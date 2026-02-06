'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { LeadCard } from '@/components/features/LeadCard';
import LeadEditModal from '@/components/features/LeadEditModal';
import { LeadFilters, FloatingFilterToggle } from '@/components/features/LeadFilters';
import { LeadDetailPanel } from '@/components/features/LeadDetailPanel';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLoading } from '@/contexts/LoadingContext';
import { useLeads, type TransformedLead } from '@/hooks/useLeadsQuery';
import {
  LeadStatus,
  LeadTemperature,
  LeadFilters as LeadFiltersType,
  ViewMode,
  LEAD_STATUS_CONFIG,
  LEAD_TEMPERATURE_CONFIG,
  PaginationInfo,
  DEFAULT_PAGE_SIZE,
  type PageSize,
} from '@/types';
import { cn, formatRelativeTime, getInitials } from '@/lib/utils';
import { updateLeadStatus, archiveLead, unarchiveLead } from '@/lib/actions/leads';
import { ChannelIcon, CHANNEL_ICON_COLORS } from '@/components/icons/ChannelIcons';

// ============================================
// Types
// ============================================

interface LeadsPageClientProps {
  initialLeads: TransformedLead[];
  initialPagination: PaginationInfo;
  initialStats: {
    total: number;
    new: number;
    hot: number;
    warm: number;
    cold: number;
  };
}

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

const RefreshIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// ============================================
// Types for Table
// ============================================

type SortField = 'name' | 'businessName' | 'status' | 'temperature' | 'channel' | 'estimatedValue' | 'lastContactAt';
type SortDirection = 'asc' | 'desc';

// ============================================
// Helper to map string to enum
// ============================================

function mapStatus(status: string): LeadStatus {
  const statusMap: Record<string, LeadStatus> = {
    'new': LeadStatus.NEW,
    'contacted': LeadStatus.CONTACTED,
    'qualified': LeadStatus.QUALIFIED,
    'proposal': LeadStatus.PROPOSAL,
    'negotiation': LeadStatus.NEGOTIATION,
    'won': LeadStatus.WON,
    'lost': LeadStatus.LOST,
  };
  return statusMap[status] || LeadStatus.NEW;
}

function mapTemperature(temp: string): LeadTemperature {
  const tempMap: Record<string, LeadTemperature> = {
    'cold': LeadTemperature.COLD,
    'warm': LeadTemperature.WARM,
    'hot': LeadTemperature.HOT,
  };
  return tempMap[temp] || LeadTemperature.COLD;
}

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
  leads: TransformedLead[];
  onLeadClick: (lead: TransformedLead) => void;
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
          const tempOrder: Record<string, number> = { hot: 3, warm: 2, cold: 1 };
          comparison = (tempOrder[a.temperature] || 0) - (tempOrder[b.temperature] || 0);
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

  const getAvatarColor = (temperature: string) => {
    switch (temperature) {
      case 'hot':
        return 'bg-gradient-to-br from-red-500 to-orange-500';
      case 'warm':
        return 'bg-gradient-to-br from-amber-400 to-yellow-500';
      case 'cold':
      default:
        return 'bg-gradient-to-br from-blue-400 to-cyan-500';
    }
  };

  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-xl border border-[var(--border-primary)]">
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
            const statusEnum = mapStatus(lead.status);
            const temperatureEnum = mapTemperature(lead.temperature);
            const statusConfig = LEAD_STATUS_CONFIG[statusEnum];
            const temperatureConfig = LEAD_TEMPERATURE_CONFIG[temperatureEnum];
            const channelColor = CHANNEL_ICON_COLORS[lead.channel as keyof typeof CHANNEL_ICON_COLORS] || CHANNEL_ICON_COLORS.other;
            const isHot = lead.temperature === 'hot';

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
                      <ChannelIcon channel={lead.channel as keyof typeof CHANNEL_ICON_COLORS} className="w-4 h-4" />
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
  dateRange: 'all', // Changed to 'all' since we have data from 1 year
  customDateRange: { start: null, end: null },
  archiveFilter: 'active',
};

export default function LeadsPageClient({ initialLeads, initialPagination, initialStats }: LeadsPageClientProps) {
  const t = useTranslations('leads');
  const locale = useLocale() as 'es' | 'en';
  const { selectedOrganization, selectedProject } = useWorkspace();
  const { hideLoading } = useLoading();

  // Local UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE as PageSize);
  const [filters, setFilters] = useState<LeadFiltersType>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<LeadFiltersType>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedLead, setSelectedLead] = useState<TransformedLead | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<TransformedLead | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<TransformedLead | null>(null);

  // Refs for debouncing
  const filtersRef = useRef(filters);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevWorkspaceRef = useRef<string | null>(null);

  // Determine workspace IDs for queries
  const projectId = selectedProject?.id;
  const organizationId = !projectId ? selectedOrganization?.id : undefined;

  // Use React Query for leads data
  const {
    leads,
    pagination,
    stats,
    isFetching,
    isLoading: isQueryLoading,
    prefetchNextPage,
    invalidateLeads,
    refetchLeads,
  } = useLeads({
    projectId,
    organizationId,
    filters: debouncedFilters,
    page: currentPage,
    limit: pageSize,
  });

  // Track workspace changes to reset page
  useEffect(() => {
    const workspaceKey = `${selectedOrganization?.id}-${selectedProject?.id}`;
    if (prevWorkspaceRef.current && prevWorkspaceRef.current !== workspaceKey) {
      setCurrentPage(1);
    }
    prevWorkspaceRef.current = workspaceKey;
  }, [selectedOrganization?.id, selectedProject?.id]);

  // Call hideLoading when query finishes
  useEffect(() => {
    if (!isFetching && !isQueryLoading) {
      hideLoading();
    }
  }, [isFetching, isQueryLoading, hideLoading]);

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

  // Debounce filters for search, immediate for other filters
  useEffect(() => {
    // Clear any pending debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Check if only search changed
    const onlySearchChanged =
      filters.search !== filtersRef.current.search &&
      filters.status === filtersRef.current.status &&
      filters.temperature === filtersRef.current.temperature &&
      filters.channel === filtersRef.current.channel &&
      filters.type === filtersRef.current.type &&
      filters.dateRange === filtersRef.current.dateRange;

    // Update ref
    filtersRef.current = filters;

    // Debounce search queries (300ms), immediate for other filters
    const delay = onlySearchChanged ? 300 : 0;

    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedFilters(filters);
      setCurrentPage(1); // Reset to page 1 when filters change
    }, delay);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [filters]);

  // Prefetch next page when current page loads
  useEffect(() => {
    if (!isFetching && pagination.hasNext) {
      prefetchNextPage();
    }
  }, [isFetching, pagination.hasNext, prefetchNextPage]);

  // Close detail panel if selected lead is no longer in results
  useEffect(() => {
    if (selectedLead && leads.length > 0 && !leads.some(l => l.id === selectedLead.id)) {
      setIsPanelOpen(false);
      setTimeout(() => setSelectedLead(null), 300);
    }
  }, [leads, selectedLead]);

  // Handlers
  const handleFiltersChange = useCallback((newFilters: LeadFiltersType) => {
    setFilters(newFilters);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((newSize: PageSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  const handleLeadClick = useCallback((lead: TransformedLead) => {
    setSelectedLead(lead);
    setIsPanelOpen(true);
  }, []);

  const handleStatusChange = useCallback(async (lead: TransformedLead, newStatus: LeadStatus) => {
    setUpdatingLeadId(lead.id);
    try {
      const result = await updateLeadStatus(lead.id, newStatus);
      if (result.success) {
        // Invalidate cache to refresh data
        invalidateLeads();
        // Also update selected lead if it's the one being changed
        if (selectedLead?.id === lead.id) {
          setSelectedLead({ ...lead, status: newStatus });
        }
      } else {
        console.error('Error updating status:', result.error);
      }
    } catch (error) {
      console.error('Error updating lead status:', error);
    } finally {
      setUpdatingLeadId(null);
    }
  }, [invalidateLeads, selectedLead]);

  const handleArchiveLead = useCallback((lead: TransformedLead) => {
    setArchiveTarget(lead);
  }, []);

  const confirmArchiveLead = useCallback(async () => {
    if (!archiveTarget) return;
    const isArchived = !!archiveTarget.archivedAt;

    setArchiveTarget(null);
    setUpdatingLeadId(archiveTarget.id);
    try {
      const result = isArchived
        ? await unarchiveLead(archiveTarget.id)
        : await archiveLead(archiveTarget.id);

      if (result.success) {
        invalidateLeads();
        if (selectedLead?.id === archiveTarget.id) {
          setIsPanelOpen(false);
          setSelectedLead(null);
        }
      } else {
        console.error('Error archiving lead:', result.error);
      }
    } catch (error) {
      console.error('Error archiving lead:', error);
    } finally {
      setUpdatingLeadId(null);
    }
  }, [archiveTarget, invalidateLeads, selectedLead]);

  // Handler to refresh selected lead when edited - returns Promise for modal to await
  const handleLeadUpdated = useCallback(async () => {
    await refetchLeads();
  }, [refetchLeads]);

  // Sync selectedLead with leads data when it changes (after edit/refresh)
  useEffect(() => {
    if (selectedLead && leads.length > 0) {
      const updatedLead = leads.find(l => l.id === selectedLead.id);
      if (updatedLead) {
        // Only update if data actually changed to avoid infinite loops
        const hasChanged =
          updatedLead.firstName !== selectedLead.firstName ||
          updatedLead.lastName !== selectedLead.lastName ||
          updatedLead.email !== selectedLead.email ||
          updatedLead.phone !== selectedLead.phone ||
          updatedLead.position !== selectedLead.position ||
          updatedLead.temperature !== selectedLead.temperature ||
          updatedLead.status !== selectedLead.status;

        if (hasChanged) {
          setSelectedLead(updatedLead);
        }
      }
    }
  }, [leads, selectedLead]);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setTimeout(() => setSelectedLead(null), 300);
  }, []);

  const hasActiveFilters = filters.search !== '' ||
    filters.status !== 'all' ||
    filters.temperature !== 'all' ||
    filters.channel !== 'all' ||
    filters.type !== 'all' ||
    filters.dateRange !== 'all';

  // Count active filters (excluding search and channel which is hidden for MVP)
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.status !== 'all') count++;
    if (filters.temperature !== 'all') count++;
    // Channel filter oculto para MVP (solo WhatsApp)
    // if (filters.channel !== 'all') count++;
    if (filters.type !== 'all') count++;
    if (filters.dateRange !== 'all') count++;
    return count;
  }, [filters]);

  // Loading state - show spinner when fetching but not on initial load with data
  const isLoading = isFetching && leads.length === 0;
  const isRefreshing = isFetching && leads.length > 0;

  // Transform selected lead for detail panel (needs to match Lead type)
  const selectedLeadForPanel = selectedLead ? {
    id: selectedLead.id,
    projectId: selectedLead.projectId,
    firstName: selectedLead.firstName,
    lastName: selectedLead.lastName,
    email: selectedLead.email,
    phone: selectedLead.phone,
    businessName: selectedLead.businessName,
    position: selectedLead.position,
    status: mapStatus(selectedLead.status),
    temperature: mapTemperature(selectedLead.temperature),
    source: selectedLead.source as any,
    channel: selectedLead.channel as any,
    type: selectedLead.type as any,
    assignedAgentId: selectedLead.assignedAgentId,
    assignedUserId: selectedLead.assignedUserId,
    pipelineStage: selectedLead.pipelineStage,
    estimatedValue: selectedLead.estimatedValue,
    currency: selectedLead.currency as any,
    tags: selectedLead.tags,
    lastContactAt: selectedLead.lastContactAt,
    nextFollowUpAt: selectedLead.nextFollowUpAt,
    createdAt: selectedLead.createdAt,
    updatedAt: selectedLead.updatedAt,
  } : null;

  // Transform leads for LeadCard (needs Lead type with enums)
  const transformLeadForCard = (lead: TransformedLead) => ({
    id: lead.id,
    projectId: lead.projectId,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    businessName: lead.businessName,
    position: lead.position,
    status: mapStatus(lead.status),
    temperature: mapTemperature(lead.temperature),
    source: lead.source as any,
    channel: lead.channel as any,
    type: lead.type as any,
    assignedAgentId: lead.assignedAgentId,
    assignedUserId: lead.assignedUserId,
    pipelineStage: lead.pipelineStage,
    estimatedValue: lead.estimatedValue,
    currency: lead.currency as any,
    tags: lead.tags,
    archivedAt: lead.archivedAt,
    lastContactAt: lead.lastContactAt,
    nextFollowUpAt: lead.nextFollowUpAt,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  });

  // Use pagination from query (with fallback to initial data for SSR)
  const paginationInfo = pagination.total > 0 ? pagination : initialPagination;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4">
        {/* Title Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('title')}</h1>
            <Badge variant="custom" customColor="#0B1220" customBgColor="#00E5FF" size="md">
              {paginationInfo.total}
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

            {/* Refresh Button */}
            <button
              onClick={() => refetchLeads()}
              disabled={isFetching}
              className={cn(
                'p-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all',
                isFetching && 'opacity-50 cursor-not-allowed'
              )}
              title={t('refreshLeads')}
            >
              <RefreshIcon className={cn('w-5 h-5', isFetching && 'animate-spin')} />
            </button>

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
        {(isLoading || isRefreshing) && (
          <div className="absolute inset-0 bg-[var(--bg-primary)]/50 flex items-center justify-center z-10 rounded-xl">
            <div className="w-8 h-8 border-3 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty States */}
        {paginationInfo.total === 0 && !hasActiveFilters ? (
          <Card>
            <EmptyState type="no-leads" />
          </Card>
        ) : leads.length === 0 ? (
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
                {leads.map((lead, index) => (
                  <div
                    key={lead.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <LeadCard
                      lead={transformLeadForCard(lead)}
                      onClick={() => handleLeadClick(lead)}
                      onStatusChange={(_, newStatus) => handleStatusChange(lead, newStatus)}
                      onViewDetails={() => handleLeadClick(lead)}
                      onEditLead={() => {
                        setEditingLead(lead);
                        setIsEditModalOpen(true);
                      }}
                      onArchiveLead={() => handleArchiveLead(lead)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
              <div
                className={cn(
                  'transition-opacity duration-300 overflow-y-hidden',
                  isLoading ? 'opacity-50' : 'opacity-100'
                )}
              >
                <LeadTable
                  leads={leads}
                  onLeadClick={handleLeadClick}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Pagination */}
      {paginationInfo.total > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={paginationInfo.totalPages}
          totalItems={paginationInfo.total}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          isLoading={isLoading}
        />
      )}

      {/* Lead Detail Panel */}
      <LeadDetailPanel
        lead={selectedLeadForPanel}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        onStatusChange={(lead, newStatus) => {
          if (selectedLead) {
            handleStatusChange(selectedLead, newStatus);
          }
        }}
        isUpdatingStatus={updatingLeadId === selectedLead?.id}
        onLeadUpdated={handleLeadUpdated}
        projectName={selectedProject?.name}
        organizationName={selectedOrganization?.name}
      />

      {/* Edit Lead Modal (from grid card menu) */}
      <LeadEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingLead(null);
        }}
        onSuccess={async () => {
          setIsEditModalOpen(false);
          setEditingLead(null);
          refetchLeads();
        }}
        lead={editingLead ? {
          id: editingLead.id,
          firstName: editingLead.firstName,
          lastName: editingLead.lastName,
          email: editingLead.email || null,
          phone: editingLead.phone || null,
          position: editingLead.position || null,
          temperature: editingLead.temperature as LeadTemperature,
        } : null}
      />

      {/* Archive Confirmation Modal */}
      <Modal
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        size="sm"
        showCloseButton={false}
      >
        <div className="flex flex-col items-center text-center py-4">
          {archiveTarget?.archivedAt ? (
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
          )}
          <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
            {archiveTarget?.archivedAt ? t('actions.confirmUnarchive') : t('actions.confirmArchive')}
          </h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {archiveTarget?.archivedAt ? t('actions.confirmUnarchiveMessage') : t('actions.confirmArchiveMessage')}
          </p>
          <div className="mt-6 flex gap-3 w-full">
            <Button variant="ghost" onClick={() => setArchiveTarget(null)} fullWidth>
              {t('actions.cancel')}
            </Button>
            {archiveTarget?.archivedAt ? (
              <Button variant="primary" onClick={confirmArchiveLead} fullWidth>
                {t('actions.unarchiveLead')}
              </Button>
            ) : (
              <Button variant="danger" onClick={confirmArchiveLead} fullWidth>
                {t('actions.archiveLead')}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
