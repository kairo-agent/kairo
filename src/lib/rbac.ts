// ============================================
// KAIRO - Role-Based Access Control (RBAC)
// ============================================

import { SystemRole, ProjectRole } from '@prisma/client';

// Route protection levels
export type RouteProtection = 'public' | 'authenticated' | 'super_admin' | 'project_member';

// Define route protections
export const routeProtections: Record<string, RouteProtection> = {
  // Public routes
  '/login': 'public',
  '/register': 'public',
  '/forgot-password': 'public',
  '/reset-password': 'public',

  // Super admin only routes
  '/admin': 'super_admin',
  '/admin/organizations': 'super_admin',
  '/admin/projects': 'super_admin',
  '/admin/users': 'super_admin',

  // Authenticated user routes (with project access)
  '/leads': 'authenticated',
  '/dashboard': 'authenticated',
  '/conversations': 'authenticated',
  '/agents': 'authenticated',
  '/reports': 'authenticated',
  '/settings': 'authenticated',
};

// Get protection level for a path (removes locale prefix)
export function getRouteProtection(pathname: string): RouteProtection {
  // Remove locale prefix
  const pathWithoutLocale = pathname.replace(/^\/(es|en)/, '') || '/';

  // Check exact match first
  if (routeProtections[pathWithoutLocale]) {
    return routeProtections[pathWithoutLocale];
  }

  // Check if path starts with a protected prefix
  for (const [route, protection] of Object.entries(routeProtections)) {
    if (pathWithoutLocale.startsWith(route)) {
      return protection;
    }
  }

  // Default to authenticated for unmatched routes
  return 'authenticated';
}

// Check if user has super_admin role
export function isSuperAdmin(systemRole: SystemRole | string): boolean {
  return systemRole === SystemRole.super_admin || systemRole === 'super_admin';
}

// Check if user has specific project role
export function hasProjectRole(
  userRole: ProjectRole | string,
  requiredRoles: ProjectRole[]
): boolean {
  return requiredRoles.includes(userRole as ProjectRole);
}

// Role hierarchy for project roles (higher index = more permissions)
const projectRoleHierarchy: ProjectRole[] = [
  ProjectRole.viewer,
  ProjectRole.agent,
  ProjectRole.manager,
  ProjectRole.admin,
];

// Check if user has at least the required role level
export function hasMinimumProjectRole(
  userRole: ProjectRole | string,
  minimumRole: ProjectRole
): boolean {
  const userRoleIndex = projectRoleHierarchy.indexOf(userRole as ProjectRole);
  const minimumRoleIndex = projectRoleHierarchy.indexOf(minimumRole);

  return userRoleIndex >= minimumRoleIndex;
}

// Permission definitions
export type Permission =
  | 'leads:read'
  | 'leads:create'
  | 'leads:update'
  | 'leads:delete'
  | 'leads:assign'
  | 'agents:read'
  | 'agents:manage'
  | 'reports:read'
  | 'reports:export'
  | 'settings:read'
  | 'settings:update'
  | 'members:read'
  | 'members:manage';

// Permission matrix by project role
const rolePermissions: Record<ProjectRole, Permission[]> = {
  [ProjectRole.viewer]: [
    'leads:read',
    'agents:read',
    'reports:read',
  ],
  [ProjectRole.agent]: [
    'leads:read',
    'leads:create',
    'leads:update',
    'agents:read',
    'reports:read',
  ],
  [ProjectRole.manager]: [
    'leads:read',
    'leads:create',
    'leads:update',
    'leads:delete',
    'leads:assign',
    'agents:read',
    'agents:manage',
    'reports:read',
    'reports:export',
    'members:read',
  ],
  [ProjectRole.admin]: [
    'leads:read',
    'leads:create',
    'leads:update',
    'leads:delete',
    'leads:assign',
    'agents:read',
    'agents:manage',
    'reports:read',
    'reports:export',
    'settings:read',
    'settings:update',
    'members:read',
    'members:manage',
  ],
};

// Check if role has permission
export function hasPermission(
  role: ProjectRole | string,
  permission: Permission
): boolean {
  const permissions = rolePermissions[role as ProjectRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}

// Get all permissions for a role
export function getPermissions(role: ProjectRole | string): Permission[] {
  return rolePermissions[role as ProjectRole] || [];
}
