// ============================================
// KAIRO - Profile Server Actions
// ============================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

// Get current user profile with memberships
export async function getProfile() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'No autorizado' };
    }

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        systemRole: true,
        timezone: true,
        locale: true,
        preferences: true,
        organizationMemberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
              },
            },
          },
        },
        projectMemberships: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                organization: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!profile) {
      return { error: 'Usuario no encontrado' };
    }

    return { profile };
  } catch (error) {
    console.error('Error getting profile:', error);
    return { error: 'Error al obtener perfil' };
  }
}

// Update user profile
export async function updateProfile(data: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  timezone?: string;
  locale?: string;
  notifyEmail?: boolean;
  notifyCcEmails?: string[];
}) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'No autorizado' };
    }

    // Read current preferences to merge notification settings
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { preferences: true },
    });

    const currentPreferences = (currentUser?.preferences as Record<string, unknown>) || {};

    // Build updated preferences by merging
    const updatedPreferences: Record<string, unknown> = { ...currentPreferences };
    if (data.notifyEmail !== undefined) {
      updatedPreferences.notifyEmail = data.notifyEmail;
    }
    if (data.notifyCcEmails !== undefined) {
      updatedPreferences.notifyCcEmails = data.notifyCcEmails;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
        timezone: data.timezone,
        locale: data.locale,
        preferences: JSON.parse(JSON.stringify(updatedPreferences)),
      },
    });

    revalidatePath('/profile');
    revalidatePath('/', 'layout');

    return { success: true, user: updatedUser };
  } catch (error) {
    console.error('Error updating profile:', error);
    return { error: 'Error al actualizar perfil' };
  }
}

// Change password
export async function changePassword(currentPassword: string, newPassword: string) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return { error: 'No autorizado' };
    }

    // First verify the current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      return { error: 'Contraseña actual incorrecta' };
    }

    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('Error updating password:', updateError);
      return { error: 'Error al cambiar contraseña' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error changing password:', error);
    return { error: 'Error al cambiar contraseña' };
  }
}
