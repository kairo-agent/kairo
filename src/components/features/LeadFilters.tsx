'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { cn, getInitials } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  LeadFilters as LeadFiltersType,
  LeadStatus,
  LeadTemperature,
  LeadChannel,
  LeadType,
  LeadSource,
  DateRangePreset,
  DateFieldOption,
  LEAD_STATUS_CONFIG,
  LEAD_TEMPERATURE_CONFIG,
  LEAD_TYPE_CONFIG,
} from '@/types';
import { ChannelIcon, CHANNEL_ICON_COLORS } from '@/components/icons/ChannelIcons';
import { TemperatureIcon, LeadTypeIcon } from '@/components/icons/LeadIcons';
import { DateRangeDropdown } from '@/components/ui/DateRangePicker';
import { getProjectTeamMembers } from '@/lib/actions/leads';

// ============================================
// Types
// ============================================

interface LeadFiltersProps {
  filters: LeadFiltersType;
  onFiltersChange: (filters: LeadFiltersType) => void;
  locale?: 'es' | 'en';
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  projectId?: string;
  currentUserId?: string;
  effectiveRole?: string;
  leadVisibilityMode?: string;
}

// Team member type from getProjectTeamMembers
interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  activeColor?: string;
  activeBgColor?: string;
  icon?: React.ReactNode;
}

// ============================================
// Filter Chip Component
// ============================================

function FilterChip({
  label,
  isActive,
  onClick,
  activeColor,
  activeBgColor,
  icon,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
        'transition-all duration-200 ease-out',
        'border border-transparent',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]',
        isActive
          ? 'scale-[1.02] shadow-sm'
          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
      )}
      style={
        isActive
          ? {
              color: activeColor || 'var(--accent-primary)',
              backgroundColor: activeBgColor || 'rgba(0, 229, 255, 0.15)',
              borderColor: activeColor || 'var(--accent-primary)',
            }
          : undefined
      }
    >
      {icon && <span className="flex items-center">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

// ============================================
// Date Field Selector (inline dropdown)
// ============================================

interface DateFieldSelectorProps {
  value: DateFieldOption;
  onChange: (value: DateFieldOption) => void;
  label: string;
  options: { value: DateFieldOption; label: string }[];
}

function DateFieldSelector({ value, onChange, label, options }: DateFieldSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedLabel = options.find((o) => o.value === value)?.label || '';

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
        {label}
      </span>
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-text)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
        >
          <span>{selectedLabel}</span>
          <ChevronIcon isOpen={isOpen} className="w-3 h-3" />
        </button>
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg shadow-lg py-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => { onChange(option.value); setIsOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm transition-colors',
                  'hover:bg-[var(--bg-hover)]',
                  value === option.value
                    ? 'text-[var(--accent-text)] font-medium'
                    : 'text-[var(--text-primary)]'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Filter Section Component
// ============================================

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

function FilterSection({ title, children, className }: FilterSectionProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
        {title}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function ChevronIcon({ isOpen, className }: { isOpen: boolean; className?: string }) {
  return (
    <svg
      className={cn(
        'w-4 h-4 transition-transform duration-200',
        isOpen && 'rotate-180',
        className
      )}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

// ============================================
// Date Range Presets
// ============================================

const DATE_RANGE_PRESETS: DateRangePreset[] = ['today', 'last7days', 'last30days', 'thisMonth', 'all'];

// ============================================
// Active Filter Badge Component
// ============================================

interface ActiveFilterBadgeProps {
  label: string;
  value: string;
  color?: string;
  bgColor?: string;
  onRemove: () => void;
}

function ActiveFilterBadge({ label, value, color, bgColor, onRemove }: ActiveFilterBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all"
      style={{
        color: color || 'var(--text-primary)',
        backgroundColor: bgColor || 'var(--bg-tertiary)',
      }}
    >
      <span className="opacity-70">{label}:</span>
      <span>{value}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 transition-colors"
      >
        <CloseIcon className="w-3 h-3" />
      </button>
    </span>
  );
}

// ============================================
// Role Badge Colors
// ============================================

const ROLE_BADGE_COLORS: Record<string, { color: string; bgColor: string }> = {
  admin: { color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
  manager: { color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.15)' },
  agent: { color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  viewer: { color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.15)' },
};

// ============================================
// Assigned To Dropdown Component
// ============================================

interface AssignedToDropdownProps {
  value: string[] | 'all' | 'unassigned' | 'mine';
  onChange: (value: string[] | 'all' | 'unassigned' | 'mine') => void;
  projectId?: string;
  currentUserId?: string;
  locale?: 'es' | 'en';
  restrictToOwnAndUnassigned?: boolean;
}

function AssignedToDropdown({ value, onChange, projectId, currentUserId, locale = 'es', restrictToOwnAndUnassigned = false }: AssignedToDropdownProps) {
  const t = useTranslations('leads');
  const tAdmin = useTranslations('admin');
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Lazy load team members when dropdown opens
  useEffect(() => {
    if (isOpen && !hasLoaded && projectId) {
      setIsLoading(true);
      getProjectTeamMembers(projectId).then((result) => {
        if (result.success && result.members) {
          setMembers(result.members);
        }
        setHasLoaded(true);
        setIsLoading(false);
      });
    }
  }, [isOpen, hasLoaded, projectId]);

  // Compute display label
  const displayLabel = useMemo(() => {
    if (value === 'all') return t('filters.allUsers');
    if (value === 'mine') return t('filters.myLeads');
    if (value === 'unassigned') return t('filters.unassignedLeads');
    if (Array.isArray(value) && value.length > 0) {
      if (value.length === 1) {
        const member = members.find((m) => m.id === value[0]);
        return member ? `${member.firstName} ${member.lastName}` : '1';
      }
      return `${value.length}`;
    }
    return t('filters.allUsers');
  }, [value, members, t]);

  const isActive = value !== 'all';

  const handleToggleUser = (userId: string) => {
    const currentIds = Array.isArray(value) ? value : [];
    if (currentIds.includes(userId)) {
      const newIds = currentIds.filter((id) => id !== userId);
      onChange(newIds.length === 0 ? 'all' : newIds);
    } else {
      onChange([...currentIds, userId]);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
          'transition-all duration-200 ease-out',
          'border',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]',
          isActive
            ? 'border-[var(--accent-primary)] text-[var(--accent-text)] bg-[rgba(0,229,255,0.15)] scale-[1.02] shadow-sm'
            : 'border-transparent bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
        )}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span>{displayLabel}</span>
        <ChevronIcon isOpen={isOpen} className="w-3 h-3" />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute top-full left-0 mt-1 z-50',
            'min-w-[220px] max-h-[300px] overflow-y-auto',
            'bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg shadow-lg',
            'py-1'
          )}
        >
          {/* Quick options */}
          <button
            type="button"
            onClick={() => { onChange('all'); setIsOpen(false); }}
            className={cn(
              'w-full text-left px-3 py-2 text-sm transition-colors',
              'hover:bg-[var(--bg-hover)]',
              value === 'all' ? 'text-[var(--accent-text)] font-medium' : 'text-[var(--text-primary)]'
            )}
          >
            {t('filters.allUsers')}
          </button>
          {currentUserId && (
            <button
              type="button"
              onClick={() => { onChange('mine'); setIsOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm transition-colors',
                'hover:bg-[var(--bg-hover)]',
                value === 'mine' ? 'text-[var(--accent-text)] font-medium' : 'text-[var(--text-primary)]'
              )}
            >
              {t('filters.myLeads')}
            </button>
          )}
          <button
            type="button"
            onClick={() => { onChange('unassigned'); setIsOpen(false); }}
            className={cn(
              'w-full text-left px-3 py-2 text-sm transition-colors',
              'hover:bg-[var(--bg-hover)]',
              value === 'unassigned' ? 'text-[var(--accent-text)] font-medium' : 'text-[var(--text-primary)]'
            )}
          >
            {t('filters.unassignedLeads')}
          </button>

          {/* Team members list - hidden when restricted to own + unassigned */}
          {!restrictToOwnAndUnassigned && (
            <>
              <div className="border-t border-[var(--border-primary)] my-1" />
              {isLoading ? (
                <div className="flex items-center justify-center py-3">
                  <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                members.map((member) => {
                  const isChecked = Array.isArray(value) && value.includes(member.id);
                  const initials = getInitials(member.firstName, member.lastName);
                  const roleBadge = ROLE_BADGE_COLORS[member.role] || ROLE_BADGE_COLORS.viewer;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleToggleUser(member.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                        'hover:bg-[var(--bg-hover)]',
                        isChecked ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                      )}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
                          isChecked
                            ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                            : 'border-[var(--border-primary)]'
                        )}
                      >
                        {isChecked && (
                          <svg className="w-3 h-3 text-[var(--kairo-midnight)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)]">{initials}</span>
                      </div>
                      <span className="flex-1 text-left truncate">
                        {member.firstName} {member.lastName}
                      </span>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: roleBadge.color, backgroundColor: roleBadge.bgColor }}
                      >
                        {tAdmin(`roles.${member.role}`)}
                      </span>
                    </button>
                  );
                })
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Source Dropdown Component
// ============================================

const SOURCE_OPTIONS: LeadSource[] = [
  LeadSource.FACEBOOK_ADS,
  LeadSource.INSTAGRAM_ADS,
  LeadSource.TIKTOK_ADS,
  LeadSource.GOOGLE_ADS,
  LeadSource.FACEBOOK_ORGANIC,
  LeadSource.INSTAGRAM_ORGANIC,
  LeadSource.TIKTOK_ORGANIC,
  LeadSource.WEBSITE,
  LeadSource.REFERRAL,
  LeadSource.SOCIAL_MEDIA,
  LeadSource.ADVERTISING,
  LeadSource.EVENT,
  LeadSource.OTHER,
];

interface SourceDropdownProps {
  value: LeadSource | 'all';
  onChange: (value: LeadSource | 'all') => void;
}

function SourceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-3.5 h-3.5', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

function SourceDropdown({ value, onChange }: SourceDropdownProps) {
  const t = useTranslations('leads');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const displayLabel = value === 'all' ? t('filters.allSources') : t(`sources.${value}`);
  const isActive = value !== 'all';

  return (
    <div ref={dropdownRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
          'w-full sm:w-auto justify-between sm:justify-start',
          'transition-all duration-200 ease-out',
          'border',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]',
          isActive
            ? 'border-[var(--accent-primary)] text-[var(--accent-text)] bg-[rgba(0,229,255,0.15)] scale-[1.02] shadow-sm'
            : 'border-transparent bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
        )}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <SourceIcon />
          <span className="truncate sm:max-w-[140px]">{displayLabel}</span>
        </span>
        <ChevronIcon isOpen={isOpen} className="w-3 h-3 flex-shrink-0" />
      </button>

      {isOpen && (
        <div
          className={cn(
            'mt-2 sm:mt-1',
            'static sm:absolute sm:top-full sm:left-0 sm:z-50',
            'w-full sm:w-auto sm:min-w-[220px] max-h-[320px] overflow-y-auto',
            'bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg shadow-lg',
            'py-1'
          )}
        >
          <button
            type="button"
            onClick={() => { onChange('all'); setIsOpen(false); }}
            className={cn(
              'w-full text-left px-3 py-2 text-sm transition-colors',
              'hover:bg-[var(--bg-hover)]',
              value === 'all' ? 'text-[var(--accent-text)] font-medium' : 'text-[var(--text-primary)]'
            )}
          >
            {t('filters.allSources')}
          </button>
          <div className="border-t border-[var(--border-primary)] my-1" />
          {SOURCE_OPTIONS.map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => { onChange(source); setIsOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm transition-colors',
                'hover:bg-[var(--bg-hover)]',
                value === source ? 'text-[var(--accent-text)] font-medium' : 'text-[var(--text-primary)]'
              )}
            >
              {t(`sources.${source}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function LeadFilters({
  filters,
  onFiltersChange,
  locale = 'es',
  isExpanded = false,
  onToggleExpanded,
  projectId,
  currentUserId,
  effectiveRole,
  leadVisibilityMode = 'all_leads',
}: LeadFiltersProps) {
  const t = useTranslations('leads');
  const tCommon = useTranslations('common');
  const [searchValue, setSearchValue] = useState(filters.search);
  const dateLocale = locale === 'es' ? es : enUS;

  // Agent and viewer roles are subject to visibility restrictions
  const isRestrictedRole = effectiveRole === 'agent' || effectiveRole === 'viewer';

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFiltersChange({ ...filters, search: searchValue });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, filters, onFiltersChange]);

  // Sync search value with external filters
  useEffect(() => {
    if (filters.search !== searchValue) {
      setSearchValue(filters.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  // Calculate active filters (excluding search)
  const activeFilters = useMemo(() => {
    const active: Array<{
      key: string;
      label: string;
      value: string;
      color?: string;
      bgColor?: string;
      onRemove: () => void;
    }> = [];

    if (filters.status !== 'all') {
      const config = LEAD_STATUS_CONFIG[filters.status];
      active.push({
        key: 'status',
        label: t('filters.status'),
        value: t(`status.${filters.status}`),
        color: config.color,
        bgColor: config.bgColor,
        onRemove: () => onFiltersChange({ ...filters, status: 'all' }),
      });
    }

    if (filters.temperature !== 'all') {
      const config = LEAD_TEMPERATURE_CONFIG[filters.temperature];
      active.push({
        key: 'temperature',
        label: t('filters.potential'),
        value: t(`potential.${filters.temperature}`),
        color: config.color,
        bgColor: `${config.color}20`,
        onRemove: () => onFiltersChange({ ...filters, temperature: 'all' }),
      });
    }

    // Channel filter oculto para MVP (solo WhatsApp)
    // TODO: Habilitar cuando se agreguen más canales
    // if (filters.channel !== 'all') {
    //   const color = CHANNEL_ICON_COLORS[filters.channel];
    //   active.push({
    //     key: 'channel',
    //     label: t('filters.channel'),
    //     value: t(`channel.${filters.channel}`),
    //     color: color,
    //     bgColor: `${color}20`,
    //     onRemove: () => onFiltersChange({ ...filters, channel: 'all' }),
    //   });
    // }

    if (filters.type !== 'all') {
      const config = LEAD_TYPE_CONFIG[filters.type];
      active.push({
        key: 'type',
        label: t('filters.type'),
        value: t(`type.${filters.type}`),
        color: config.color,
        bgColor: config.bgColor,
        onRemove: () => onFiltersChange({ ...filters, type: 'all' }),
      });
    }

    if (filters.source && filters.source !== 'all') {
      active.push({
        key: 'source',
        label: t('filters.source'),
        value: t(`sources.${filters.source}`),
        onRemove: () => onFiltersChange({ ...filters, source: 'all' }),
      });
    }

    if (filters.archiveFilter && filters.archiveFilter !== 'active') {
      active.push({
        key: 'archiveFilter',
        label: t('filters.archiveFilter'),
        value: t(`filters.${filters.archiveFilter}`),
        onRemove: () => onFiltersChange({ ...filters, archiveFilter: 'active' }),
      });
    }

    if (filters.dateRange !== 'thisMonth') {
      let dateValue = t(`dateRange.${filters.dateRange}`);
      if (filters.dateRange === 'custom' && filters.customDateRange.start) {
        const start = format(filters.customDateRange.start, 'dd MMM', { locale: dateLocale });
        const end = filters.customDateRange.end
          ? format(filters.customDateRange.end, 'dd MMM', { locale: dateLocale })
          : '';
        dateValue = end ? `${start} - ${end}` : start;
      }
      const dateFieldLabel = filters.dateField === 'lastContactAt'
        ? t('filters.dateFieldLastContact')
        : t('filters.dateFieldCreatedAt');
      active.push({
        key: 'dateRange',
        label: dateFieldLabel,
        value: dateValue,
        onRemove: () => onFiltersChange({
          ...filters,
          dateRange: 'thisMonth',
          customDateRange: { start: null, end: null }
        }),
      });
    }

    if (filters.assignedTo !== 'all') {
      let assignedValue = '';
      if (filters.assignedTo === 'mine') assignedValue = t('filters.myLeads');
      else if (filters.assignedTo === 'unassigned') assignedValue = t('filters.unassignedLeads');
      else if (Array.isArray(filters.assignedTo)) assignedValue = `${filters.assignedTo.length}`;
      active.push({
        key: 'assignedTo',
        label: t('filters.assignedTo'),
        value: assignedValue,
        onRemove: () => onFiltersChange({ ...filters, assignedTo: 'all' }),
      });
    }

    return active;
  }, [filters, t, onFiltersChange, dateLocale]);

  // Count of active filters (excluding search)
  const activeFiltersCount = activeFilters.length;

  // Check if any filters are active (including search)
  const hasActiveFilters = activeFiltersCount > 0 || filters.search.trim() !== '';

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchValue('');
    onFiltersChange({
      search: '',
      status: 'all',
      temperature: 'all',
      source: 'all',
      channel: 'all',
      type: 'all',
      dateField: 'createdAt',
      dateRange: 'thisMonth',
      customDateRange: { start: null, end: null },
      archiveFilter: 'active',
      assignedTo: 'all',
    });
  }, [onFiltersChange]);

  // Filter change handlers
  const handleStatusChange = useCallback(
    (status: LeadStatus | 'all') => {
      onFiltersChange({ ...filters, status });
    },
    [filters, onFiltersChange]
  );

  const handleTemperatureChange = useCallback(
    (temperature: LeadTemperature | 'all') => {
      onFiltersChange({ ...filters, temperature });
    },
    [filters, onFiltersChange]
  );

  const handleChannelChange = useCallback(
    (channel: LeadChannel | 'all') => {
      onFiltersChange({ ...filters, channel });
    },
    [filters, onFiltersChange]
  );

  const handleTypeChange = useCallback(
    (type: LeadType | 'all') => {
      onFiltersChange({ ...filters, type });
    },
    [filters, onFiltersChange]
  );

  const handleSourceChange = useCallback(
    (source: LeadSource | 'all') => {
      onFiltersChange({ ...filters, source });
    },
    [filters, onFiltersChange]
  );

  const handleDateFieldChange = useCallback(
    (dateField: DateFieldOption) => {
      onFiltersChange({ ...filters, dateField });
    },
    [filters, onFiltersChange]
  );

  const handleDateRangeChange = useCallback(
    (dateRange: DateRangePreset) => {
      onFiltersChange({
        ...filters,
        dateRange,
        customDateRange: { start: null, end: null }
      });
    },
    [filters, onFiltersChange]
  );

  const handleCustomDateRangeChange = useCallback(
    (range: { start: Date | null; end: Date | null }) => {
      onFiltersChange({
        ...filters,
        dateRange: 'custom',
        customDateRange: range,
      });
    },
    [filters, onFiltersChange]
  );

  const handleCustomDateClick = useCallback(() => {
    if (filters.dateRange !== 'custom') {
      onFiltersChange({
        ...filters,
        dateRange: 'custom',
      });
    }
  }, [filters, onFiltersChange]);

  return (
    <div className="w-full space-y-3">
      {/* Search Bar + Active Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {/* Search Input */}
        <div className="flex-1">
          <Input
            placeholder={t('filters.search')}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            leftIcon={<SearchIcon />}
            size="md"
            className="w-full"
          />
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--status-lost)] transition-colors"
          >
            <CloseIcon className="w-3.5 h-3.5" />
            <span>{tCommon('actions.clearFilters')}</span>
          </button>
        )}
      </div>

      {/* Active Filter Badges (shown when collapsed and has filters) */}
      {!isExpanded && activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2">
          {activeFilters.map((filter) => (
            <ActiveFilterBadge
              key={filter.key}
              label={filter.label}
              value={filter.value}
              color={filter.color}
              bgColor={filter.bgColor}
              onRemove={filter.onRemove}
            />
          ))}
        </div>
      )}

      {/* Expandable Filters Grid */}
      <div
        className={cn(
          'grid gap-4 transition-all duration-300 ease-out',
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
          isExpanded
            ? 'opacity-100 max-h-[600px] pb-4 overflow-visible'
            : 'opacity-0 max-h-0 pointer-events-none overflow-hidden'
        )}
      >
        {/* Date Range Filter */}
        <div className="flex flex-col gap-2">
          <DateFieldSelector
            value={filters.dateField || 'createdAt'}
            onChange={handleDateFieldChange}
            label={t('filters.dateRange')}
            options={[
              { value: 'createdAt', label: t('filters.dateFieldCreatedAt') },
              { value: 'lastContactAt', label: t('filters.dateFieldLastContact') },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {DATE_RANGE_PRESETS.map((preset) => (
              <FilterChip
                key={preset}
                label={t(`dateRange.${preset}`)}
                isActive={filters.dateRange === preset}
                onClick={() => handleDateRangeChange(preset)}
                icon={preset === 'today' ? <CalendarIcon className="w-3.5 h-3.5" /> : undefined}
              />
            ))}
            <DateRangeDropdown
              value={filters.customDateRange}
              onChange={handleCustomDateRangeChange}
              isActive={filters.dateRange === 'custom'}
              onClick={handleCustomDateClick}
              locale={locale}
            />
          </div>
        </div>

        {/* Status Filter */}
        <FilterSection title={t('filters.status')}>
          <FilterChip
            label={tCommon('labels.all')}
            isActive={filters.status === 'all'}
            onClick={() => handleStatusChange('all')}
          />
          {Object.entries(LEAD_STATUS_CONFIG).map(([status]) => (
            <FilterChip
              key={status}
              label={t(`status.${status}`)}
              isActive={filters.status === status}
              onClick={() => handleStatusChange(status as LeadStatus)}
              activeColor={LEAD_STATUS_CONFIG[status as LeadStatus].color}
              activeBgColor={LEAD_STATUS_CONFIG[status as LeadStatus].bgColor}
            />
          ))}
        </FilterSection>

        {/* Potential Filter */}
        <FilterSection title={t('filters.potential')}>
          <FilterChip
            label={tCommon('labels.all')}
            isActive={filters.temperature === 'all'}
            onClick={() => handleTemperatureChange('all')}
          />
          {Object.entries(LEAD_TEMPERATURE_CONFIG).map(([temp, config]) => (
            <FilterChip
              key={temp}
              label={t(`potential.${temp}`)}
              isActive={filters.temperature === temp}
              onClick={() => handleTemperatureChange(temp as LeadTemperature)}
              activeColor={config.color}
              activeBgColor={`${config.color}20`}
              icon={<TemperatureIcon temperature={temp as LeadTemperature} className="w-3.5 h-3.5" />}
            />
          ))}
        </FilterSection>

        {/* Channel Filter - Oculto para MVP (solo WhatsApp por ahora) */}
        {/* TODO: Habilitar cuando se agreguen más canales (email, phone, webchat, instagram, facebook)
        <FilterSection title={t('filters.channel')}>
          <FilterChip
            label={tCommon('labels.all')}
            isActive={filters.channel === 'all'}
            onClick={() => handleChannelChange('all')}
          />
          {Object.values(LeadChannel).map((channel) => (
            <FilterChip
              key={channel}
              label={t(`channel.${channel}`)}
              isActive={filters.channel === channel}
              onClick={() => handleChannelChange(channel)}
              activeColor={CHANNEL_ICON_COLORS[channel]}
              activeBgColor={`${CHANNEL_ICON_COLORS[channel]}20`}
              icon={
                <span style={{ color: filters.channel === channel ? CHANNEL_ICON_COLORS[channel] : 'currentColor' }}>
                  <ChannelIcon channel={channel} className="w-3.5 h-3.5" />
                </span>
              }
            />
          ))}
        </FilterSection>
        */}

        {/* Type Filter */}
        <FilterSection title={t('filters.type')}>
          <FilterChip
            label={tCommon('labels.all')}
            isActive={filters.type === 'all'}
            onClick={() => handleTypeChange('all')}
          />
          {Object.values(LeadType).map((type) => (
            <FilterChip
              key={type}
              label={t(`type.${type}`)}
              isActive={filters.type === type}
              onClick={() => handleTypeChange(type)}
              activeColor={LEAD_TYPE_CONFIG[type].color}
              activeBgColor={LEAD_TYPE_CONFIG[type].bgColor}
              icon={<LeadTypeIcon type={type} className="w-3.5 h-3.5" />}
            />
          ))}
        </FilterSection>

        {/* Source Filter */}
        <FilterSection title={t('filters.source')}>
          <SourceDropdown
            value={filters.source || 'all'}
            onChange={handleSourceChange}
          />
        </FilterSection>

        {/* Archive Filter */}
        <FilterSection title={t('filters.archiveFilter')}>
          <FilterChip
            label={t('filters.active')}
            isActive={!filters.archiveFilter || filters.archiveFilter === 'active'}
            onClick={() => onFiltersChange({ ...filters, archiveFilter: 'active' })}
          />
          <FilterChip
            label={t('filters.archived')}
            isActive={filters.archiveFilter === 'archived'}
            onClick={() => onFiltersChange({ ...filters, archiveFilter: 'archived' })}
            activeColor="#EF4444"
            activeBgColor="rgba(239, 68, 68, 0.15)"
          />
          <FilterChip
            label={t('filters.showArchived')}
            isActive={filters.archiveFilter === 'all'}
            onClick={() => onFiltersChange({ ...filters, archiveFilter: 'all' })}
          />
        </FilterSection>

        {/* Assigned To Filter - hidden when visibility restricts agent/viewer to only their leads */}
        {!(isRestrictedRole && leadVisibilityMode === 'only_assigned') && (
          <FilterSection title={t('filters.assignedTo')}>
            <AssignedToDropdown
              value={filters.assignedTo}
              onChange={(assignedTo) => onFiltersChange({ ...filters, assignedTo })}
              projectId={projectId}
              currentUserId={currentUserId}
              locale={locale}
              restrictToOwnAndUnassigned={isRestrictedRole && leadVisibilityMode === 'assigned_and_unassigned'}
            />
          </FilterSection>
        )}
      </div>
    </div>
  );
}

// ============================================
// Floating Toggle Badge Component
// ============================================

interface FloatingFilterToggleProps {
  isExpanded: boolean;
  onClick: () => void;
  activeCount?: number;
}

export function FloatingFilterToggle({ isExpanded, onClick, activeCount = 0 }: FloatingFilterToggleProps) {
  const t = useTranslations('leads');

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'absolute left-1/2 -translate-x-1/2 -bottom-3',
        'inline-flex items-center gap-1.5 px-3 py-1.5',
        'text-xs font-medium rounded-full',
        'border border-[var(--border-primary)]',
        'bg-[var(--bg-card)] shadow-md',
        'hover:bg-[var(--bg-hover)] hover:border-[var(--accent-primary)]',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2',
        'z-10'
      )}
    >
      {isExpanded ? (
        <>
          <ChevronIcon isOpen={true} className="w-3.5 h-3.5" />
          <span>{t('filters.lessFilters')}</span>
        </>
      ) : (
        <>
          <span>{t('filters.moreFilters')}</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-[var(--accent-primary)] text-[#0B1220]">
              {activeCount}
            </span>
          )}
          <ChevronIcon isOpen={false} className="w-3.5 h-3.5" />
        </>
      )}
    </button>
  );
}

export default LeadFilters;
