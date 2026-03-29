// ============================================
// KAIRO - Permission System (Pure module, no 'use server')
// Importable from both server and client code
// ============================================

import type { ProjectRole } from '@/types';

// Effective role hierarchy: super_admin > owner > admin > manager > agent > viewer
export type EffectiveRole = 'super_admin' | 'owner' | 'admin' | 'manager' | 'agent' | 'viewer';

const ROLE_HIERARCHY: Record<EffectiveRole, number> = {
  super_admin: 60,
  owner: 50,
  admin: 40,
  manager: 30,
  agent: 20,
  viewer: 10,
};

/**
 * Resolve the highest privilege from systemRole + org ownership + project role.
 * A user who is org owner AND project admin gets 'owner' (higher).
 */
export function getEffectiveRole(
  systemRole: string,
  isOrgOwner: boolean,
  projectRole?: string | null
): EffectiveRole {
  if (systemRole === 'super_admin') return 'super_admin';

  let highest: EffectiveRole = 'viewer';
  let highestLevel = ROLE_HIERARCHY.viewer;

  if (isOrgOwner) {
    highest = 'owner';
    highestLevel = ROLE_HIERARCHY.owner;
  }

  if (projectRole) {
    const role = projectRole as EffectiveRole;
    const level = ROLE_HIERARCHY[role];
    if (level && level > highestLevel) {
      highest = role;
    }
  }

  return highest;
}

function hasMinRole(role: EffectiveRole, minRole: EffectiveRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

// --- Permission predicates ---

/** Can take an unassigned lead (>= agent) */
export function canTakeUnassignedLead(role: EffectiveRole): boolean {
  return hasMinRole(role, 'agent');
}

/** Can work on own assigned lead - chat, edit, etc. (>= agent) */
export function canWorkOwnLead(role: EffectiveRole): boolean {
  return hasMinRole(role, 'agent');
}

/** Can reassign or unassign leads (>= manager) */
export function canReassignLead(role: EffectiveRole): boolean {
  return hasMinRole(role, 'manager');
}

/** Can work on another user's lead (>= admin) */
export function canWorkOtherLead(role: EffectiveRole): boolean {
  return hasMinRole(role, 'admin');
}

/** Is viewer only (no actions) */
export function isViewerOnly(role: EffectiveRole): boolean {
  return role === 'viewer';
}

/**
 * Check if user can perform actions on a specific lead.
 * Combines role + assignment status.
 */
export function canActOnLead(
  role: EffectiveRole,
  leadAssignedUserId: string | null | undefined,
  currentUserId: string
): boolean {
  if (isViewerOnly(role)) return false;
  // Unassigned lead or own lead
  if (!leadAssignedUserId || leadAssignedUserId === currentUserId) return true;
  // Other user's lead requires >= admin
  return canWorkOtherLead(role);
}
