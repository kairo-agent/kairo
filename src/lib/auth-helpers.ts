// ============================================
// KAIRO - Auth Helpers
// Secure authentication utilities
// SECURITY: Always verifies with source of truth (Supabase + DB)
// PERFORMANCE: Uses React cache() for request-scoped deduplication
// ============================================

import { cache } from 'react';
import { createServerClient } from '@/lib/supabase';
import prisma from '@/lib/prisma';

// Re-export getCurrentUser from auth.ts (full version with projectMemberships)
// This ensures all consumers use the same cached, complete user data
export { getCurrentUser } from '@/lib/actions/auth';

/**
 * Verify super admin status - used by server actions
 * SECURITY: Always verifies directly with Supabase Auth and database
 * PERFORMANCE: Uses React cache() for request-scoped deduplication
 * Never trusts client-provided headers or cookies alone
 *
 * @returns Object with userId and isAdmin status
 */
export const verifySuperAdmin = cache(async (): Promise<{
  userId: string | null;
  isAdmin: boolean;
}> => {
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
});
