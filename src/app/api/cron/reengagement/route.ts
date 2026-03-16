/**
 * KAIRO - ReEngagement Cron Job
 *
 * Runs every 15 minutes via Vercel Cron.
 * Finds leads who stopped responding and sends ONE AI-generated
 * follow-up message within the WhatsApp 24h customer service window.
 *
 * Conditions for re-engagement:
 * 1. Agent has reEngagementConfig.enabled = true
 * 2. Lead is in AI mode (handoffMode = 'ai'), not archived
 * 3. Last message in conversation is from AI (lead didn't respond)
 * 4. Lead's last message was > delayHours ago but < 24h ago (within window)
 * 5. No re-engagement already sent for this silence period
 * 6. Current time is within business hours (9 AM - 8 PM project timezone)
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getProjectSecret } from '@/lib/actions/secrets';
import { generateReEngagementMessage } from '@/lib/ai/generate-reengagement';
import { sendToWhatsApp } from '@/lib/whatsapp/send';
import type { ReEngagementConfig } from '@/lib/actions/reengagement';

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

      // Find eligible leads for this agent's project
      // Using raw query for complex conditions with subqueries
      const eligibleLeads = await prisma.$queryRaw<Array<{
        id: string;
        firstName: string;
        lastName: string | null;
        whatsappId: string | null;
        conversationId: string;
        lastLeadMessageAt: Date;
        lastReEngagementAt: Date | null;
      }>>`
        SELECT
          l.id,
          l."firstName",
          l."lastName",
          l."whatsappId",
          c.id as "conversationId",
          lead_msg."createdAt" as "lastLeadMessageAt",
          l."lastReEngagementAt"
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
        WHERE l."projectId" = ${agent.projectId}
          AND l."handoffMode" = 'ai'
          AND l."archivedAt" IS NULL
          AND l."whatsappId" IS NOT NULL
          -- Lead's last message was > delayHours ago
          AND lead_msg."createdAt" < ${new Date(now.getTime() - delayMs)}
          -- Lead's last message was < 24h ago (within WhatsApp window)
          AND lead_msg."createdAt" > ${new Date(now.getTime() - windowMs)}
          -- No re-engagement sent for this silence period
          AND (
            l."lastReEngagementAt" IS NULL
            OR l."lastReEngagementAt" < lead_msg."createdAt"
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
            select: { sender: true, content: true },
          });

          const conversationHistory = messages.reverse().map(m => ({
            role: (m.sender === 'lead' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
          }));

          const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(' ');

          // Generate AI message
          const reEngagementMessage = await generateReEngagementMessage(openaiKey, {
            agentName: agent.name,
            leadName,
            conversationHistory,
            promptTemplate: config.promptTemplate,
            systemInstructions: agent.systemInstructions,
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
