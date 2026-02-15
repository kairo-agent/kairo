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
import { getProjectSecret } from '@/lib/actions/secrets';
import { generateEmbedding, formatEmbeddingForPg } from '@/lib/openai/embeddings';
import { createClient } from '@/lib/supabase/server';
import { buildSystemPrompt } from './build-system-prompt';

// ============================================
// Types
// ============================================

export interface AIProcessParams {
  projectId: string;
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

    // --- Step 2: RAG search ---
    let ragResults: Array<{ content: string; title: string | null; similarity: number }> = [];
    if (params.agentId) {
      const stepStart = Date.now();
      ragResults = await searchRAG(params.agentId, projectId, userMessage);
      steps.push({ name: 'rag_search', duration: Date.now() - stepStart });
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
      systemInstructions: params.systemInstructions,
      ragResults,
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
            { role: 'user', content: userMessage },
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

    // --- Step 5: Extract temperature ---
    const tempMatch = rawResponse.match(/\[TEMPERATURA:\s*(HOT|WARM|COLD)\]/i);
    const suggestedTemperature = tempMatch
      ? (tempMatch[1].toLowerCase() as 'hot' | 'warm' | 'cold')
      : null;

    // Clean message (remove temperature marker)
    const cleanMessage = rawResponse.replace(/\[TEMPERATURA:\s*(HOT|WARM|COLD)\]/gi, '').trim();

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
        },
      },
    });

    // Update lead: temperature + summary (parallel)
    const leadUpdates: Promise<unknown>[] = [];

    if (suggestedTemperature) {
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
              summary: suggestedSummary.trim().slice(0, 500),
              summaryUpdatedAt: new Date(),
            },
          })
        );
      }
    }

    if (leadUpdates.length > 0) {
      await Promise.all(leadUpdates);
    }

    steps.push({ name: 'db_save', duration: Date.now() - stepDB });

    // --- Step 8: Send to WhatsApp ---
    const stepWA = Date.now();
    const phoneNumber = params.whatsappId || params.leadPhone;
    if (phoneNumber) {
      await sendToWhatsApp(projectId, phoneNumber, cleanMessage, savedMessage.id);
    }
    steps.push({ name: 'whatsapp_send', duration: Date.now() - stepWA });

    // --- Pipeline complete: structured log ---
    const totalDuration = Date.now() - pipelineStart;
    const stepsLog = steps.map(s => `${s.name}=${s.duration}ms`).join(' ');
    console.log(
      `[AI Pipeline] OK leadId=${leadId} agent=${agentName} temp=${suggestedTemperature || 'none'} ` +
      `rag=${ragResults.length} ${stepsLog} total=${totalDuration}ms`
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
    const mimeType = mediaInfo.mime_type || 'audio/ogg';
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
      p_match_threshold: 0.5,
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

// ============================================
// Internal Helper: Send to WhatsApp
// Extracted from /api/ai/respond logic
// ============================================

async function sendToWhatsApp(
  projectId: string,
  phoneNumber: string,
  message: string,
  messageId: string
): Promise<void> {
  try {
    const [accessToken, phoneNumberId] = await Promise.all([
      getProjectSecret(projectId, 'whatsapp_access_token'),
      getProjectSecret(projectId, 'whatsapp_phone_number_id'),
    ]);

    if (!accessToken || !phoneNumberId) {
      console.error('[AI Pipeline] WhatsApp credentials not configured');
      return;
    }

    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const whatsappApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body: message },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[AI Pipeline] WhatsApp send error:', data);
      await prisma.message.update({
        where: { id: messageId },
        data: {
          metadata: {
            whatsappError: data.error?.message || 'Unknown error',
            whatsappErrorCode: data.error?.code,
          },
        },
      });
      return;
    }

    // Update message with WhatsApp ID
    const whatsappMsgId = data.messages?.[0]?.id;
    if (whatsappMsgId) {
      await prisma.message.update({
        where: { id: messageId },
        data: {
          whatsappMsgId,
          isDelivered: true,
          deliveredAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error('[AI Pipeline] WhatsApp send failed:', error);
  }
}

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

    const prompt = `Based on this conversation, create a brief summary (max 500 chars) of the lead's interests, needs, and current status.${existingSummary ? `\n\nPrevious summary: ${existingSummary}` : ''}

Recent conversation:
${historyText}
Lead: ${latestUserMessage}
Agent: ${latestAIResponse}

Summary (Spanish, max 500 chars):`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    return summary && summary.length > 0 ? summary.slice(0, 500) : null;
  } catch (error) {
    console.error('[AI Pipeline] Summary generation failed:', error);
    return null; // Non-critical: don't fail pipeline for summary
  }
}
