// ============================================
// KAIRO - Admin Server Actions
// For Super Admin operations
// Optimized: Uses middleware-verified auth when available
// ============================================

'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase';
import prisma from '@/lib/prisma';
import { SystemRole, ProjectRole } from '@/types';
import { verifySuperAdmin as verifyAdmin } from '@/lib/auth-helpers';

// Generate a cryptographically secure random password
// SECURITY: Uses crypto.randomBytes instead of Math.random()
function generatePassword(length: number = 16): string {
  const { randomBytes } = require('crypto');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

// Verify current user is super admin (optimized with middleware headers)
async function verifySuperAdmin(): Promise<boolean> {
  const { isAdmin } = await verifyAdmin();
  return isAdmin;
}

// ============================================
// ORGANIZATION ACTIONS
// ============================================

export async function createOrganization(data: {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  defaultTimezone?: string;
  defaultLocale?: string;
}) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  try {
    const organization = await prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug.toLowerCase().replace(/\s+/g, '-'),
        description: data.description,
        logoUrl: data.logoUrl,
        defaultTimezone: data.defaultTimezone || 'America/Lima',
        defaultLocale: data.defaultLocale || 'es-PE',
      },
    });

    revalidatePath('/admin/organizations');
    return { success: true, organization };
  } catch (error) {
    console.error('Error creating organization:', error);
    return { error: 'Error al crear la organización' };
  }
}

export async function updateOrganization(id: string, data: {
  name?: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  isActive?: boolean;
  defaultTimezone?: string;
  defaultLocale?: string;
}) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  try {
    const organization = await prisma.organization.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug?.toLowerCase().replace(/\s+/g, '-'),
        description: data.description,
        logoUrl: data.logoUrl,
        isActive: data.isActive,
        defaultTimezone: data.defaultTimezone,
        defaultLocale: data.defaultLocale,
      },
    });

    revalidatePath('/admin/organizations');
    return { success: true, organization };
  } catch (error) {
    console.error('Error updating organization:', error);
    return { error: 'Error al actualizar la organización' };
  }
}

export async function deleteOrganization(id: string) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  try {
    // Check for dependencies before deleting
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            projects: true,
            members: true,
          },
        },
      },
    });

    if (!organization) {
      return { error: 'Organización no encontrada' };
    }

    // Block deletion if has projects
    if (organization._count.projects > 0) {
      return {
        error: 'HAS_PROJECTS',
        count: organization._count.projects,
      };
    }

    // Block deletion if has members
    if (organization._count.members > 0) {
      return {
        error: 'HAS_MEMBERS',
        count: organization._count.members,
      };
    }

    await prisma.organization.delete({
      where: { id },
    });

    revalidatePath('/admin/organizations');
    return { success: true };
  } catch (error) {
    console.error('Error deleting organization:', error);
    return { error: 'Error al eliminar la organización' };
  }
}

export async function getOrganizations() {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado', organizations: [] };
  }

  try {
    const organizations = await prisma.organization.findMany({
      include: {
        _count: {
          select: {
            projects: true,
            members: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { organizations };
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return { error: 'Error al obtener organizaciones', organizations: [] };
  }
}

// ============================================
// PROJECT ACTIONS
// ============================================

export async function createProject(data: {
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
}) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  try {
    const project = await prisma.project.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        slug: data.slug.toLowerCase().replace(/\s+/g, '-'),
        description: data.description,
        logoUrl: data.logoUrl,
      },
    });

    revalidatePath('/admin/projects');
    return { success: true, project };
  } catch (error) {
    console.error('Error creating project:', error);
    return { error: 'Error al crear el proyecto' };
  }
}

export async function updateProject(id: string, data: {
  name?: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  isActive?: boolean;
  plan?: 'free' | 'starter' | 'professional' | 'enterprise';
}) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug?.toLowerCase().replace(/\s+/g, '-'),
        description: data.description,
        logoUrl: data.logoUrl,
        isActive: data.isActive,
        plan: data.plan,
      },
    });

    revalidatePath('/admin/projects');
    return { success: true, project };
  } catch (error) {
    console.error('Error updating project:', error);
    return { error: 'Error al actualizar el proyecto' };
  }
}

export async function deleteProject(id: string) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  try {
    // Check for dependencies before deleting
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            members: true,
            leads: true,
          },
        },
      },
    });

    if (!project) {
      return { error: 'Proyecto no encontrado' };
    }

    // Block deletion if has members
    if (project._count.members > 0) {
      return {
        error: 'HAS_MEMBERS',
        count: project._count.members,
      };
    }

    // Block deletion if has leads
    if (project._count.leads > 0) {
      return {
        error: 'HAS_LEADS',
        count: project._count.leads,
      };
    }

    await prisma.project.delete({
      where: { id },
    });

    revalidatePath('/admin/projects');
    return { success: true };
  } catch (error) {
    console.error('Error deleting project:', error);
    return { error: 'Error al eliminar el proyecto' };
  }
}

export async function getProjects(organizationId?: string) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado', projects: [] };
  }

  try {
    const projects = await prisma.project.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        organization: true,
        _count: {
          select: {
            members: true,
            leads: true,
            aiAgents: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { projects };
  } catch (error) {
    console.error('Error fetching projects:', error);
    return { error: 'Error al obtener proyectos', projects: [] };
  }
}

// ============================================
// USER ACTIONS
// ============================================

export async function createUser(data: {
  email: string;
  firstName: string;
  lastName: string;
  systemRole?: SystemRole;
  generatePassword?: boolean;
  password?: string;
  // Organization membership (optional)
  organizationId?: string;
  isOrgOwner?: boolean;
  // Project membership (optional)
  projectId?: string;
  projectRole?: ProjectRole;
}) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  const adminClient = createAdminClient();
  const password = data.generatePassword ? generatePassword() : data.password;

  if (!password) {
    return { error: 'Se requiere una contraseña' };
  }

  try {
    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      console.error('Supabase Auth error:', authError);
      return { error: authError.message };
    }

    if (!authData.user) {
      return { error: 'Error al crear usuario en autenticación' };
    }

    // 2. Create user in our database
    const user = await prisma.user.create({
      data: {
        id: authData.user.id, // Use Supabase Auth ID
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        systemRole: data.systemRole || 'user',
      },
    });

    // 3. Add organization membership if provided
    if (data.organizationId) {
      await prisma.organizationMember.create({
        data: {
          organizationId: data.organizationId,
          userId: user.id,
          isOwner: data.isOrgOwner || false,
        },
      });
    }

    // 4. Add project membership if provided
    if (data.projectId) {
      await prisma.projectMember.create({
        data: {
          projectId: data.projectId,
          userId: user.id,
          role: data.projectRole || 'viewer',
        },
      });
    }

    revalidatePath('/admin/users');

    return {
      success: true,
      user,
      // Only return password if it was auto-generated
      generatedPassword: data.generatePassword ? password : undefined,
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return { error: 'Error al crear el usuario' };
  }
}

export async function updateUser(id: string, data: {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  systemRole?: SystemRole;
  isActive?: boolean;
}) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
    });

    revalidatePath('/admin/users');
    return { success: true, user };
  } catch (error) {
    console.error('Error updating user:', error);
    return { error: 'Error al actualizar el usuario' };
  }
}

export async function deleteUser(id: string) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  const adminClient = createAdminClient();

  try {
    // Delete from Supabase Auth
    await adminClient.auth.admin.deleteUser(id);

    // Delete from our database (cascade will handle memberships)
    await prisma.user.delete({
      where: { id },
    });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { error: 'Error al eliminar el usuario' };
  }
}

export async function getUsers() {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado', users: [] };
  }

  try {
    const users = await prisma.user.findMany({
      include: {
        organizationMemberships: {
          include: {
            organization: true,
          },
        },
        projectMemberships: {
          include: {
            project: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { users };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { error: 'Error al obtener usuarios', users: [] };
  }
}

// ============================================
// MEMBERSHIP ACTIONS
// ============================================

export async function addUserToOrganization(data: {
  userId: string;
  organizationId: string;
  isOwner?: boolean;
}) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  try {
    const membership = await prisma.organizationMember.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        isOwner: data.isOwner || false,
      },
    });

    revalidatePath('/admin/users');
    return { success: true, membership };
  } catch (error) {
    console.error('Error adding user to organization:', error);
    return { error: 'Error al agregar usuario a la organización' };
  }
}

export async function removeUserFromOrganization(userId: string, organizationId: string) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  try {
    await prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error) {
    console.error('Error removing user from organization:', error);
    return { error: 'Error al remover usuario de la organización' };
  }
}

export async function addUserToProject(data: {
  userId: string;
  projectId: string;
  role: ProjectRole;
}) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  try {
    const membership = await prisma.projectMember.create({
      data: {
        userId: data.userId,
        projectId: data.projectId,
        role: data.role,
      },
    });

    revalidatePath('/admin/users');
    return { success: true, membership };
  } catch (error) {
    console.error('Error adding user to project:', error);
    return { error: 'Error al agregar usuario al proyecto' };
  }
}

export async function removeUserFromProject(userId: string, projectId: string) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  try {
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error) {
    console.error('Error removing user from project:', error);
    return { error: 'Error al remover usuario del proyecto' };
  }
}

export async function updateProjectMemberRole(userId: string, projectId: string, role: ProjectRole) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  try {
    const membership = await prisma.projectMember.update({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      data: { role },
    });

    revalidatePath('/admin/users');
    return { success: true, membership };
  } catch (error) {
    console.error('Error updating project member role:', error);
    return { error: 'Error al actualizar rol del usuario' };
  }
}

// ============================================
// PASSWORD RESET
// ============================================

export async function resetUserPassword(userId: string, generateNew: boolean = true) {
  if (!await verifySuperAdmin()) {
    return { error: 'No autorizado' };
  }

  const adminClient = createAdminClient();
  const newPassword = generateNew ? generatePassword() : undefined;

  try {
    if (newPassword) {
      await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      return { success: true, newPassword };
    } else {
      // Send password reset email
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return { error: 'Usuario no encontrado' };
      }

      await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: user.email,
      });

      return { success: true, message: 'Email de recuperación enviado' };
    }
  } catch (error) {
    console.error('Error resetting password:', error);
    return { error: 'Error al resetear contraseña' };
  }
}

// ============================================
// SUPER ADMIN SELF-JOIN ACTIONS
// Allows super_admin to join any org/project as admin
// ============================================

export async function joinOrganization(organizationId: string) {
  const { isAdmin, userId } = await verifyAdmin();
  if (!isAdmin || !userId) {
    return { error: 'No autorizado' };
  }

  try {
    // Check if already a member
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });

    if (existingMembership) {
      return { error: 'Ya eres miembro de esta organización' };
    }

    // Add as owner (super_admin gets full control)
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId,
        isOwner: true,
      },
    });

    revalidatePath('/admin');
    return { success: true, message: 'Te has unido a la organización como Owner' };
  } catch (error) {
    console.error('Error joining organization:', error);
    return { error: 'Error al unirse a la organización' };
  }
}

export async function joinProject(projectId: string) {
  const { isAdmin, userId } = await verifyAdmin();
  if (!isAdmin || !userId) {
    return { error: 'No autorizado' };
  }

  try {
    // Get project to find organization
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, organizationId: true },
    });

    if (!project) {
      return { error: 'Proyecto no encontrado' };
    }

    // First ensure user is member of the organization
    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: project.organizationId, userId },
      },
    });

    if (!orgMembership) {
      // Auto-join organization first
      await prisma.organizationMember.create({
        data: {
          organizationId: project.organizationId,
          userId,
          isOwner: true,
        },
      });
    }

    // Check if already a project member
    const existingMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    if (existingMembership) {
      return { error: 'Ya eres miembro de este proyecto' };
    }

    // Add as admin
    await prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role: 'admin',
      },
    });

    revalidatePath('/admin');
    return { success: true, message: 'Te has unido al proyecto como Admin' };
  } catch (error) {
    console.error('Error joining project:', error);
    return { error: 'Error al unirse al proyecto' };
  }
}

// ============================================
// UNIFIED ADMIN DATA (Optimized - Single Query)
// ============================================

export type AdminViewType = 'organizations' | 'projects' | 'users';

export interface AdminFilters {
  viewType: AdminViewType;
  organizationId?: string;
  projectId?: string;
  search?: string;
}

export async function getAdminOverviewData(filters?: AdminFilters) {
  const { isAdmin, userId } = await verifyAdmin();
  if (!isAdmin || !userId) {
    return { error: 'No autorizado' };
  }

  try {
    // Get current user's memberships to show "joined" status
    const [stats, organizationsList, myOrgMemberships, myProjectMemberships] = await Promise.all([
      prisma.$transaction([
        prisma.organization.count(),
        prisma.project.count(),
        prisma.user.count(),
        prisma.lead.count(),
      ]),
      prisma.organization.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      }),
      prisma.organizationMember.findMany({
        where: { userId },
        select: { organizationId: true },
      }),
      prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      }),
    ]);

    const myOrgIds = new Set(myOrgMemberships.map(m => m.organizationId));
    const myProjectIds = new Set(myProjectMemberships.map(m => m.projectId));

    // Always load all projects - filtering is done in the UI (UserModal)
    const projectsList = await prisma.project.findMany({
      select: { id: true, name: true, slug: true, organizationId: true },
      orderBy: { name: 'asc' },
    });

    const baseData = {
      stats: {
        totalOrganizations: stats[0],
        totalProjects: stats[1],
        totalUsers: stats[2],
        totalLeads: stats[3],
      },
      organizationsList,
      projectsList,
      myOrgIds: Array.from(myOrgIds),
      myProjectIds: Array.from(myProjectIds),
    };

    // Fetch data based on view type
    const viewType = filters?.viewType || 'organizations';

    if (viewType === 'organizations') {
      const organizations = await prisma.organization.findMany({
        where: filters?.search ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { slug: { contains: filters.search, mode: 'insensitive' } },
          ],
        } : undefined,
        include: {
          _count: {
            select: { projects: true, members: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return { ...baseData, organizations, viewType };
    }

    if (viewType === 'projects') {
      const projects = await prisma.project.findMany({
        where: {
          ...(filters?.organizationId ? { organizationId: filters.organizationId } : {}),
          ...(filters?.search ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { slug: { contains: filters.search, mode: 'insensitive' } },
            ],
          } : {}),
        },
        include: {
          organization: { select: { id: true, name: true } },
          _count: { select: { members: true, leads: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return { ...baseData, projects, viewType };
    }

    if (viewType === 'users') {
      const users = await prisma.user.findMany({
        where: {
          ...(filters?.search ? {
            OR: [
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
            ],
          } : {}),
          ...(filters?.organizationId ? {
            organizationMemberships: { some: { organizationId: filters.organizationId } },
          } : {}),
          ...(filters?.projectId ? {
            projectMemberships: { some: { projectId: filters.projectId } },
          } : {}),
        },
        include: {
          organizationMemberships: {
            include: { organization: { select: { id: true, name: true } } },
          },
          projectMemberships: {
            include: { project: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return { ...baseData, users, viewType };
    }

    return baseData;
  } catch (error) {
    console.error('Error fetching admin data:', error);
    return { error: 'Error al obtener datos' };
  }
}
