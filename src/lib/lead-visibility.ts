// ============================================
// KAIRO - Lead Visibility Module (Pure, no 'use server')
// Importable from both server actions and other modules
// ============================================

import { prisma } from '@/lib/prisma';
import { getProjectRole } from '@/lib/actions/auth';
import { getEffectiveRole, type EffectiveRole } from '@/lib/permissions';
import type { Prisma } from '@prisma/client';

// Lead visibility modes (stored in Project.leadVisibilityMode)
export type LeadVisibilityMode = 'all_leads' | 'assigned_and_unassigned' | 'only_assigned';

// Visibility context for filtering leads based on project settings + user role
export interface VisibilityContext {
  userId: string;
  effectiveRole: EffectiveRole;
  visibilityMode: LeadVisibilityMode;
}

/**
 * Get visibility context for a user in a specific project.
 * Returns the project's visibility setting + user's effective role.
 */
export async function getVisibilityContext(
  userId: string,
  systemRole: string,
  projectId: string
): Promise<VisibilityContext> {
  if (systemRole === 'super_admin') {
    return { userId, effectiveRole: 'super_admin', visibilityMode: 'all_leads' };
  }

  const [roleInfo, project] = await Promise.all([
    getProjectRole(userId, systemRole, projectId),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { leadVisibilityMode: true },
    }),
  ]);

  const effectiveRole = getEffectiveRole(
    systemRole,
    roleInfo.isOrgOwner ?? false,
    roleInfo.projectRole
  );

  return {
    userId,
    effectiveRole,
    visibilityMode: (project?.leadVisibilityMode as LeadVisibilityMode) || 'all_leads',
  };
}

/**
 * Build a visibility filter clause based on project settings + user role.
 * Only restricts agent (20) and viewer (10) roles.
 * Manager (30)+ always see all leads.
 * Returns undefined if no restriction needed.
 */
export function buildVisibilityFilter(
  visibility?: VisibilityContext
): Prisma.LeadWhereInput | undefined {
  if (!visibility) return undefined;

  const { effectiveRole, visibilityMode, userId } = visibility;

  // Manager and above always see everything
  if (effectiveRole === 'super_admin' || effectiveRole === 'owner' || effectiveRole === 'admin' || effectiveRole === 'manager') {
    return undefined;
  }

  // Agent and viewer: apply project visibility setting
  if (visibilityMode === 'assigned_and_unassigned') {
    return { OR: [{ assignedUserId: userId }, { assignedUserId: null }] };
  } else if (visibilityMode === 'only_assigned') {
    return { assignedUserId: userId };
  }

  // 'all_leads' = no restriction
  return undefined;
}
