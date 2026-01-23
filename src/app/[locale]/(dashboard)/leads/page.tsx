// ============================================
// KAIRO - Leads Page (Server Component)
// Fetches paginated data from database
// ============================================

import { getLeadsPaginated, getLeadsStatsFromDB } from '@/lib/actions/leads';
import { DEFAULT_PAGE_SIZE } from '@/types';
import LeadsPageClient from './LeadsPageClient';

// Helper to transform Prisma lead to frontend format
function transformLead(lead: Awaited<ReturnType<typeof getLeadsPaginated>>['data'][number]) {
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
  // Fetch first page of leads and stats from database
  const [leadsResponse, stats] = await Promise.all([
    getLeadsPaginated(undefined, undefined, undefined, { page: 1, limit: DEFAULT_PAGE_SIZE }),
    getLeadsStatsFromDB(),
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
