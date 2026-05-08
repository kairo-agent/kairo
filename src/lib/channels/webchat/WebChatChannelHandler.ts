/**
 * WebChatChannelHandler — Implementacion de IChannelHandler para WebChat (widget embebible)
 *
 * Plan multi-canal: docs/plans/MULTI-CHANNEL-IMPL.md Fase 3.6
 *
 * - receive(): aplica debounce Redis 5s + concatenacion de mensajes pendientes
 *   + processAIResponse(). El message AI queda persistido en BD para que el
 *   widget lo recoja via polling (/api/webchat/messages).
 * - send(): para webchat el delivery es via persistencia en BD (el widget
 *   hace polling). En Fase 4 se agregara broadcast Realtime.
 *
 * El webhook /api/webhooks/webchat/route.ts persiste el Lead/Conversation/
 * Message stub ANTES de invocar este handler. El handler recibe los IDs y
 * solo se encarga del pipeline AI con debounce.
 *
 * Diferencia clave con WhatsApp: NO se envia a transporte externo. Pasamos
 * `externalUserId: null` y `leadPhone: null` a processAIResponse para que
 * el bloque "Step 8 Send to WhatsApp" sea skipeado (line 569-573 del pipeline).
 */

import type { Lead } from '@prisma/client';
import { LeadChannel } from '@prisma/client';
import { waitUntil } from '@vercel/functions';
import type {
  IChannelHandler,
  ChannelMessageOutbound,
  ChannelSendResult,
} from '../IChannelHandler';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { processAIResponse } from '@/lib/ai/process-ai-response';
import { getActiveGlobalRules } from '@/lib/actions/global-rules';
import { DEFAULT_AGENT_NAME } from '@/lib/knowledge/prompt-builder';
import type { PromptStructure } from '@/lib/knowledge/prompt-builder';
import type { FormConfig } from '@/lib/types/form-template';
import { emitWebChatSignal } from './realtime-emit';

// ============================================================
// Payload type — lo que el webhook /api/webhooks/webchat envia al handler
// ============================================================

export interface WebChatReceivePayload {
  leadId: string;
  conversationId: string;
  messageId: string;
  visitorId: string;
  sessionId?: string | null;
  type: 'text' | 'image' | 'audio' | 'document';
  text?: string;
  mediaUrl?: string | null;
}

const DEBOUNCE_SECONDS = 5;
const HISTORY_LIMIT = 12;
const SUMMARY_THRESHOLD = 20;

// ============================================================
// Handler
// ============================================================

export class WebChatChannelHandler implements IChannelHandler {
  readonly channel = LeadChannel.webchat;

  async receive(projectId: string, payload: unknown): Promise<void> {
    if (!isWebChatReceivePayload(payload)) {
      console.warn('[WebChatChannelHandler.receive] Invalid payload shape');
      return;
    }

    const { leadId, conversationId, type, text, mediaUrl } = payload;

    // Solo procesar si el lead esta en modo AI (no en handoff humano)
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        assignedAgent: {
          select: {
            id: true,
            systemInstructions: true,
            promptStructure: true,
            formConfig: true,
          },
        },
        // Conversation -> realtimeTopicSecret needed by processAIResponse
        // to emit a Realtime "new message" signal after persisting the AI reply.
        conversation: {
          select: { realtimeTopicSecret: true },
        },
      },
    });

    if (!lead) {
      console.warn('[WebChatChannelHandler.receive] Lead not found', { leadId });
      return;
    }

    if (lead.handoffMode === 'human' || lead.archivedAt) {
      // En handoff humano o lead descartado: solo guardar mensaje, no AI.
      // (El message ya fue persistido por el webhook.)
      return;
    }

    // Debounce: NX 5s. Si ya hay otra request en debounce, esta retorna.
    const redis = await getRedis();
    const debounceKey = `debounce:ai:${lead.id}`;
    let shouldProcess = true;

    if (redis) {
      try {
        const result = await redis.set(debounceKey, '1', { nx: true, ex: DEBOUNCE_SECONDS });
        shouldProcess = result === 'OK';
      } catch (err) {
        console.error('[WebChatChannelHandler.receive] Redis debounce error:', err);
      }
    }

    if (!shouldProcess) {
      // Otra request ya esta esperando el debounce; esa va a concatenar mensajes.
      return;
    }

    // Cargar contexto del proyecto + global rules en paralelo
    const [project, globalRules] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: {
          name: true,
          organizationId: true,
          organization: { select: { defaultTimezone: true } },
        },
      }),
      getActiveGlobalRules(),
    ]);

    const leadFullName = `${lead.firstName} ${lead.lastName || ''}`.trim();
    const agentId = lead.assignedAgent?.id || null;
    const agentName =
      (lead.assignedAgent?.promptStructure as PromptStructure | null)?.agentName?.trim() ||
      DEFAULT_AGENT_NAME;
    const systemInstructions = lead.assignedAgent?.systemInstructions || null;
    const agentFormConfig = lead.assignedAgent?.formConfig as FormConfig | null;
    const organizationId = project?.organizationId || '';
    const companyName = project?.name || 'KAIRO';
    const orgTimezone = project?.organization?.defaultTimezone || null;
    const leadSummary = lead.summary || null;
    const realtimeTopicSecret = lead.conversation?.realtimeTopicSecret ?? null;

    // Fire-and-forget: esperar el debounce + concatenar pendientes + correr pipeline.
    waitUntil(
      (async () => {
        try {
          // Esperar el resto del debounce window
          if (redis) {
            await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_SECONDS * 1000));
          }

          // Releer mensajes recientes para concatenar pendientes y armar history
          let concatenatedMessage = text || `[${type}] ${mediaUrl ?? ''}`;
          let freshMessageCount = 1;
          let freshHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

          if (conversationId) {
            const [msgCount, recentMsgs] = await Promise.all([
              prisma.message.count({ where: { conversationId } }),
              prisma.message.findMany({
                where: { conversationId },
                orderBy: { createdAt: 'desc' },
                take: HISTORY_LIMIT,
                select: { content: true, sender: true },
              }),
            ]);

            freshMessageCount = msgCount;
            const chronological = [...recentMsgs].reverse();

            // Concatenar mensajes pendientes del lead (los ultimos consecutivos)
            const pendingLeadMsgs: string[] = [];
            for (let i = chronological.length - 1; i >= 0; i--) {
              if (chronological[i].sender === 'lead') {
                pendingLeadMsgs.unshift(chronological[i].content);
              } else {
                break;
              }
            }

            if (pendingLeadMsgs.length > 1) {
              concatenatedMessage = pendingLeadMsgs.join('\n');
            } else if (pendingLeadMsgs.length === 1) {
              concatenatedMessage = pendingLeadMsgs[0];
            }

            // History: todo excepto los pendientes del lead
            const historyMsgs = chronological.slice(0, chronological.length - pendingLeadMsgs.length);
            freshHistory = historyMsgs.map((msg) => ({
              role: msg.sender === 'lead' ? ('user' as const) : ('assistant' as const),
              content: msg.content,
            }));
          }

          // Llamar processAIResponse con externalUserId=null y leadPhone=null
          // para que el bloque WhatsApp send sea skipeado. El AI message se persiste
          // en BD por el pipeline (paso db_save antes del send) y el widget lo recibe
          // via polling /api/webchat/messages.
          await processAIResponse({
            projectId,
            organizationId,
            conversationId,
            leadId: lead.id,
            leadName: leadFullName,
            leadPhone: null,
            externalUserId: null,
            message: concatenatedMessage,
            messageType: type,
            mediaId: null, // webchat does NOT use WhatsApp's mediaId — see webchatMediaUrl below
            agentId,
            agentName,
            globalRules,
            systemInstructions,
            companyName,
            conversationHistory: freshHistory,
            historyCount: freshHistory.length,
            messageCount: freshMessageCount,
            summaryThreshold: SUMMARY_THRESHOLD,
            leadSummary,
            timezone: orgTimezone || undefined,
            formConfig: agentFormConfig,
            // Fase 4.A: webchat-only Realtime signal. Pipeline emits broadcast
            // after persisting AI message so the widget refreshes via polling
            // endpoint (signal-only model). No-op for WhatsApp (param undefined).
            webchatTopicSecret: realtimeTopicSecret,
            // Fase 4.D.1: webchat image URL (Supabase Storage public URL)
            // forwarded to processAIResponse so GPT-4o Vision can read it.
            webchatMediaUrl: mediaUrl ?? null,
          });
        } catch (err) {
          console.error('[WebChatChannelHandler.receive] Pipeline error:', err);
        }
      })()
    );
  }

  /**
   * Para webchat el delivery del mensaje es via persistencia en BD: el widget
   * hace polling y lo recibe. En Fase 4 se agrega broadcast Realtime.
   *
   * processAIResponse() ya persiste el AI message internamente (paso db_save),
   * por lo que este send() rara vez se llama desde el pipeline AI. Sirve para
   * mensajes de asesor manual desde el dashboard (handoff humano).
   */
  async send(
    _projectId: string,
    lead: Lead,
    message: ChannelMessageOutbound
  ): Promise<ChannelSendResult> {
    if (!message.text && !message.mediaUrl) {
      return { success: false, error: 'Empty message: neither text nor media provided' };
    }

    // Buscar la conversacion del lead
    const conversation = await prisma.conversation.findUnique({
      where: { leadId: lead.id },
      select: { id: true, realtimeTopicSecret: true },
    });

    if (!conversation) {
      return { success: false, error: 'Conversation not found for lead' };
    }

    const content = message.text || message.caption || `[${message.mediaType}]`;

    const persisted = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: 'human',
        content,
        metadata: {
          channel: 'webchat',
          mediaUrl: message.mediaUrl ?? undefined,
          mediaType: message.mediaType ?? undefined,
          caption: message.caption ?? undefined,
        },
      },
      select: { id: true },
    });

    // Fase 4.A: Realtime signal — best-effort, never blocks delivery.
    // Widget receives the signal and refreshes via the authenticated polling
    // endpoint. If the broadcast fails (network, Supabase down), the widget's
    // 30s polling fallback ensures eventual consistency. waitUntil keeps the
    // 2.5s timeout off the request path on Vercel.
    waitUntil(emitWebChatSignal(conversation.realtimeTopicSecret));

    return { success: true, externalMessageId: persisted.id };
  }
}

// ============================================================
// Type guard
// ============================================================

function isWebChatReceivePayload(payload: unknown): payload is WebChatReceivePayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.leadId === 'string' &&
    typeof p.conversationId === 'string' &&
    typeof p.messageId === 'string' &&
    typeof p.visitorId === 'string' &&
    typeof p.type === 'string' &&
    ['text', 'image', 'audio', 'document'].includes(p.type as string)
  );
}

// ============================================================
// Singleton para registry
// ============================================================

export const webchatChannelHandler = new WebChatChannelHandler();
