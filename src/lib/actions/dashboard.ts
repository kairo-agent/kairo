// ============================================
// KAIRO - Dashboard Server Actions
// Real-time stats for the dashboard overview
// ============================================

'use server';

import { prisma } from '@/lib/prisma';
import { verifyAuth } from './auth';
import { getAccessibleProjectIds, type PreVerifiedAuth } from './leads';
import { getVisibilityContext, buildVisibilityFilter, type VisibilityContext } from '@/lib/lead-visibility';
import type { Prisma } from '@prisma/client';
import { getEffectiveTimezone, getStartOfDayInTimezone, getEndOfDayInTimezone, getStartOfMonthInTimezone, getDateStringInTimezone, getYesterdayInTimezone } from '@/lib/timezone';

// ============================================
// Types
// ============================================

export interface DashboardStats {
  totalLeads: number;
  activeLeads: number;
  leadsWon: number;
  leadsCustomer: number;
  leadsInHumanMode: number;
  activeAgents: number;
  archivedLeads: number;
}

export interface DashboardChartData {
  leadsPerDay: Array<{ date: string; count: number }>;
  temperatureDistribution: Array<{ temperature: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
  sourceDistribution: Array<{ source: string; count: number }>;
}

export type DashboardDateRange =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'custom';

// ============================================
// HELPER: Build date filter
// ============================================

function buildDateFilter(
  dateRange: DashboardDateRange,
  customDateRange?: { start: string | null; end: string | null },
  timezone: string = 'America/Lima'
): Prisma.DateTimeFilter | undefined {
  const now = new Date();

  switch (dateRange) {
    case 'today': {
      return { gte: getStartOfDayInTimezone(timezone) };
    }
    case 'yesterday': {
      const yesterday = getYesterdayInTimezone(timezone);
      return { gte: getStartOfDayInTimezone(timezone, yesterday), lt: getStartOfDayInTimezone(timezone) };
    }
    case 'last7days': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { gte: start };
    }
    case 'last30days': {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { gte: start };
    }
    case 'thisMonth': {
      return { gte: getStartOfMonthInTimezone(timezone) };
    }
    case 'custom': {
      if (customDateRange?.start || customDateRange?.end) {
        const filter: Prisma.DateTimeFilter = {};
        if (customDateRange.start) filter.gte = getStartOfDayInTimezone(timezone, new Date(customDateRange.start));
        if (customDateRange.end) filter.lt = getEndOfDayInTimezone(timezone, new Date(customDateRange.end));
        return filter;
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

// ============================================
// HELPER: Build project where clause
// ============================================

function buildProjectFilter(
  accessibleProjects: string[] | 'all_in_org',
  organizationId?: string
): Prisma.LeadWhereInput {
  if (accessibleProjects === 'all_in_org' && organizationId) {
    return {
      project: { organizationId },
    };
  }
  return {
    projectId: { in: accessibleProjects as string[] },
  };
}

function buildAgentProjectFilter(
  accessibleProjects: string[] | 'all_in_org',
  organizationId?: string
): Prisma.AIAgentWhereInput {
  if (accessibleProjects === 'all_in_org' && organizationId) {
    return {
      project: { organizationId },
    };
  }
  return {
    projectId: { in: accessibleProjects as string[] },
  };
}

// ============================================
// HELPER: Apply visibility filter to a where clause
// ============================================

function applyVisibility(
  where: Prisma.LeadWhereInput,
  visibility?: VisibilityContext
): Prisma.LeadWhereInput {
  const visFilter = buildVisibilityFilter(visibility);
  if (!visFilter) return where;
  return {
    ...where,
    AND: [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      visFilter,
    ],
  };
}

// ============================================
// Main: getDashboardStats (client-callable)
// ============================================

export async function getDashboardStats(
  projectId?: string,
  organizationId?: string,
  dateRange: DashboardDateRange = 'today',
  customDateRange?: { start: string | null; end: string | null }
): Promise<DashboardStats> {
  const emptyStats: DashboardStats = {
    totalLeads: 0,
    activeLeads: 0,
    leadsWon: 0,
    leadsCustomer: 0,
    leadsInHumanMode: 0,
    activeAgents: 0,
    archivedLeads: 0,
  };

  try {
    const user = await verifyAuth();
    if (!user) return emptyStats;

    const [accessibleProjects, orgData] = await Promise.all([
      getAccessibleProjectIds(
        user.id,
        user.systemRole,
        projectId,
        organizationId
      ),
      organizationId
        ? prisma.organization.findUnique({ where: { id: organizationId }, select: { defaultTimezone: true } })
        : Promise.resolve(null),
    ]);

    if (!accessibleProjects) return emptyStats;

    const timezone = getEffectiveTimezone(orgData?.defaultTimezone);
    const dateFilter = buildDateFilter(dateRange, customDateRange, timezone);
    const projectFilter = buildProjectFilter(accessibleProjects, organizationId);
    const agentProjectFilter = buildAgentProjectFilter(accessibleProjects, organizationId);

    // Get visibility context for agent/viewer lead restrictions
    const visibility = projectId ? await getVisibilityContext(user.id, user.systemRole, projectId) : undefined;

    const [activeLeads, leadsWon, leadsCustomer, leadsInHumanMode, activeAgents, archivedLeads] = await Promise.all([
      prisma.lead.count({
        where: applyVisibility({
          ...projectFilter,
          archivedAt: null,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        }, visibility),
      }),

      prisma.lead.count({
        where: applyVisibility({
          ...projectFilter,
          archivedAt: null,
          status: 'won',
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        }, visibility),
      }),

      prisma.lead.count({
        where: applyVisibility({
          ...projectFilter,
          archivedAt: null,
          status: 'customer',
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        }, visibility),
      }),

      prisma.lead.count({
        where: applyVisibility({
          ...projectFilter,
          archivedAt: null,
          handoffMode: 'human',
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        }, visibility),
      }),

      // Active agents — not a lead query, no visibility filter
      prisma.aIAgent.count({
        where: {
          ...agentProjectFilter,
          isActive: true,
        },
      }),

      prisma.lead.count({
        where: applyVisibility({
          ...projectFilter,
          archivedAt: { not: null },
          ...(dateFilter ? { archivedAt: dateFilter } : {}),
        }, visibility),
      }),
    ]);

    const totalLeads = activeLeads + archivedLeads;

    return { totalLeads, activeLeads, leadsWon, leadsCustomer, leadsInHumanMode, activeAgents, archivedLeads };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return emptyStats;
  }
}

// ============================================
// SSR: getDashboardStatsSSR (pre-verified auth)
// ============================================

export async function getDashboardStatsSSR(
  auth: PreVerifiedAuth,
  projectId?: string,
  organizationId?: string,
  dateRange: DashboardDateRange = 'today',
  customDateRange?: { start: string | null; end: string | null }
): Promise<DashboardStats> {
  const emptyStats: DashboardStats = {
    totalLeads: 0,
    activeLeads: 0,
    leadsWon: 0,
    leadsCustomer: 0,
    leadsInHumanMode: 0,
    activeAgents: 0,
    archivedLeads: 0,
  };

  try {
    const [accessibleProjects, orgData] = await Promise.all([
      getAccessibleProjectIds(
        auth.id,
        auth.systemRole,
        projectId,
        organizationId
      ),
      organizationId
        ? prisma.organization.findUnique({ where: { id: organizationId }, select: { defaultTimezone: true } })
        : Promise.resolve(null),
    ]);

    if (!accessibleProjects) return emptyStats;

    const timezone = getEffectiveTimezone(orgData?.defaultTimezone);
    const dateFilter = buildDateFilter(dateRange, customDateRange, timezone);
    const projectFilter = buildProjectFilter(accessibleProjects, organizationId);
    const agentProjectFilter = buildAgentProjectFilter(accessibleProjects, organizationId);

    // Get visibility context for agent/viewer lead restrictions
    const visibility = projectId ? await getVisibilityContext(auth.id, auth.systemRole, projectId) : undefined;

    const [activeLeads, leadsWon, leadsCustomer, leadsInHumanMode, activeAgents, archivedLeads] = await Promise.all([
      prisma.lead.count({
        where: applyVisibility({
          ...projectFilter,
          archivedAt: null,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        }, visibility),
      }),

      prisma.lead.count({
        where: applyVisibility({
          ...projectFilter,
          archivedAt: null,
          status: 'won',
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        }, visibility),
      }),

      prisma.lead.count({
        where: applyVisibility({
          ...projectFilter,
          archivedAt: null,
          status: 'customer',
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        }, visibility),
      }),

      prisma.lead.count({
        where: applyVisibility({
          ...projectFilter,
          archivedAt: null,
          handoffMode: 'human',
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        }, visibility),
      }),

      prisma.aIAgent.count({
        where: {
          ...agentProjectFilter,
          isActive: true,
        },
      }),

      prisma.lead.count({
        where: applyVisibility({
          ...projectFilter,
          archivedAt: { not: null },
          ...(dateFilter ? { archivedAt: dateFilter } : {}),
        }, visibility),
      }),
    ]);

    const totalLeads = activeLeads + archivedLeads;

    return { totalLeads, activeLeads, leadsWon, leadsCustomer, leadsInHumanMode, activeAgents, archivedLeads };
  } catch (error) {
    console.error('Error fetching dashboard stats (SSR):', error);
    return emptyStats;
  }
}

// ============================================
// Charts: getDashboardCharts (client-callable)
// ============================================

const EMPTY_CHARTS: DashboardChartData = {
  leadsPerDay: [],
  temperatureDistribution: [],
  statusDistribution: [],
  sourceDistribution: [],
};

export async function getDashboardCharts(
  projectId?: string,
  organizationId?: string,
  dateRange: DashboardDateRange = 'today',
  customDateRange?: { start: string | null; end: string | null }
): Promise<DashboardChartData> {
  try {
    const user = await verifyAuth();
    if (!user) return EMPTY_CHARTS;

    const [accessibleProjects, orgData] = await Promise.all([
      getAccessibleProjectIds(
        user.id,
        user.systemRole,
        projectId,
        organizationId
      ),
      organizationId
        ? prisma.organization.findUnique({ where: { id: organizationId }, select: { defaultTimezone: true } })
        : Promise.resolve(null),
    ]);

    if (!accessibleProjects) return EMPTY_CHARTS;

    const timezone = getEffectiveTimezone(orgData?.defaultTimezone);
    const dateFilter = buildDateFilter(dateRange, customDateRange, timezone);
    const projectFilter = buildProjectFilter(accessibleProjects, organizationId);

    // Get visibility context for agent/viewer lead restrictions
    const visibility = projectId ? await getVisibilityContext(user.id, user.systemRole, projectId) : undefined;

    const baseWhere = applyVisibility({
      ...projectFilter,
      archivedAt: null,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    }, visibility);

    const noDateWhere = applyVisibility({
      ...projectFilter,
      archivedAt: null,
    }, visibility);

    const [leads, tempGroups, statusGroups, sourceGroups] = await Promise.all([
      prisma.lead.findMany({
        where: baseWhere,
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),

      prisma.lead.groupBy({
        by: ['temperature'],
        where: noDateWhere,
        _count: true,
      }),

      prisma.lead.groupBy({
        by: ['status'],
        where: noDateWhere,
        _count: true,
      }),

      prisma.lead.groupBy({
        by: ['source'],
        where: baseWhere,
        _count: true,
      }),
    ]);

    // Group leads by date
    const dateMap = new Map<string, number>();
    for (const lead of leads) {
      const day = getDateStringInTimezone(lead.createdAt, timezone);
      dateMap.set(day, (dateMap.get(day) || 0) + 1);
    }
    const leadsPerDay = Array.from(dateMap.entries()).map(([date, count]) => ({ date, count }));

    return {
      leadsPerDay,
      temperatureDistribution: tempGroups.map((g) => ({
        temperature: g.temperature,
        count: g._count,
      })),
      statusDistribution: statusGroups.map((g) => ({
        status: g.status,
        count: g._count,
      })),
      sourceDistribution: sourceGroups.map((g) => ({
        source: g.source,
        count: g._count,
      })),
    };
  } catch (error) {
    console.error('Error fetching dashboard charts:', error);
    return EMPTY_CHARTS;
  }
}
