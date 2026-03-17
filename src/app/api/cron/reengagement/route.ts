/**
 * KAIRO - ReEngagement Cron Job
 *
 * Runs every 15 minutes via Supabase pg_cron.
 * Sends AI-generated follow-up messages within WhatsApp 24h window.
 *
 * Anti-spam flow:
 * - Initial ReEngagement: fires on lead silence (no prior reengagement unanswered)
 * - Follow-up 1: ONLY if lead responded to initial reengagement + went silent
 * - Follow-up 2: ONLY if lead responded to follow-up 1 + went silent
 *
 * A "completed cycle" = reengagement sent AND lead responded to it.
 * completedCycles determines the attempt number (0=initial, 1=follow-up 1, 2=follow-up 2).
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getProjectSecret } from '@/lib/actions/secrets';
import { generateReEngagementMessage } from '@/lib/ai/generate-reengagement';
import { sendToWhatsApp } from '@/lib/whatsapp/send';
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
  const errors: string[] = [];

  try {
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

      // Check business hours in project timezone
      const timezone = agent.project.organization.defaultTimezone || 'America/Lima';
      if (!isWithinBusinessHours(timezone)) {
        continue;
      }

      const now = new Date();
      const delayMs = config.delayHours * 60 * 60 * 1000;
      const windowMs = 24 * 60 * 60 * 1000; // 24h WhatsApp window
      const maxAttempts = config.maxAttempts ?? 2;

      // Find eligible leads for this agent's project
      // Anti-spam: only sends follow-ups if lead responded to previous reengagement
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
        completedCycles: number;
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
          COALESCE(cycles.cnt, 0)::int as "completedCycles"
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
        -- Get last reengagement message time
        LEFT JOIN LATERAL (
          SELECT m."createdAt" as last_re_at
          FROM messages m
          WHERE m."conversationId" = c.id
            AND m.sender = 'ai'
            AND (m.metadata->>'isReEngagement')::boolean = true
          ORDER BY m."createdAt" DESC
          LIMIT 1
        ) last_re ON true
        -- Count completed reengagement cycles (reengagement that got a lead response)
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int as cnt
          FROM messages m_re
          WHERE m_re."conversationId" = c.id
            AND m_re.sender = 'ai'
            AND (m_re.metadata->>'isReEngagement')::boolean = true
            AND EXISTS (
              SELECT 1 FROM messages m_resp
              WHERE m_resp."conversationId" = c.id
                AND m_resp.sender = 'lead'
                AND m_resp."createdAt" > m_re."createdAt"
            )
        ) cycles ON true
        WHERE l."projectId" = ${agent.projectId}
          AND l."handoffMode" = 'ai'
          AND l."archivedAt" IS NULL
          AND l."whatsappId" IS NOT NULL
          -- Lead's last message was > delayHours ago
          AND lead_msg."createdAt" < ${new Date(now.getTime() - delayMs)}
          -- Lead's last message was < 24h ago (within WhatsApp window)
          AND lead_msg."createdAt" > ${new Date(now.getTime() - windowMs)}
          -- Anti-spam: lead must have responded to the last reengagement
          -- (or no reengagement sent yet = initial)
          AND (
            last_re.last_re_at IS NULL
            OR lead_msg."createdAt" > last_re.last_re_at
          )
          -- Within max attempts: 0 cycles = initial, N cycles = follow-up N
          AND COALESCE(cycles.cnt, 0) <= ${maxAttempts}
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

          // Determine attempt number from completed cycles
          const attemptNumber = lead.completedCycles; // 0=initial, 1=follow-up 1, 2=follow-up 2

          // Select the right instructions based on attempt
          let attemptInstructions: string | null = null;
          if (attemptNumber === 1) {
            attemptInstructions = config.attempt1Instructions || null;
          } else if (attemptNumber >= 2) {
            attemptInstructions = config.attempt2Instructions || null;
          }

          // Generate AI message with context
          const reEngagementMessage = await generateReEngagementMessage(openaiKey, {
            agentName: agent.name,
            leadName,
            conversationHistory,
            promptTemplate: config.promptTemplate,
            attemptInstructions,
            systemInstructions: agent.systemInstructions,
            attemptNumber,
            leadSummary: lead.summary,
          });

          if (!reEngagementMessage) {
            skipped++;
            continue;
          }

          // Save message to conversation
          const savedMessage = await prisma.message.create({
            data: {
              conversationId: lead.conversationId,
              sender: 'ai',
              content: reEngagementMessage,
              metadata: {
                isReEngagement: true,
                attemptNumber,
                agentId: agent.id,
                agentName: agent.name,
                source: 'kairo_reengagement',
              },
            },
          });

          // Send via WhatsApp
          const sendResult = await sendToWhatsApp(
            agent.projectId,
            lead.whatsappId,
            reEngagementMessage,
            savedMessage.id
          );

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
 * Check if current time is within business hours (9 AM - 8 PM) in given timezone
 */
function isWithinBusinessHours(timezone: string): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(formatter.format(now), 10);
    return hour >= 9 && hour < 20; // 9 AM - 8 PM
  } catch {
    // If timezone is invalid, default to allowing (UTC check)
    const hour = new Date().getUTCHours();
    return hour >= 14 && hour < 25; // Approximate Lima business hours in UTC
  }
}
