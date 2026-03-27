// ============================================
// KAIRO - Dashboard Server Actions
// Real-time stats for the dashboard overview
// ============================================

'use server';

import { prisma } from '@/lib/prisma';
import { verifyAuth } from './auth';
import { getAccessibleProjectIds, type PreVerifiedAuth } from './leads';
import type { Prisma } from '@prisma/client';

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
  customDateRange?: { start: string | null; end: string | null }
): Prisma.DateTimeFilter | undefined {
  const now = new Date();

  switch (dateRange) {
    case 'today': {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { gte: startOfDay };
    }
    case 'yesterday': {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { gte: startOfYesterday, lt: startOfToday };
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
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { gte: startOfMonth };
    }
    case 'custom': {
      if (customDateRange?.start || customDateRange?.end) {
        const filter: Prisma.DateTimeFilter = {};
        if (customDateRange.start) filter.gte = new Date(customDateRange.start);
        if (customDateRange.end) filter.lte = new Date(customDateRange.end);
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

    const accessibleProjects = await getAccessibleProjectIds(
      user.id,
      user.systemRole,
      projectId,
      organizationId
    );

    if (!accessibleProjects) return emptyStats;

    const dateFilter = buildDateFilter(dateRange, customDateRange);
    const projectFilter = buildProjectFilter(accessibleProjects, organizationId);
    const agentProjectFilter = buildAgentProjectFilter(accessibleProjects, organizationId);

    const [activeLeads, leadsWon, leadsCustomer, leadsInHumanMode, activeAgents, archivedLeads] = await Promise.all([
      // 1. Active leads created in date range (non-archived)
      prisma.lead.count({
        where: {
          ...projectFilter,
          archivedAt: null,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),

      // 2. Leads won (status changed to 'won' in date range) - use updatedAt
      prisma.lead.count({
        where: {
          ...projectFilter,
          archivedAt: null,
          status: 'won',
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        },
      }),

      // 3. Leads customer (status changed to 'customer' in date range)
      prisma.lead.count({
        where: {
          ...projectFilter,
          archivedAt: null,
          status: 'customer',
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        },
      }),

      // 4. Leads in human mode (within date range by updatedAt)
      prisma.lead.count({
        where: {
          ...projectFilter,
          archivedAt: null,
          handoffMode: 'human',
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        },
      }),

      // 5. Active agents (no date filter - current state)
      prisma.aIAgent.count({
        where: {
          ...agentProjectFilter,
          isActive: true,
        },
      }),

      // 6. Archived leads (archived within date range)
      prisma.lead.count({
        where: {
          ...projectFilter,
          archivedAt: { not: null },
          ...(dateFilter ? { archivedAt: dateFilter } : {}),
        },
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
    const accessibleProjects = await getAccessibleProjectIds(
      auth.id,
      auth.systemRole,
      projectId,
      organizationId
    );

    if (!accessibleProjects) return emptyStats;

    const dateFilter = buildDateFilter(dateRange, customDateRange);
    const projectFilter = buildProjectFilter(accessibleProjects, organizationId);
    const agentProjectFilter = buildAgentProjectFilter(accessibleProjects, organizationId);

    const [activeLeads, leadsWon, leadsCustomer, leadsInHumanMode, activeAgents, archivedLeads] = await Promise.all([
      prisma.lead.count({
        where: {
          ...projectFilter,
          archivedAt: null,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),

      prisma.lead.count({
        where: {
          ...projectFilter,
          archivedAt: null,
          status: 'won',
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        },
      }),

      prisma.lead.count({
        where: {
          ...projectFilter,
          archivedAt: null,
          status: 'customer',
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        },
      }),

      prisma.lead.count({
        where: {
          ...projectFilter,
          archivedAt: null,
          handoffMode: 'human',
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        },
      }),

      prisma.aIAgent.count({
        where: {
          ...agentProjectFilter,
          isActive: true,
        },
      }),

      prisma.lead.count({
        where: {
          ...projectFilter,
          archivedAt: { not: null },
          ...(dateFilter ? { archivedAt: dateFilter } : {}),
        },
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

    const accessibleProjects = await getAccessibleProjectIds(
      user.id,
      user.systemRole,
      projectId,
      organizationId
    );

    if (!accessibleProjects) return EMPTY_CHARTS;

    const dateFilter = buildDateFilter(dateRange, customDateRange);
    const projectFilter = buildProjectFilter(accessibleProjects, organizationId);

    const baseWhere: Prisma.LeadWhereInput = {
      ...projectFilter,
      archivedAt: null,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    };

    const [leads, tempGroups, statusGroups, sourceGroups] = await Promise.all([
      // Leads per day — fetch dates only, group client-side
      prisma.lead.findMany({
        where: baseWhere,
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),

      // Temperature distribution
      prisma.lead.groupBy({
        by: ['temperature'],
        where: { ...projectFilter, archivedAt: null },
        _count: true,
      }),

      // Status distribution
      prisma.lead.groupBy({
        by: ['status'],
        where: { ...projectFilter, archivedAt: null },
        _count: true,
      }),

      // Source distribution
      prisma.lead.groupBy({
        by: ['source'],
        where: baseWhere,
        _count: true,
      }),
    ]);

    // Group leads by date
    const dateMap = new Map<string, number>();
    for (const lead of leads) {
      const day = lead.createdAt.toISOString().slice(0, 10);
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
