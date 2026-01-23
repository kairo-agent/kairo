// ============================================
// KAIRO - Workspace Server Actions
// Fetch organizations and projects for workspace selector
// ============================================

'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from './auth';

export interface WorkspaceOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
}

/**
 * Get organizations accessible to the current user
 * - super_admin: All organizations
 * - regular user: Only organizations they're members of
 */
export async function getOrganizations(): Promise<WorkspaceOrganization[]> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return [];
    }

    // Super admin can see all organizations
    if (user.systemRole === 'super_admin') {
      const orgs = await prisma.organization.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });
      // Serialize to plain objects for client components
      return orgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
      }));
    }

    // Regular users see only their organizations
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: user.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
      },
    });

    return memberships
      .filter((m) => m.organization.isActive)
      .map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
      }));
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return [];
  }
}

/**
 * Get projects for a specific organization
 * - super_admin: All projects in the organization
 * - regular user: Only projects they're members of
 */
export async function getProjects(organizationId: string): Promise<WorkspaceProject[]> {
  try {
    const user = await getCurrentUser();

    if (!user || !organizationId) {
      return [];
    }

    // Super admin can see all projects in the organization
    if (user.systemRole === 'super_admin') {
      const projects = await prisma.project.findMany({
        where: {
          organizationId,
          isActive: true,
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          organizationId: true,
        },
      });
      return projects;
    }

    // Regular users see only their projects within the organization
    const memberships = await prisma.projectMember.findMany({
      where: { userId: user.id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            organizationId: true,
            isActive: true,
          },
        },
      },
    });

    return memberships
      .filter((m) => m.project.organizationId === organizationId && m.project.isActive)
      .map((m) => ({
        id: m.project.id,
        name: m.project.name,
        slug: m.project.slug,
        organizationId: m.project.organizationId,
      }));
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}
