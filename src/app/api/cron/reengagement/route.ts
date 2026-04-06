/**
 * KAIRO - ReEngagement Cron Job
 *
 * Runs every 15 minutes via Supabase pg_cron.
 * Sends AI-generated follow-up messages within WhatsApp 24h window.
 *
 * Two models coexist:
 * - Model A (response-based): lead responds to reengagement → goes silent → next attempt
 * - Model B (time-based): lead never responds → attempts still fire sequentially with delayHours gap
 *
 * In both cases, attemptNumber always advances (never repeats the same attempt).
 * attemptNumber = total reengagements sent (0=initial, 1=follow-up 1, 2=follow-up 2).
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getProjectSecret } from '@/lib/actions/secrets';
import { generateReEngagementMessage } from '@/lib/ai/generate-reengagement';
import { sendToWhatsApp, sendImageToWhatsApp, sendVideoToWhatsApp } from '@/lib/whatsapp/send';
import { projectHasMedia, searchRelevantMedia, searchRelevantVideos, getFixedMediaForEvent } from '@/lib/ai/search-media';
import type { MediaSearchResult, FixedEventMedia } from '@/lib/types/agent-media';
import type { FixedEventType } from '@/lib/types/agent-media';
import type { ReEngagementConfig } from '@/lib/types/reengagement';

const MAX_LEADS_PER_RUN = 50;

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let autoNoResponse = 0;
  const errors: string[] = [];

  try {
    // ============================================
    // Auto-tipify: leads in status 'new' that received a reengagement
    // >24h ago without responding → mark as 'no_response'
    // ============================================
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const leadsToAutoTipify = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT l.id
        FROM leads l
        INNER JOIN conversations c ON c."leadId" = l.id
        -- Verify the lead has at least one reengagement message
        INNER JOIN LATERAL (
          SELECT m."createdAt" as last_re_at
          FROM messages m
          WHERE m."conversationId" = c.id
            AND m.sender = 'ai'
            AND (m.metadata->>'isReEngagement')::boolean = true
          ORDER BY m."createdAt" DESC
          LIMIT 1
        ) last_re ON true
        -- Verify the last message overall is from AI (lead hasn't responded)
        INNER JOIN LATERAL (
          SELECT m.sender
          FROM messages m
          WHERE m."conversationId" = c.id
          ORDER BY m."createdAt" DESC
          LIMIT 1
        ) last_msg ON last_msg.sender = 'ai'
        WHERE l.status = 'new'
          AND l."archivedAt" IS NULL
          AND l."handoffMode" = 'ai'
          -- Last reengagement was sent >24h ago
          AND last_re.last_re_at < ${twentyFourHoursAgo}
      `;

      if (leadsToAutoTipify.length > 0) {
        const leadIds = leadsToAutoTipify.map(l => l.id);
        await prisma.lead.updateMany({
          where: { id: { in: leadIds } },
          data: { status: 'no_response', updatedAt: new Date() },
        });
        autoNoResponse = leadIds.length;
        console.log(`[ReEngagement] Auto-tipified ${autoNoResponse} leads to no_response`);
      }
    } catch (tipifyError) {
      console.error('[ReEngagement] Auto-tipify error:', tipifyError);
      // Non-fatal: continue with normal reengagement processing
    }

    // Find all active agents with reEngagement enabled
    const agents = await prisma.aIAgent.findMany({
      where: {
        isActive: true,
        reEngagementConfig: { not: Prisma.JsonNull },
      },
      select: {
        id: true,
        name: true,
        systemInstructions: true,
        reEngagementConfig: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            organization: {
              select: {
                defaultTimezone: true,
              },
            },
          },
        },
      },
    });

    for (const agent of agents) {
      const config = agent.reEngagementConfig as ReEngagementConfig | null;
      if (!config?.enabled || !config.promptTemplate) continue;

      // Check send window in project timezone
      const timezone = agent.project.organization.defaultTimezone || 'America/Lima';
      const windowStart = config.sendWindowStart || '17:00';
      const windowEnd = config.sendWindowEnd || '23:00';
      if (!isWithinSendWindow(timezone, windowStart, windowEnd)) {
        continue;
      }

      const now = new Date();
      const delayMs = config.delayHours * 60 * 60 * 1000;
      const windowMs = 24 * 60 * 60 * 1000; // 24h WhatsApp window
      const maxAttempts = config.maxAttempts ?? 2;

      // Find eligible leads for this agent's project
      // Supports both models:
      // - Model A: lead responded to previous reengagement → went silent → next attempt
      // - Model B: lead never responded → attempts fire sequentially with delayHours gap
      // attemptNumber = total reengagements sent (always advances, never repeats)
      const eligibleLeads = await prisma.$queryRaw<Array<{
        id: string;
        firstName: string;
        lastName: string | null;
        whatsappId: string | null;
        conversationId: string;
        lastLeadMessageAt: Date;
        lastReEngagementAt: Date | null;
        reEngagementCount: number;
        summary: string | null;
        totalReengagements: number;
      }>>`
        SELECT
          l.id,
          l."firstName",
          l."lastName",
          l."whatsappId",
          c.id as "conversationId",
          lead_msg."createdAt" as "lastLeadMessageAt",
          l."lastReEngagementAt",
          l."reEngagementCount",
          l.summary,
          COALESCE(total_re.cnt, 0)::int as "totalReengagements"
        FROM leads l
        INNER JOIN conversations c ON c."leadId" = l.id
        -- Get the last message from the lead
        INNER JOIN LATERAL (
          SELECT m."createdAt"
          FROM messages m
          WHERE m."conversationId" = c.id AND m.sender = 'lead'
          ORDER BY m."createdAt" DESC
          LIMIT 1
        ) lead_msg ON true
        -- Verify the last message overall is from AI (lead hasn't responded)
        INNER JOIN LATERAL (
          SELECT m.sender
          FROM messages m
          WHERE m."conversationId" = c.id
          ORDER BY m."createdAt" DESC
          LIMIT 1
        ) last_msg ON last_msg.sender = 'ai'
        -- Count total reengagement messages sent (regardless of lead response)
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int as cnt
          FROM messages m_re
          WHERE m_re."conversationId" = c.id
            AND m_re.sender = 'ai'
            AND (m_re.metadata->>'isReEngagement')::boolean = true
        ) total_re ON true
        WHERE l."projectId" = ${agent.projectId}
          AND l."handoffMode" = 'ai'
          AND l."archivedAt" IS NULL
          AND l."whatsappId" IS NOT NULL
          -- Lead's last message was > delayHours ago (initial silence threshold)
          AND lead_msg."createdAt" < ${new Date(now.getTime() - delayMs)}
          -- Lead's last message was < 24h ago (within WhatsApp window)
          AND lead_msg."createdAt" > ${new Date(now.getTime() - windowMs)}
          -- Within max attempts (total sent must be less than max)
          AND COALESCE(total_re.cnt, 0) < ${maxAttempts + 1}
          -- Enough time since last reengagement (delayHours gap between attempts)
          AND (
            l."lastReEngagementAt" IS NULL
            OR l."lastReEngagementAt" < ${new Date(now.getTime() - delayMs)}
          )
        LIMIT ${MAX_LEADS_PER_RUN}
      `;

      if (eligibleLeads.length === 0) continue;

      // Get OpenAI key for this project
      const openaiKey = await getProjectSecret(agent.projectId, 'openai_api_key');
      if (!openaiKey) {
        console.warn(`[ReEngagement] No OpenAI key for project ${agent.projectId}`);
        continue;
      }

      for (const lead of eligibleLeads) {
        processed++;

        // Safety: check timeout (leave 10s buffer for Vercel)
        if (Date.now() - startTime > 50000) {
          console.warn('[ReEngagement] Approaching timeout, stopping');
          break;
        }

        try {
          if (!lead.whatsappId) {
            skipped++;
            continue;
          }

          // Fetch conversation history (last 6 messages)
          const messages = await prisma.message.findMany({
            where: { conversationId: lead.conversationId },
            orderBy: { createdAt: 'desc' },
            take: 6,
            select: { sender: true, content: true, metadata: true },
          });

          const conversationHistory = messages.reverse().map(m => ({
            role: (m.sender === 'lead' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
          }));

          const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(' ');

          // Determine attempt number from total reengagements sent
          const attemptNumber = lead.totalReengagements; // 0=initial, 1=follow-up 1, 2=follow-up 2

          // Select the right instructions based on attempt
          let attemptInstructions: string | null = null;
          if (attemptNumber === 1) {
            attemptInstructions = config.attempt1Instructions || null;
          } else if (attemptNumber >= 2) {
            attemptInstructions = config.attempt2Instructions || null;
          }

          // Search for available media (images + videos) for this agent
          let mediaResults: MediaSearchResult[] = [];
          let videoResults: MediaSearchResult[] = [];
          if (agent.id) {
            try {
              const hasMedia = await projectHasMedia(agent.id, agent.projectId);
              if (hasMedia) {
                const searchQuery = lead.summary || conversationHistory[conversationHistory.length - 1]?.content || leadName;
                const [images, videos] = await Promise.all([
                  searchRelevantMedia(agent.id, agent.projectId, searchQuery),
                  searchRelevantVideos(agent.id, agent.projectId, searchQuery),
                ]);
                mediaResults = images;
                videoResults = videos;
              }
            } catch (mediaErr) {
              console.error(`[ReEngagement] Media search error for lead ${lead.id}:`, mediaErr);
            }
          }

          // Generate AI message with context + available media
          const rawMessage = await generateReEngagementMessage(openaiKey, {
            agentName: agent.name,
            leadName,
            conversationHistory,
            promptTemplate: config.promptTemplate,
            attemptInstructions,
            systemInstructions: agent.systemInstructions,
            attemptNumber,
            leadSummary: lead.summary,
            mediaItems: mediaResults.length > 0
              ? mediaResults.map(m => ({ title: m.title, description: m.description }))
              : undefined,
            videoItems: videoResults.length > 0
              ? videoResults.map(v => ({ title: v.title, description: v.description }))
              : undefined,
          });

          if (!rawMessage) {
            skipped++;
            continue;
          }

          // Extract [MEDIA-X] and [VIDEO-X] markers before cleanup
          const mediaMarkers = rawMessage.match(/\[MEDIA-(\d+)\]/gi) || [];
          const requestedMediaIds: number[] = mediaMarkers
            .map(m => parseInt(m.match(/\d+/)?.[0] || '0'))
            .filter(n => n >= 1 && n <= mediaResults.length)
            .slice(0, 3);

          const videoMarkers = rawMessage.match(/\[VIDEO-(\d+)\]/gi) || [];
          const requestedVideoIds: number[] = videoMarkers
            .map(m => parseInt(m.match(/\d+/)?.[0] || '0'))
            .filter(n => n >= 1 && n <= videoResults.length)
            .slice(0, 2);

          // Clean message (remove markers)
          const cleanMessage = rawMessage
            .replace(/\[MEDIA-\d+\]/gi, '')
            .replace(/\[VIDEO-\d+\]/gi, '')
            .trim();

          if (!cleanMessage) {
            skipped++;
            continue;
          }

          // Build media attachments for metadata
          const mediaAttachments = [
            ...requestedMediaIds.map(idx => {
              const media = mediaResults[idx - 1];
              return media ? { url: media.mediaUrl, title: media.title, type: 'image', position: 'after' } : null;
            }),
            ...requestedVideoIds.map(idx => {
              const video = videoResults[idx - 1];
              return video ? { url: video.mediaUrl, title: video.title, type: 'video', position: 'after' } : null;
            }),
          ].filter((a): a is { url: string; title: string; type: string; position: string } => a !== null);

          // Save message to conversation
          const savedMessage = await prisma.message.create({
            data: {
              conversationId: lead.conversationId,
              sender: 'ai',
              content: cleanMessage,
              metadata: {
                isReEngagement: true,
                attemptNumber,
                agentId: agent.id,
                agentName: agent.name,
                source: 'kairo_reengagement',
                ...(mediaAttachments.length > 0 && { mediaAttachments }),
              },
            },
          });

          // Send order: fixed image → text → fixed video → RAG media
          // Video goes AFTER text because WhatsApp processes video slower than text,
          // so the actual delivery order matches our intended display order.
          const fixedEventType = `reengagement_${attemptNumber}` as FixedEventType;
          const fixedVideoEventType = `reengagement_${attemptNumber}_video` as FixedEventType;
          const fixedAttachments: Array<{ url: string; title: string; type: string; position: string }> = [];
          let fixedVideo: FixedEventMedia | null = null;

          // Step 1: Send fixed image BEFORE text
          try {
            const fixedMedia = await getFixedMediaForEvent(agent.id, agent.projectId, fixedEventType);
            if (fixedMedia) {
              await sendImageToWhatsApp(agent.projectId, lead.whatsappId!, fixedMedia.mediaUrl);
              fixedAttachments.push({ url: fixedMedia.mediaUrl, title: fixedMedia.title, type: 'image', position: 'before' });
            }
            // Pre-fetch fixed video (send later, after text)
            fixedVideo = await getFixedMediaForEvent(agent.id, agent.projectId, fixedVideoEventType);
          } catch (fixedErr) {
            console.error(`[ReEngagement] Fixed image send failed:`, fixedErr);
          }

          // Step 2: Send text via WhatsApp
          const sendResult = await sendToWhatsApp(
            agent.projectId,
            lead.whatsappId,
            cleanMessage,
            savedMessage.id
          );

          // Step 3: Send fixed video AFTER text
          if (fixedVideo && sendResult.success) {
            try {
              await sendVideoToWhatsApp(agent.projectId, lead.whatsappId!, fixedVideo.mediaUrl);
              fixedAttachments.push({ url: fixedVideo.mediaUrl, title: fixedVideo.title, type: 'video', position: 'after' });
            } catch (vidErr) {
              console.error(`[ReEngagement] Fixed video send failed:`, vidErr);
            }
          }

          // Update metadata with fixed attachments
          if (fixedAttachments.length > 0) {
            try {
              await prisma.message.update({
                where: { id: savedMessage.id },
                data: {
                  metadata: {
                    ...savedMessage.metadata as Record<string, unknown>,
                    mediaAttachments: [
                      ...fixedAttachments,
                      ...mediaAttachments as Array<{ url: string; title: string }>,
                    ],
                  },
                },
              });
            } catch (metaErr) {
              console.error(`[ReEngagement] Metadata update failed:`, metaErr);
            }
          }

          // Send RAG images if GPT included [MEDIA-X] markers (after text)
          if (sendResult.success && requestedMediaIds.length > 0) {
            for (const idx of requestedMediaIds) {
              const media = mediaResults[idx - 1];
              if (media) {
                try {
                  await sendImageToWhatsApp(agent.projectId, lead.whatsappId, media.mediaUrl);
                } catch (imgErr) {
                  console.error(`[ReEngagement] Media send failed idx=${idx}:`, imgErr);
                }
              }
            }
          }

          // Send RAG videos if GPT included [VIDEO-X] markers (after images)
          if (sendResult.success && requestedVideoIds.length > 0) {
            for (const idx of requestedVideoIds) {
              const video = videoResults[idx - 1];
              if (video) {
                try {
                  await sendVideoToWhatsApp(agent.projectId, lead.whatsappId, video.mediaUrl);
                } catch (vidErr) {
                  console.error(`[ReEngagement] Video send failed idx=${idx}:`, vidErr);
                }
              }
            }
          }

          if (sendResult.success) {
            // Update lead tracking
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                lastReEngagementAt: new Date(),
                reEngagementCount: { increment: 1 },
                lastContactAt: new Date(),
              },
            });
            sent++;
            console.log(`[ReEngagement] Sent attempt #${attemptNumber} to lead ${lead.id} (${leadName})`);
          } else {
            skipped++;
          }
        } catch (leadError) {
          const errorMsg = leadError instanceof Error ? leadError.message : 'Unknown error';
          errors.push(`Lead ${lead.id}: ${errorMsg}`);
          console.error(`[ReEngagement] Error processing lead ${lead.id}:`, leadError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      sent,
      skipped,
      autoNoResponse,
      errors: errors.length,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[ReEngagement] Cron error:', error);
    return NextResponse.json(
      { error: 'ReEngagement cron failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * Check if current time is within the configured send window in given timezone.
 * Supports windows that cross midnight (e.g. 22:00 → 02:00).
 */
function isWithinSendWindow(timezone: string, windowStart: string, windowEnd: string): boolean {
  try {
    const now = new Date();
    const hourFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = hourFormatter.format(now).split(':');
    const currentMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);

    const [sh, sm] = windowStart.split(':').map(Number);
    const [eh, em] = windowEnd.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    if (startMin <= endMin) {
      // Normal window (e.g. 17:00 → 23:00)
      return currentMin >= startMin && currentMin < endMin;
    } else {
      // Crosses midnight (e.g. 22:00 → 02:00)
      return currentMin >= startMin || currentMin < endMin;
    }
  } catch {
    // If timezone is invalid, default to allowing
    return true;
  }
}
