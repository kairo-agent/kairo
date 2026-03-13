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
  leadsWon: number;
  leadsInHumanMode: number;
  activeAgents: number;
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
    leadsWon: 0,
    leadsInHumanMode: 0,
    activeAgents: 0,
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

    const [totalLeads, leadsWon, leadsInHumanMode, activeAgents] = await Promise.all([
      // 1. Total leads created in date range (non-archived)
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

      // 3. Leads currently in human mode (no date filter - current state)
      prisma.lead.count({
        where: {
          ...projectFilter,
          archivedAt: null,
          handoffMode: 'human',
        },
      }),

      // 4. Active agents (no date filter - current state)
      prisma.aIAgent.count({
        where: {
          ...agentProjectFilter,
          isActive: true,
        },
      }),
    ]);

    return { totalLeads, leadsWon, leadsInHumanMode, activeAgents };
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
    leadsWon: 0,
    leadsInHumanMode: 0,
    activeAgents: 0,
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

    const [totalLeads, leadsWon, leadsInHumanMode, activeAgents] = await Promise.all([
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
          handoffMode: 'human',
        },
      }),

      prisma.aIAgent.count({
        where: {
          ...agentProjectFilter,
          isActive: true,
        },
      }),
    ]);

    return { totalLeads, leadsWon, leadsInHumanMode, activeAgents };
  } catch (error) {
    console.error('Error fetching dashboard stats (SSR):', error);
    return emptyStats;
  }
}
