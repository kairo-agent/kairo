'use server';

import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/actions/auth';
import { NotificationType, type Prisma } from '@prisma/client';

// ============================================
// Sanitization
// ============================================

function sanitizeText(input: string, maxLength: number): string {
  return input
    .replace(/[<>]/g, '')
    .substring(0, maxLength)
    .trim();
}

// ============================================
// Query: Get notifications for current user
// ============================================

export async function getNotifications(options?: {
  limit?: number;
  unreadOnly?: boolean;
}) {
  const user = await verifyAuth();
  if (!user) return { success: false as const, error: 'No autorizado' };

  const limit = options?.limit ?? 20;

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: user.id,
          ...(options?.unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          readAt: true,
          metadata: true,
          createdAt: true,
          projectId: true,
        },
      }),
      prisma.notification.count({
        where: {
          userId: user.id,
          readAt: null,
        },
      }),
    ]);

    // Enrich notifications with lead data (batch fetch)
    const leadIds = [
      ...new Set(
        notifications
          .map((n) => (n.metadata as Record<string, unknown> | null)?.leadId)
          .filter((id): id is string => typeof id === 'string')
      ),
    ];

    const leads =
      leadIds.length > 0
        ? await prisma.lead.findMany({
            where: { id: { in: leadIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              temperature: true,
              nextFollowUpAt: true,
            },
          })
        : [];

    const leadsMap = new Map(leads.map((l) => [l.id, l]));

    const enrichedNotifications = notifications.map((n) => {
      const leadId = (n.metadata as Record<string, unknown> | null)?.leadId;
      return {
        ...n,
        lead: typeof leadId === 'string' ? leadsMap.get(leadId) ?? null : null,
      };
    });

    return { success: true as const, notifications: enrichedNotifications, unreadCount };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return { success: false as const, error: 'Error al obtener notificaciones' };
  }
}

// ============================================
// Query: Get unread count only (lightweight)
// ============================================

export async function getUnreadNotificationCount() {
  const user = await verifyAuth();
  if (!user) return 0;

  try {
    return await prisma.notification.count({
      where: {
        userId: user.id,
        readAt: null,
      },
    });
  } catch {
    return 0;
  }
}

// ============================================
// Mutation: Mark notification as read
// ============================================

export async function markNotificationRead(notificationId: string) {
  const user = await verifyAuth();
  if (!user) return { success: false, error: 'No autorizado' };

  try {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true },
    });

    if (!notification) return { success: false, error: 'No encontrada' };
    if (notification.userId !== user.id) return { success: false, error: 'Prohibido' };

    await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    console.error('Error marking notification read:', error);
    return { success: false, error: 'Error al marcar notificacion' };
  }
}

// ============================================
// Mutation: Mark all notifications as read
// ============================================

export async function markAllNotificationsRead() {
  const user = await verifyAuth();
  if (!user) return { success: false, error: 'No autorizado' };

  try {
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    return { success: false, error: 'Error al marcar notificaciones' };
  }
}

// ============================================
// Internal: Create notification (called from webhook/server actions)
// NOT a server action - used internally only
// ============================================

export async function createNotification(data: {
  userId: string;
  organizationId: string;
  projectId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  source: string;
  expiresAt?: Date;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        projectId: data.projectId,
        type: data.type,
        title: sanitizeText(data.title, 255),
        message: sanitizeText(data.message, 1024),
        metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
        source: data.source,
        expiresAt: data.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      },
    });
  } catch (error) {
    // Fire-and-forget: log but don't throw
    console.error('Error creating notification:', error);
  }
}

// ============================================
// Internal: Notify project members about new message
// ============================================

export async function notifyProjectMembers(params: {
  projectId: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  source: string;
  excludeUserId?: string;
}) {
  try {
    // Get project members with relevant roles
    const members = await prisma.projectMember.findMany({
      where: {
        projectId: params.projectId,
        role: { in: ['admin', 'manager', 'agent'] },
      },
      select: { userId: true },
    });

    // Rate limit: max 10 notifications per call
    const recipients = members
      .filter((m) => m.userId !== params.excludeUserId)
      .slice(0, 10);

    if (recipients.length === 0) return;

    await prisma.notification.createMany({
      data: recipients.map((member) => ({
        userId: member.userId,
        organizationId: params.organizationId,
        projectId: params.projectId,
        type: params.type,
        title: sanitizeText(params.title, 255),
        message: sanitizeText(params.message, 1024),
        metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
        source: params.source,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })),
    });
  } catch (error) {
    console.error('Error notifying project members:', error);
  }
}
