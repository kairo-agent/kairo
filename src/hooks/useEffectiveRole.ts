'use client';

import { useMemo, useContext } from 'react';
import { useCurrentUser } from '@/app/[locale]/(dashboard)/DashboardLayoutClient';
import { useWorkspaceOptional } from '@/contexts/WorkspaceContext';
import { getEffectiveRole, type EffectiveRole } from '@/lib/permissions';

/**
 * Computes the user's effective role for the currently selected project.
 * Combines systemRole + org ownership + project role into a single EffectiveRole.
 * Safe to use outside DashboardLayoutClient (returns null).
 */
export function useEffectiveRole(): EffectiveRole {
  const user = useCurrentUser();
  const workspace = useWorkspaceOptional();

  return useMemo(() => {
    if (user.systemRole === 'super_admin') return 'super_admin' as const;

    const selectedProject = workspace?.selectedProject;
    const selectedOrganization = workspace?.selectedOrganization;

    const projectRole = selectedProject
      ? user.projectMemberships?.find(m => m.projectId === selectedProject.id)?.role
      : undefined;

    const isOrgOwner = selectedOrganization
      ? user.organizationMemberships?.some(
          m => m.organizationId === selectedOrganization.id && m.isOwner
        ) ?? false
      : false;

    return getEffectiveRole(user.systemRole, isOrgOwner, projectRole);
  }, [user, workspace?.selectedProject, workspace?.selectedOrganization]);
}

/**
 * Safe version that returns null when outside DashboardLayoutClient context.
 * Use this in shared components like Header that render in both dashboard and admin layouts.
 */
export function useEffectiveRoleSafe(): EffectiveRole | null {
  try {
    return useEffectiveRole();
  } catch {
    return null;
  }
}
