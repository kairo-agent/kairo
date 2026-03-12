'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/actions/notifications';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Safety-net fallback polling (Realtime handles instant updates)
const FALLBACK_POLL_INTERVAL = 120_000; // 2 minutes

interface NotificationLead {
  id: string;
  firstName: string;
  lastName: string | null;
  temperature: string;
  nextFollowUpAt: Date | null;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: Date | null;
  metadata: Record<string, unknown> | null;
  lead: NotificationLead | null;
  createdAt: Date;
  projectId: string;
}

/**
 * Singleton AudioContext — unlocked on first user interaction.
 * Browsers suspend AudioContext created without a user gesture,
 * so we resume it the first time the user clicks/touches/presses a key.
 */
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioContext();
    // Unlock on first user gesture (required by Chrome autoplay policy)
    const unlock = () => {
      if (sharedAudioCtx?.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {});
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }
  return sharedAudioCtx;
}

/**
 * Play a short beep using Web Audio API.
 * Catches all errors silently (autoplay restrictions, missing API, etc.)
 */
function playNotificationBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state === 'suspended') return;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 800;
    gainNode.gain.value = 0.3;
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.15);
  } catch {
    // Silently ignore - browser may not support Web Audio API
  }
}

export function useNotifications(projectId?: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const previousUnreadCountRef = useRef<number | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    const result = await getNotifications({ limit: 20, projectId });
    if (result.success && 'notifications' in result) {
      setNotifications(result.notifications as unknown as Notification[]);
      setUnreadCount(result.unreadCount);

      // Initialize previous count on first fetch (no sound on page load)
      if (previousUnreadCountRef.current === null) {
        previousUnreadCountRef.current = result.unreadCount;
      }
    }
    setIsLoading(false);
  }, [projectId]);

  // Poll for unread count (lightweight)
  const pollUnreadCount = useCallback(async () => {
    const count = await getUnreadNotificationCount(projectId);

    // Play sound if new notifications arrived (not on initial load)
    if (
      previousUnreadCountRef.current !== null &&
      count > previousUnreadCountRef.current
    ) {
      playNotificationBeep();
    }

    previousUnreadCountRef.current = count;
    setUnreadCount(count);
  }, [projectId]);

  // Mark single as read
  const markAsRead = useCallback(async (notificationId: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, readAt: new Date() } : n))
    );
    setUnreadCount((prev) => {
      const newCount = Math.max(0, prev - 1);
      previousUnreadCountRef.current = newCount;
      return newCount;
    });

    const result = await markNotificationRead(notificationId);
    if (!result.success) {
      // Rollback
      await fetchNotifications();
    }
  }, [fetchNotifications]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date() })));
    setUnreadCount(0);
    previousUnreadCountRef.current = 0;

    const result = await markAllNotificationsRead(projectId);
    if (!result.success) {
      await fetchNotifications();
    }
  }, [fetchNotifications, projectId]);

  // Initialize AudioContext early so user gestures can unlock it
  useEffect(() => {
    getAudioContext();
  }, []);

  // Reset baseline when projectId changes (avoid false positive beeps)
  useEffect(() => {
    previousUnreadCountRef.current = null;
  }, [projectId]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ============================================
  // Supabase Realtime subscription for instant notification delivery
  // Falls back to long-interval polling as safety net
  // ============================================
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const startPolling = () => {
      if (!interval) {
        interval = setInterval(pollUnreadCount, FALLBACK_POLL_INTERVAL);
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Fetch immediately when tab becomes visible, then resume fallback polling
        pollUnreadCount();
        startPolling();
      }
    };

    // Set up Realtime subscription
    const setupRealtime = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled || !user) return;

        const channelName = projectId
          ? `notifications:${user.id}:${projectId}`
          : `notifications:${user.id}`;

        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `userId=eq.${user.id}`,
            },
            (payload) => {
              // If filtering by projectId, check the inserted row matches
              if (projectId && payload.new?.projectId !== projectId) return;

              console.log('[RT] New notification received:', payload.new?.id);

              // Play notification sound
              if (previousUnreadCountRef.current !== null) {
                playNotificationBeep();
              }

              // Refetch full list to get enriched data (lead info, etc.)
              fetchNotifications();
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log(`[RT] Subscribed to notifications channel: ${channelName}`);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn(`[RT] Notifications channel error: ${status}`);
            }
          });
      } catch (err) {
        console.warn('[RT] Failed to set up notifications realtime:', err);
      }
    };

    // Start both: realtime for instant updates, polling as safety net
    setupRealtime();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channel) {
        const supabase = createClient();
        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [pollUnreadCount, fetchNotifications, projectId]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
