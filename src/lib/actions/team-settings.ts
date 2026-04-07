'use server';

import { prisma } from '@/lib/prisma';
import { verifyAuth, verifyProjectAccess, getProjectRole } from './auth';
import { getEffectiveRole } from '@/lib/permissions';

// Valid visibility modes
const VALID_MODES = ['all_leads', 'assigned_and_unassigned', 'only_assigned'] as const;
type LeadVisibilityMode = typeof VALID_MODES[number];

/**
 * Get the current lead visibility mode for a project.
 * Accessible to admin+ roles.
 */
export async function getProjectLeadVisibility(
  projectId: string
): Promise<{ success: boolean; mode?: LeadVisibilityMode; error?: string }> {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    // Any project member can read the visibility setting (needed to adapt UI)
    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, projectId);
    if (!hasAccess) return { success: false, error: 'Sin acceso' };

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { leadVisibilityMode: true },
    });

    if (!project) return { success: false, error: 'Proyecto no encontrado' };

    return {
      success: true,
      mode: (project.leadVisibilityMode as LeadVisibilityMode) || 'all_leads',
    };
  } catch (error) {
    console.error('Error getting project lead visibility:', error);
    return { success: false, error: 'Error interno' };
  }
}

/**
 * Update the lead visibility mode for a project.
 * Accessible to admin+ roles.
 */
export async function updateProjectLeadVisibility(
  projectId: string,
  mode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    // Validate mode
    if (!VALID_MODES.includes(mode as LeadVisibilityMode)) {
      return { success: false, error: 'Modo de visibilidad no válido' };
    }

    const roleInfo = await getProjectRole(user.id, user.systemRole, projectId);
    if (!roleInfo.hasAccess) return { success: false, error: 'Sin acceso' };

    const effectiveRole = getEffectiveRole(
      user.systemRole,
      roleInfo.isOrgOwner ?? false,
      roleInfo.projectRole
    );

    // Only admin+ can modify team settings
    if (effectiveRole !== 'super_admin' && effectiveRole !== 'owner' && effectiveRole !== 'admin') {
      return { success: false, error: 'Permisos insuficientes' };
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { leadVisibilityMode: mode },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating project lead visibility:', error);
    return { success: false, error: 'Error interno' };
  }
}

// ============================================
// Auto-Assignment Configuration
// ============================================

interface AutoAssignmentMember {
  userId: string;
  percentage: number;
}

interface AutoAssignmentConfig {
  enabled: boolean;
  members: AutoAssignmentMember[];
}

/**
 * Get the current auto-assignment configuration for a project.
 * Readable by admin+ roles.
 */
export async function getProjectAutoAssignment(
  projectId: string
): Promise<{ success: boolean; config?: AutoAssignmentConfig; error?: string }> {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const roleInfo = await getProjectRole(user.id, user.systemRole, projectId);
    if (!roleInfo.hasAccess) return { success: false, error: 'Sin acceso' };

    const effectiveRole = getEffectiveRole(
      user.systemRole,
      roleInfo.isOrgOwner ?? false,
      roleInfo.projectRole
    );

    if (effectiveRole !== 'super_admin' && effectiveRole !== 'owner' && effectiveRole !== 'admin') {
      return { success: false, error: 'Permisos insuficientes' };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { leadAutoAssignment: true },
    });

    if (!project) return { success: false, error: 'Proyecto no encontrado' };

    const config = (project.leadAutoAssignment as AutoAssignmentConfig | null) || {
      enabled: false,
      members: [],
    };

    return { success: true, config };
  } catch (error) {
    console.error('Error getting auto-assignment config:', error);
    return { success: false, error: 'Error interno' };
  }
}

/**
 * Update the auto-assignment configuration for a project.
 * Only admin+ can modify.
 */
export async function updateProjectAutoAssignment(
  projectId: string,
  config: AutoAssignmentConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const roleInfo = await getProjectRole(user.id, user.systemRole, projectId);
    if (!roleInfo.hasAccess) return { success: false, error: 'Sin acceso' };

    const effectiveRole = getEffectiveRole(
      user.systemRole,
      roleInfo.isOrgOwner ?? false,
      roleInfo.projectRole
    );

    if (effectiveRole !== 'super_admin' && effectiveRole !== 'owner' && effectiveRole !== 'admin') {
      return { success: false, error: 'Permisos insuficientes' };
    }

    // Validate: if enabled, percentages must sum to 100
    if (config.enabled) {
      const activeMembers = config.members.filter(m => m.percentage > 0);
      if (activeMembers.length === 0) {
        return { success: false, error: 'Selecciona al menos un miembro' };
      }
      const total = activeMembers.reduce((sum, m) => sum + m.percentage, 0);
      if (total !== 100) {
        return { success: false, error: 'Los porcentajes deben sumar 100%' };
      }
      for (const m of config.members) {
        if (m.percentage < 0 || m.percentage > 100 || !Number.isInteger(m.percentage)) {
          return { success: false, error: 'Porcentajes inválidos' };
        }
      }
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { leadAutoAssignment: config as object },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating auto-assignment config:', error);
    return { success: false, error: 'Error interno' };
  }
}
