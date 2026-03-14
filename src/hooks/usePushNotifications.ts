'use client';

import { useState, useEffect, useCallback } from 'react';
import { subscribePush, unsubscribePush } from '@/lib/actions/push-subscriptions';

// ============================================
// Hook: Manage Web Push subscription lifecycle
// ============================================

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

interface UsePushNotificationsReturn {
  permission: PushPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  /** Show pre-permission modal for this user? */
  shouldShowModal: boolean;
  /** User chose "Activar" -> request browser permission + subscribe */
  requestAndSubscribe: () => Promise<boolean>;
  /** User chose "Ahora no" -> dismiss modal for this session */
  dismissModal: () => void;
  /** Unsubscribe current browser */
  unsubscribeCurrentBrowser: () => Promise<void>;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Dismiss persistence: localStorage with 3-day cooldown, max 3 attempts
const DISMISS_COOLDOWN_DAYS = 3;
const MAX_DISMISS_COUNT = 3;

interface DismissData {
  count: number;
  dismissedAt: number; // timestamp
}

function getDismissData(userId: string): DismissData | null {
  try {
    const raw = localStorage.getItem(`kairo_push_dismiss_${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as DismissData;
  } catch {
    return null;
  }
}

function isDismissed(userId: string): boolean {
  const data = getDismissData(userId);
  if (!data) return false;

  // Max attempts reached → never show again
  if (data.count >= MAX_DISMISS_COUNT) return true;

  // Still within cooldown period
  const cooldownMs = DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() - data.dismissedAt < cooldownMs) return true;

  return false;
}

function saveDismiss(userId: string): void {
  const data = getDismissData(userId);
  const newData: DismissData = {
    count: (data?.count || 0) + 1,
    dismissedAt: Date.now(),
  };
  localStorage.setItem(`kairo_push_dismiss_${userId}`, JSON.stringify(newData));
}

export function usePushNotifications(userId?: string): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<PushPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Check support + current state on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermission('unsupported');
      setIsLoading(false);
      return;
    }

    setPermission(Notification.permission as PushPermission);

    // Check if dismissed (localStorage: 3-day cooldown, max 3 attempts)
    if (userId && isDismissed(userId)) {
      setDismissed(true);
    }

    // Check existing subscription
    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
        setIsLoading(false);
      });
    }).catch(() => {
      setIsLoading(false);
    });
  }, [userId]);

  // Register service worker on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[SW] Registration failed:', err);
    });
  }, []);

  const shouldShowModal =
    permission === 'default' && !isSubscribed && !dismissed && !isLoading && !!VAPID_PUBLIC_KEY;

  const requestAndSubscribe = useCallback(async (): Promise<boolean> => {
    if (!VAPID_PUBLIC_KEY) return false;

    try {
      setIsLoading(true);

      // Request browser permission
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);

      if (result !== 'granted') {
        setIsLoading(false);
        return false;
      }

      // Subscribe with VAPID key
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setIsLoading(false);
        return false;
      }

      // Save to DB
      const res = await subscribePush({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      });

      if (res.success) {
        setIsSubscribed(true);
        setIsLoading(false);
        return true;
      }

      setIsLoading(false);
      return false;
    } catch (error) {
      console.error('[Push] Subscribe error:', error);
      setIsLoading(false);
      return false;
    }
  }, []);

  const dismissModal = useCallback(() => {
    setDismissed(true);
    if (userId) {
      saveDismiss(userId);
    }
  }, [userId]);

  const unsubscribeCurrentBrowser = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (error) {
      console.error('[Push] Unsubscribe error:', error);
    }
  }, []);

  return {
    permission,
    isSubscribed,
    isLoading,
    shouldShowModal,
    requestAndSubscribe,
    dismissModal,
    unsubscribeCurrentBrowser,
  };
}
