// ============================================
// KAIRO - Leads Server Actions
// Server-side filtering and pagination
// ============================================

'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { verifyAuth, verifyProjectAccess, getProjectRole } from './auth';
import { getEffectiveRole, isViewerOnly, canActOnLead, canTakeUnassignedLead, canReassignLead } from '@/lib/permissions';
import { getVisibilityContext, buildVisibilityFilter, type VisibilityContext } from '@/lib/lead-visibility';
import { getEffectiveTimezone, getStartOfDayInTimezone, getEndOfDayInTimezone, getStartOfMonthInTimezone } from '@/lib/timezone';
import { validatePhone, normalizePhone } from '@/lib/utils';
import { notifyProjectMembers } from './notifications';
import type { Lead as PrismaLead, AIAgent, Prisma, Note, Activity, User, LeadStatus as PrismaLeadStatus } from '@prisma/client';
import type {
  LeadFilters,
  PaginationParams,
  PaginatedResponse,
  DateRangePreset,
} from '@/types';
import { LeadTemperature } from '@/types';

// Types for notes and activities with author info
export type NoteWithAuthor = Note & {
  author: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
};

export type ActivityWithPerformer = Activity & {
  performer: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
};

// Type for lead with agent included (full)
export type LeadWithAgent = PrismaLead & {
  assignedAgent: AIAgent | null;
};

// Type for lead grid view with partial agent (optimized for list display)
// Includes all fields needed by the frontend lead grid and detail views
export type LeadGridItem = Pick<
  PrismaLead,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'businessName'
  | 'position'
  | 'status'
  | 'temperature'
  | 'source'
  | 'channel'
  | 'type'
  | 'assignedAgentId'
  | 'assignedUserId'
  | 'pipelineStage'
  | 'estimatedValue'
  | 'currency'
  | 'tags'
  | 'archivedAt'
  | 'lastContactAt'
  | 'nextFollowUpAt'
  | 'summary'
  | 'summaryUpdatedAt'
  | 'createdAt'
  | 'updatedAt'
  | 'projectId'
> & {
  assignedAgent: Pick<AIAgent, 'id' | 'name' | 'type'> | null;
  assignedUser: { id: string; firstName: string; lastName: string } | null;
};

// Get leads stats for a project
export type LeadsStats = {
  total: number;
  byStatus: Record<string, number>;
  byTemperature: Record<string, number>;
};

// ============================================
// HELPER: Get organization timezone
// ============================================

async function getOrgTimezone(organizationId?: string): Promise<string> {
  if (!organizationId) return getEffectiveTimezone();
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { defaultTimezone: true },
  });
  return getEffectiveTimezone(org?.defaultTimezone);
}

// ============================================
// HELPER: Get accessible project IDs for user
// ============================================

export async function getAccessibleProjectIds(
  userId: string,
  systemRole: string,
  projectId?: string,
  organizationId?: string
): Promise<string[] | 'all_in_org' | null> {
  if (projectId) {
    // Specific project requested — validate access for non-super_admin
    if (systemRole !== 'super_admin') {
      const membership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { id: true },
      });
      if (!membership) return null;
    }
    return [projectId];
  }

  if (organizationId) {
    if (systemRole === 'super_admin') {
      // Super admin can see all projects in org
      return 'all_in_org';
    }
    // Regular users: get intersection of their projects and org projects
    const orgProjects = await prisma.project.findMany({
      where: {
        organizationId,
        members: { some: { userId } },
      },
      select: { id: true },
    });
    if (orgProjects.length === 0) return null;
    return orgProjects.map((p) => p.id);
  }

  // No project or org specified: fallback to first accessible project
  if (systemRole === 'super_admin') {
    const firstProject = await prisma.project.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!firstProject) return null;
    return [firstProject.id];
  }

  const firstMembership = await prisma.projectMember.findFirst({
    where: { userId },
    select: { projectId: true },
    orderBy: { createdAt: 'asc' },
  });

  if (firstMembership) {
    return [firstMembership.projectId];
  }

  return null;
}

// ============================================
// HELPER: Build Prisma where clause for leads
// ============================================

function getDateRangeFilter(
  dateRange: DateRangePreset | 'custom',
  customDateRange?: { start: Date | null; end: Date | null },
  timezone?: string
): Prisma.DateTimeNullableFilter | undefined {
  const now = new Date();

  switch (dateRange) {
    case 'today': {
      const tz = timezone || getEffectiveTimezone();
      const startOfDay = getStartOfDayInTimezone(tz);
      const endOfDay = getEndOfDayInTimezone(tz);
      return { gte: startOfDay, lt: endOfDay };
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
      const tz = timezone || getEffectiveTimezone();
      const startOfMonth = getStartOfMonthInTimezone(tz);
      return { gte: startOfMonth };
    }
    case 'custom': {
      if (customDateRange?.start || customDateRange?.end) {
        const filter: Prisma.DateTimeNullableFilter = {};
        if (customDateRange.start) filter.gte = customDateRange.start;
        if (customDateRange.end) {
          // Include the full end day (set to 23:59:59.999)
          const endOfDay = new Date(customDateRange.end);
          endOfDay.setHours(23, 59, 59, 999);
          filter.lte = endOfDay;
        }
        return filter;
      }
      return undefined;
    }
    case 'all':
    default:
      return undefined;
  }
}

function buildLeadWhereClause(
  accessibleProjects: string[] | 'all_in_org',
  organizationId?: string,
  filters?: Partial<LeadFilters>,
  currentUserId?: string,
  timezone?: string,
  visibility?: VisibilityContext
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};

  // Project/Org filtering
  if (accessibleProjects === 'all_in_org' && organizationId) {
    where.project = { organizationId };
  } else if (Array.isArray(accessibleProjects)) {
    if (accessibleProjects.length === 1) {
      where.projectId = accessibleProjects[0];
    } else {
      where.projectId = { in: accessibleProjects };
    }
  }

  // Search (text matching across multiple fields)
  if (filters?.search && filters.search.trim()) {
    const searchTerm = filters.search.trim();
    where.OR = [
      { firstName: { contains: searchTerm, mode: 'insensitive' } },
      { lastName: { contains: searchTerm, mode: 'insensitive' } },
      { email: { contains: searchTerm, mode: 'insensitive' } },
      { phone: { contains: searchTerm, mode: 'insensitive' } },
      { businessName: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  // Enum filters
  if (filters?.status && filters.status !== 'all') {
    where.status = filters.status;
  }
  if (filters?.temperature && filters.temperature !== 'all') {
    where.temperature = filters.temperature;
  }
  if (filters?.channel && filters.channel !== 'all') {
    where.channel = filters.channel;
  }
  if (filters?.type && filters.type !== 'all') {
    where.type = filters.type;
  }

  // Date range filter (applies to selected dateField: createdAt or lastContactAt)
  if (filters?.dateRange && filters.dateRange !== 'all') {
    const dateFilter = getDateRangeFilter(filters.dateRange, filters.customDateRange, timezone);
    if (dateFilter) {
      const field = filters.dateField || 'createdAt';
      if (field === 'createdAt') {
        where.createdAt = dateFilter as Prisma.DateTimeFilter;
      } else {
        where.lastContactAt = dateFilter;
      }
    }
  }

  // Archive filter: 'active' (default) | 'archived' | 'all'
  const archiveFilter = filters?.archiveFilter || 'active';
  if (archiveFilter === 'active') {
    where.archivedAt = null;
  } else if (archiveFilter === 'archived') {
    where.archivedAt = { not: null };
  }
  // 'all' = no filter on archivedAt

  // Assigned to filter (user-selected filter in UI)
  if (filters?.assignedTo && filters.assignedTo !== 'all') {
    if (filters.assignedTo === 'unassigned') {
      where.assignedUserId = null;
    } else if (filters.assignedTo === 'mine' && currentUserId) {
      where.assignedUserId = currentUserId;
    } else if (Array.isArray(filters.assignedTo)) {
      where.assignedUserId = { in: filters.assignedTo };
    }
  }

  // Visibility filter (project-level setting for agent/viewer roles)
  const visibilityFilter = buildVisibilityFilter(visibility);
  if (visibilityFilter) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      visibilityFilter,
    ];
  }

  return where;
}

// ============================================
// SSR-OPTIMIZED: Pre-authenticated lead fetching
// These skip verifyAuth() for SSR calls where auth is already verified
// by the layout. Client-side calls MUST use the original functions.
// ============================================

export type PreVerifiedAuth = {
  id: string;
  systemRole: string;
};

/**
 * SSR-optimized version of getLeadsPaginated.
 * Accepts pre-verified auth context from the layout, skipping redundant
 * Supabase + Prisma auth checks. Only use from server components where
 * auth has already been verified (e.g., page.tsx under authenticated layout).
 */
export async function getLeadsPaginatedSSR(
  auth: PreVerifiedAuth,
  projectId?: string,
  organizationId?: string,
  filters?: Partial<LeadFilters>,
  pagination?: PaginationParams
): Promise<PaginatedResponse<LeadGridItem>> {
  try {
    const accessibleProjects = await getAccessibleProjectIds(auth.id, auth.systemRole, projectId, organizationId);

    if (!accessibleProjects) {
      return {
        data: [],
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    const timezone = await getOrgTimezone(organizationId);
    // Get visibility context for agent/viewer lead restrictions
    const visibility = projectId ? await getVisibilityContext(auth.id, auth.systemRole, projectId) : undefined;
    const where = buildLeadWhereClause(accessibleProjects, organizationId, filters, auth.id, timezone, visibility);
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 25;
    const skip = (page - 1) * limit;

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          businessName: true,
          position: true,
          status: true,
          temperature: true,
          source: true,
          channel: true,
          type: true,
          pipelineStage: true,
          estimatedValue: true,
          currency: true,
          tags: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
          lastContactAt: true,
          nextFollowUpAt: true,
          summary: true,
          summaryUpdatedAt: true,
          projectId: true,
          assignedAgentId: true,
          assignedUserId: true,
          assignedAgent: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          assignedUser: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: leads,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    console.error('Error fetching paginated leads (SSR):', error);
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }
}

/**
 * SSR-optimized version of getLeadsStatsFromDB.
 * Accepts pre-verified auth context from the layout.
 */
export async function getLeadsStatsFromDBSSR(
  auth: PreVerifiedAuth,
  projectId?: string,
  organizationId?: string,
  filters?: Partial<LeadFilters>
): Promise<LeadsStats> {
  try {
    const accessibleProjects = await getAccessibleProjectIds(auth.id, auth.systemRole, projectId, organizationId);

    if (!accessibleProjects) {
      return { total: 0, byStatus: {}, byTemperature: {} };
    }

    const timezone = await getOrgTimezone(organizationId);
    const visibility = projectId ? await getVisibilityContext(auth.id, auth.systemRole, projectId) : undefined;
    const where = buildLeadWhereClause(accessibleProjects, organizationId, filters, auth.id, timezone, visibility);

    const [total, statusCounts, temperatureCounts] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      prisma.lead.groupBy({
        by: ['temperature'],
        where,
        _count: true,
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const sc of statusCounts) {
      byStatus[sc.status] = sc._count;
    }

    const byTemperature: Record<string, number> = {};
    for (const tc of temperatureCounts) {
      byTemperature[tc.temperature] = tc._count;
    }

    return { total, byStatus, byTemperature };
  } catch (error) {
    console.error('Error fetching leads stats (SSR):', error);
    return { total: 0, byStatus: {}, byTemperature: {} };
  }
}

// ============================================
// PAGINATED LEADS WITH SERVER-SIDE FILTERS
// ============================================

export async function getLeadsPaginated(
  projectId?: string,
  organizationId?: string,
  filters?: Partial<LeadFilters>,
  pagination?: PaginationParams
): Promise<PaginatedResponse<LeadGridItem>> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return {
        data: [],
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    // Get accessible projects for this user
    const accessibleProjects = await getAccessibleProjectIds(user.id, user.systemRole, projectId, organizationId);

    if (!accessibleProjects) {
      return {
        data: [],
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    // Build where clause with filters
    const timezone = await getOrgTimezone(organizationId);
    const visibility = projectId ? await getVisibilityContext(user.id, user.systemRole, projectId) : undefined;
    const where = buildLeadWhereClause(accessibleProjects, organizationId, filters, user.id, timezone, visibility);

    // Pagination params
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 25;
    const skip = (page - 1) * limit;

    // Execute count and fetch in parallel
    // OPTIMIZATION: Using partial select to fetch only fields needed for grid view
    // This reduces data transfer by excluding large text fields (notes, metadata, etc.)
    // projectId is included as required for access verification pattern
    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        select: {
          // Core identification fields
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          businessName: true,
          position: true,
          // Status and classification
          status: true,
          temperature: true,
          source: true,
          channel: true,
          type: true,
          // Pipeline and value
          pipelineStage: true,
          estimatedValue: true,
          currency: true,
          tags: true,
          // Timestamps for display
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
          lastContactAt: true,
          nextFollowUpAt: true,
          // AI summary
          summary: true,
          summaryUpdatedAt: true,
          // SECURITY: projectId required for access verification
          projectId: true,
          // Assignment references
          assignedAgentId: true,
          assignedUserId: true,
          // Agent info - partial select excludes stats, description, avatarUrl
          assignedAgent: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          // Assigned user info
          assignedUser: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: leads,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    console.error('Error fetching paginated leads:', error);
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }
}

// ============================================
// LEGACY: Get all leads (for backward compatibility)
// NOTE: Consider using getLeadsPaginated() for better performance
// ============================================

export async function getLeads(
  projectId?: string,
  organizationId?: string
): Promise<LeadGridItem[]> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return [];
    }

    const accessibleProjects = await getAccessibleProjectIds(user.id, user.systemRole, projectId, organizationId);

    if (!accessibleProjects) {
      return [];
    }

    const timezone = await getOrgTimezone(organizationId);
    const visibility = projectId ? await getVisibilityContext(user.id, user.systemRole, projectId) : undefined;
    const where = buildLeadWhereClause(accessibleProjects, organizationId, undefined, user.id, timezone, visibility);

    // OPTIMIZATION: Partial select for legacy function
    // Returns same fields as getLeadsPaginated for consistency
    // projectId included for access pattern consistency
    const leads = await prisma.lead.findMany({
      where,
      select: {
        // Core identification fields
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        businessName: true,
        position: true,
        // Status and classification
        status: true,
        temperature: true,
        source: true,
        channel: true,
        type: true,
        // Pipeline and value
        pipelineStage: true,
        estimatedValue: true,
        currency: true,
        tags: true,
        // Timestamps
        createdAt: true,
        updatedAt: true,
        archivedAt: true,
        lastContactAt: true,
        nextFollowUpAt: true,
        // AI summary
        summary: true,
        summaryUpdatedAt: true,
        // SECURITY: projectId for access verification
        projectId: true,
        // Assignment references
        assignedAgentId: true,
        assignedUserId: true,
        // Agent info - partial select
        assignedAgent: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        // Assigned user info
        assignedUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return leads;
  } catch (error) {
    console.error('Error fetching leads:', error);
    return [];
  }
}

// ============================================
// LEADS STATS WITH SERVER-SIDE FILTERS
// ============================================

export async function getLeadsStatsFromDB(
  projectId?: string,
  organizationId?: string,
  filters?: Partial<LeadFilters>
): Promise<LeadsStats> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return { total: 0, byStatus: {}, byTemperature: {} };
    }

    const accessibleProjects = await getAccessibleProjectIds(user.id, user.systemRole, projectId, organizationId);

    if (!accessibleProjects) {
      return { total: 0, byStatus: {}, byTemperature: {} };
    }

    const timezone = await getOrgTimezone(organizationId);
    const visibility = projectId ? await getVisibilityContext(user.id, user.systemRole, projectId) : undefined;
    const where = buildLeadWhereClause(accessibleProjects, organizationId, filters, user.id, timezone, visibility);

    // Get counts in parallel
    const [total, statusCounts, temperatureCounts] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      prisma.lead.groupBy({
        by: ['temperature'],
        where,
        _count: true,
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const sc of statusCounts) {
      byStatus[sc.status] = sc._count;
    }

    const byTemperature: Record<string, number> = {};
    for (const tc of temperatureCounts) {
      byTemperature[tc.temperature] = tc._count;
    }

    return { total, byStatus, byTemperature };
  } catch (error) {
    console.error('Error fetching leads stats:', error);
    return { total: 0, byStatus: {}, byTemperature: {} };
  }
}

// ============================================
// UPDATE LEAD STATUS
// ============================================

export async function updateLeadStatus(
  leadId: string,
  newStatus: PrismaLeadStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { projectId: true, status: true, assignedUserId: true },
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso a este lead' };
    }

    // Role-based access control
    const roleInfo = await getProjectRole(user.id, user.systemRole, lead.projectId);
    const effectiveRole = getEffectiveRole(user.systemRole, roleInfo.isOrgOwner ?? false, roleInfo.projectRole);
    if (isViewerOnly(effectiveRole)) {
      return { success: false, error: 'Sin permisos para esta acción' };
    }
    if (!canActOnLead(effectiveRole, lead.assignedUserId, user.id)) {
      return { success: false, error: 'Este lead está asignado a otro usuario' };
    }

    const oldStatus = lead.status;

    // Update the lead status and create activity in a transaction
    await prisma.$transaction([
      prisma.lead.update({
        where: { id: leadId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      }),
      prisma.activity.create({
        data: {
          leadId,
          type: 'status_change',
          description: `Estado cambiado de "${oldStatus}" a "${newStatus}"`,
          metadata: { oldStatus, newStatus },
          performedBy: user.id,
        },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error updating lead status:', error);
    return { success: false, error: 'Error al actualizar estado' };
  }
}

// ============================================
// ARCHIVE / UNARCHIVE LEAD
// ============================================

export async function archiveLead(
  leadId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { projectId: true, archivedAt: true },
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso a este lead' };
    }

    if (lead.archivedAt) {
      return { success: false, error: 'Lead ya esta archivado' };
    }

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: leadId },
        data: { archivedAt: new Date() },
      }),
      prisma.activity.create({
        data: {
          leadId,
          type: 'status_change',
          description: 'Lead archivado',
          metadata: { action: 'archive' },
          performedBy: user.id,
        },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error archiving lead:', error);
    return { success: false, error: 'Error al archivar lead' };
  }
}

export async function unarchiveLead(
  leadId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { projectId: true, archivedAt: true },
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso a este lead' };
    }

    if (!lead.archivedAt) {
      return { success: false, error: 'Lead no esta archivado' };
    }

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: leadId },
        data: { archivedAt: null },
      }),
      prisma.activity.create({
        data: {
          leadId,
          type: 'status_change',
          description: 'Lead desarchivado',
          metadata: { action: 'unarchive' },
          performedBy: user.id,
        },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error unarchiving lead:', error);
    return { success: false, error: 'Error al desarchivar lead' };
  }
}

// ============================================
// UPDATE LEAD DATA
// ============================================

export async function updateLead(
  leadId: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string | null;
    phone?: string | null;
    position?: string | null;
    temperature?: LeadTemperature;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        projectId: true,
        temperature: true,
        firstName: true,
        lastName: true,
        assignedUserId: true,
        project: { select: { organizationId: true, name: true } },
      },
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso a este lead' };
    }

    // Role-based access control
    const roleInfo = await getProjectRole(user.id, user.systemRole, lead.projectId);
    const effectiveRole = getEffectiveRole(user.systemRole, roleInfo.isOrgOwner ?? false, roleInfo.projectRole);
    if (isViewerOnly(effectiveRole)) {
      return { success: false, error: 'Sin permisos para esta acción' };
    }
    if (!canActOnLead(effectiveRole, lead.assignedUserId, user.id)) {
      return { success: false, error: 'Este lead está asignado a otro usuario' };
    }

    // Validate and normalize phone if provided
    let normalizedPhone = data.phone;
    if (data.phone) {
      if (!validatePhone(data.phone)) {
        return { success: false, error: 'Número de teléfono inválido' };
      }
      normalizedPhone = normalizePhone(data.phone) || data.phone;
    }

    // Detect transition to HOT temperature
    const isNewHot = data.temperature === 'hot' && lead.temperature !== 'hot';

    // Update the lead and create activity in a transaction
    await prisma.$transaction([
      prisma.lead.update({
        where: { id: leadId },
        data: {
          ...data,
          phone: normalizedPhone,
          updatedAt: new Date(),
        },
      }),
      prisma.activity.create({
        data: {
          leadId,
          type: 'lead_updated',
          description: 'Datos del lead actualizados',
          performedBy: user.id,
        },
      }),
    ]);

    // Notify project team about HOT lead (fire-and-forget)
    if (isNewHot) {
      const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Lead';
      notifyProjectMembers({
        projectId: lead.projectId,
        organizationId: lead.project.organizationId,
        type: 'hot_lead',
        title: `Lead caliente: ${leadName}`,
        message: `${leadName} fue marcado como lead de alto potencial`,
        metadata: { leadId, previousTemperature: lead.temperature },
        source: 'server_action',
        excludeUserId: user.id,
        leadName,
        projectName: lead.project.name,
      }).catch((err) =>
        console.error('[Leads] Failed to send hot lead notification:', err)
      );
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating lead:', error);
    return { success: false, error: 'Error al actualizar lead' };
  }
}

// ============================================
// FOLLOW-UP SCHEDULING
// ============================================

export async function scheduleFollowUp(
  leadId: string,
  date: Date | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { projectId: true },
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso a este lead' };
    }

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: leadId },
        data: {
          nextFollowUpAt: date,
          updatedAt: new Date(),
        },
      }),
      prisma.activity.create({
        data: {
          leadId,
          type: date ? 'follow_up_scheduled' : 'follow_up_cleared',
          description: date
            ? `Seguimiento programado para ${date.toISOString()}`
            : 'Seguimiento cancelado',
          performedBy: user.id,
        },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error scheduling follow-up:', error);
    return { success: false, error: 'Error al programar seguimiento' };
  }
}

// ============================================
// AI AGENTS
// ============================================

export async function getAIAgents(projectId?: string) {
  try {
    const user = await verifyAuth();

    if (!user) {
      return [];
    }

    let targetProjectId = projectId;

    if (!targetProjectId) {
      if (user.systemRole === 'super_admin') {
        const firstProject = await prisma.project.findFirst({
          orderBy: { createdAt: 'asc' },
        });
        targetProjectId = firstProject?.id;
      } else {
        const firstMembership = await prisma.projectMember.findFirst({
          where: { userId: user.id },
          select: { projectId: true },
          orderBy: { createdAt: 'asc' },
        });
        targetProjectId = firstMembership?.projectId;
      }
    }

    if (!targetProjectId) {
      return [];
    }

    const agents = await prisma.aIAgent.findMany({
      where: {
        projectId: targetProjectId,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return agents;
  } catch (error) {
    console.error('Error fetching AI agents:', error);
    return [];
  }
}

// ============================================
// NOTES
// ============================================

/**
 * PERFORMANCE (P2-2): Consolidated panel data - single auth check for notes + activities.
 * Replaces separate getLeadNotes() + getLeadActivities() calls on panel open.
 * Saves ~1 auth check + 1 lead lookup + 1 access check (~100-300ms).
 */
export async function getLeadPanelData(leadId: string): Promise<{
  notes: NoteWithAuthor[];
  activities: ActivityWithPerformer[];
} | null> {
  try {
    const user = await verifyAuth();
    if (!user) return null;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { projectId: true, assignedUserId: true },
    });
    if (!lead) return null;

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) return null;

    // Check visibility: agent/viewer may not see this lead
    const visibility = await getVisibilityContext(user.id, user.systemRole, lead.projectId);
    const visFilter = buildVisibilityFilter(visibility);
    if (visFilter) {
      if ('assignedUserId' in visFilter && visFilter.assignedUserId !== undefined) {
        if (lead.assignedUserId !== user.id) return null;
      } else if (visFilter.OR) {
        if (lead.assignedUserId !== null && lead.assignedUserId !== user.id) return null;
      }
    }

    const [notes, activities] = await Promise.all([
      prisma.note.findMany({
        where: { leadId },
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activity.findMany({
        where: { leadId },
        include: {
          performer: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { notes, activities };
  } catch (error) {
    console.error('Error fetching lead panel data:', error);
    return null;
  }
}

export async function getLeadNotes(leadId: string): Promise<NoteWithAuthor[]> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return [];
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { projectId: true },
    });

    if (!lead) {
      return [];
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return [];
    }

    const notes = await prisma.note.findMany({
      where: { leadId },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notes;
  } catch (error) {
    console.error('Error fetching lead notes:', error);
    return [];
  }
}

export async function addLeadNote(
  leadId: string,
  content: string
): Promise<{ success: boolean; note?: NoteWithAuthor; error?: string }> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    if (!content.trim()) {
      return { success: false, error: 'El contenido no puede estar vacío' };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { projectId: true },
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso a este lead' };
    }

    // Create note and activity in a transaction
    const [note] = await prisma.$transaction([
      prisma.note.create({
        data: {
          leadId,
          content: content.trim(),
          createdBy: user.id,
        },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.activity.create({
        data: {
          leadId,
          type: 'note_added',
          description: 'Nueva nota agregada',
          performedBy: user.id,
        },
      }),
    ]);

    return { success: true, note };
  } catch (error) {
    console.error('Error adding lead note:', error);
    return { success: false, error: 'Error al agregar nota' };
  }
}

// ============================================
// ACTIVITIES
// ============================================

export async function getLeadActivities(leadId: string): Promise<ActivityWithPerformer[]> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return [];
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { projectId: true },
    });

    if (!lead) {
      return [];
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return [];
    }

    const activities = await prisma.activity.findMany({
      where: { leadId },
      include: {
        performer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return activities;
  } catch (error) {
    console.error('Error fetching lead activities:', error);
    return [];
  }
}

export async function logLeadActivity(
  leadId: string,
  type: string,
  description: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { projectId: true },
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso a este lead' };
    }

    await prisma.activity.create({
      data: {
        leadId,
        type,
        description,
        metadata: metadata as Prisma.InputJsonValue | undefined,
        performedBy: user.id,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error logging activity:', error);
    return { success: false, error: 'Error al registrar actividad' };
  }
}

// ============================================
// Get single lead by ID (for notification deep-link)
// ============================================

export async function getLeadById(leadId: string): Promise<LeadGridItem | null> {
  try {
    const user = await verifyAuth();
    if (!user) return null;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        businessName: true,
        position: true,
        status: true,
        temperature: true,
        source: true,
        channel: true,
        type: true,
        pipelineStage: true,
        estimatedValue: true,
        currency: true,
        tags: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        lastContactAt: true,
        nextFollowUpAt: true,
        summary: true,
        summaryUpdatedAt: true,
        projectId: true,
        assignedAgentId: true,
        assignedUserId: true,
        assignedAgent: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        assignedUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!lead) return null;

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) return null;

    // Check visibility: agent/viewer may not see this lead based on project settings
    const visibility = await getVisibilityContext(user.id, user.systemRole, lead.projectId);
    const visFilter = buildVisibilityFilter(visibility);
    if (visFilter) {
      // Check if this specific lead matches the visibility filter
      if ('assignedUserId' in visFilter && visFilter.assignedUserId !== undefined) {
        if (lead.assignedUserId !== user.id) return null;
      } else if (visFilter.OR) {
        // assigned_and_unassigned: must be assigned to user OR unassigned
        if (lead.assignedUserId !== null && lead.assignedUserId !== user.id) return null;
      }
    }

    return lead;
  } catch (error) {
    console.error('Error fetching lead by ID:', error);
    return null;
  }
}

// ============================================
// Export Leads to Excel
// ============================================

export async function exportLeadsToExcel(
  projectId?: string,
  organizationId?: string,
  startDate?: string,
  endDate?: string,
  locale: string = 'es'
): Promise<{ success: boolean; data?: string; filename?: string; count?: number; error?: string }> {
  try {
    const user = await verifyAuth();
    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    // Restrict export to super_admin, owner, or admin roles
    if (user.systemRole !== 'super_admin' && projectId) {
      const roleInfo = await getProjectRole(user.id, user.systemRole, projectId);
      if (!roleInfo.hasAccess) {
        return { success: false, error: 'Sin acceso' };
      }
      const effectiveRole = getEffectiveRole(user.systemRole, roleInfo.isOrgOwner ?? false, roleInfo.projectRole);
      if (effectiveRole !== 'owner' && effectiveRole !== 'admin') {
        return { success: false, error: 'No autorizado para exportar' };
      }
    }

    const accessibleProjects = await getAccessibleProjectIds(user.id, user.systemRole, projectId, organizationId);
    if (!accessibleProjects) {
      return { success: false, error: 'Sin acceso' };
    }

    const timezone = await getOrgTimezone(organizationId);

    // Build where clause with date filter on createdAt
    const where: Prisma.LeadWhereInput = {};

    if (accessibleProjects === 'all_in_org' && organizationId) {
      where.project = { organizationId };
    } else if (Array.isArray(accessibleProjects)) {
      if (accessibleProjects.length === 1) {
        where.projectId = accessibleProjects[0];
      } else {
        where.projectId = { in: accessibleProjects };
      }
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      // Use timezone-aware end of day instead of UTC setHours
      const endOfDay = getEndOfDayInTimezone(timezone, end);
      where.createdAt = { gte: start, lte: endOfDay };
    }

    const leads = await prisma.lead.findMany({
      where,
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        businessName: true,
        position: true,
        status: true,
        temperature: true,
        source: true,
        channel: true,
        type: true,
        estimatedValue: true,
        currency: true,
        tags: true,
        summary: true,
        lastContactAt: true,
        createdAt: true,
        archivedAt: true,
        assignedAgent: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (leads.length === 0) {
      return { success: false, error: locale === 'es' ? 'No hay leads en ese rango de fechas' : 'No leads found in that date range' };
    }

    // Dynamic import to avoid bundling xlsx on every page load
    const XLSX = await import('xlsx');

    const isEs = locale === 'es';

    // Status translations
    const statusLabels: Record<string, string> = isEs
      ? { new: 'Nuevo', contacted: 'Contactado', qualified: 'Calificado', proposal: 'Propuesta', negotiation: 'Negociación', won: 'Ganado', lost: 'Perdido' }
      : { new: 'New', contacted: 'Contacted', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation', won: 'Won', lost: 'Lost' };

    const tempLabels: Record<string, string> = isEs
      ? { cold: 'Bajo', warm: 'Medio', hot: 'Alto' }
      : { cold: 'Cold', warm: 'Warm', hot: 'Hot' };

    const sourceLabels: Record<string, string> = isEs
      ? { website: 'Sitio Web', referral: 'Referido', social_media: 'Redes Sociales', advertising: 'Publicidad', event: 'Evento', other: 'Otro' }
      : { website: 'Website', referral: 'Referral', social_media: 'Social Media', advertising: 'Advertising', event: 'Event', other: 'Other' };

    const typeLabels: Record<string, string> = isEs
      ? { ai_agent: 'Agente IA', manual: 'Manual' }
      : { ai_agent: 'AI Agent', manual: 'Manual' };

    const formatDate = (date: Date | null) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString(isEs ? 'es-PE' : 'en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
        timeZone: timezone,
      });
    };

    const rows = leads.map(lead => ({
      [isEs ? 'Nombre' : 'First Name']: lead.firstName,
      [isEs ? 'Apellido' : 'Last Name']: lead.lastName,
      [isEs ? 'Email' : 'Email']: lead.email || '',
      [isEs ? 'Teléfono' : 'Phone']: lead.phone || '',
      [isEs ? 'Empresa' : 'Company']: lead.businessName || '',
      [isEs ? 'Cargo' : 'Position']: lead.position || '',
      [isEs ? 'Estado' : 'Status']: statusLabels[lead.status] || lead.status,
      [isEs ? 'Potencial' : 'Potential']: tempLabels[lead.temperature] || lead.temperature,
      [isEs ? 'Fuente' : 'Source']: sourceLabels[lead.source] || lead.source,
      [isEs ? 'Canal' : 'Channel']: lead.channel || '',
      [isEs ? 'Tipo' : 'Type']: typeLabels[lead.type] || lead.type,
      [isEs ? 'Valor Estimado' : 'Estimated Value']: lead.estimatedValue ? Number(lead.estimatedValue) : '',
      [isEs ? 'Moneda' : 'Currency']: lead.currency || '',
      [isEs ? 'Etiquetas' : 'Tags']: lead.tags?.join(', ') || '',
      [isEs ? 'Agente' : 'Agent']: lead.assignedAgent?.name || '',
      [isEs ? 'Proyecto' : 'Project']: lead.project?.name || '',
      [isEs ? 'Resumen IA' : 'AI Summary']: lead.summary || '',
      [isEs ? 'Último Contacto' : 'Last Contact']: formatDate(lead.lastContactAt),
      [isEs ? 'Fecha Creación' : 'Created']: formatDate(lead.createdAt),
      [isEs ? 'Archivado' : 'Archived']: lead.archivedAt ? (isEs ? 'Sí' : 'Yes') : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns + hide Currency column
    const currencyKey = isEs ? 'Moneda' : 'Currency';
    const colWidths = Object.keys(rows[0]).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String((r as Record<string, unknown>)[key] || '').length).slice(0, 50)) + 2,
      hidden: key === currencyKey,
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const base64 = Buffer.from(buffer).toString('base64');

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `leads_${dateStr}.xlsx`;

    return { success: true, data: base64, filename, count: leads.length };
  } catch (error) {
    console.error('Error exporting leads:', error);
    return { success: false, error: 'Error interno' };
  }
}

// ============================================
// ASSIGN / REASSIGN LEAD
// ============================================

export async function assignLead(
  leadId: string,
  targetUserId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, projectId: true, assignedUserId: true },
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    const roleInfo = await getProjectRole(user.id, user.systemRole, lead.projectId);
    if (!roleInfo.hasAccess) {
      return { success: false, error: 'Sin acceso a este lead' };
    }

    const effectiveRole = getEffectiveRole(user.systemRole, roleInfo.isOrgOwner ?? false, roleInfo.projectRole);

    if (isViewerOnly(effectiveRole)) {
      return { success: false, error: 'Sin permisos para esta acción' };
    }

    // No-op if already assigned to the target
    if (lead.assignedUserId === targetUserId) {
      return { success: true };
    }

    // Permission checks based on action type
    if (canReassignLead(effectiveRole)) {
      // Manager+ can assign/reassign/unassign to anyone (including self)
    } else if (targetUserId === user.id && !lead.assignedUserId) {
      // Agent self-assign: only when lead is unassigned
      if (!canTakeUnassignedLead(effectiveRole)) {
        return { success: false, error: 'Sin permisos para tomar este lead' };
      }
    } else {
      return { success: false, error: 'Sin permisos para reasignar leads' };
    }

    // Fetch target user name and role for activity log
    let description = 'Lead desasignado';
    if (targetUserId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { firstName: true, lastName: true },
      });
      const targetMembership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: lead.projectId, userId: targetUserId } },
        select: { role: true },
      });
      const targetName = targetUser ? `${targetUser.firstName} ${targetUser.lastName}` : 'usuario';
      const targetRole = targetMembership?.role || '';
      const roleSuffix = targetRole ? ` [${targetRole}]` : '';
      description = targetUserId === user.id
        ? `Lead asignado a sí mismo${roleSuffix}`
        : `Lead asignado a: ${targetName}${roleSuffix}`;
    }

    // Update lead assignment
    await prisma.$transaction([
      prisma.lead.update({
        where: { id: leadId },
        data: {
          assignedUserId: targetUserId,
          updatedAt: new Date(),
        },
      }),
      prisma.activity.create({
        data: {
          leadId,
          type: 'assignment_change',
          description,
          performedBy: user.id,
          metadata: {
            previousAssignedUserId: lead.assignedUserId,
            newAssignedUserId: targetUserId,
          },
        },
      }),
    ]);

    revalidatePath('/leads');

    return { success: true };
  } catch (error) {
    console.error('Error assigning lead:', error);
    return { success: false, error: 'Error al asignar lead' };
  }
}

// ============================================
// GET PROJECT TEAM MEMBERS
// ============================================

export async function getProjectTeamMembers(
  projectId: string
): Promise<{ success: boolean; members?: { id: string; firstName: string; lastName: string; role: string }[]; error?: string }> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso a este proyecto' };
    }

    const projectMembers = await prisma.projectMember.findMany({
      where: {
        projectId,
        user: { isActive: true },
      },
      select: {
        role: true,
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Role hierarchy for sorting
    const roleOrder: Record<string, number> = {
      admin: 1,
      manager: 2,
      agent: 3,
      viewer: 4,
    };

    const members = projectMembers
      .map((pm) => ({
        id: pm.user.id,
        firstName: pm.user.firstName,
        lastName: pm.user.lastName,
        role: pm.role,
      }))
      .sort((a, b) => {
        const roleA = roleOrder[a.role] ?? 99;
        const roleB = roleOrder[b.role] ?? 99;
        if (roleA !== roleB) return roleA - roleB;
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

    return { success: true, members };
  } catch (error) {
    console.error('Error getting project team members:', error);
    return { success: false, error: 'Error al obtener miembros del equipo' };
  }
}
