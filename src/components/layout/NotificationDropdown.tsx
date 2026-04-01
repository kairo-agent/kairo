'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import { useRouter } from '@/i18n/routing';
import { useWorkspaceOptional } from '@/contexts/WorkspaceContext';

const BellIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const MessageIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const HandoffIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
  </svg>
);

const FireIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
  </svg>
);

function getNotificationIcon(type: string) {
  switch (type) {
    case 'new_message':
      return <MessageIcon />;
    case 'follow_up_due':
      return <CalendarIcon />;
    case 'lead_assigned':
      return <UserIcon />;
    case 'handoff_request':
      return <HandoffIcon />;
    case 'hot_lead':
      return <FireIcon />;
    default:
      return <MessageIcon />;
  }
}

function getNotificationIconColor(type: string) {
  switch (type) {
    case 'new_message':
      return 'text-blue-500 bg-blue-500/10';
    case 'follow_up_due':
      return 'text-orange-500 bg-orange-500/10';
    case 'lead_assigned':
      return 'text-green-500 bg-green-500/10';
    case 'handoff_request':
      return 'text-red-500 bg-red-500/10';
    case 'hot_lead':
      return 'text-red-500 bg-red-500/10';
    default:
      return 'text-[var(--text-tertiary)] bg-[var(--bg-tertiary)]';
  }
}

function getTemperatureBadge(temperature: string): { label: string; className: string } | null {
  switch (temperature) {
    case 'hot':
      return { label: 'Alto', className: 'bg-red-500/10 text-red-500' };
    case 'warm':
      return { label: 'Medio', className: 'bg-amber-500/10 text-amber-500' };
    case 'cold':
      return { label: 'Bajo', className: 'bg-blue-500/10 text-blue-500' };
    default:
      return null;
  }
}

// formatTimeAgo removed — now uses formatRelativeTime from @/lib/utils

function formatFollowUpDate(date: Date, timezone?: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

export function NotificationDropdown() {
  const t = useTranslations('notifications');
  const tLeads = useTranslations('leads');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const workspace = useWorkspaceOptional();
  const selectedProject = workspace?.selectedProject ?? null;
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch,
  } = useNotifications(selectedProject?.id);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Refetch when opening
  const handleToggle = () => {
    if (!isOpen) {
      refetch();
    }
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = (notification: typeof notifications[number]) => {
    if (!notification.readAt) {
      markAsRead(notification.id);
    }
    setIsOpen(false);

    // Navigate to leads page with leadId to open detail panel
    const leadId = notification.lead?.id || (notification.metadata as Record<string, unknown> | null)?.leadId;
    if (typeof leadId === 'string') {
      router.push(`/leads?leadId=${leadId}` as any);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className={cn(
          'p-2 rounded-lg relative',
          'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
          'transition-colors duration-200'
        )}
        aria-label={t('title')}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-[var(--status-lost)] rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {t('title')}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-[var(--accent-text)] hover:underline"
              >
                {t('markAllRead')}
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <BellIcon />
                <p className="mt-2 text-sm text-[var(--text-tertiary)]">
                  {t('empty')}
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                const lead = notification.lead;
                const leadName = lead
                  ? [lead.firstName, lead.lastName].filter(Boolean).join(' ')
                  : null;
                const tempBadge = lead ? getTemperatureBadge(lead.temperature) : null;

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                      'hover:bg-[var(--bg-tertiary)]',
                      !notification.readAt && 'bg-[var(--accent-primary)]/5'
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5',
                      getNotificationIconColor(notification.type)
                    )}>
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Lead name + temperature badge */}
                      <div className="flex items-center gap-1.5">
                        <p className={cn(
                          'text-sm truncate',
                          notification.readAt
                            ? 'text-[var(--text-secondary)]'
                            : 'text-[var(--text-primary)] font-medium'
                        )}>
                          {leadName || notification.title}
                        </p>
                        {tempBadge && (
                          <span className={cn(
                            'flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                            tempBadge.className
                          )}>
                            {tLeads(`potentialShort.${lead!.temperature}`)}
                          </span>
                        )}
                      </div>

                      {/* Notification message */}
                      <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">
                        {notification.message}
                      </p>

                      {/* Follow-up date (for follow_up_due notifications) */}
                      {notification.type === 'follow_up_due' && lead?.nextFollowUpAt && (
                        <p className="text-[10px] text-orange-500 mt-0.5">
                          {t('scheduledFor')} {formatFollowUpDate(lead.nextFollowUpAt, workspace?.selectedOrganization?.defaultTimezone)}
                        </p>
                      )}

                      {/* Time ago */}
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!notification.readAt && (
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-[var(--accent-primary)] mt-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
