import webPush from 'web-push';

// ============================================
// VAPID Configuration
// ============================================

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:soporte@kairoagent.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// ============================================
// Types
// ============================================

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  actions?: Array<{ action: string; title: string }>;
}

interface PushSubscriptionData {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ============================================
// Send push to a single subscription
// Returns false if subscription is expired (410)
// ============================================

export async function sendPush(
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID keys not configured, skipping');
    return true; // Don't mark as expired
  }

  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      { TTL: 86400 } // 24 hours
    );
    return true;
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;

    if (statusCode === 410 || statusCode === 404) {
      // Subscription expired or invalid - caller should delete it
      console.log(`[Push] Subscription ${subscription.id.slice(0, 8)}... expired (${statusCode})`);
      return false;
    }

    console.error(`[Push] Error sending to ${subscription.id.slice(0, 8)}...:`, statusCode || error);
    return true; // Don't delete on transient errors
  }
}
