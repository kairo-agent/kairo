'use client';

import { useMemo } from 'react';
import { useCurrentUser } from '@/app/[locale]/(dashboard)/DashboardLayoutClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getEffectiveRole, type EffectiveRole } from '@/lib/permissions';

/**
 * Computes the user's effective role for the currently selected project.
 * Combines systemRole + org ownership + project role into a single EffectiveRole.
 */
export function useEffectiveRole(): EffectiveRole {
  const user = useCurrentUser();
  const { selectedProject, selectedOrganization } = useWorkspace();

  return useMemo(() => {
    if (user.systemRole === 'super_admin') return 'super_admin' as const;

    const projectRole = selectedProject
      ? user.projectMemberships?.find(m => m.projectId === selectedProject.id)?.role
      : undefined;

    const isOrgOwner = selectedOrganization
      ? user.organizationMemberships?.some(
          m => m.organizationId === selectedOrganization.id && m.isOwner
        ) ?? false
      : false;

    return getEffectiveRole(user.systemRole, isOrgOwner, projectRole);
  }, [user, selectedProject, selectedOrganization]);
}
