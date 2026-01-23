'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  LeadFilters as LeadFiltersType,
  LeadStatus,
  LeadTemperature,
  LeadChannel,
  LeadType,
  DateRangePreset,
  LEAD_STATUS_CONFIG,
  LEAD_TEMPERATURE_CONFIG,
  LEAD_TYPE_CONFIG,
} from '@/types';
import { ChannelIcon, CHANNEL_ICON_COLORS } from '@/components/icons/ChannelIcons';
import { DateRangeDropdown } from '@/components/ui/DateRangePicker';

// ============================================
// Types
// ============================================

interface LeadFiltersProps {
  filters: LeadFiltersType;
  onFiltersChange: (filters: LeadFiltersType) => void;
  locale?: 'es' | 'en';
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
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

const DATE_RANGE_PRESETS: DateRangePreset[] = ['today', 'last7days', 'last30days', 'last90days', 'all'];

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
// Main Component
// ============================================

export function LeadFilters({
  filters,
  onFiltersChange,
  locale = 'es',
  isExpanded = false,
  onToggleExpanded,
}: LeadFiltersProps) {
  const t = useTranslations('leads');
  const tCommon = useTranslations('common');
  const [searchValue, setSearchValue] = useState(filters.search);
  const dateLocale = locale === 'es' ? es : enUS;

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

    if (filters.dateRange !== 'last30days') {
      let dateValue = t(`dateRange.${filters.dateRange}`);
      if (filters.dateRange === 'custom' && filters.customDateRange.start) {
        const start = format(filters.customDateRange.start, 'dd MMM', { locale: dateLocale });
        const end = filters.customDateRange.end
          ? format(filters.customDateRange.end, 'dd MMM', { locale: dateLocale })
          : '';
        dateValue = end ? `${start} - ${end}` : start;
      }
      active.push({
        key: 'dateRange',
        label: t('filters.dateRange'),
        value: dateValue,
        onRemove: () => onFiltersChange({
          ...filters,
          dateRange: 'last30days',
          customDateRange: { start: null, end: null }
        }),
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
      channel: 'all',
      type: 'all',
      dateRange: 'last30days',
      customDateRange: { start: null, end: null },
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
          'grid gap-4 transition-all duration-300 ease-out overflow-hidden',
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
          isExpanded
            ? 'opacity-100 max-h-[500px] pb-4'
            : 'opacity-0 max-h-0 pointer-events-none'
        )}
      >
        {/* Date Range Filter */}
        <FilterSection title={t('filters.dateRange')}>
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
        </FilterSection>

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
              icon={config.icon}
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
              icon={LEAD_TYPE_CONFIG[type].icon}
            />
          ))}
        </FilterSection>
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
