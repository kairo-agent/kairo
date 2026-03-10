'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/actions/notifications';

const POLL_INTERVAL = 15_000; // 15 seconds

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
 * Play a short beep using Web Audio API.
 * Catches all errors silently (autoplay restrictions, missing API, etc.)
 */
function playNotificationBeep() {
  try {
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.value = 800;
    gainNode.gain.value = 0.3;
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
    // Clean up after sound finishes
    oscillator.onended = () => {
      audioCtx.close().catch(() => {});
    };
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

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Polling
  useEffect(() => {
    const interval = setInterval(pollUnreadCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [pollUnreadCount]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
