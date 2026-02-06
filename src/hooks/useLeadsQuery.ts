'use client';

// ============================================
// KAIRO - Leads Query Hook
// TanStack Query hook for leads with caching
// ============================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getLeadsPaginated, getLeadsStatsFromDB } from '@/lib/actions/leads';
import type { LeadFilters, PageSize } from '@/types';

// ============================================
// Types
// ============================================

interface LeadsQueryParams {
  projectId?: string;
  organizationId?: string;
  filters: LeadFilters;
  page: number;
  limit: PageSize;
}

interface LeadsStatsQueryParams {
  projectId?: string;
  organizationId?: string;
  filters: LeadFilters;
}

// Lead type from server (uses lowercase enum values from Prisma)
export interface ServerLead {
  id: string;
  projectId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  businessName?: string | null;
  position?: string | null;
  status: string;
  temperature: string;
  source: string;
  channel: string;
  type: string;
  assignedAgentId?: string | null;
  assignedUserId?: string | null;
  pipelineStage: string;
  estimatedValue?: number | null;
  currency: string;
  tags: string[];
  lastContactAt?: Date | null;
  nextFollowUpAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignedAgent?: {
    id: string;
    name: string;
    type: string;
  } | null;
}

export interface TransformedLead {
  id: string;
  projectId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  businessName?: string;
  position?: string;
  status: string;
  temperature: string;
  source: string;
  channel: string;
  type: string;
  assignedAgentId?: string;
  assignedUserId?: string;
  pipelineStage: string;
  estimatedValue?: number;
  currency: string;
  tags: string[];
  archivedAt?: Date;
  lastContactAt?: Date;
  nextFollowUpAt?: Date;
  summary?: string;
  summaryUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  assignedAgent?: {
    id: string;
    name: string;
    type: string;
  };
}

export interface LeadsStats {
  total: number;
  new: number;
  hot: number;
  warm: number;
  cold: number;
}

// ============================================
// Query Keys
// ============================================

export const leadsQueryKeys = {
  all: ['leads'] as const,
  lists: () => [...leadsQueryKeys.all, 'list'] as const,
  list: (params: LeadsQueryParams) => [...leadsQueryKeys.lists(), params] as const,
  stats: () => [...leadsQueryKeys.all, 'stats'] as const,
  stat: (params: LeadsStatsQueryParams) => [...leadsQueryKeys.stats(), params] as const,
};

// ============================================
// Transform function
// ============================================

function transformLeads(serverLeads: Awaited<ReturnType<typeof getLeadsPaginated>>['data']): TransformedLead[] {
  return serverLeads.map((lead) => ({
    id: lead.id,
    projectId: lead.projectId,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email || undefined,
    phone: lead.phone || undefined,
    businessName: lead.businessName || undefined,
    position: lead.position || undefined,
    status: lead.status,
    temperature: lead.temperature,
    source: lead.source,
    channel: lead.channel,
    type: lead.type,
    assignedAgentId: lead.assignedAgentId || undefined,
    assignedUserId: lead.assignedUserId || undefined,
    pipelineStage: lead.pipelineStage,
    estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : undefined,
    currency: lead.currency,
    tags: lead.tags,
    archivedAt: lead.archivedAt || undefined,
    lastContactAt: lead.lastContactAt || undefined,
    nextFollowUpAt: lead.nextFollowUpAt || undefined,
    summary: lead.summary || undefined,
    summaryUpdatedAt: lead.summaryUpdatedAt || undefined,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    assignedAgent: lead.assignedAgent
      ? {
          id: lead.assignedAgent.id,
          name: lead.assignedAgent.name,
          type: lead.assignedAgent.type,
        }
      : undefined,
  }));
}

// ============================================
// Leads Query Hook
// ============================================

export function useLeadsQuery({
  projectId,
  organizationId,
  filters,
  page,
  limit,
  enabled = true,
}: LeadsQueryParams & { enabled?: boolean }) {
  return useQuery({
    queryKey: leadsQueryKeys.list({ projectId, organizationId, filters, page, limit }),
    queryFn: async () => {
      const response = await getLeadsPaginated(projectId, organizationId, filters, { page, limit });
      return {
        data: transformLeads(response.data),
        pagination: response.pagination,
      };
    },
    enabled,
  });
}

// ============================================
// Leads Stats Query Hook
// ============================================

export function useLeadsStatsQuery({
  projectId,
  organizationId,
  filters,
  enabled = true,
}: LeadsStatsQueryParams & { enabled?: boolean }) {
  return useQuery({
    queryKey: leadsQueryKeys.stat({ projectId, organizationId, filters }),
    queryFn: async () => {
      const stats = await getLeadsStatsFromDB(projectId, organizationId, filters);
      return {
        total: stats.total,
        new: stats.byStatus.new || 0,
        hot: stats.byTemperature.hot || 0,
        warm: stats.byTemperature.warm || 0,
        cold: stats.byTemperature.cold || 0,
      } as LeadsStats;
    },
    enabled,
  });
}

// ============================================
// Combined Hook for Leads Page
// ============================================

export function useLeads({
  projectId,
  organizationId,
  filters,
  page,
  limit,
}: LeadsQueryParams) {
  const queryClient = useQueryClient();

  // Determine if queries should be enabled
  const hasWorkspace = Boolean(organizationId || projectId);

  // Leads query
  const leadsQuery = useLeadsQuery({
    projectId,
    organizationId,
    filters,
    page,
    limit,
    enabled: hasWorkspace,
  });

  // Stats query
  const statsQuery = useLeadsStatsQuery({
    projectId,
    organizationId,
    filters,
    enabled: hasWorkspace,
  });

  // Invalidate all leads queries (useful after mutations)
  const invalidateLeads = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: leadsQueryKeys.all });
  }, [queryClient]);

  // Refetch leads and wait for completion (useful when UI must wait for fresh data)
  const refetchLeads = useCallback(async () => {
    await Promise.all([
      leadsQuery.refetch(),
      statsQuery.refetch(),
    ]);
  }, [leadsQuery, statsQuery]);

  // Prefetch next page for smooth pagination
  const prefetchNextPage = useCallback(() => {
    if (leadsQuery.data?.pagination.hasNext) {
      queryClient.prefetchQuery({
        queryKey: leadsQueryKeys.list({
          projectId,
          organizationId,
          filters,
          page: page + 1,
          limit,
        }),
        queryFn: async () => {
          const response = await getLeadsPaginated(projectId, organizationId, filters, {
            page: page + 1,
            limit,
          });
          return {
            data: transformLeads(response.data),
            pagination: response.pagination,
          };
        },
      });
    }
  }, [queryClient, projectId, organizationId, filters, page, limit, leadsQuery.data?.pagination.hasNext]);

  return {
    // Leads data
    leads: leadsQuery.data?.data ?? [],
    pagination: leadsQuery.data?.pagination ?? {
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },

    // Stats data
    stats: statsQuery.data ?? {
      total: 0,
      new: 0,
      hot: 0,
      warm: 0,
      cold: 0,
    },

    // Loading states
    isLoading: leadsQuery.isLoading || statsQuery.isLoading,
    isFetching: leadsQuery.isFetching || statsQuery.isFetching,
    isRefetching: leadsQuery.isRefetching || statsQuery.isRefetching,

    // Error states
    isError: leadsQuery.isError || statsQuery.isError,
    error: leadsQuery.error || statsQuery.error,

    // Actions
    invalidateLeads,
    refetchLeads,
    prefetchNextPage,

    // Query references (for advanced use cases)
    leadsQuery,
    statsQuery,
  };
}
