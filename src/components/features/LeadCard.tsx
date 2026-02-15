'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Lead,
  LeadStatus,
  LeadTemperature,
  LEAD_STATUS_CONFIG,
  LEAD_TEMPERATURE_CONFIG,
} from '@/types';
import { TemperatureIcon } from '@/components/icons/LeadIcons';
import { cn, formatRelativeTime, getInitials } from '@/lib/utils';
import { ChannelIcon, CHANNEL_ICON_COLORS } from '@/components/icons/ChannelIcons';
import { useWorkspace } from '@/contexts/WorkspaceContext';

// Icons as SVG components for better performance
const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const MoreIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const BuildingIcon = () => (
  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

interface LeadCardProps {
  lead: Lead;
  onClick?: (lead: Lead) => void;
  onStatusChange?: (lead: Lead, newStatus: LeadStatus) => void;
  onViewDetails?: (lead: Lead) => void;
  onEditLead?: (lead: Lead) => void;
  onScheduleFollowUp?: (lead: Lead) => void;
  onArchiveLead?: (lead: Lead) => void;
  onMoreOptions?: (lead: Lead) => void;
  className?: string;
}

export function LeadCard({
  lead,
  onClick,
  onStatusChange,
  onViewDetails,
  onEditLead,
  onScheduleFollowUp,
  onArchiveLead,
  onMoreOptions,
  className,
}: LeadCardProps) {
  const t = useTranslations('leads');
  const tCommon = useTranslations('common');
  const { selectedOrganization, selectedProject } = useWorkspace();
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const moreDropdownRef = useRef<HTMLDivElement>(null);

  const statusConfig = LEAD_STATUS_CONFIG[lead.status];
  const temperatureConfig = LEAD_TEMPERATURE_CONFIG[lead.temperature];
  const channelColor = CHANNEL_ICON_COLORS[lead.channel];
  const isHot = lead.temperature === LeadTemperature.HOT;
  const isArchived = !!lead.archivedAt;

  // Build workspace display text: "Org > Project" or just "Org" if no specific project
  const workspaceText = selectedProject?.name
    ? `${selectedOrganization?.name} \u203A ${selectedProject.name}`
    : selectedOrganization?.name || '';

  // Get avatar background color based on temperature
  const getAvatarColor = () => {
    switch (lead.temperature) {
      case LeadTemperature.HOT:
        return 'bg-gradient-to-br from-red-500 to-orange-500';
      case LeadTemperature.WARM:
        return 'bg-gradient-to-br from-amber-400 to-yellow-500';
      case LeadTemperature.COLD:
      default:
        return 'bg-gradient-to-br from-blue-400 to-cyan-500';
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
        setIsMoreDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent card click when clicking on action buttons
    if ((e.target as HTMLElement).closest('[data-action]')) {
      return;
    }
    onClick?.(lead);
  };

  const handleStatusChange = (newStatus: LeadStatus) => {
    setIsStatusDropdownOpen(false);
    onStatusChange?.(lead, newStatus);
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewDetails?.(lead);
  };

  const handleMoreOptions = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMoreDropdownOpen(!isMoreDropdownOpen);
    onMoreOptions?.(lead);
  };

  const fullName = `${lead.firstName} ${lead.lastName}`.trim();

  return (
    <Card
      hover
      onClick={handleCardClick}
      className={cn(
        'relative group',
        // Hot lead special styling
        isHot && [
          'ring-2 ring-red-500/30',
          'before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-r before:from-red-500/5 before:to-orange-500/5 before:pointer-events-none',
          'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
        ],
        className
      )}
    >
      {/* Hot Lead Indicator Bar */}
      {isHot && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-t-xl" />
      )}

      {/* Header: Avatar + Name + Status */}
      <div className="flex items-start gap-3">
        {/* Avatar with initials */}
        <div
          className={cn(
            'flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md',
            getAvatarColor(),
            isHot && 'hot-lead-avatar ring-2 ring-red-400/50 ring-offset-2 ring-offset-[var(--bg-card)]'
          )}
        >
          {getInitials(lead.firstName, lead.lastName)}
        </div>

        {/* Name and Workspace */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)] truncate leading-tight">
            {fullName}
          </h3>
          {workspaceText && (
            <p className="text-sm text-[var(--text-secondary)] truncate mt-0.5 flex items-center gap-1">
              <BuildingIcon />
              <span>{workspaceText}</span>
            </p>
          )}
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          {lead.nextFollowUpAt && (() => {
            const isOverdue = new Date(lead.nextFollowUpAt) < new Date();
            const isUpcoming = !isOverdue && new Date(lead.nextFollowUpAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;
            return (
              <Badge
                variant="custom"
                customColor={isOverdue ? '#EF4444' : isUpcoming ? '#F97316' : '#6B7280'}
                customBgColor={isOverdue ? 'rgba(239, 68, 68, 0.15)' : isUpcoming ? 'rgba(249, 115, 22, 0.15)' : 'rgba(107, 114, 128, 0.15)'}
                size="sm"
              >
                {isOverdue ? t('followUp.overdue') : isUpcoming ? t('followUp.upcoming') : t('followUp.scheduled')}
              </Badge>
            );
          })()}
          {isArchived && (
            <Badge
              variant="custom"
              customColor="#9CA3AF"
              customBgColor="rgba(156, 163, 175, 0.15)"
              size="sm"
            >
              {t('filters.archivedBadge')}
            </Badge>
          )}
          <Badge
            variant="custom"
            customColor={statusConfig.color}
            customBgColor={statusConfig.bgColor}
            size="sm"
          >
            {t(`status.${lead.status}`)}
          </Badge>
        </div>
      </div>

      {/* Meta Information */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        {/* Temperature */}
        <div
          className="flex items-center gap-1"
          title={`${tCommon('labels.potential')}: ${t(`potential.${lead.temperature}`)}`}
        >
          <span style={{ color: temperatureConfig.color }}>
            <TemperatureIcon temperature={lead.temperature} className="w-4 h-4" />
          </span>
          <span
            className="text-xs font-medium"
            style={{ color: temperatureConfig.color }}
          >
            {t(`potential.${lead.temperature}`)}
          </span>
        </div>

        {/* Channel */}
        <div
          className="flex items-center gap-1.5"
          title={`${tCommon('labels.channel')}: ${t(`channel.${lead.channel}`)}`}
        >
          <span style={{ color: channelColor }}>
            <ChannelIcon channel={lead.channel} className="w-4 h-4" />
          </span>
          <span className="text-xs text-[var(--text-secondary)]">{t(`channel.${lead.channel}`)}</span>
        </div>

      </div>

      {/* Last Contact */}
      {lead.lastContactAt && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
          <ClockIcon />
          <span>{tCommon('labels.lastContact')}: {formatRelativeTime(lead.lastContactAt)}</span>
        </div>
      )}

      {/* Actions */}
      <div
        className="mt-4 pt-3 border-t border-[var(--border-primary)] flex items-center gap-2"
        data-action="true"
      >
        {/* View Details Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleViewDetails}
          className="flex-1 justify-center"
        >
          <EyeIcon />
          <span>{tCommon('actions.viewDetails')}</span>
        </Button>

        {/* Status Dropdown */}
        <div className="relative" ref={statusDropdownRef}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsStatusDropdownOpen(!isStatusDropdownOpen);
            }}
            className="px-2"
          >
            <span className="sr-only">{t('actions.changeStatus')}</span>
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusConfig.color }}
            />
            <ChevronDownIcon />
          </Button>

          {/* Status Dropdown Menu */}
          {isStatusDropdownOpen && (
            <div className="absolute right-0 bottom-full mb-1 w-40 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg shadow-lg overflow-hidden z-20">
              <div className="py-1">
                {Object.entries(LEAD_STATUS_CONFIG).map(([status, config]) => (
                  <button
                    key={status}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(status as LeadStatus);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--bg-tertiary)] transition-colors',
                      lead.status === status && 'bg-[var(--bg-tertiary)]'
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-[var(--text-primary)]">{t(`status.${status}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* More Options */}
        <div className="relative" ref={moreDropdownRef}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMoreOptions}
            className="px-2"
          >
            <span className="sr-only">{t('actions.moreOptions')}</span>
            <MoreIcon />
          </Button>

          {/* More Options Dropdown */}
          {isMoreDropdownOpen && (
            <div className="absolute right-0 bottom-full mb-1 w-44 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg shadow-lg overflow-hidden z-20">
              <div className="py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMoreDropdownOpen(false);
                    onEditLead?.(lead);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  {t('actions.editLead')}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMoreDropdownOpen(false);
                    onScheduleFollowUp?.(lead);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  {t('actions.scheduleFollowUp')}
                </button>
                <hr className="my-1 border-[var(--border-primary)]" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMoreDropdownOpen(false);
                    onArchiveLead?.(lead);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  {lead.archivedAt ? t('actions.unarchiveLead') : t('actions.archiveLead')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// Export type for external use
export type { LeadCardProps };
