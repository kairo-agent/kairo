// ============================================
// KAIRO - Auth Server Actions
// ============================================

'use server';

import { cache } from 'react';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

// Error codes for i18n on client side
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_not_found'
  | 'user_inactive'
  | 'server_error';

export type SignInResult = {
  success: boolean;
  error?: AuthErrorCode;
  redirectTo?: string;
  user?: {
    systemRole: string;
    id: string;
    firstName: string;
    lastName: string;
  };
};

export async function signIn(email: string, password: string): Promise<SignInResult> {
  try {
    const supabase = await createServerClient();

    // Authenticate with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Map Supabase errors to our error codes
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'invalid_credentials' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { success: false, error: 'email_not_confirmed' };
      }
      console.error('Supabase auth error:', error.message);
      return { success: false, error: 'server_error' };
    }

    if (!data.user) {
      return { success: false, error: 'server_error' };
    }

    // Check if user exists in our database
    const dbUser = await prisma.user.findUnique({
      where: { id: data.user.id },
    });

    if (!dbUser) {
      // User exists in Auth but not in our DB - should not happen
      console.error('User not found in DB:', data.user.id);
      await supabase.auth.signOut();
      return { success: false, error: 'user_not_found' };
    }

    if (!dbUser.isActive) {
      // User is deactivated
      await supabase.auth.signOut();
      return { success: false, error: 'user_inactive' };
    }

    // Revalidate cache
    revalidatePath('/', 'layout');

    // For super_admin: redirect to select-workspace (client will check localStorage)
    // For regular users: redirect to leads
    const redirectTo = dbUser.systemRole === 'super_admin' ? '/select-workspace' : '/leads';

    return {
      success: true,
      redirectTo,
      user: {
        systemRole: dbUser.systemRole,
        id: dbUser.id,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
      },
    };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: 'server_error' };
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
}

/**
 * Get current authenticated user with full membership data
 * PERFORMANCE: Uses React cache() to deduplicate within a single request
 * Multiple calls to getCurrentUser() in the same request will only hit DB once
 */
export const getCurrentUser = cache(async () => {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
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
    });

    return dbUser;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
});

export async function getSession() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Lightweight auth check - returns user identity WITHOUT membership data.
 * PERFORMANCE (P2-1): ~50-150ms faster than getCurrentUser() per call.
 * Use this when you only need to verify auth + check access to a specific project.
 * For functions that need to enumerate all user projects, use getCurrentUser() instead.
 */
export const verifyAuth = cache(async () => {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, systemRole: true, firstName: true, lastName: true },
    });

    return dbUser;
  } catch (error) {
    console.error('Verify auth error:', error);
    return null;
  }
});

/**
 * Check if a user has access to a specific project.
 * PERFORMANCE (P2-1): Uses indexed lookup on project_members(projectId, userId)
 * instead of loading all memberships.
 */
export async function verifyProjectAccess(
  userId: string,
  systemRole: string,
  projectId: string
): Promise<boolean> {
  if (systemRole === 'super_admin') return true;

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });

  return !!membership;
}
