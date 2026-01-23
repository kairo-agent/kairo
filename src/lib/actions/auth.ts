// ============================================
// KAIRO - Auth Server Actions
// ============================================

'use server';

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

export async function getCurrentUser() {
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
}

export async function getSession() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
