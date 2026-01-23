// ============================================
// KAIRO - Mock Users Data
// ============================================

import { User, SystemRole, ProjectRole } from '@/types';

// Users with the new multi-tenant structure
export const users: User[] = [
  {
    id: 'user-001',
    email: 'carlos.mendoza@techcorp.pe',
    firstName: 'Carlos',
    lastName: 'Mendoza Quispe',
    avatarUrl: '/avatars/carlos.jpg',
    systemRole: SystemRole.SUPER_ADMIN,
    isActive: true,
    preferences: {
      language: 'es',
      displayCurrency: 'PEN',
      timezone: 'America/Lima',
      theme: 'light',
    },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-12-20'),
    // Memberships
    organizationMemberships: [
      {
        id: 'om-001',
        organizationId: 'org-001',
        userId: 'user-001',
        isOwner: true,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      },
    ],
    projectMemberships: [
      {
        id: 'pm-001',
        projectId: 'company-001',
        userId: 'user-001',
        role: ProjectRole.ADMIN,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      },
    ],
  },
  {
    id: 'user-002',
    email: 'maria.rodriguez@techcorp.pe',
    firstName: 'Maria',
    lastName: 'Rodriguez Flores',
    avatarUrl: '/avatars/maria.jpg',
    systemRole: SystemRole.USER,
    isActive: true,
    preferences: {
      language: 'es',
      displayCurrency: 'PEN',
      timezone: 'America/Lima',
      theme: 'light',
    },
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-12-18'),
    organizationMemberships: [],
    projectMemberships: [
      {
        id: 'pm-002',
        projectId: 'company-001',
        userId: 'user-002',
        role: ProjectRole.MANAGER,
        createdAt: new Date('2024-02-10'),
        updatedAt: new Date('2024-02-10'),
      },
    ],
  },
  {
    id: 'user-003',
    email: 'jose.garcia@techcorp.pe',
    firstName: 'Jose Luis',
    lastName: 'Garcia Paredes',
    avatarUrl: '/avatars/jose.jpg',
    systemRole: SystemRole.USER,
    isActive: true,
    preferences: {
      language: 'es',
      displayCurrency: 'PEN',
      timezone: 'America/Lima',
      theme: 'light',
    },
    createdAt: new Date('2024-03-05'),
    updatedAt: new Date('2024-12-15'),
    organizationMemberships: [],
    projectMemberships: [
      {
        id: 'pm-003',
        projectId: 'company-001',
        userId: 'user-003',
        role: ProjectRole.AGENT,
        createdAt: new Date('2024-03-05'),
        updatedAt: new Date('2024-03-05'),
      },
    ],
  },
];

// Helper to get user by ID
export const getUserById = (id: string): User | undefined => {
  return users.find((user) => user.id === id);
};

// Get users by project
export const getUsersByProject = (projectId: string): User[] => {
  return users.filter((user) =>
    user.projectMemberships?.some((m) => m.projectId === projectId)
  );
};

// Default user (admin) for the MVP
export const currentUser = users[0];
