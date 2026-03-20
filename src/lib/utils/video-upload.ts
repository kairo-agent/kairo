/**
 * Client-side video upload utility
 *
 * Uploads videos directly to Supabase Storage from the browser,
 * bypassing the Next.js serverless function to avoid Vercel's
 * 4.5MB body size limit on Hobby plan.
 *
 * Path structure: {projectId}/{year}/{month}/{uuid}.mp4
 */

import { createClient } from '@/lib/supabase/client';

const BUCKET_NAME = 'media';

interface VideoUploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

/**
 * Uploads a video file directly to Supabase Storage from the client.
 * Requires the user to be authenticated (RLS policies check project membership).
 */
export async function uploadVideoToStorage(
  projectId: string,
  file: File
): Promise<VideoUploadResult> {
  try {
    if (file.type !== 'video/mp4') {
      return { success: false, error: 'Solo se aceptan videos en formato MP4' };
    }

    const supabase = createClient();

    // Generate path: {projectId}/{year}/{month}/{uuid}.mp4
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uniqueId = crypto.randomUUID();
    const filePath = `${projectId}/${year}/${month}/${uniqueId}.mp4`;

    // Upload directly from the browser
    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[VideoUpload] Storage upload error:', uploadError);
      return { success: false, error: `Error al subir video: ${uploadError.message}` };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return {
      success: true,
      url: publicUrlData.publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('[VideoUpload] Upload error:', error);
    return { success: false, error: 'Error interno al subir video' };
  }
}
