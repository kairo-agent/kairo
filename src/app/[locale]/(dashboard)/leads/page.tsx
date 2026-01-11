'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LeadCard } from '@/components/features/LeadCard';
import { LeadFilters, FloatingFilterToggle } from '@/components/features/LeadFilters';
import { LeadDetailPanel } from '@/components/features/LeadDetailPanel';
import { leads as initialLeads, getLeadsStats } from '@/data';
import {
  Lead,
  LeadStatus,
  LeadTemperature,
  LeadFilters as LeadFiltersType,
  ViewMode,
  LEAD_STATUS_CONFIG,
  LEAD_TEMPERATURE_CONFIG,
  DATE_RANGE_CONFIG,
} from '@/types';
import { cn, formatRelativeTime, getInitials } from '@/lib/utils';
import { ChannelIcon, CHANNEL_ICON_COLORS } from '@/components/icons/ChannelIcons';

// ============================================
// Icons
// ============================================

const GridIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const TableIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const FireIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
  </svg>
);

const SunIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const SnowflakeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const EmptyIcon = () => (
  <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const SearchEmptyIcon = () => (
  <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

// ============================================
// Types for Table
// ============================================

type SortField = 'name' | 'businessName' | 'status' | 'temperature' | 'channel' | 'estimatedValue' | 'lastContactAt';
type SortDirection = 'asc' | 'desc';

// ============================================
// SortIcon Component
// ============================================

interface SortIconProps {
  field: SortField;
  currentSortField: SortField;
  sortDirection: SortDirection;
}

function SortIcon({ field, currentSortField, sortDirection }: SortIconProps) {
  if (currentSortField !== field) {
    return <span className="opacity-30 ml-1"><ChevronDownIcon /></span>;
  }
  return (
    <span className="ml-1 text-[var(--accent-primary)]">
      {sortDirection === 'asc' ? <ChevronUpIcon /> : <ChevronDownIcon />}
    </span>
  );
}

// ============================================
// Lead Table Component
// ============================================

interface LeadTableProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}

function LeadTable({ leads, onLeadClick }: LeadTableProps) {
  const t = useTranslations('leads');
  const tCommon = useTranslations('common');
  const [sortField, setSortField] = useState<SortField>('lastContactAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case 'businessName':
          comparison = (a.businessName || '').localeCompare(b.businessName || '');
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'temperature':
          const tempOrder = { hot: 3, warm: 2, cold: 1 };
          comparison = tempOrder[a.temperature] - tempOrder[b.temperature];
          break;
        case 'channel':
          comparison = a.channel.localeCompare(b.channel);
          break;
        case 'estimatedValue':
          comparison = (a.estimatedValue || 0) - (b.estimatedValue || 0);
          break;
        case 'lastContactAt':
          const dateA = a.lastContactAt ? new Date(a.lastContactAt).getTime() : 0;
          const dateB = b.lastContactAt ? new Date(b.lastContactAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [leads, sortField, sortDirection]);

  const getAvatarColor = (temperature: LeadTemperature) => {
    switch (temperature) {
      case LeadTemperature.HOT:
        return 'bg-gradient-to-br from-red-500 to-orange-500';
      case LeadTemperature.WARM:
        return 'bg-gradient-to-br from-amber-400 to-yellow-500';
      case LeadTemperature.COLD:
      default:
        return 'bg-gradient-to-br from-blue-400 to-cyan-500';
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)]">
            <th
              className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] transition-colors"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center">
                {t('table.name')}
                <SortIcon field="name" currentSortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] transition-colors"
              onClick={() => handleSort('businessName')}
            >
              <div className="flex items-center">
                {t('table.company')}
                <SortIcon field="businessName" currentSortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] transition-colors"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center">
                {t('table.status')}
                <SortIcon field="status" currentSortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] transition-colors"
              onClick={() => handleSort('temperature')}
            >
              <div className="flex items-center">
                {t('table.potential')}
                <SortIcon field="temperature" currentSortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] transition-colors"
              onClick={() => handleSort('channel')}
            >
              <div className="flex items-center">
                {t('table.channel')}
                <SortIcon field="channel" currentSortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] transition-colors"
              onClick={() => handleSort('lastContactAt')}
            >
              <div className="flex items-center">
                {t('table.lastContact')}
                <SortIcon field="lastContactAt" currentSortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              {t('table.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-primary)]">
          {sortedLeads.map((lead, index) => {
            const statusConfig = LEAD_STATUS_CONFIG[lead.status];
            const temperatureConfig = LEAD_TEMPERATURE_CONFIG[lead.temperature];
            const channelColor = CHANNEL_ICON_COLORS[lead.channel];
            const isHot = lead.temperature === LeadTemperature.HOT;

            return (
              <tr
                key={lead.id}
                onClick={() => onLeadClick(lead)}
                className={cn(
                  'cursor-pointer transition-colors',
                  'animate-fade-in',
                  isHot ? 'hot-lead-row' : 'lead-row-normal'
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {/* Name + Avatar */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm',
                        getAvatarColor(lead.temperature),
                        isHot && 'hot-lead-avatar ring-2 ring-red-400/50 ring-offset-2 ring-offset-[var(--bg-card)]'
                      )}
                    >
                      {getInitials(lead.firstName, lead.lastName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-primary)] truncate">
                        {lead.firstName} {lead.lastName}
                      </p>
                      {lead.email && (
                        <p className="text-xs text-[var(--text-tertiary)] truncate">{lead.email}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Business */}
                <td className="px-4 py-3">
                  <span className="text-sm text-[var(--text-secondary)]">
                    {lead.businessName || '-'}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <Badge
                    variant="custom"
                    customColor={statusConfig.color}
                    customBgColor={statusConfig.bgColor}
                    size="sm"
                  >
                    {statusConfig.label}
                  </Badge>
                </td>

                {/* Temperature/Potential */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{temperatureConfig.icon}</span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: temperatureConfig.color }}
                    >
                      {t(`potentialShort.${lead.temperature}`)}
                    </span>
                  </div>
                </td>

                {/* Channel */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: channelColor }}>
                      <ChannelIcon channel={lead.channel} className="w-4 h-4" />
                    </span>
                    <span className="text-sm text-[var(--text-secondary)]">{t(`channel.${lead.channel}`)}</span>
                  </div>
                </td>

                {/* Last Contact */}
                <td className="px-4 py-3">
                  <span className="text-sm text-[var(--text-tertiary)]">
                    {lead.lastContactAt ? formatRelativeTime(lead.lastContactAt) : '-'}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onLeadClick(lead)}
                      className="px-2"
                    >
                      {tCommon('buttons.view')}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Stats Card Component
// ============================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass?: string;
}

function StatCard({ label, value, icon, colorClass = 'text-[var(--accent-primary)]' }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-xl">
      <div className={cn('p-2 rounded-lg bg-[var(--bg-card)]', colorClass)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">{label}</p>
        <p className="text-lg font-bold text-[var(--text-primary)]">{value}</p>
      </div>
    </div>
  );
}

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
  type: 'no-leads' | 'no-results';
  onClearFilters?: () => void;
}

function EmptyState({ type, onClearFilters }: EmptyStateProps) {
  const t = useTranslations('leads');
  const tCommon = useTranslations('common');

  if (type === 'no-leads') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-20 h-20 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-6 text-[var(--text-tertiary)]">
          <EmptyIcon />
        </div>
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          {t('empty.noLeads.title')}
        </h3>
        <p className="text-sm text-[var(--text-secondary)] text-center max-w-md mb-6">
          {t('empty.noLeads.message')}
        </p>
        <Button variant="primary">
          <PlusIcon />
          <span>{t('addFirstLead')}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-6 text-[var(--text-tertiary)]">
        <SearchEmptyIcon />
      </div>
      <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
        {t('empty.noResults.title')}
      </h3>
      <p className="text-sm text-[var(--text-secondary)] text-center max-w-md mb-6">
        {t('empty.noResults.message')}
      </p>
      {onClearFilters && (
        <Button variant="secondary" onClick={onClearFilters}>
          {tCommon('actions.clearFilters')}
        </Button>
      )}
    </div>
  );
}


// ============================================
// Main Page Component
// ============================================

const DEFAULT_FILTERS: LeadFiltersType = {
  search: '',
  status: 'all',
  temperature: 'all',
  channel: 'all',
  type: 'all',
  dateRange: 'last7days',
  customDateRange: { start: null, end: null },
};

export default function LeadsPage() {
  const t = useTranslations('leads');
  const locale = useLocale() as 'es' | 'en';

  // State
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [filters, setFilters] = useState<LeadFiltersType>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Load view mode from localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const savedViewMode = localStorage.getItem('kairo-leads-view-mode');
      if (savedViewMode === 'grid' || savedViewMode === 'table') {
        setViewMode(savedViewMode);
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  // Save view mode to localStorage
  useEffect(() => {
    localStorage.setItem('kairo-leads-view-mode', viewMode);
  }, [viewMode]);

  // Simulated loading when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [filters]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          lead.firstName.toLowerCase().includes(searchLower) ||
          lead.lastName.toLowerCase().includes(searchLower) ||
          (lead.businessName?.toLowerCase().includes(searchLower) ?? false) ||
          (lead.email?.toLowerCase().includes(searchLower) ?? false) ||
          (lead.phone?.includes(searchLower) ?? false);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status !== 'all' && lead.status !== filters.status) {
        return false;
      }

      // Temperature filter
      if (filters.temperature !== 'all' && lead.temperature !== filters.temperature) {
        return false;
      }

      // Channel filter
      if (filters.channel !== 'all' && lead.channel !== filters.channel) {
        return false;
      }

      // Type filter
      if (filters.type !== 'all' && lead.type !== filters.type) {
        return false;
      }

      // Date range filter (based on lastContactAt)
      if (filters.dateRange === 'custom') {
        // Custom date range
        if (lead.lastContactAt) {
          const leadDate = new Date(lead.lastContactAt);
          const startDate = filters.customDateRange.start;
          const endDate = filters.customDateRange.end;

          if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (leadDate < start) {
              return false;
            }
          }

          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (leadDate > end) {
              return false;
            }
          }
        }
      } else if (filters.dateRange !== 'all') {
        // Preset date range
        const config = DATE_RANGE_CONFIG[filters.dateRange];
        if (config.days !== null && lead.lastContactAt) {
          const now = new Date();
          const cutoffDate = new Date();
          cutoffDate.setDate(now.getDate() - config.days);
          cutoffDate.setHours(0, 0, 0, 0);

          const leadDate = new Date(lead.lastContactAt);
          if (leadDate < cutoffDate) {
            return false;
          }
        }
      }

      return true;
    });
  }, [leads, filters]);

  // Stats
  const stats = useMemo(() => {
    const baseStats = getLeadsStats();
    return {
      total: leads.length,
      new: baseStats.byStatus.new,
      hot: baseStats.byTemperature.hot,
      warm: baseStats.byTemperature.warm,
      cold: baseStats.byTemperature.cold,
    };
  }, [leads]);

  // Handlers
  const handleFiltersChange = useCallback((newFilters: LeadFiltersType) => {
    setIsLoading(true);
    setFilters(newFilters);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleLeadClick = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setIsPanelOpen(true);
  }, []);

  const handleStatusChange = useCallback((lead: Lead, newStatus: LeadStatus) => {
    setLeads((prevLeads) =>
      prevLeads.map((l) =>
        l.id === lead.id ? { ...l, status: newStatus, updatedAt: new Date() } : l
      )
    );
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setTimeout(() => setSelectedLead(null), 300);
  }, []);

  const hasActiveFilters = filters.search !== '' ||
    filters.status !== 'all' ||
    filters.temperature !== 'all' ||
    filters.channel !== 'all' ||
    filters.type !== 'all' ||
    filters.dateRange !== 'last7days';

  // Count active filters (excluding search) for the floating badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.status !== 'all') count++;
    if (filters.temperature !== 'all') count++;
    if (filters.channel !== 'all') count++;
    if (filters.type !== 'all') count++;
    if (filters.dateRange !== 'last7days') count++;
    return count;
  }, [filters]);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4">
        {/* Title Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('title')}</h1>
            <Badge variant="custom" customColor="#0B1220" customBgColor="#00E5FF" size="md">
              {filteredLeads.length}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-[var(--bg-tertiary)] rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 rounded-md transition-all duration-200',
                  viewMode === 'grid'
                    ? 'bg-[var(--accent-primary)] text-[var(--kairo-midnight)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
                title={t('viewGrid')}
              >
                <GridIcon />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'p-2 rounded-md transition-all duration-200',
                  viewMode === 'table'
                    ? 'bg-[var(--accent-primary)] text-[var(--kairo-midnight)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
                title={t('viewTable')}
              >
                <TableIcon />
              </button>
            </div>

            {/* New Lead Button */}
            <Button variant="primary">
              <PlusIcon />
              <span className="hidden sm:inline">{t('newLead')}</span>
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label={t('stats.total')}
            value={stats.total}
            icon={<UsersIcon />}
            colorClass="text-[var(--accent-primary)]"
          />
          <StatCard
            label={t('stats.new')}
            value={stats.new}
            icon={<SparklesIcon />}
            colorClass="text-blue-500"
          />
          <StatCard
            label={t('stats.hot')}
            value={stats.hot}
            icon={<FireIcon />}
            colorClass="text-red-500"
          />
          <StatCard
            label={t('stats.warm')}
            value={stats.warm}
            icon={<SunIcon />}
            colorClass="text-amber-500"
          />
          <StatCard
            label={t('stats.cold')}
            value={stats.cold}
            icon={<SnowflakeIcon />}
            colorClass="text-blue-400"
          />
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 pb-6 relative">
        <LeadFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          locale={locale}
          isExpanded={isFiltersExpanded}
          onToggleExpanded={() => setIsFiltersExpanded(!isFiltersExpanded)}
        />
        <FloatingFilterToggle
          isExpanded={isFiltersExpanded}
          onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          activeCount={activeFiltersCount}
        />
      </Card>

      {/* Content */}
      <div className="relative min-h-[400px]">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-[var(--bg-primary)]/50 flex items-center justify-center z-10 rounded-xl">
            <div className="w-8 h-8 border-3 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty States */}
        {leads.length === 0 ? (
          <Card>
            <EmptyState type="no-leads" />
          </Card>
        ) : filteredLeads.length === 0 ? (
          <Card>
            <EmptyState type="no-results" onClearFilters={handleClearFilters} />
          </Card>
        ) : (
          <>
            {/* Grid View */}
            {viewMode === 'grid' && (
              <div
                className={cn(
                  'grid gap-4',
                  'grid-cols-1',
                  'sm:grid-cols-2',
                  'lg:grid-cols-3',
                  'xl:grid-cols-4',
                  'transition-opacity duration-300',
                  isLoading ? 'opacity-50' : 'opacity-100'
                )}
              >
                {filteredLeads.map((lead, index) => (
                  <div
                    key={lead.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <LeadCard
                      lead={lead}
                      onClick={handleLeadClick}
                      onStatusChange={handleStatusChange}
                      onViewDetails={handleLeadClick}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
              <div
                className={cn(
                  'transition-opacity duration-300',
                  isLoading ? 'opacity-50' : 'opacity-100'
                )}
              >
                <LeadTable
                  leads={filteredLeads}
                  onLeadClick={handleLeadClick}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Results Count */}
      {filteredLeads.length > 0 && hasActiveFilters && (
        <div className="text-center text-sm text-[var(--text-tertiary)]">
          {t('showing', { filtered: filteredLeads.length, total: leads.length })}
        </div>
      )}

      {/* Lead Detail Panel */}
      <LeadDetailPanel
        lead={selectedLead}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
