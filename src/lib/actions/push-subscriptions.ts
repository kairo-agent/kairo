'use server';

import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/actions/auth';

// ============================================
// Subscribe: Register a push subscription for current user
// ============================================

export async function subscribePush(data: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const user = await verifyAuth();
  if (!user) return { success: false, error: 'No autorizado' };

  try {
    // Upsert: if same endpoint exists for user, update keys
    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: user.id,
          endpoint: data.endpoint,
        },
      },
      create: {
        userId: user.id,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent?.substring(0, 512),
        active: true,
      },
      update: {
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent?.substring(0, 512),
        active: true,
      },
    });

    // Also set notifyPush preference to true
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { preferences: true },
    });
    const prefs = (currentUser?.preferences as Record<string, unknown>) || {};
    if (prefs.notifyPush !== true) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          preferences: JSON.parse(JSON.stringify({ ...prefs, notifyPush: true })),
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[Push] Subscribe error:', error);
    return { success: false, error: 'Error al registrar suscripcion' };
  }
}

// ============================================
// Unsubscribe: Remove a push subscription
// ============================================

export async function unsubscribePush(endpoint: string) {
  const user = await verifyAuth();
  if (!user) return { success: false, error: 'No autorizado' };

  try {
    await prisma.pushSubscription.deleteMany({
      where: {
        userId: user.id,
        endpoint,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[Push] Unsubscribe error:', error);
    return { success: false, error: 'Error al eliminar suscripcion' };
  }
}

// ============================================
// Toggle all push subscriptions (ON/OFF)
// Called from Profile toggle
// ============================================

export async function toggleAllPushSubscriptions(active: boolean) {
  const user = await verifyAuth();
  if (!user) return { success: false, error: 'No autorizado' };

  try {
    // Update all subscriptions
    await prisma.pushSubscription.updateMany({
      where: { userId: user.id },
      data: { active },
    });

    // Update user preference
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { preferences: true },
    });
    const prefs = (currentUser?.preferences as Record<string, unknown>) || {};
    await prisma.user.update({
      where: { id: user.id },
      data: {
        preferences: JSON.parse(JSON.stringify({ ...prefs, notifyPush: active })),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[Push] Toggle error:', error);
    return { success: false, error: 'Error al actualizar preferencia' };
  }
}

// ============================================
// Get push status for current user
// Used by Profile page toggle
// ============================================

export async function getPushStatus() {
  const user = await verifyAuth();
  if (!user) return { enabled: false, subscriptionCount: 0 };

  try {
    const [count, currentUser] = await Promise.all([
      prisma.pushSubscription.count({
        where: { userId: user.id, active: true },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { preferences: true },
      }),
    ]);

    const prefs = (currentUser?.preferences as Record<string, unknown>) || {};

    return {
      enabled: prefs.notifyPush !== false && count > 0,
      subscriptionCount: count,
    };
  } catch {
    return { enabled: false, subscriptionCount: 0 };
  }
}
