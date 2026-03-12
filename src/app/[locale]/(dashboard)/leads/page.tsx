// ============================================
// KAIRO - Leads Page (Server Component)
// Fetches paginated data from database
// PERFORMANCE: Uses SSR-optimized functions that skip redundant auth checks.
// The layout already verifies auth via getCurrentUser() (cached).
// verifyAuth() shares the same cached Supabase call via getSupabaseUser().
// ============================================

import { verifyAuth } from '@/lib/actions/auth';
import { getLeadsPaginatedSSR, getLeadsStatsFromDBSSR } from '@/lib/actions/leads';
import type { LeadGridItem } from '@/lib/actions/leads';
import { DEFAULT_PAGE_SIZE } from '@/types';
import LeadsPageClient from './LeadsPageClient';

// Helper to transform Prisma lead to frontend format
function transformLead(lead: LeadGridItem) {
  return {
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
    lastContactAt: lead.lastContactAt || undefined,
    nextFollowUpAt: lead.nextFollowUpAt || undefined,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    assignedAgent: lead.assignedAgent
      ? {
          id: lead.assignedAgent.id,
          name: lead.assignedAgent.name,
          type: lead.assignedAgent.type,
        }
      : undefined,
  };
}

export default async function LeadsPage() {
  // PERFORMANCE: verifyAuth() shares the cached getSupabaseUser() call
  // with getCurrentUser() from the layout, eliminating the redundant
  // Supabase auth round-trip. The lightweight Prisma select is still
  // cached independently via React.cache().
  const user = await verifyAuth();

  if (!user) {
    // Layout should have already redirected, but guard defensively
    return (
      <LeadsPageClient
        initialLeads={[]}
        initialPagination={{
          page: 1,
          limit: DEFAULT_PAGE_SIZE,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        }}
        initialStats={{ total: 0, new: 0, hot: 0, warm: 0, cold: 0 }}
      />
    );
  }

  // SSR-optimized: pass pre-verified auth, skip internal verifyAuth() calls
  const authContext = { id: user.id, systemRole: user.systemRole };

  const [leadsResponse, stats] = await Promise.all([
    getLeadsPaginatedSSR(authContext, undefined, undefined, undefined, { page: 1, limit: DEFAULT_PAGE_SIZE }),
    getLeadsStatsFromDBSSR(authContext),
  ]);

  // Transform Prisma leads to frontend format
  const transformedLeads = leadsResponse.data.map(transformLead);

  return (
    <LeadsPageClient
      initialLeads={transformedLeads}
      initialPagination={leadsResponse.pagination}
      initialStats={{
        total: stats.total,
        new: stats.byStatus.new || 0,
        hot: stats.byTemperature.hot || 0,
        warm: stats.byTemperature.warm || 0,
        cold: stats.byTemperature.cold || 0,
      }}
    />
  );
}
