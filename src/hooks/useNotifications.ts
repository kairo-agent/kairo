'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/actions/notifications';

const POLL_INTERVAL = 15_000; // 15 seconds

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  projectId: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    const result = await getNotifications({ limit: 20 });
    if (result.success && 'notifications' in result) {
      setNotifications(result.notifications as unknown as Notification[]);
      setUnreadCount(result.unreadCount);
    }
    setIsLoading(false);
  }, []);

  // Poll for unread count (lightweight)
  const pollUnreadCount = useCallback(async () => {
    const count = await getUnreadNotificationCount();
    setUnreadCount(count);
  }, []);

  // Mark single as read
  const markAsRead = useCallback(async (notificationId: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, readAt: new Date() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

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

    const result = await markAllNotificationsRead();
    if (!result.success) {
      await fetchNotifications();
    }
  }, [fetchNotifications]);

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
