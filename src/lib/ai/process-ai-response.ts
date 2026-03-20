/**
 * KAIRO - Internal AI Pipeline
 *
 * Replaces n8n workflow: processes incoming lead messages with RAG + OpenAI
 * and sends responses via WhatsApp. Runs entirely within KAIRO (no external orchestrator).
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
import { buildSystemPrompt } from './build-system-prompt';
import { notifyProjectMembers } from '@/lib/actions/notifications';
import { sendToWhatsApp, sendImageToWhatsApp, sendVideoToWhatsApp } from '@/lib/whatsapp/send';
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
  whatsappId: string | null;
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
}

interface PipelineStep {
  name: string;
  duration: number;
}

// Minimum messages required before saving a summary (defense in depth)
const SUMMARY_MIN_MESSAGES = 5;

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
    if (params.messageType === 'audio' && params.mediaId) {
      const stepStart = Date.now();
      const transcription = await transcribeAudio(params.mediaId, projectId);
      if (transcription) {
        userMessage = transcription;
      }
      steps.push({ name: 'audio_transcribe', duration: Date.now() - stepStart });
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

    // --- Step 3: Build system prompt ---
    const currentDate = new Date().toLocaleDateString('es-PE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'America/Lima',
    });
    const currentTime = new Date().toLocaleTimeString('es-PE', {
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Lima',
    });

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
            { role: 'user', content: userMessage.slice(0, 4096) },
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
      // Include instruction in the same response to avoid extra API call
      // The summary generation was previously done by n8n as a separate step
      // Now we generate it with a quick dedicated call only when needed
      const summaryStart = Date.now();
      suggestedSummary = await generateSummary(openai, params.conversationHistory, userMessage, cleanMessage, params.leadSummary);
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
    const phoneNumber = params.whatsappId || params.leadPhone;
    if (phoneNumber) {
      // Send fixed first-contact media BEFORE text (visual impact first)
      if (params.messageCount <= 2 && params.agentId) {
        const fixedAttachments: Array<{ url: string; title: string; type: string; position: string }> = [];
        try {
          // Fixed image first
          const firstContactImage = await getFixedMediaForEvent(params.agentId, projectId, 'first_contact');
          if (firstContactImage) {
            await sendImageToWhatsApp(projectId, phoneNumber, firstContactImage.mediaUrl);
            fixedAttachments.push({ url: firstContactImage.mediaUrl, title: firstContactImage.title, type: 'image', position: 'before' });
          }
          // Fixed video second (after image, before text)
          const firstContactVideo = await getFixedMediaForEvent(params.agentId, projectId, 'first_contact_video');
          if (firstContactVideo) {
            await sendVideoToWhatsApp(projectId, phoneNumber, firstContactVideo.mediaUrl);
            fixedAttachments.push({ url: firstContactVideo.mediaUrl, title: firstContactVideo.title, type: 'video', position: 'before' });
          }
          // Update saved message metadata with fixed attachments
          if (fixedAttachments.length > 0) {
            await prisma.message.update({
              where: { id: savedMessage.id },
              data: {
                metadata: {
                  ...(savedMessage.metadata as Record<string, unknown> || {}),
                  mediaAttachments: [...fixedAttachments, ...mediaAttachments],
                },
              },
            });
          }
        } catch (err) {
          console.error('[AI Pipeline] First contact media failed:', err);
        }
      }

      // Send text message
      await sendToWhatsApp(projectId, phoneNumber, cleanMessage, savedMessage.id);

      // Send RAG images if GPT included [MEDIA-X] markers (after text)
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

      // Send RAG videos if GPT included [VIDEO-X] markers (after images)
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
// Internal Helper: Audio Transcription
// Extracted from /api/audio/transcribe logic
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
// Internal Helper: RAG Search
// Extracted from /api/rag/search logic
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

async function generateSummary(
  openai: OpenAI,
  conversationHistory: Array<{ role: string; content: string }>,
  latestUserMessage: string,
  latestAIResponse: string,
  existingSummary: string | null
): Promise<string | null> {
  try {
    const historyText = conversationHistory
      .map(m => `${m.role === 'user' ? 'Lead' : 'Agent'}: ${m.content}`)
      .join('\n');

    const prompt = `You are a lead qualification analyst. Summarize this conversation into a complete, self-contained summary in Spanish.

RULES:
- Maximum 1000 characters. NEVER exceed this limit.
- The summary MUST end in a complete sentence. Never cut mid-sentence.
- Prioritize: (1) what the lead wants, (2) key decisions/commitments, (3) current status/next steps.
- Omit greetings, filler, and repetitive exchanges.
- If space is tight, keep only the most actionable information.
- Write in third person (e.g. "El lead esta interesado en...").
${existingSummary ? `\nPrevious summary (update with new info, don't repeat): ${existingSummary}` : ''}

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
