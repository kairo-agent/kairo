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
      include: {
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
  avatarUrl?: string;
  timezone?: string;
  locale?: string;
}) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'No autorizado' };
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        avatarUrl: data.avatarUrl,
        timezone: data.timezone,
        locale: data.locale,
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
