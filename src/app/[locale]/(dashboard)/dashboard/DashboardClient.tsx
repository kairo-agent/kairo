'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getDashboardStats, getDashboardCharts } from '@/lib/actions/dashboard';
import type { DashboardStats, DashboardDateRange, DashboardChartData } from '@/lib/actions/dashboard';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from 'recharts';

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
// Chart Colors
// ============================================

const TEMP_COLORS: Record<string, string> = {
  hot: '#EF4444',
  warm: '#F59E0B',
  cold: '#3B82F6',
};

const STATUS_COLORS: Record<string, string> = {
  new: '#6366F1',
  contacted: '#3B82F6',
  qualified: '#10B981',
  unqualified: '#78716C',
  no_response: '#94A3B8',
  proposal: '#F59E0B',
  negotiation: '#F97316',
  won: '#22C55E',
  customer: '#0EA5E9',
  lost: '#EF4444',
};

const SOURCE_COLORS: Record<string, string> = {
  facebook_ads: '#1877F2',
  facebook_organic: '#4599FF',
  instagram_ads: '#E4405F',
  instagram_organic: '#F77737',
  tiktok_ads: '#000000',
  tiktok_organic: '#69C9D0',
  google_ads: '#4285F4',
  website: '#10B981',
  referral: '#8B5CF6',
  social_media: '#F59E0B',
  advertising: '#F97316',
  event: '#EC4899',
  other: '#6B7280',
};

// ============================================
// SVG Icons (inline, no external dependencies)
// ============================================

function PeopleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0" />
      <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

function RobotIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
    </svg>
  );
}

function TrendUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function CustomerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </svg>
  );
}

function CloseRateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('w-4 h-4', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

// ============================================
// Stat Card Component
// ============================================

function StatCard({ icon, value, label, bgColor, isLoading, suffix }: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  bgColor: string;
  isLoading: boolean;
  suffix?: string;
}) {
  return (
    <Card className="p-4">
      <div className={cn('flex items-center gap-3 transition-opacity duration-200', isLoading && 'opacity-50')}>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', bgColor)}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">
            {value}{suffix && <span className="text-base font-medium ml-0.5">{suffix}</span>}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">{label}</p>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Chart Card wrapper
// ============================================

function ChartCard({ title, children, isLoading, isEmpty }: {
  title: string;
  children: React.ReactNode;
  isLoading: boolean;
  isEmpty?: boolean;
}) {
  const t = useTranslations('dashboard');
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{title}</h3>
      <div className={cn('transition-opacity duration-200', isLoading && 'opacity-50')}>
        {isEmpty ? (
          <div className="flex items-center justify-center h-[200px] text-xs text-[var(--text-tertiary)]">
            {t('charts.noData')}
          </div>
        ) : children}
      </div>
    </Card>
  );
}

// ============================================
// Custom Tooltip
// ============================================

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 shadow-lg">
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="text-sm font-bold text-[var(--text-primary)]">{payload[0].value}</p>
    </div>
  );
}

// ============================================
// Custom Legend for Pie Charts
// ============================================

function PieLegend({ payload, labelMap, dataMap }: { payload?: Array<{ value: string; color: string }>; labelMap: Record<string, string>; dataMap?: Record<string, number> }) {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[11px] text-[var(--text-secondary)]">
            {labelMap[entry.value] || entry.value}
            {dataMap && dataMap[entry.value] !== undefined && (
              <span className="font-semibold text-[var(--text-primary)]"> ({dataMap[entry.value]})</span>
            )}
          </span>
        </div>
      ))}
    </div>
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
  const [charts, setCharts] = useState<DashboardChartData | null>(null);
  const [activeDateRange, setActiveDateRange] = useState<DashboardDateRange>('last30days');
  const [isLoading, setIsLoading] = useState(true);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customRange, setCustomRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const [adSpend, setAdSpend] = useState<string>('');
  const customPickerRef = useRef<HTMLDivElement>(null);

  // Re-fetch on mount with correct workspace context (SSR doesn't have localStorage)
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (!hasFetchedRef.current && (selectedProject?.id || selectedOrganization?.id)) {
      hasFetchedRef.current = true;
      fetchAll(activeDateRange);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id, selectedOrganization?.id]);

  // Close custom picker on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customPickerRef.current && !customPickerRef.current.contains(event.target as Node)) {
        setShowCustomPicker(false);
      }
    }
    if (showCustomPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCustomPicker]);

  const fetchAll = useCallback(
    async (dateRange: DashboardDateRange, custom?: { start: string | null; end: string | null }) => {
      setIsLoading(true);
      try {
        const [statsResult, chartsResult] = await Promise.all([
          getDashboardStats(selectedProject?.id, selectedOrganization?.id, dateRange, custom),
          getDashboardCharts(selectedProject?.id, selectedOrganization?.id, dateRange, custom),
        ]);
        setStats(statsResult);
        setCharts(chartsResult);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
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
      fetchAll(range);
    },
    [fetchAll]
  );

  const handleCustomRangeChange = useCallback(
    (range: { start: Date | null; end: Date | null }) => {
      setCustomRange(range);
      if (range.start || range.end) {
        fetchAll('custom', {
          start: range.start?.toISOString() ?? null,
          end: range.end?.toISOString() ?? null,
        });
      }
    },
    [fetchAll]
  );

  // Close rate (won / active leads)
  const closeRate = stats.activeLeads > 0
    ? Math.round((stats.leadsWon / stats.activeLeads) * 100)
    : 0;

  // Conversion rate (customer / active leads)
  const conversionRate = stats.activeLeads > 0
    ? Math.round((stats.leadsCustomer / stats.activeLeads) * 100)
    : 0;

  // Format bar chart dates
  const barData = (charts?.leadsPerDay || []).map((d) => ({
    ...d,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString(locale === 'es' ? 'es-PE' : 'en-US', { day: '2-digit', month: 'short' }),
  }));

  // Pie chart data with labels
  const tempLabelMap: Record<string, string> = {
    hot: t('charts.hot'),
    warm: t('charts.warm'),
    cold: t('charts.cold'),
  };

  const statusLabelMap: Record<string, string> = {
    new: t('charts.new'),
    contacted: t('charts.contacted'),
    qualified: t('charts.qualified'),
    unqualified: t('charts.unqualified'),
    no_response: t('charts.noResponse'),
    proposal: t('charts.proposal'),
    negotiation: t('charts.negotiation'),
    won: t('charts.won'),
    customer: t('charts.customer'),
    lost: t('charts.lost'),
  };

  const tempData = (charts?.temperatureDistribution || []).map((d) => ({
    name: d.temperature,
    value: d.count,
  }));

  const tempDataMap: Record<string, number> = {};
  tempData.forEach((d) => { tempDataMap[d.name] = d.value; });

  const statusData = (charts?.statusDistribution || []).filter((d) => d.count > 0).map((d) => ({
    name: d.status,
    value: d.count,
  }));

  const sourceLabelMap: Record<string, string> = {
    facebook_ads: t('charts.facebookAds'),
    facebook_organic: t('charts.facebookOrganic'),
    instagram_ads: t('charts.instagramAds'),
    instagram_organic: t('charts.instagramOrganic'),
    tiktok_ads: t('charts.tiktokAds'),
    tiktok_organic: t('charts.tiktokOrganic'),
    google_ads: t('charts.googleAds'),
    website: t('charts.website'),
    referral: t('charts.referral'),
    social_media: t('charts.socialMedia'),
    advertising: t('charts.advertising'),
    event: t('charts.event'),
    other: t('charts.other'),
  };

  const sourceData = (charts?.sourceDistribution || []).filter((d) => d.count > 0).map((d) => ({
    name: d.source,
    value: d.count,
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t('welcome')}</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{t('subtitle')}</p>
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
                    ? 'bg-[var(--accent-primary)] text-[var(--kairo-midnight)] border-[var(--accent-primary)]'
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

      {/* Stats grid — 8 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard icon={<PeopleIcon />} value={stats.totalLeads} label={t('stats.totalLeads')} bgColor="bg-blue-100 dark:bg-blue-900/30" isLoading={isLoading} />
        <StatCard icon={<PeopleIcon />} value={stats.activeLeads} label={t('stats.activeLeads')} bgColor="bg-indigo-100 dark:bg-indigo-900/30" isLoading={isLoading} />
        <StatCard icon={<CheckIcon />} value={stats.leadsWon} label={t('stats.leadsWon')} bgColor="bg-green-100 dark:bg-green-900/30" isLoading={isLoading} />
        <StatCard icon={<CustomerIcon />} value={stats.leadsCustomer} label={t('stats.leadsCustomer')} bgColor="bg-sky-100 dark:bg-sky-900/30" isLoading={isLoading} />
        <StatCard icon={<CloseRateIcon />} value={closeRate} label={t('stats.closeRate')} bgColor="bg-purple-100 dark:bg-purple-900/30" isLoading={isLoading} suffix="%" />
        <StatCard icon={<TrendUpIcon />} value={conversionRate} label={t('charts.conversionRate')} bgColor="bg-emerald-100 dark:bg-emerald-900/30" isLoading={isLoading} suffix="%" />
        <StatCard icon={<HandIcon />} value={stats.leadsInHumanMode} label={t('stats.inHumanMode')} bgColor="bg-amber-100 dark:bg-amber-900/30" isLoading={isLoading} />
        <StatCard icon={<ArchiveIcon />} value={stats.archivedLeads} label={t('stats.archivedLeads')} bgColor="bg-red-100 dark:bg-red-900/30" isLoading={isLoading} />
      </div>

      {/* Cost per lead calculator */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">{t('calculator.title')}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)]">S/</span>
            <input
              type="text"
              inputMode="decimal"
              value={adSpend}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d+\.?\d{0,2}$/.test(val)) {
                  setAdSpend(val);
                }
              }}
              placeholder="0.00"
              className="w-28 px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
            />
          </div>

          <div className="hidden sm:block w-px h-8 bg-[var(--border-color)]" />

          <div className="flex items-center gap-4 sm:gap-6">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">{t('calculator.totalLeads')}</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{stats.totalLeads}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">{t('calculator.costPerLead')}</p>
              <p className="text-lg font-bold text-[var(--accent-text)]">
                S/ {adSpend && parseFloat(adSpend) > 0 && stats.totalLeads > 0
                  ? (parseFloat(adSpend) / stats.totalLeads).toFixed(2)
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Leads per day — bar chart (spans 2 cols on desktop) */}
        <div className="lg:col-span-2">
          <ChartCard title={t('charts.leadsPerDay')} isLoading={isLoading} isEmpty={barData.length === 0}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 20, right: 5, left: -20, bottom: 5 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--accent-primary)', opacity: 0.08 }} />
                <Bar dataKey="count" fill="#00E5FF" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: 'var(--text-secondary)', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Temperature — donut */}
        <ChartCard title={t('charts.temperature')} isLoading={isLoading} isEmpty={tempData.length === 0}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={tempData} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={45} outerRadius={70} paddingAngle={3} strokeWidth={0} label={({ value, cx: cxPos, cy: cyPos, midAngle = 0, outerRadius: or = 70 }) => {
                const RADIAN = Math.PI / 180;
                const x = (cxPos as number) + (or + 14) * Math.cos(-midAngle * RADIAN);
                const y = (cyPos as number) + (or + 14) * Math.sin(-midAngle * RADIAN);
                return <text x={x} y={y} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontWeight: 600, fill: 'var(--text-secondary)' }}>{value}</text>;
              }} labelLine={false}>
                {tempData.map((entry) => (
                  <Cell key={entry.name} fill={TEMP_COLORS[entry.name] || '#6B7280'} />
                ))}
              </Pie>
              <Legend content={<PieLegend labelMap={tempLabelMap} dataMap={tempDataMap} />} />
              <Tooltip formatter={(value, name) => [value, tempLabelMap[String(name)] || name]} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Status + Source distribution — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={t('charts.status')} isLoading={isLoading} isEmpty={statusData.length === 0}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                axisLine={false}
                tickLine={false}
                width={110}
                tickFormatter={(v: string) => statusLabelMap[v] || v}
              />
              <Tooltip formatter={(value) => [value, '']} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#6B7280'} />
                ))}
                <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: 'var(--text-secondary)', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('charts.source')} isLoading={isLoading} isEmpty={sourceData.length === 0}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sourceData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                axisLine={false}
                tickLine={false}
                width={110}
                tickFormatter={(v: string) => sourceLabelMap[v] || v}
              />
              <Tooltip formatter={(value) => [value, '']} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {sourceData.map((entry) => (
                  <Cell key={entry.name} fill={SOURCE_COLORS[entry.name] || '#6B7280'} />
                ))}
                <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: 'var(--text-secondary)', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
