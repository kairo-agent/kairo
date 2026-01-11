// ============================================
// KAIRO - Mock Users Data
// ============================================

import { User, UserRole } from '@/types';

export const users: User[] = [
  {
    id: 'user-001',
    email: 'carlos.mendoza@techcorp.pe',
    firstName: 'Carlos',
    lastName: 'Mendoza Quispe',
    avatarUrl: '/avatars/carlos.jpg',
    role: UserRole.ADMIN,
    companyId: 'company-001',
    preferences: {
      language: 'es',
      displayCurrency: 'PEN',
      timezone: 'America/Lima',
      theme: 'light',
    },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-12-20'),
  },
  {
    id: 'user-002',
    email: 'maria.rodriguez@techcorp.pe',
    firstName: 'Maria',
    lastName: 'Rodriguez Flores',
    avatarUrl: '/avatars/maria.jpg',
    role: UserRole.MANAGER,
    companyId: 'company-001',
    preferences: {
      language: 'es',
      displayCurrency: 'PEN',
      timezone: 'America/Lima',
      theme: 'light',
    },
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-12-18'),
  },
  {
    id: 'user-003',
    email: 'jose.garcia@techcorp.pe',
    firstName: 'Jose Luis',
    lastName: 'Garcia Paredes',
    avatarUrl: '/avatars/jose.jpg',
    role: UserRole.AGENT,
    companyId: 'company-001',
    preferences: {
      language: 'es',
      displayCurrency: 'PEN',
      timezone: 'America/Lima',
      theme: 'light',
    },
    createdAt: new Date('2024-03-05'),
    updatedAt: new Date('2024-12-15'),
  },
];

// Helper to get user by ID
export const getUserById = (id: string): User | undefined => {
  return users.find((user) => user.id === id);
};

// Get users by company
export const getUsersByCompany = (companyId: string): User[] => {
  return users.filter((user) => user.companyId === companyId);
};

// Default user (admin) for the MVP
export const currentUser = users[0];
