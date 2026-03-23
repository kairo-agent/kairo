'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getDashboardStats } from '@/lib/actions/dashboard';
import type { DashboardStats, DashboardDateRange } from '@/lib/actions/dashboard';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface DashboardClientProps {
  initialStats: DashboardStats;
}

type DateRangeOption = {
  id: DashboardDateRange;
  labelKey: string;
};

const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  { id: 'today', labelKey: 'today' },
  { id: 'yesterday', labelKey: 'yesterday' },
  { id: 'last7days', labelKey: 'last7days' },
  { id: 'last30days', labelKey: 'last30days' },
  { id: 'thisMonth', labelKey: 'thisMonth' },
  { id: 'custom', labelKey: 'custom' },
];

// ============================================
// SVG Icons (inline, no external dependencies)
// ============================================

function PeopleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3B82F6"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#10B981"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#F59E0B"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0" />
      <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

function RobotIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#00E5FF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
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
// Stat Card Component
// ============================================

function StatCard({
  icon,
  value,
  label,
  bgColor,
  isLoading,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  bgColor: string;
  isLoading: boolean;
}) {
  return (
    <Card className="p-4">
      <div
        className={cn(
          'flex items-center gap-3 transition-opacity duration-200',
          isLoading && 'opacity-50'
        )}
      >
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            bgColor
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
          <p className="text-xs text-[var(--text-secondary)]">{label}</p>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Main Dashboard Client
// ============================================

export default function DashboardClient({ initialStats }: DashboardClientProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale() as 'es' | 'en';
  const { selectedOrganization, selectedProject } = useWorkspace();

  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [activeDateRange, setActiveDateRange] = useState<DashboardDateRange>('today');
  const [isLoading, setIsLoading] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customRange, setCustomRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const customPickerRef = useRef<HTMLDivElement>(null);

  // Re-fetch on mount with correct workspace context (SSR doesn't have localStorage)
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (!hasFetchedRef.current && (selectedProject?.id || selectedOrganization?.id)) {
      hasFetchedRef.current = true;
      fetchStats(activeDateRange);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id, selectedOrganization?.id]);

  // Close custom picker on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        customPickerRef.current &&
        !customPickerRef.current.contains(event.target as Node)
      ) {
        setShowCustomPicker(false);
      }
    }

    if (showCustomPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCustomPicker]);

  const fetchStats = useCallback(
    async (
      dateRange: DashboardDateRange,
      custom?: { start: string | null; end: string | null }
    ) => {
      setIsLoading(true);
      try {
        const result = await getDashboardStats(
          selectedProject?.id,
          selectedOrganization?.id,
          dateRange,
          custom
        );
        setStats(result);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProject?.id, selectedOrganization?.id]
  );

  const handleDateRangeChange = useCallback(
    (range: DashboardDateRange) => {
      setActiveDateRange(range);
      if (range === 'custom') {
        setShowCustomPicker(true);
        return;
      }
      setShowCustomPicker(false);
      fetchStats(range);
    },
    [fetchStats]
  );

  const handleCustomRangeChange = useCallback(
    (range: { start: Date | null; end: Date | null }) => {
      setCustomRange(range);
      if (range.start || range.end) {
        fetchStats('custom', {
          start: range.start?.toISOString() ?? null,
          end: range.end?.toISOString() ?? null,
        });
      }
    },
    [fetchStats]
  );

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">
          {t('welcome')}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t('subtitle')}
        </p>
      </div>

      {/* Date range filter pills */}
      <div className="relative">
        <div className="flex flex-wrap gap-2">
          {DATE_RANGE_OPTIONS.map((option) => {
            const isActive = activeDateRange === option.id;
            return (
              <button
                key={option.id}
                onClick={() => handleDateRangeChange(option.id)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-full border transition-colors duration-150',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-1',
                  isActive
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                )}
              >
                {option.id === 'custom' ? (
                  <span className="flex items-center gap-1.5">
                    <CalendarIcon />
                    {t(`dateRange.${option.labelKey}`)}
                  </span>
                ) : (
                  t(`dateRange.${option.labelKey}`)
                )}
              </button>
            );
          })}
        </div>

        {/* Custom date picker dropdown */}
        {showCustomPicker && (
          <div
            ref={customPickerRef}
            className="absolute left-0 top-full mt-2 z-50 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-lg"
          >
            <DateRangePicker
              value={customRange}
              onChange={handleCustomRangeChange}
              onClose={() => setShowCustomPicker(false)}
              locale={locale}
            />
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<PeopleIcon />}
          value={stats.totalLeads}
          label={t('stats.totalLeads')}
          bgColor="bg-blue-100 dark:bg-blue-900/30"
          isLoading={isLoading}
        />
        <StatCard
          icon={<CheckIcon />}
          value={stats.leadsWon}
          label={t('stats.leadsWon')}
          bgColor="bg-green-100 dark:bg-green-900/30"
          isLoading={isLoading}
        />
        <StatCard
          icon={<HandIcon />}
          value={stats.leadsInHumanMode}
          label={t('stats.inHumanMode')}
          bgColor="bg-amber-100 dark:bg-amber-900/30"
          isLoading={isLoading}
        />
        <StatCard
          icon={<RobotIcon />}
          value={stats.activeAgents}
          label={t('stats.activeAgents')}
          bgColor="bg-cyan-100 dark:bg-cyan-900/30"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
