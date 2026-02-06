// ============================================
// KAIRO - Leads Server Actions
// Server-side filtering and pagination
// ============================================

'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser, verifyAuth, verifyProjectAccess } from './auth';
import { validatePhone, normalizePhone } from '@/lib/utils';
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
  | 'createdAt'
  | 'updatedAt'
  | 'projectId'
> & {
  assignedAgent: Pick<AIAgent, 'id' | 'name' | 'type'> | null;
};

// Get leads stats for a project
export type LeadsStats = {
  total: number;
  byStatus: Record<string, number>;
  byTemperature: Record<string, number>;
};

// ============================================
// HELPER: Get accessible project IDs for user
// ============================================

interface UserWithMemberships {
  systemRole: string;
  projectMemberships?: Array<{ projectId: string }>;
}

async function getAccessibleProjectIds(
  user: UserWithMemberships,
  projectId?: string,
  organizationId?: string
): Promise<string[] | 'all_in_org' | null> {
  if (projectId) {
    // Specific project requested
    return [projectId];
  }

  if (organizationId) {
    if (user.systemRole === 'super_admin') {
      // Super admin can see all projects in org
      return 'all_in_org';
    }
    // Regular users: get intersection of their projects and org projects
    const userProjectIds = user.projectMemberships?.map((m) => m.projectId) || [];
    const orgProjects = await prisma.project.findMany({
      where: {
        organizationId,
        id: { in: userProjectIds },
      },
      select: { id: true },
    });
    if (orgProjects.length === 0) return null;
    return orgProjects.map((p) => p.id);
  }

  // No project or org specified: fallback to first accessible project
  if (user.systemRole === 'super_admin') {
    const firstProject = await prisma.project.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!firstProject) return null;
    return [firstProject.id];
  }

  if (user.projectMemberships && user.projectMemberships.length > 0) {
    return [user.projectMemberships[0].projectId];
  }

  return null;
}

// ============================================
// HELPER: Build Prisma where clause for leads
// ============================================

function getDateRangeFilter(
  dateRange: DateRangePreset | 'custom',
  customDateRange?: { start: Date | null; end: Date | null }
): Prisma.DateTimeNullableFilter | undefined {
  const now = new Date();

  switch (dateRange) {
    case 'today': {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
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
    case 'last90days': {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { gte: start };
    }
    case 'custom': {
      if (customDateRange?.start || customDateRange?.end) {
        const filter: Prisma.DateTimeNullableFilter = {};
        if (customDateRange.start) filter.gte = customDateRange.start;
        if (customDateRange.end) filter.lte = customDateRange.end;
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
  filters?: Partial<LeadFilters>
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

  // Date range filter
  if (filters?.dateRange && filters.dateRange !== 'all') {
    const dateFilter = getDateRangeFilter(filters.dateRange, filters.customDateRange);
    if (dateFilter) {
      where.lastContactAt = dateFilter;
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

  return where;
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
    const user = await getCurrentUser();

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
    const accessibleProjects = await getAccessibleProjectIds(user, projectId, organizationId);

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
    const where = buildLeadWhereClause(accessibleProjects, organizationId, filters);

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
    const user = await getCurrentUser();

    if (!user) {
      return [];
    }

    const accessibleProjects = await getAccessibleProjectIds(user, projectId, organizationId);

    if (!accessibleProjects) {
      return [];
    }

    const where = buildLeadWhereClause(accessibleProjects, organizationId);

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
    const user = await getCurrentUser();

    if (!user) {
      return { total: 0, byStatus: {}, byTemperature: {} };
    }

    const accessibleProjects = await getAccessibleProjectIds(user, projectId, organizationId);

    if (!accessibleProjects) {
      return { total: 0, byStatus: {}, byTemperature: {} };
    }

    const where = buildLeadWhereClause(accessibleProjects, organizationId, filters);

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
      select: { projectId: true, status: true },
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso a este lead' };
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
      select: { projectId: true },
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso a este lead' };
    }

    // Validate and normalize phone if provided
    let normalizedPhone = data.phone;
    if (data.phone) {
      if (!validatePhone(data.phone)) {
        return { success: false, error: 'Número de teléfono inválido' };
      }
      normalizedPhone = normalizePhone(data.phone) || data.phone;
    }

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

    return { success: true };
  } catch (error) {
    console.error('Error updating lead:', error);
    return { success: false, error: 'Error al actualizar lead' };
  }
}

// ============================================
// AI AGENTS
// ============================================

export async function getAIAgents(projectId?: string) {
  try {
    const user = await getCurrentUser();

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
      } else if (user.projectMemberships && user.projectMemberships.length > 0) {
        targetProjectId = user.projectMemberships[0].projectId;
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
      select: { projectId: true },
    });
    if (!lead) return null;

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) return null;

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
