/**
 * WhatsApp webhook receive logic — Fase 1.4b2
 *
 * Toda la logica del POST handler de src/app/api/webhooks/whatsapp/route.ts
 * fue extraida aqui. El endpoint route.ts ahora es un thin wrapper que delega
 * a este modulo via WhatsAppChannelHandler.
 *
 * Refactor mecanico — zero behavior change. Si algo aqui cambia respecto al
 * route.ts original, es un bug. El smoke test E&Z post-deploy es el filtro.
 */

import * as crypto from 'crypto';
import { waitUntil } from '@vercel/functions';
import type { Prisma } from '@prisma/client';
import {
  LeadChannel,
  LeadType,
  LeadStatus,
  LeadTemperature,
  LeadSource,
  HandoffMode,
  MessageSender,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto/secrets';
import { getProjectSecret } from '@/lib/actions/secrets';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRedis } from '@/lib/redis';
import { notifyProjectMembers } from '@/lib/actions/notifications';
import { processAIResponse } from '@/lib/ai/process-ai-response';
import { downloadAndStoreMedia } from './download-media';
import { getActiveGlobalRules } from '@/lib/actions/global-rules';
import { DEFAULT_AGENT_NAME } from '@/lib/knowledge/prompt-builder';
import type { PromptStructure } from '@/lib/knowledge/prompt-builder';
import type { FormConfig } from '@/lib/types/form-template';
import { getAutoAssignUserId } from '@/lib/auto-assign';

// ============================================
// In-Memory Cache for phoneNumberId → Project
// TTL: 5 minutes (300000ms)
// ============================================

interface CachedProject {
  project: { id: string; name: string } | null;
  appSecret: string | null;
  timestamp: number;
}

interface ProjectLookupResult {
  project: { id: string; name: string } | null;
  appSecret: string | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_PHONE_CACHE_SIZE = 500;
const phoneNumberIdCache = new Map<string, CachedProject>();

function getCachedProject(phoneNumberId: string): ProjectLookupResult | undefined {
  const cached = phoneNumberIdCache.get(phoneNumberId);
  if (!cached) return undefined;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    phoneNumberIdCache.delete(phoneNumberId);
    return undefined;
  }
  return { project: cached.project, appSecret: cached.appSecret };
}

function setCachedProject(phoneNumberId: string, project: { id: string; name: string } | null, appSecret: string | null = null): void {
  if (phoneNumberIdCache.size >= MAX_PHONE_CACHE_SIZE) {
    const now = Date.now();
    for (const [k, v] of phoneNumberIdCache.entries()) {
      if (now - v.timestamp > CACHE_TTL_MS) phoneNumberIdCache.delete(k);
    }
    if (phoneNumberIdCache.size >= MAX_PHONE_CACHE_SIZE) {
      const oldestKey = phoneNumberIdCache.keys().next().value;
      if (oldestKey) phoneNumberIdCache.delete(oldestKey);
    }
  }

  phoneNumberIdCache.set(phoneNumberId, {
    project,
    appSecret,
    timestamp: Date.now(),
  });
}

export function invalidatePhoneNumberCache(phoneNumberId?: string): void {
  if (phoneNumberId) {
    phoneNumberIdCache.delete(phoneNumberId);
  } else {
    phoneNumberIdCache.clear();
  }
}

// ============================================
// Types: WhatsApp Cloud API Webhook payloads
// https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
// ============================================

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppEntry[];
}

interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

interface WhatsAppChange {
  value: WhatsAppValue;
  field: 'messages';
}

interface WhatsAppValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contacts' | 'button' | 'interactive';
  text?: { body: string };
  image?: WhatsAppMedia;
  audio?: WhatsAppMedia;
  video?: WhatsAppMedia;
  document?: WhatsAppMedia & { filename?: string };
  sticker?: WhatsAppMedia;
  referral?: WhatsAppReferral;
}

interface WhatsAppReferral {
  source_url: string;
  source_type: string;
  source_id: string;
  headline?: string;
  body?: string;
}

interface WhatsAppMedia {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
}

interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

// ============================================
// HMAC Signature Verification
// ============================================

function verifyHmacSignature(rawBody: string, signature: string | null, appSecret: string): boolean {
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Valida la firma HMAC del webhook con per-project app_secret first,
 * fallback a WHATSAPP_APP_SECRET global solo si no hay per-project.
 *
 * Si un per-project secret existe pero falla, NO hace fallback a global
 * (security: prevents global secret from bypassing per-project verification).
 *
 * Retorna true si la firma es valida, false si no.
 */
export async function validateWhatsAppWebhookSignature(
  rawBody: string,
  headers: Headers
): Promise<boolean> {
  const isDev = process.env.NODE_ENV === 'development';
  const bypassSignature = process.env.WEBHOOK_BYPASS_SIGNATURE === 'true';

  if (isDev && bypassSignature) {
    console.warn('[WhatsApp Webhook] DEV MODE: Signature verification bypassed');
    return true;
  }

  const signature = headers.get('X-Hub-Signature-256');

  // Parse payload to extract phone_number_ids
  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const phoneNumberIds = new Set<string>();
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field === 'messages' && change.value?.metadata?.phone_number_id) {
        phoneNumberIds.add(change.value.metadata.phone_number_id);
      }
    }
  }

  // Try per-project App Secret first
  if (phoneNumberIds.size > 0) {
    for (const phoneNumberId of phoneNumberIds) {
      const result = await findProjectByPhoneNumberId(phoneNumberId);
      if (result.appSecret) {
        if (verifyHmacSignature(rawBody, signature, result.appSecret)) {
          console.log('[WhatsApp Webhook] Signature verified with per-project App Secret');
          return true;
        }
        // Per-project secret exists but HMAC failed -> do NOT fallback to global
        console.warn('[WhatsApp Webhook] Per-project App Secret HMAC failed, rejecting');
        return false;
      }
    }
  }

  // Fallback to global App Secret ONLY if no per-project secret was found
  const globalAppSecret = process.env.WHATSAPP_APP_SECRET;
  if (!globalAppSecret) {
    console.error('[WhatsApp Webhook] No App Secret configured (neither per-project nor global)');
    return false;
  }

  if (verifyHmacSignature(rawBody, signature, globalAppSecret)) {
    console.log('[WhatsApp Webhook] Signature verified with global WHATSAPP_APP_SECRET');
    return true;
  }

  console.warn('[WhatsApp Webhook] Invalid signature - possible spoofing attempt', {
    hasSignature: !!signature,
    timestamp: new Date().toISOString(),
  });
  return false;
}

// ============================================
// Find Project by Phone Number ID (with cache)
// ============================================

async function findProjectByPhoneNumberId(phoneNumberId: string): Promise<ProjectLookupResult> {
  const cachedResult = getCachedProject(phoneNumberId);
  if (cachedResult !== undefined) {
    if (cachedResult.project) {
      console.log(`[CACHE HIT] phone_number_id: ${phoneNumberId} -> ${cachedResult.project.name}`);
    } else {
      console.log(`[CACHE HIT] (no project) for phone_number_id: ${phoneNumberId}`);
    }
    return cachedResult;
  }

  console.log(`[CACHE MISS] Looking for project with phone_number_id: ${phoneNumberId}`);

  const secrets = await prisma.projectSecret.findMany({
    where: { key: 'whatsapp_phone_number_id' },
    include: { project: { select: { id: true, name: true } } },
  });

  for (const secret of secrets) {
    try {
      const decryptedPhoneNumberId = decryptSecret({
        encryptedValue: secret.encryptedValue,
        iv: secret.iv,
        authTag: secret.authTag,
      });

      if (decryptedPhoneNumberId === phoneNumberId) {
        console.log(`[OK] Found project: ${secret.projectId.substring(0, 8)}...`);

        let projectAppSecret: string | null = null;
        try {
          projectAppSecret = await getProjectSecret(secret.projectId, 'whatsapp_app_secret');
        } catch {
          // No app secret configured - will use global fallback
        }

        setCachedProject(phoneNumberId, secret.project, projectAppSecret);
        return { project: secret.project, appSecret: projectAppSecret };
      }
    } catch (error) {
      console.error(`Error decrypting secret for project ${secret.projectId.substring(0, 8)}...:`, error);
    }
  }

  // Fallback only in development with explicit opt-in
  if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_WEBHOOK_FALLBACK === 'true') {
    console.warn('[DEV] No matching project found, using fallback (ALLOW_WEBHOOK_FALLBACK=true)');
    const fallbackProject = await prisma.project.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
    });
    setCachedProject(phoneNumberId, fallbackProject, null);
    return { project: fallbackProject, appSecret: null };
  }

  console.warn(`No matching project for phoneNumberId: ${phoneNumberId.substring(0, 6)}...`);
  setCachedProject(phoneNumberId, null, null);
  return { project: null, appSecret: null };
}

// ============================================
// Send Read Receipt + Typing Indicator
// ============================================

async function sendReadReceipt(projectId: string, messageId: string): Promise<void> {
  try {
    const [accessToken, phoneNumberId] = await Promise.all([
      getProjectSecret(projectId, 'whatsapp_access_token'),
      getProjectSecret(projectId, 'whatsapp_phone_number_id'),
    ]);

    if (!accessToken || !phoneNumberId) {
      console.log('WhatsApp credentials not configured, skipping read receipt');
      return;
    }

    const whatsappApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        typing_indicator: { type: 'text' },
      }),
    });

    if (response.ok) {
      console.log(`Read receipt + typing indicator sent for: ${messageId}`);
    } else {
      const errorData = await response.json();
      console.error(`Failed to send read receipt:`, errorData);
    }
  } catch (error) {
    console.error('Error sending read receipt:', error);
  }
}

// ============================================
// Sanitize Contact Name
// ============================================

function sanitizeContactName(raw: string, phoneNumber: string): string {
  const cleaned = raw
    .normalize('NFC')
    .replace(/[\u{10000}-\u{10FFFF}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    .replace(/[&<>"']/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 100);

  return cleaned || `+${phoneNumber}`;
}

// ============================================
// Detect Lead Source
// ============================================

function detectLeadSource(message: WhatsAppMessage): LeadSource {
  if (message.referral) {
    console.log('[Source Detection] Meta referral data:', JSON.stringify(message.referral));
    const url = (message.referral.source_url || '').toLowerCase();
    const detected = url.includes('instagram') ? LeadSource.instagram_ads : LeadSource.facebook_ads;
    console.log(`[Source Detection] source_url="${url}" → ${detected}`);
    return detected;
  }

  const text = (message.text?.body || '').toLowerCase();
  if (text.includes('#tiktokads') || text.includes('tiktokads')) return LeadSource.tiktok_ads;
  if (text.includes('#tiktok')) return LeadSource.tiktok_organic;
  if (text.includes('#googleads')) return LeadSource.google_ads;
  if (text.includes('#facebookads')) return LeadSource.facebook_ads;
  if (text.includes('#facebook')) return LeadSource.facebook_organic;
  if (text.includes('#instagramads')) return LeadSource.instagram_ads;
  if (text.includes('#instagram')) return LeadSource.instagram_organic;

  return LeadSource.other;
}

// ============================================
// Handle Incoming Message
// ============================================

async function handleIncomingMessage(
  projectId: string,
  message: WhatsAppMessage,
  contact?: WhatsAppContact
) {
  const whatsappId = message.from;
  const contactName = sanitizeContactName(contact?.profile?.name || '', whatsappId);

  // === DEDUP: Skip if message already processed ===
  if (message.id) {
    const existingMessage = await prisma.message.findFirst({
      where: { whatsappMsgId: message.id },
      select: { id: true },
    });

    if (existingMessage) {
      console.log(`[DEDUP] Message ${message.id} already processed, skipping`);
      return;
    }
  }

  // Extract message content based on type
  let content = '';
  const metadata: Record<string, unknown> = {
    messageType: message.type,
    whatsappMsgId: message.id,
  };

  switch (message.type) {
    case 'text':
      content = (message.text?.body || '').slice(0, 4096);
      break;
    case 'image':
      content = (message.image?.caption || '[Imagen recibida]').slice(0, 2048);
      metadata.mediaId = message.image?.id;
      metadata.mimeType = message.image?.mime_type;
      break;
    case 'audio':
      content = '[Audio recibido]';
      metadata.mediaId = message.audio?.id;
      metadata.mimeType = message.audio?.mime_type;
      break;
    case 'video':
      content = (message.video?.caption || '[Video recibido]').slice(0, 2048);
      metadata.mediaId = message.video?.id;
      metadata.mimeType = message.video?.mime_type;
      break;
    case 'document':
      content = `[Documento: ${(message.document?.filename || 'archivo').slice(0, 255)}]`;
      metadata.mediaId = message.document?.id;
      metadata.mimeType = message.document?.mime_type;
      metadata.filename = message.document?.filename;
      break;
    case 'sticker':
      content = '[Sticker recibido]';
      metadata.mediaId = message.sticker?.id;
      metadata.mimeType = message.sticker?.mime_type;
      break;
    default:
      content = `[Mensaje tipo: ${message.type}]`;
  }

  // Find or create lead
  let lead = await prisma.lead.findFirst({
    where: { projectId, whatsappId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      whatsappId: true,
      summary: true,
      handoffMode: true,
      archivedAt: true,
      conversation: true,
      assignedAgent: {
        select: { id: true, name: true, systemInstructions: true, promptStructure: true, formConfig: true },
      },
      assignedUser: {
        select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true },
      },
    },
  });

  if (!lead) {
    const nameParts = contactName.split(' ').filter(Boolean);
    const firstName = nameParts[0] || 'Sin nombre';
    const lastName = nameParts.slice(1).join(' ') || '';

    const defaultAgent = await prisma.aIAgent.findFirst({
      where: { projectId, isActive: true },
      select: { id: true, name: true, systemInstructions: true, promptStructure: true, formConfig: true },
      orderBy: { createdAt: 'asc' },
    });

    const detectedSource = detectLeadSource(message);
    const autoAssignedUserId = await getAutoAssignUserId(projectId);

    lead = await prisma.lead.create({
      data: {
        projectId,
        firstName,
        lastName,
        phone: `+${whatsappId}`,
        whatsappId,
        channel: LeadChannel.whatsapp,
        source: detectedSource,
        type: LeadType.ai_agent,
        status: LeadStatus.new,
        temperature: LeadTemperature.cold,
        handoffMode: HandoffMode.ai,
        lastContactAt: new Date(),
        assignedAgentId: defaultAgent?.id || null,
        assignedUserId: autoAssignedUserId,
        conversation: {
          create: {
            messages: {
              create: {
                sender: MessageSender.lead,
                content,
                whatsappMsgId: message.id,
                metadata: metadata as Prisma.InputJsonValue,
              },
            },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        whatsappId: true,
        summary: true,
        handoffMode: true,
        archivedAt: true,
        conversation: true,
        assignedAgent: {
          select: { id: true, name: true, systemInstructions: true, promptStructure: true, formConfig: true },
        },
        assignedUser: {
          select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true },
        },
      },
    });

    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: 'lead_created',
        description: 'Lead creado desde WhatsApp',
        metadata: { source: detectedSource, channel: 'whatsapp', ...(message.referral ? { adId: message.referral.source_id, adHeadline: message.referral.headline } : {}) },
      },
    });

    console.log(`[OK] New lead created: ${lead.id.substring(0, 8)}... (source: ${detectedSource}${autoAssignedUserId ? `, auto-assigned: ${autoAssignedUserId.substring(0, 8)}...` : ''})`);

    if (metadata.mediaId && lead.conversation?.id) {
      waitUntil(
        downloadAndStoreMedia({
          mediaId: String(metadata.mediaId),
          mimeType: String(metadata.mimeType || ''),
          projectId,
          whatsappMsgId: message.id,
          conversationId: lead.conversation.id,
          messageType: message.type,
        }).catch((err) => console.error('[Media Download] Error:', err))
      );
    }
  } else {
    let conversationId = lead.conversation?.id;

    if (!conversationId) {
      const conversation = await prisma.conversation.create({
        data: { leadId: lead.id },
      });
      conversationId = conversation.id;
    }

    if (!lead.assignedAgent) {
      const messageCreatePromise = prisma.message.create({
        data: {
          conversationId,
          sender: MessageSender.lead,
          content,
          whatsappMsgId: message.id,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });

      const defaultAgent = await prisma.aIAgent.findFirst({
        where: { projectId, isActive: true },
        select: { id: true, name: true, systemInstructions: true, promptStructure: true, formConfig: true },
        orderBy: { createdAt: 'asc' },
      });

      if (defaultAgent) {
        await Promise.all([
          messageCreatePromise,
          prisma.lead.update({
            where: { id: lead.id },
            data: { lastContactAt: new Date(), assignedAgentId: defaultAgent.id },
          }),
        ]);
        lead.assignedAgent = defaultAgent;
        console.log(`[OK] Assigned agent ${defaultAgent.name} to existing lead: ${lead.id}`);
      } else {
        await Promise.all([
          messageCreatePromise,
          prisma.lead.update({
            where: { id: lead.id },
            data: { lastContactAt: new Date() },
          }),
        ]);
      }
    } else {
      await Promise.all([
        prisma.message.create({
          data: {
            conversationId,
            sender: MessageSender.lead,
            content,
            whatsappMsgId: message.id,
            metadata: metadata as Prisma.InputJsonValue,
          },
        }),
        prisma.lead.update({
          where: { id: lead.id },
          data: { lastContactAt: new Date() },
        }),
      ]);
    }

    console.log(`[OK] Message added to lead: ${lead.id.substring(0, 8)}...`);

    if (metadata.mediaId && conversationId) {
      waitUntil(
        downloadAndStoreMedia({
          mediaId: String(metadata.mediaId),
          mimeType: String(metadata.mimeType || ''),
          projectId,
          whatsappMsgId: message.id,
          conversationId,
          messageType: message.type,
        }).catch((err) => console.error('[Media Download] Error:', err))
      );
    }
  }

  // Discarded leads: save message (above) but skip notifications and AI
  if (lead.archivedAt) {
    console.log(`[SKIP] Lead ${lead.id.substring(0, 8)}... is discarded — no notifications or AI`);
    return;
  }

  // Background: notify project members about new message
  const leadName = lead.firstName || contactName;
  if (lead.handoffMode === HandoffMode.human) {
    waitUntil(
      prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true, name: true },
      }).then((project) => {
        if (project) {
          return notifyProjectMembers({
            projectId,
            organizationId: project.organizationId,
            type: 'new_message',
            title: `Nuevo mensaje de ${leadName}`,
            message: content.substring(0, 100),
            metadata: { leadId: lead.id },
            source: 'webhook',
            leadName,
            projectName: project.name,
          });
        }
      }).catch((err) => console.error('Notification error:', err))
    );
  }

  // Send read receipt
  waitUntil(
    sendReadReceipt(projectId, message.id).catch((err) =>
      console.error('Read receipt error:', err)
    )
  );

  // Process AI response internally if handoffMode is 'ai'
  if (lead.handoffMode === HandoffMode.ai) {
    const aiRateLimit = await checkRateLimit(`ai:pipeline:${projectId}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });

    if (!aiRateLimit.success) {
      console.warn(`[WhatsApp Webhook] AI pipeline rate limit for project ${projectId.substring(0, 8)}...`);
      return;
    }

    const mediaId = (metadata.mediaId as string) || null;

    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let totalMessageCount = 1;

    if (lead.conversation?.id) {
      const [messageCount, recentMessages] = await Promise.all([
        prisma.message.count({ where: { conversationId: lead.conversation.id } }),
        prisma.message.findMany({
          where: { conversationId: lead.conversation.id },
          orderBy: { createdAt: 'desc' },
          take: 9,
          select: { content: true, sender: true },
        }),
      ]);

      totalMessageCount = messageCount;
      conversationHistory = recentMessages
        .slice(1)
        .reverse()
        .map((msg) => ({
          role: msg.sender === 'lead' ? 'user' as const : 'assistant' as const,
          content: msg.content,
        }));
    }

    const [project, globalRules] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, organizationId: true, organization: { select: { defaultTimezone: true } } },
      }),
      getActiveGlobalRules(),
    ]);

    // Debounce: wait 5s to accumulate rapid messages before AI responds
    const redis = await getRedis();
    const debounceKey = `debounce:ai:${lead.id}`;
    let shouldProcess = true;

    if (redis) {
      try {
        const result = await redis.set(debounceKey, '1', { nx: true, ex: 5 });
        shouldProcess = result === 'OK';
      } catch (err) {
        console.error('[Debounce] Redis error, processing immediately:', err);
      }
    }

    if (shouldProcess) {
      const leadFullName = `${lead.firstName} ${lead.lastName || ''}`.trim();
      const agentId = lead.assignedAgent?.id || null;
      const agentName = (lead.assignedAgent?.promptStructure as PromptStructure | null)?.agentName?.trim() || DEFAULT_AGENT_NAME;
      const systemInstructions = lead.assignedAgent?.systemInstructions || null;
      const agentFormConfig = lead.assignedAgent?.formConfig as FormConfig | null;
      const conversationId = lead.conversation?.id || '';
      const organizationId = project?.organizationId || '';
      const companyName = project?.name || 'KAIRO';
      const orgTimezone = project?.organization?.defaultTimezone || null;
      const leadSummary = lead.summary || null;

      waitUntil(
        (async () => {
          try {
            if (redis) {
              await new Promise(resolve => setTimeout(resolve, 5000));
            }

            let freshHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
            let freshMessageCount = totalMessageCount;
            let concatenatedMessage = content;
            let freshMediaId: string | null = mediaId;
            let freshMessageType: string = message.type;

            if (conversationId) {
              const [msgCount, recentMsgs] = await Promise.all([
                prisma.message.count({ where: { conversationId } }),
                prisma.message.findMany({
                  where: { conversationId },
                  orderBy: { createdAt: 'desc' },
                  take: 12,
                  select: { content: true, sender: true, metadata: true },
                }),
              ]);

              freshMessageCount = msgCount;

              const chronological = [...recentMsgs].reverse();
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

              for (let i = chronological.length - 1; i >= 0; i--) {
                if (chronological[i].sender !== 'lead') break;
                const meta = chronological[i].metadata as Record<string, unknown> | null;
                if ((meta?.messageType === 'image' || meta?.messageType === 'sticker') && meta?.mediaId) {
                  freshMediaId = String(meta.mediaId);
                  freshMessageType = String(meta.messageType);
                  break;
                }
              }

              const historyMsgs = chronological.slice(0, chronological.length - pendingLeadMsgs.length);
              freshHistory = historyMsgs.map(msg => ({
                role: msg.sender === 'lead' ? 'user' as const : 'assistant' as const,
                content: msg.content,
              }));
            }

            await processAIResponse({
              projectId,
              organizationId,
              conversationId,
              leadId: lead.id,
              leadName: leadFullName,
              leadPhone: lead.phone,
              whatsappId: lead.whatsappId || null,
              message: concatenatedMessage,
              messageType: freshMessageType,
              mediaId: freshMediaId,
              agentId,
              agentName,
              globalRules,
              systemInstructions,
              companyName,
              conversationHistory: freshHistory,
              historyCount: freshHistory.length,
              messageCount: freshMessageCount,
              summaryThreshold: 5,
              leadSummary,
              timezone: orgTimezone || undefined,
              formConfig: agentFormConfig,
              assignedUser: lead.assignedUser || undefined,
            });
          } catch (err) {
            console.error('[WhatsApp Webhook] AI pipeline error:', err);
          }
        })()
      );
    }
  }
}

// ============================================
// Handle Status Update
// ============================================

async function handleStatusUpdate(projectId: string, status: WhatsAppStatus) {
  const message = await prisma.message.findFirst({
    where: { whatsappMsgId: status.id },
  });

  if (!message) {
    console.log(`[WhatsApp Webhook] Message not found for status update - will be updated on next event`);
    return;
  }

  console.log(`[FOUND] Message ${message.id.substring(0, 8)}... status: ${status.status}`);

  const now = new Date();
  const existingMetadata = (message.metadata as Record<string, unknown>) || {};

  const newMetadata: Prisma.InputJsonValue = {
    ...existingMetadata,
    deliveryStatus: status.status,
    statusTimestamp: status.timestamp,
  };

  const updateData: Prisma.MessageUpdateInput = { metadata: newMetadata };

  if (status.status === 'delivered') {
    updateData.isDelivered = true;
    updateData.deliveredAt = now;
    console.log(`[DELIVERED] Message: ${status.id}`);
  }

  if (status.status === 'read') {
    updateData.isDelivered = true;
    updateData.deliveredAt = message.deliveredAt || now;
    updateData.isRead = true;
    updateData.readAt = now;
    console.log(`[READ] Message: ${status.id}`);
  }

  await prisma.message.update({
    where: { id: message.id },
    data: updateData,
  });

  console.log(`[OK] Message ${status.id} status updated: ${status.status}`);
}

// ============================================
// Process Messages Change (per entry change)
// ============================================

async function processMessagesChange(value: WhatsAppValue, _businessAccountId: string) {
  const { metadata, contacts, messages, statuses } = value;
  const phoneNumberId = metadata.phone_number_id;

  const result = await findProjectByPhoneNumberId(phoneNumberId);
  const project = result.project;

  if (!project) {
    console.warn(`No project found for phone_number_id: ${phoneNumberId}`);
    return;
  }

  if (messages && contacts) {
    for (const message of messages) {
      const contact = contacts.find((c) => c.wa_id === message.from);
      await handleIncomingMessage(project.id, message, contact);
    }
  }

  if (statuses) {
    for (const status of statuses) {
      waitUntil(
        handleStatusUpdate(project.id, status).catch((err) =>
          console.error('[WhatsApp Webhook] Status update error:', err)
        )
      );
    }
  }
}

// ============================================
// Entry point: process a verified WhatsApp webhook payload
// Called by WhatsAppChannelHandler.receive()
// ============================================

export async function processWhatsAppWebhookPayload(payload: WhatsAppWebhookPayload): Promise<void> {
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field === 'messages') {
        await processMessagesChange(change.value, entry.id);
      }
    }
  }
}
