/**
 * KAIRO - Internal AI Pipeline
 *
 * Procesa mensajes entrantes de leads con RAG + OpenAI y envia respuestas
 * via WhatsApp. Todo corre dentro de KAIRO (sin orquestador externo).
 *
 * Pipeline: Audio Transcription (if needed) → RAG Search → OpenAI Chat → Save + Send
 *
 * @see docs/RAG-AGENTS.md for architecture details
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { HandoffMode } from '@prisma/client';
import { getProjectSecret } from '@/lib/actions/secrets';
import { generateEmbedding, formatEmbeddingForPg } from '@/lib/openai/embeddings';
import { createClient } from '@/lib/supabase/server';
import { buildSystemPrompt, SystemPromptParams } from './build-system-prompt';
import { notifyProjectMembers } from '@/lib/actions/notifications';
import type { FormConfig } from '@/lib/types/form-template';
import { getLeadFormData, bulkUpdateLeadFormFields } from '@/lib/actions/lead-form-data';
import { sendToWhatsApp, sendTextToWhatsApp, sendImageToWhatsApp, sendVideoToWhatsApp } from '@/lib/channels/whatsapp/send';
import { getEffectiveTimezone } from '@/lib/timezone';
import { projectHasMedia, searchRelevantMedia, searchRelevantVideos, getFixedMediaForEvent } from './search-media';
import type { MediaSearchResult } from '@/lib/types/agent-media';

// ============================================
// Types
// ============================================

export interface AIProcessParams {
  projectId: string;
  organizationId: string;
  conversationId: string;
  leadId: string;
  leadName: string;
  leadPhone: string | null;
  /**
   * Identificador externo del usuario en el canal de origen.
   * - WhatsApp: numero de telefono (igual a Lead.whatsappId / Lead.externalId)
   * - WebChat: visitorId del browser (Fase 3)
   * - Otros canales: ID en la plataforma origen
   *
   * Usado para enviar mensajes salientes en canales WhatsApp (line 562).
   * En canales que NO necesitan transporte aqui (webchat, future), el handler
   * del canal hace su propio delivery despues de processAIResponse.
   */
  externalUserId: string | null;
  message: string;
  messageType: string;
  mediaId: string | null;
  agentId: string | null;
  agentName: string;
  globalRules: string[];
  systemInstructions: string | null;
  companyName: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  historyCount: number;
  messageCount: number;
  summaryThreshold: number;
  leadSummary: string | null;
  timezone?: string;
  formConfig?: FormConfig | null;
  // Advisor info for personalized handoff
  assignedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatarUrl: string | null;
  };
}

interface PipelineStep {
  name: string;
  duration: number;
}

// Minimum messages required before saving a summary (defense in depth)
const SUMMARY_MIN_MESSAGES = 5;

/**
 * Check if a string looks like a real person name (not a phone number, symbols, etc.)
 * Returns false for: pure digits, phone-like strings, pure symbols/emojis, very short garbage
 */
function isValidPersonName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) return false;
  // Reject if it's mostly digits (phone numbers used as names)
  if (/^\+?\d[\d\s\-()]+$/.test(trimmed)) return false;
  // Reject if it has no letters at all
  if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑàèìòùâêîôûäëïöü]/i.test(trimmed)) return false;
  // Reject if more than 50% non-letter characters (symbols, emojis)
  const letterCount = (trimmed.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑàèìòùâêîôûäëïöü]/g) || []).length;
  if (letterCount / trimmed.length < 0.5) return false;
  return true;
}

// ============================================
// OpenAI Client Cache (reuses pattern from embeddings.ts)
// ============================================

import * as crypto from 'crypto';

interface CachedChatClient {
  client: OpenAI;
  timestamp: number;
}
const CHAT_CLIENT_TTL = 5 * 60 * 1000;
const chatClientCache = new Map<string, CachedChatClient>();

function getChatClient(apiKey: string): OpenAI {
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 16);
  const cached = chatClientCache.get(keyHash);

  if (cached && (Date.now() - cached.timestamp) < CHAT_CLIENT_TTL) {
    return cached.client;
  }

  if (chatClientCache.size > 20) {
    const now = Date.now();
    for (const [k, v] of chatClientCache.entries()) {
      if (now - v.timestamp > CHAT_CLIENT_TTL) chatClientCache.delete(k);
    }
  }

  const client = new OpenAI({ apiKey });
  chatClientCache.set(keyHash, { client, timestamp: Date.now() });
  return client;
}

// ============================================
// Main Pipeline
// ============================================

export async function processAIResponse(params: AIProcessParams): Promise<void> {
  const pipelineStart = Date.now();
  const steps: PipelineStep[] = [];
  const { projectId, leadId, conversationId, agentName } = params;

  try {
    // --- Step 1: Audio transcription (conditional) ---
    let userMessage = params.message;
    let imageUrl: string | null = null;

    if (params.messageType === 'audio' && params.mediaId) {
      const stepStart = Date.now();
      const transcription = await transcribeAudio(params.mediaId, projectId);
      if (transcription) {
        userMessage = transcription;
      }
      steps.push({ name: 'audio_transcribe', duration: Date.now() - stepStart });
    }

    // --- Step 1b: Image/Sticker vision - get image URL for GPT ---
    if ((params.messageType === 'image' || params.messageType === 'sticker') && params.mediaId) {
      // Try downloaded URL first (fastest)
      const imgMsg = await prisma.message.findFirst({
        where: { conversationId, metadata: { path: ['mediaId'], equals: params.mediaId } },
        select: { metadata: true },
      });
      const meta = imgMsg?.metadata as Record<string, unknown> | null;
      if (meta?.downloadedUrl) {
        imageUrl = String(meta.downloadedUrl);
      } else {
        // Fallback: get temporary URL from WhatsApp API directly
        try {
          const accessToken = await getProjectSecret(projectId, 'whatsapp_access_token');
          if (accessToken) {
            const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${params.mediaId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (mediaRes.ok) {
              const mediaInfo = await mediaRes.json();
              if (mediaInfo.url) {
                // Download image to buffer and convert to base64 data URL for GPT
                const imgRes = await fetch(mediaInfo.url, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (imgRes.ok) {
                  const buffer = await imgRes.arrayBuffer();
                  const base64 = Buffer.from(buffer).toString('base64');
                  const mime = mediaInfo.mime_type || 'image/jpeg';
                  imageUrl = `data:${mime};base64,${base64}`;
                  console.log(`[AI Pipeline] Image fetched from WhatsApp API (${buffer.byteLength} bytes)`);
                }
              }
            }
          }
        } catch (err) {
          console.error('[AI Pipeline] Failed to fetch image from WhatsApp:', err);
        }
      }
    }

    // --- Step 2: RAG search (with context-enriched query) ---
    let ragResults: Array<{ content: string; title: string | null; similarity: number }> = [];
    let mediaResults: MediaSearchResult[] = [];
    let ragQuery = '';
    if (params.agentId) {
      const stepStart = Date.now();
      ragQuery = buildRAGQuery(userMessage, params.conversationHistory);
      ragResults = await searchRAG(params.agentId, projectId, ragQuery);
      steps.push({ name: 'rag_search', duration: Date.now() - stepStart });
    }

    // --- Step 2b: Media search - images + videos (only if project has media configured) ---
    let videoResults: MediaSearchResult[] = [];
    if (params.agentId && ragQuery) {
      const stepStart = Date.now();
      const hasMedia = await projectHasMedia(params.agentId, projectId);
      if (hasMedia) {
        const [images, videos] = await Promise.all([
          searchRelevantMedia(params.agentId, projectId, ragQuery),
          searchRelevantVideos(params.agentId, projectId, ragQuery),
        ]);
        mediaResults = images;
        videoResults = videos;
        if (mediaResults.length > 0 || videoResults.length > 0) {
          steps.push({ name: 'media_search', duration: Date.now() - stepStart });
        }
      }
    }

    // --- Step 2c: Load form data (if conversational form is active) ---
    let formFields: SystemPromptParams['formFields'] = undefined;
    if (params.formConfig?.isActive && params.agentId) {
      let shouldInject = params.formConfig.triggerMode === 'immediate';

      // For temperature-based trigger, check the lead's current temperature from DB
      if (!shouldInject) {
        const currentLead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { temperature: true },
        });
        const currentTemp = currentLead?.temperature ?? null;
        shouldInject = ['hot', 'warm'].includes(currentTemp || '');
      }

      if (shouldInject) {
        const [formCollected, leadRecord] = await Promise.all([
          getLeadFormData(leadId, params.agentId),
          prisma.lead.findUnique({
            where: { id: leadId },
            select: { firstName: true, lastName: true, email: true, phone: true, businessName: true, position: true, estimatedValue: true },
          }),
        ]);

        // Pre-fill collected with lead data for mapped fields
        const collected = { ...formCollected };
        const unconfirmedKeys = new Set<string>(); // Fields from WhatsApp profile that need AI confirmation

        if (leadRecord) {
          for (const field of params.formConfig.fields) {
            if (collected[field.key]) continue; // Already collected by AI
            if (!field.leadFieldMapping) continue;
            const leadVal = leadRecord[field.leadFieldMapping as keyof typeof leadRecord];
            if (leadVal === null || leadVal === undefined) continue;
            const strVal = String(leadVal).trim();
            if (!strVal) continue;

            // Names from WhatsApp profile: always need AI confirmation
            // (could be phone numbers, random text, business names, etc.)
            if (field.leadFieldMapping === 'firstName' || field.leadFieldMapping === 'lastName') {
              // Obviously invalid (pure digits/symbols) → skip entirely
              if (!isValidPersonName(strVal)) continue;
              // Looks like it could be a name → pre-fill but flag for confirmation
              collected[field.key] = strVal;
              unconfirmedKeys.add(field.key);
            } else {
              // Phone, email, etc. → reliable data, no confirmation needed
              collected[field.key] = strVal;
            }
          }
        }

        const pending = params.formConfig.fields.filter(f => !collected[f.key]);
        formFields = { pending, collected, unconfirmedKeys: unconfirmedKeys.size > 0 ? unconfirmedKeys : undefined };
      }
    }

    // --- Step 3: Build system prompt ---
    const effectiveTimezone = getEffectiveTimezone(params.timezone);
    const currentDate = new Date().toLocaleDateString('es-PE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: effectiveTimezone,
    });
    const currentTime = new Date().toLocaleTimeString('es-PE', {
      hour: '2-digit', minute: '2-digit',
      timeZone: effectiveTimezone,
    });

    // Build advisor name for handoff personalization
    const advisorFullName = params.assignedUser
      ? `${params.assignedUser.firstName} ${params.assignedUser.lastName}`.trim()
      : null;

    const systemPrompt = buildSystemPrompt({
      agentName: params.agentName,
      companyName: params.companyName,
      globalRules: params.globalRules,
      systemInstructions: params.systemInstructions,
      ragResults,
      mediaResults: mediaResults.length > 0 ? mediaResults : undefined,
      videoResults: videoResults.length > 0 ? videoResults : undefined,
      conversationHistory: params.conversationHistory,
      leadSummary: params.leadSummary,
      leadName: params.leadName,
      currentDate,
      currentTime,
      messageCount: params.messageCount,
      summaryThreshold: params.summaryThreshold,
      formFields,
      advisorName: advisorFullName,
    });

    // --- Step 4: Call OpenAI ---
    const stepOpenAI = Date.now();
    const openaiKey = await getProjectSecret(projectId, 'openai_api_key');
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured for this project');
    }

    const openai = getChatClient(openaiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout

    let rawResponse: string;
    try {
      const completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            imageUrl
              ? { role: 'user' as const, content: [
                  { type: 'text' as const, text: (userMessage || 'El usuario envió esta imagen.').slice(0, 4096) },
                  { type: 'image_url' as const, image_url: { url: imageUrl, detail: 'low' as const } },
                ] }
              : { role: 'user' as const, content: userMessage.slice(0, 4096) },
          ],
          temperature: 0.7,
          max_tokens: 500,
        },
        { signal: controller.signal }
      );
      rawResponse = completion.choices[0]?.message?.content || '';
    } finally {
      clearTimeout(timeout);
    }
    steps.push({ name: 'openai_chat', duration: Date.now() - stepOpenAI });

    // --- Step 5: Extract temperature + handoff markers ---
    const tempMatch = rawResponse.match(/\[TEMPERATURA:\s*(HOT|WARM|COLD)\]/i);
    const suggestedTemperature = tempMatch
      ? (tempMatch[1].toLowerCase() as 'hot' | 'warm' | 'cold')
      : null;

    const shouldHandoff = /\[HANDOFF\]/i.test(rawResponse);

    // Extract [FORM-DATA: key=value | key2=value2] marker
    const formDataMatch = rawResponse.match(/\[FORM-DATA:\s*(.+?)\]/i);
    if (formDataMatch && params.formConfig && params.agentId) {
      const pairs = formDataMatch[1].split('|').map(p => p.trim());
      const extracted: Record<string, string> = {};
      for (const pair of pairs) {
        const [key, ...valueParts] = pair.split('=');
        if (key && valueParts.length) {
          extracted[key.trim()] = valueParts.join('=').trim();
        }
      }
      if (Object.keys(extracted).length > 0) {
        bulkUpdateLeadFormFields(leadId, params.agentId, extracted, params.formConfig).catch(err =>
          console.error('[AI Pipeline] Failed to save form data:', err)
        );
      }
    }

    // Extract [MEDIA-X] and [VIDEO-X] markers before cleanup
    const mediaMarkers = rawResponse.match(/\[MEDIA-(\d+)\]/gi) || [];
    const requestedMediaIds: number[] = mediaMarkers
      .map(m => parseInt(m.match(/\d+/)?.[0] || '0'))
      .filter(n => n >= 1 && n <= mediaResults.length)
      .slice(0, 3); // Max 3 images per response

    const videoMarkers = rawResponse.match(/\[VIDEO-(\d+)\]/gi) || [];
    const requestedVideoIds: number[] = videoMarkers
      .map(m => parseInt(m.match(/\d+/)?.[0] || '0'))
      .filter(n => n >= 1 && n <= videoResults.length)
      .slice(0, 2); // Max 2 videos per response

    // Clean message (remove markers - strict format + fallback for GPT variations)
    const cleanMessage = rawResponse
      .replace(/\[HANDOFF\]/gi, '')
      .replace(/\[TEMPERATURA:\s*(HOT|WARM|COLD)\]/gi, '')
      .replace(/\[FORM-DATA:[^\]]*\]/gi, '')
      .replace(/\[MEDIA-\d+\]/gi, '')
      .replace(/\[VIDEO-\d+\]/gi, '')
      .replace(/\n?\*{0,2}[Tt]emperatura\*{0,2}\s*:\s*.+$/gm, '')
      .trim();

    if (!cleanMessage) {
      throw new Error('OpenAI returned empty response');
    }

    // --- Step 6: Generate summary if threshold met ---
    let suggestedSummary: string | null = null;
    if (params.messageCount >= params.summaryThreshold) {
      // Quick dedicated call to generate the summary only when needed
      const summaryStart = Date.now();
      // Build form status for form-aware summaries
      const formStatus = params.formConfig?.isActive ? {
        fields: params.formConfig.fields,
        collected: formFields?.collected || {},
        pendingLabels: (formFields?.pending || []).filter(f => f.required).map(f => f.label),
      } : null;
      suggestedSummary = await generateSummary(openai, params.conversationHistory, userMessage, cleanMessage, params.leadSummary, formStatus);
      steps.push({ name: 'summary_gen', duration: Date.now() - summaryStart });
    }

    // --- Step 7: Save to DB ---
    const stepDB = Date.now();

    // Build media attachments for metadata (so chat UI can render them)
    const mediaAttachments = [
      ...requestedMediaIds.map(idx => {
        const media = mediaResults[idx - 1];
        return media ? { url: media.mediaUrl, title: media.title, type: 'image', position: 'after' } : null;
      }),
      ...requestedVideoIds.map(idx => {
        const video = videoResults[idx - 1];
        return video ? { url: video.mediaUrl, title: video.title, type: 'video', position: 'after' } : null;
      }),
    ].filter(Boolean);

    // Save AI message
    const savedMessage = await prisma.message.create({
      data: {
        conversationId,
        sender: 'ai',
        content: cleanMessage,
        metadata: {
          agentId: params.agentId || null,
          agentName: agentName || null,
          source: 'kairo_ai',
          createdAt: new Date().toISOString(),
          ...(mediaAttachments.length > 0 && { mediaAttachments }),
        },
      },
    });

    // Update lead: temperature + summary (parallel)
    const leadUpdates: Promise<unknown>[] = [];

    // Track previous temperature for HOT lead notification
    let previousTemperature: string | null = null;

    if (suggestedTemperature) {
      // Guard: only update temperature after the lead has sent at least 3 messages
      // (need real back-and-forth: lead asks → AI responds → lead answers AI's questions)
      const leadMessageCount = await prisma.message.count({
        where: { conversationId, sender: 'lead' },
      });

      if (leadMessageCount >= 3) {
        // Fetch current temperature to detect HOT transition
        if (suggestedTemperature === 'hot') {
          const currentLead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { temperature: true },
          });
          previousTemperature = currentLead?.temperature ?? null;
        }

        leadUpdates.push(
          prisma.lead.update({
            where: { id: leadId },
            data: { temperature: suggestedTemperature },
          })
        );
      }
    }

    if (suggestedSummary && suggestedSummary.trim().length > 0) {
      // Defense in depth: verify message count independently
      const actualMessageCount = await prisma.message.count({
        where: { conversationId },
      });
      if (actualMessageCount >= SUMMARY_MIN_MESSAGES) {
        leadUpdates.push(
          prisma.lead.update({
            where: { id: leadId },
            data: {
              summary: suggestedSummary.trim().slice(0, 1000),
              summaryUpdatedAt: new Date(),
            },
          })
        );
      }
    }

    if (leadUpdates.length > 0) {
      await Promise.all(leadUpdates);
    }

    // Auto-handoff: AI decided to transfer to human
    if (shouldHandoff) {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          handoffMode: HandoffMode.human,
          handoffAt: new Date(),
          handoffUserId: null, // AI-initiated, no specific user
        },
      });
      await prisma.activity.create({
        data: {
          leadId,
          type: 'handoff_change',
          description: `${agentName || 'Kaira'} transfirio la conversacion a un asesor humano`,
          performedBy: null, // AI-initiated
          metadata: { mode: 'human', initiatedBy: 'ai', agentName: agentName || 'Kaira' },
        },
      });
      console.log(`[AI Pipeline] HANDOFF leadId=${leadId.slice(0, 8)}... agent=${agentName} -> human mode`);

      // Notify project team about handoff
      notifyProjectMembers({
        projectId,
        organizationId: params.organizationId,
        type: 'handoff_request',
        title: `${params.leadName} solicita atencion`,
        message: `${agentName || 'Kaira'} transfirio la conversacion a un asesor humano`,
        metadata: { leadId, agentName: agentName || 'Kaira', initiatedBy: 'ai' },
        source: 'ai_pipeline',
        leadName: params.leadName,
        agentName: agentName || 'Kaira',
        projectName: params.companyName,
      }).catch((err) =>
        console.error('[AI Pipeline] Failed to send handoff notification:', err)
      );

      // Send personalized advisor card to the lead (after AI message is sent)
      // This is deferred to after WhatsApp send (Step 8) — stored for later
    }

    // Notify project team about HOT lead (only on transition to HOT)
    if (suggestedTemperature === 'hot' && previousTemperature !== 'hot') {
      notifyProjectMembers({
        projectId,
        organizationId: params.organizationId,
        type: 'hot_lead',
        title: `Lead caliente: ${params.leadName}`,
        message: `${agentName || 'Kaira'} califico a ${params.leadName} como lead de alto potencial`,
        metadata: { leadId, agentName: agentName || 'Kaira', previousTemperature },
        source: 'ai_pipeline',
        leadName: params.leadName,
        agentName: agentName || 'Kaira',
        projectName: params.companyName,
      }).catch((err) =>
        console.error('[AI Pipeline] Failed to send hot lead notification:', err)
      );
      console.log(`[AI Pipeline] HOT LEAD leadId=${leadId.slice(0, 8)}... name=${params.leadName} prev=${previousTemperature}`);
    }

    steps.push({ name: 'db_save', duration: Date.now() - stepDB });

    // --- Step 8: Send to WhatsApp (text + media) ---
    // Order: fixed image → fixed video → text → RAG images → RAG videos
    const stepWA = Date.now();
    const phoneNumber = params.externalUserId || params.leadPhone;
    if (phoneNumber) {
      // Send order: fixed image → text → fixed video → RAG images → RAG videos
      // This matches WhatsApp delivery order (video takes longer to process)
      const allFixedAttachments: Array<{ url: string; title: string; type: string; position: string }> = [];

      // Step 1: Send fixed image BEFORE text
      if (params.messageCount <= 2 && params.agentId) {
        try {
          const firstContactImage = await getFixedMediaForEvent(params.agentId, projectId, 'first_contact');
          if (firstContactImage) {
            await sendImageToWhatsApp(projectId, phoneNumber, firstContactImage.mediaUrl);
            allFixedAttachments.push({ url: firstContactImage.mediaUrl, title: firstContactImage.title, type: 'image', position: 'before' });
          }
        } catch (err) {
          console.error('[AI Pipeline] First contact image failed:', err);
        }
      }

      // Step 2: Send text message
      await sendToWhatsApp(projectId, phoneNumber, cleanMessage, savedMessage.id);

      // Step 3: Send fixed video AFTER text (video delivery is slower on WhatsApp)
      if (params.messageCount <= 2 && params.agentId) {
        try {
          const firstContactVideo = await getFixedMediaForEvent(params.agentId, projectId, 'first_contact_video');
          if (firstContactVideo) {
            await sendVideoToWhatsApp(projectId, phoneNumber, firstContactVideo.mediaUrl);
            allFixedAttachments.push({ url: firstContactVideo.mediaUrl, title: firstContactVideo.title, type: 'video', position: 'after' });
          }
        } catch (err) {
          console.error('[AI Pipeline] First contact video failed:', err);
        }
      }

      // Update saved message metadata with fixed attachments
      if (allFixedAttachments.length > 0) {
        const beforeFixed = allFixedAttachments.filter(a => a.position === 'before');
        const afterFixed = allFixedAttachments.filter(a => a.position === 'after');
        await prisma.message.update({
          where: { id: savedMessage.id },
          data: {
            metadata: {
              ...(savedMessage.metadata as Record<string, unknown> || {}),
              mediaAttachments: [...beforeFixed, ...afterFixed, ...mediaAttachments],
            },
          },
        });
      }

      // Step 4: Send RAG images if GPT included [MEDIA-X] markers
      if (requestedMediaIds.length > 0) {
        for (const idx of requestedMediaIds) {
          const media = mediaResults[idx - 1];
          if (media) {
            try {
              await sendImageToWhatsApp(projectId, phoneNumber, media.mediaUrl);
            } catch (err) {
              console.error(`[AI Pipeline] Media send failed idx=${idx}:`, err);
            }
          }
        }
      }

      // Step 5: Send RAG videos if GPT included [VIDEO-X] markers
      if (requestedVideoIds.length > 0) {
        for (const idx of requestedVideoIds) {
          const video = videoResults[idx - 1];
          if (video) {
            try {
              await sendVideoToWhatsApp(projectId, phoneNumber, video.mediaUrl);
            } catch (err) {
              console.error(`[AI Pipeline] Video send failed idx=${idx}:`, err);
            }
          }
        }
      }
      // Step 6: Send advisor card after handoff (image with caption, or text-only)
      if (shouldHandoff && params.assignedUser) {
        try {
          const advisorName = `${params.assignedUser.firstName} ${params.assignedUser.lastName}`.trim();
          const caption = `*${advisorName}*\nAsesor Comercial`;

          // Send to WhatsApp
          if (params.assignedUser.avatarUrl) {
            await sendImageToWhatsApp(projectId, phoneNumber, params.assignedUser.avatarUrl, caption);
          } else {
            await sendTextToWhatsApp(projectId, phoneNumber, caption);
          }

          // Save as message in DB so it shows in the chat panel
          await prisma.message.create({
            data: {
              conversationId,
              sender: 'ai',
              content: caption,
              metadata: {
                isAdvisorCard: true,
                advisorId: params.assignedUser.id,
                advisorName,
                advisorAvatarUrl: params.assignedUser.avatarUrl || null,
                source: 'handoff_card',
              },
            },
          });

          console.log(`[AI Pipeline] Handoff advisor card sent: ${advisorName}`);
        } catch (err) {
          console.error('[AI Pipeline] Failed to send advisor card:', err);
        }
      }
    }
    steps.push({ name: 'whatsapp_send', duration: Date.now() - stepWA });

    // --- Pipeline complete: structured log ---
    const totalDuration = Date.now() - pipelineStart;
    const stepsLog = steps.map(s => `${s.name}=${s.duration}ms`).join(' ');
    console.log(
      `[AI Pipeline] OK leadId=${leadId} agent=${agentName} temp=${suggestedTemperature || 'none'} ` +
      `handoff=${shouldHandoff} rag=${ragResults.length} media=${requestedMediaIds.length}/${mediaResults.length} ` +
      `video=${requestedVideoIds.length}/${videoResults.length} ` +
      `${stepsLog} total=${totalDuration}ms`
    );

  } catch (error) {
    const totalDuration = Date.now() - pipelineStart;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const stepsLog = steps.map(s => `${s.name}=${s.duration}ms`).join(' ');

    console.error(
      `[AI Pipeline] ERROR leadId=${leadId} agent=${agentName} ` +
      `error="${errorMessage}" ${stepsLog} total=${totalDuration}ms`
    );

    // Don't re-throw: pipeline errors should not crash the webhook
    // The lead's message is already saved, they just won't get an AI response
    // TODO: Add notification/alert system for pipeline failures
  }
}

// ============================================
// Internal Helper: Audio Transcription (Whisper)
// ============================================

async function transcribeAudio(
  mediaId: string,
  projectId: string
): Promise<string | null> {
  try {
    const accessToken = await getProjectSecret(projectId, 'whatsapp_access_token');
    if (!accessToken) {
      console.error('[AI Pipeline] WhatsApp access token not configured');
      return null;
    }

    // Get media info
    const mediaInfoResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!mediaInfoResponse.ok) {
      console.error('[AI Pipeline] Failed to get media info');
      return null;
    }

    const mediaInfo = await mediaInfoResponse.json();

    // Download audio + get OpenAI key in parallel
    const [audioResponse, openaiKey] = await Promise.all([
      fetch(mediaInfo.url, { headers: { Authorization: `Bearer ${accessToken}` } }),
      getProjectSecret(projectId, 'openai_api_key'),
    ]);

    if (!audioResponse.ok || !openaiKey) {
      console.error('[AI Pipeline] Failed to download audio or missing OpenAI key');
      return null;
    }

    const audioBuffer = await audioResponse.arrayBuffer();

    // Validate audio size (max 10MB)
    const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
    if (audioBuffer.byteLength > MAX_AUDIO_SIZE) {
      console.warn(`[AI Pipeline] Audio too large: ${audioBuffer.byteLength} bytes, skipping`);
      return null;
    }

    const mimeType = mediaInfo.mime_type || 'audio/ogg';

    // Validate MIME type
    const ALLOWED_AUDIO_TYPES = new Set([
      'audio/ogg', 'audio/opus', 'audio/mpeg',
      'audio/mp4', 'audio/wav', 'audio/webm',
    ]);
    if (!ALLOWED_AUDIO_TYPES.has(mimeType)) {
      console.warn(`[AI Pipeline] Unsupported audio MIME type: ${mimeType}, skipping`);
      return null;
    }

    // Validate media URL hostname (must be Facebook CDN)
    try {
      const mediaUrl = new URL(mediaInfo.url);
      if (!mediaUrl.hostname.endsWith('.fbcdn.net') && !mediaUrl.hostname.endsWith('.facebook.com') && !mediaUrl.hostname.endsWith('.fbsbx.com')) {
        console.warn(`[AI Pipeline] Suspicious media URL hostname: ${mediaUrl.hostname}`);
        return null;
      }
    } catch {
      console.warn('[AI Pipeline] Invalid media URL');
      return null;
    }

    const audioBlob = new Blob([audioBuffer], { type: mimeType });

    const extMap: Record<string, string> = {
      'audio/ogg': 'ogg', 'audio/opus': 'opus', 'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/webm': 'webm',
    };
    const ext = extMap[mimeType] || 'ogg';

    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${ext}`);
    formData.append('model', 'whisper-1');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    });

    if (!whisperResponse.ok) {
      console.error('[AI Pipeline] Whisper transcription failed');
      return null;
    }

    const result = await whisperResponse.json();
    const transcription = result.text;

    // Persist transcription to message metadata (non-blocking)
    persistTranscription(mediaId, projectId, transcription).catch(err =>
      console.error('[AI Pipeline] Failed to persist transcription:', err)
    );

    return transcription;
  } catch (error) {
    console.error('[AI Pipeline] Audio transcription error:', error);
    return null;
  }
}

async function persistTranscription(
  mediaId: string,
  projectId: string,
  transcription: string
): Promise<void> {
  const truncated = transcription.length > 10_000
    ? transcription.slice(0, 10_000) + '...'
    : transcription;

  const audioMessage = await prisma.message.findFirst({
    where: {
      metadata: { path: ['mediaId'], equals: mediaId },
      conversation: { lead: { projectId } },
    },
    select: { id: true, metadata: true },
  });

  if (audioMessage) {
    const existing = (audioMessage.metadata as Record<string, unknown>) || {};
    await prisma.message.update({
      where: { id: audioMessage.id },
      data: {
        metadata: {
          ...existing,
          transcription: truncated,
          transcribedAt: new Date().toISOString(),
        },
      },
    });
  }
}

// ============================================
// Internal Helper: Build context-enriched RAG query
// Short/ambiguous messages (e.g. "Si", "Ok") produce poor embeddings.
// We prepend recent conversation context so RAG can match relevant KB chunks.
// Escalating strategy: last agent message first, then more if still too short.
// ============================================

const SHORT_MESSAGE_THRESHOLD = 15; // chars — below this, enrich with context
const MIN_ENRICHED_LENGTH = 30; // chars — if still short after 1 message, add more

function buildRAGQuery(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  // If the message is long enough, it has sufficient semantic signal on its own
  if (userMessage.length >= SHORT_MESSAGE_THRESHOLD) {
    return userMessage;
  }

  // Escalating context: start with last agent message, add more if needed
  const recentAssistantMessages = conversationHistory
    .filter(m => m.role === 'assistant')
    .slice(-2); // Keep last 2 agent messages available

  if (recentAssistantMessages.length === 0) {
    return userMessage;
  }

  // Level 1: last agent message + current user message
  const lastAgent = recentAssistantMessages[recentAssistantMessages.length - 1];
  let enriched = `${lastAgent.content} ${userMessage}`;

  // Level 2: if still too short, add one more agent message
  if (enriched.length < MIN_ENRICHED_LENGTH && recentAssistantMessages.length > 1) {
    const prevAgent = recentAssistantMessages[recentAssistantMessages.length - 2];
    enriched = `${prevAgent.content} ${lastAgent.content} ${userMessage}`;
  }

  // Cap at 500 chars to keep embedding focused (avoid dilution)
  return enriched.slice(0, 500);
}

// ============================================
// Internal Helper: RAG Search (pgvector + OpenAI embeddings)
// ============================================

async function searchRAG(
  agentId: string,
  projectId: string,
  query: string
): Promise<Array<{ content: string; title: string | null; similarity: number }>> {
  try {
    const queryEmbedding = await generateEmbedding(query, projectId);
    const embeddingStr = formatEmbeddingForPg(queryEmbedding);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('search_agent_knowledge', {
      p_agent_id: agentId,
      p_project_id: projectId,
      p_query_embedding: embeddingStr,
      p_match_count: 5,
      p_match_threshold: 0.35,
    });

    if (error) {
      console.error('[AI Pipeline] RAG search error:', error);
      return [];
    }

    return (data || []).map((row: { content: string; title: string | null; similarity: number }) => ({
      content: row.content,
      title: row.title,
      similarity: row.similarity,
    }));
  } catch (error) {
    console.error('[AI Pipeline] RAG search failed:', error);
    return []; // Graceful degradation: respond without RAG context
  }
}

// sendToWhatsApp extracted to @/lib/whatsapp/send

// ============================================
// Internal Helper: Generate Lead Summary
// ============================================

interface FormSummaryContext {
  fields: Array<{ key: string; label: string; required: boolean }>;
  collected: Record<string, string>;
  pendingLabels: string[];
}

async function generateSummary(
  openai: OpenAI,
  conversationHistory: Array<{ role: string; content: string }>,
  latestUserMessage: string,
  latestAIResponse: string,
  existingSummary: string | null,
  formStatus?: FormSummaryContext | null
): Promise<string | null> {
  try {
    const historyText = conversationHistory
      .map(m => `${m.role === 'user' ? 'Lead' : 'Agent'}: ${m.content}`)
      .join('\n');

    // Form-aware summary: structured with bullet points for collected data + short narrative
    const formContext = formStatus ? (() => {
      const collectedLines = formStatus.fields.map(f => {
        const val = formStatus.collected[f.key]?.trim();
        return val ? `- ${f.label}: ${val}` : `- ${f.label}: (pendiente)${f.required ? ' *' : ''}`;
      }).join('\n');
      const pendingNote = formStatus.pendingLabels.length > 0
        ? `\nCampos requeridos pendientes: ${formStatus.pendingLabels.join(', ')}`
        : '';
      return `\nIMPORTANT: A conversational form is active. Structure the summary as follows:
1. FIRST, list ALL form fields as bullet points with their values (or "pendiente" if empty). Use this exact format:
${collectedLines}${pendingNote}

2. THEN, write a very SHORT complementary paragraph (2-3 sentences max) with ONLY additional insights NOT covered by the form fields above (e.g. lead sentiment, objections, next steps). Do NOT repeat information that is already in the bullet points.`;
    })() : '';

    const prompt = `You are a lead qualification analyst. Summarize this conversation into a complete, self-contained summary in Spanish.

RULES:
- Maximum 1000 characters. NEVER exceed this limit.
- The summary MUST end in a complete sentence. Never cut mid-sentence.
${formStatus ? '- Follow the structured format described below (bullet points + short paragraph).' : '- Prioritize: (1) what the lead wants, (2) key decisions/commitments, (3) current status/next steps.'}
- Omit greetings, filler, and repetitive exchanges.
- If space is tight, keep only the most actionable information.
- Write in third person (e.g. "El lead esta interesado en...").
${existingSummary ? `\nPrevious summary (update with new info, don't repeat): ${existingSummary}` : ''}${formContext}

Conversation:
${historyText}
Lead: ${latestUserMessage}
Agent: ${latestAIResponse}

Summary (Spanish, complete sentences, max 1000 chars):`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 400,
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    return summary && summary.length > 0 ? summary.slice(0, 1000) : null;
  } catch (error) {
    console.error('[AI Pipeline] Summary generation failed:', error);
    return null; // Non-critical: don't fail pipeline for summary
  }
}
