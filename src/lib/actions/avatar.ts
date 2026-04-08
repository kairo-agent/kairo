'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

const BUCKET_NAME = 'media';
const AVATAR_PREFIX = 'avatars';
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB (after client-side compression should be ~50KB)

/**
 * Upload user avatar to Supabase Storage and update user record.
 * Deletes previous avatar if one exists.
 */
export async function uploadAvatar(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const file = formData.get('avatar') as File;
    if (!file || file.size === 0) {
      return { success: false, error: 'No se recibio archivo' };
    }

    if (file.size > MAX_SIZE_BYTES) {
      return { success: false, error: 'Archivo demasiado grande (max 2MB)' };
    }

    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'Solo se permiten imagenes' };
    }

    // Delete previous avatar if exists
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    });

    if (currentUser?.avatarUrl) {
      // Extract storage path from URL
      const urlParts = currentUser.avatarUrl.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
      if (urlParts.length === 2) {
        const oldPath = urlParts[1];
        await supabase.storage.from(BUCKET_NAME).remove([oldPath]);
      }
    }

    // Upload new avatar
    const ext = 'jpg'; // Always JPEG after client compression
    const uuid = crypto.randomUUID();
    const storagePath = `${AVATAR_PREFIX}/${user.id}/${uuid}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError);
      return { success: false, error: 'Error al subir imagen' };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    const avatarUrl = urlData.publicUrl;

    // Update user record
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl },
    });

    revalidatePath('/profile');
    revalidatePath('/', 'layout');

    return { success: true, url: avatarUrl };
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return { success: false, error: 'Error interno' };
  }
}

/**
 * Remove user avatar (revert to initials).
 */
export async function removeAvatar(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    });

    if (currentUser?.avatarUrl) {
      const urlParts = currentUser.avatarUrl.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
      if (urlParts.length === 2) {
        await supabase.storage.from(BUCKET_NAME).remove([urlParts[1]]);
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: null },
    });

    revalidatePath('/profile');
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (error) {
    console.error('Error removing avatar:', error);
    return { success: false, error: 'Error interno' };
  }
}
