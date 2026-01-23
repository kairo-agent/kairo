// ============================================
// KAIRO - Auth Helpers
// Secure authentication utilities
// SECURITY: Always verifies with source of truth (Supabase + DB)
// ============================================

import { createServerClient } from '@/lib/supabase';
import prisma from '@/lib/prisma';

/**
 * Verify super admin status - used by server actions
 * SECURITY: Always verifies directly with Supabase Auth and database
 * Never trusts client-provided headers or cookies alone
 *
 * @returns Object with userId and isAdmin status
 */
export async function verifySuperAdmin(): Promise<{
  userId: string | null;
  isAdmin: boolean;
}> {
  try {
    // Always verify with source of truth
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { userId: null, isAdmin: false };
    }

    // Verify role in our database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        systemRole: true,
        isActive: true,
      },
    });

    // User must exist, be active, and be super_admin
    if (!dbUser || !dbUser.isActive) {
      return { userId: user.id, isAdmin: false };
    }

    return {
      userId: user.id,
      isAdmin: dbUser.systemRole === 'super_admin',
    };
  } catch (error) {
    console.error('Error verifying super admin:', error);
    return { userId: null, isAdmin: false };
  }
}

/**
 * Get current authenticated user info
 * SECURITY: Always verifies with Supabase Auth
 *
 * @returns User info or null if not authenticated
 */
export async function getCurrentUser(): Promise<{
  userId: string;
  email: string;
  systemRole: string;
  isActive: boolean;
} | null> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        systemRole: true,
        isActive: true,
      },
    });

    if (!dbUser) {
      return null;
    }

    return {
      userId: dbUser.id,
      email: dbUser.email,
      systemRole: dbUser.systemRole,
      isActive: dbUser.isActive,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}
