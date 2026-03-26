/**
 * KAIRO - Follow-Up Notification (Email + Push)
 *
 * Called by pg_cron via pg_net when follow-up notifications are created.
 * Bell notifications are already inserted by pg_cron directly.
 * This endpoint handles email + push channels only.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendFollowUpEmail } from '@/lib/email';
import { sendPush, type PushPayload } from '@/lib/push/send-push';

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { leads: Array<{ leadId: string; leadName: string; projectId: string; organizationId: string; scheduledAt?: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.leads || !Array.isArray(body.leads) || body.leads.length === 0) {
    return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
  }

  // Limit per call to prevent abuse
  const leads = body.leads.slice(0, 20);
  let emailsSent = 0;
  let pushSent = 0;

  for (const lead of leads) {
    if (!lead.leadId || !lead.projectId) continue;

    try {
      // Get project name + members with relevant roles
      const [project, members] = await Promise.all([
        prisma.project.findUnique({
          where: { id: lead.projectId },
          select: { name: true },
        }),
        prisma.projectMember.findMany({
          where: {
            projectId: lead.projectId,
            role: { in: ['admin', 'manager', 'agent'] },
          },
          select: { userId: true },
        }),
      ]);

      const recipientIds = members.map((m) => m.userId).slice(0, 10);
      if (recipientIds.length === 0) continue;

      const projectName = project?.name || '';

      // --- Email notifications ---
      const users = await prisma.user.findMany({
        where: { id: { in: recipientIds } },
        select: {
          id: true,
          email: true,
          preferences: true,
          locale: true,
          pushSubscriptions: {
            where: { active: true },
            select: { id: true, endpoint: true, p256dh: true, auth: true },
          },
        },
      });

      const emailPromises: Promise<void>[] = [];
      const pushPromises: Promise<void>[] = [];

      for (const user of users) {
        const prefs = (user.preferences as Record<string, unknown>) || {};

        // Email (if enabled)
        if (prefs.notifyEmail !== false) {
          const ccEmails = Array.isArray(prefs.notifyCcEmails)
            ? (prefs.notifyCcEmails as string[])
            : [];
          const locale =
            (user.locale as 'es' | 'en') ||
            (prefs.language as 'es' | 'en') ||
            'es';
          const validLocale: 'es' | 'en' = locale === 'en' ? 'en' : 'es';

          emailPromises.push(
            sendFollowUpEmail({
              recipientEmail: user.email,
              ccEmails,
              leadName: lead.leadName || '',
              projectName,
              leadId: lead.leadId,
              locale: validLocale,
              scheduledAt: lead.scheduledAt,
            }).then(() => { emailsSent++; })
              .catch((err) =>
                console.error(`[FollowUp Email] Error for ${user.id.slice(0, 8)}...:`, err)
              )
          );
        }

        // Push (if enabled + has subscriptions)
        if (prefs.notifyPush !== false && user.pushSubscriptions.length > 0) {
          const payload: PushPayload = {
            title: 'Seguimiento pendiente',
            body: `Tienes un seguimiento programado con ${lead.leadName || 'un lead'}`,
            url: `/leads?leadId=${lead.leadId}`,
            tag: `kairo-follow_up_due-${lead.projectId}`,
          };

          for (const sub of user.pushSubscriptions) {
            pushPromises.push(
              sendPush(sub, payload).then((alive) => {
                if (alive) pushSent++;
                if (!alive) {
                  // Clean up expired subscription
                  prisma.pushSubscription.delete({ where: { id: sub.id } })
                    .catch((err) => console.error('[Push] Cleanup error:', err));
                }
              }).catch((err) =>
                console.error(`[FollowUp Push] Error for ${user.id.slice(0, 8)}...:`, err)
              )
            );
          }
        }
      }

      await Promise.all([...emailPromises, ...pushPromises]);
    } catch (error) {
      console.error(`[FollowUp] Error processing lead ${lead.leadId}:`, error);
    }
  }

  return NextResponse.json({
    success: true,
    processed: leads.length,
    emailsSent,
    pushSent,
  });
}
