'use server';

/**
 * Server Actions for Media Upload Management
 *
 * Provides secure upload and delete operations for media files
 * stored in Supabase Storage. All operations require authentication.
 *
 * Bucket: media
 * Path structure: {projectId}/{year}/{month}/{uuid}.{extension}
 * Max size: 3MB (images), 16MB (videos)
 * Allowed types: image/jpeg, image/png, image/webp, video/mp4, video/webm
 */

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';
import { randomUUID } from 'crypto';

// Configuration constants
const BUCKET_NAME = 'media';
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB for images
const MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16MB for videos (WhatsApp limit)

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const VIDEO_TYPES = ['video/mp4', 'video/webm'] as const;
const ALLOWED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES] as const;

type AllowedMimeType = (typeof ALLOWED_TYPES)[number];
type ImageMimeType = (typeof IMAGE_TYPES)[number];
type VideoMimeType = (typeof VIDEO_TYPES)[number];

interface UploadMediaResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

interface DeleteMediaResult {
  success: boolean;
  error?: string;
}

/**
 * Checks if MIME type is a video
 */
function isVideoType(mimeType: string): mimeType is VideoMimeType {
  return VIDEO_TYPES.includes(mimeType as VideoMimeType);
}

/**
 * Maps MIME type to file extension
 */
function getExtensionFromMimeType(mimeType: AllowedMimeType): string {
  const extensions: Record<AllowedMimeType, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };
  return extensions[mimeType];
}

/**
 * Validates file before upload
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file type first
  if (!ALLOWED_TYPES.includes(file.type as AllowedMimeType)) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido. Tipos aceptados: ${ALLOWED_TYPES.join(', ')}`,
    };
  }

  // Check file size based on type
  const maxSize = isVideoType(file.type) ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `El archivo excede el tamaño máximo de ${maxSize / (1024 * 1024)}MB`,
    };
  }

  return { valid: true };
}

/**
 * Verifies if user has access to a project
 */
async function verifyProjectAccess(
  userId: string,
  projectId: string
): Promise<boolean> {
  // Check if user is super admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  });

  if (user?.systemRole === 'super_admin') {
    return true;
  }

  // Check project membership
  const membership = await prisma.projectMember.findFirst({
    where: {
      userId,
      projectId,
    },
  });

  return !!membership;
}

/**
 * Generates the storage path for a file
 * Format: {projectId}/{year}/{month}/{uuid}.{extension}
 */
function generateFilePath(projectId: string, mimeType: AllowedMimeType): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const extension = getExtensionFromMimeType(mimeType);
  const uniqueId = randomUUID();

  return `${projectId}/${year}/${month}/${uniqueId}.${extension}`;
}

/**
 * Uploads a media file to Supabase Storage
 *
 * @param projectId - The project to associate the media with
 * @param file - The file to upload
 * @returns Upload result with public URL and path, or error
 */
export async function uploadMedia(
  projectId: string,
  file: File
): Promise<UploadMediaResult> {
  try {
    // Verify authentication
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    if (!user.isActive) {
      return { success: false, error: 'Usuario desactivado' };
    }

    // Validate project ID
    if (!projectId || typeof projectId !== 'string') {
      return { success: false, error: 'ID de proyecto inválido' };
    }

    // Verify user has access to the project
    const hasAccess = await verifyProjectAccess(user.userId, projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin permisos para este proyecto' };
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Generate file path
    const filePath = generateFilePath(projectId, file.type as AllowedMimeType);

    // Create Supabase client
    const supabase = await createClient();

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      return {
        success: false,
        error: `Error al subir archivo: ${uploadError.message}`,
      };
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
    console.error('Failed to upload media:', error);
    return {
      success: false,
      error: 'Error interno al subir archivo',
    };
  }
}

/**
 * Deletes a media file from Supabase Storage
 *
 * @param path - The storage path of the file to delete
 * @returns Delete result with success status or error
 */
export async function deleteMedia(path: string): Promise<DeleteMediaResult> {
  try {
    // Verify authentication
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    if (!user.isActive) {
      return { success: false, error: 'Usuario desactivado' };
    }

    // Validate path
    if (!path || typeof path !== 'string') {
      return { success: false, error: 'Ruta de archivo inválida' };
    }

    // Extract projectId from path (first segment)
    const pathSegments = path.split('/');
    if (pathSegments.length < 4) {
      return { success: false, error: 'Formato de ruta inválido' };
    }

    const projectId = pathSegments[0];

    // Verify user has access to the project
    const hasAccess = await verifyProjectAccess(user.userId, projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin permisos para eliminar este archivo' };
    }

    // Create Supabase client
    const supabase = await createClient();

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (deleteError) {
      console.error('Supabase storage delete error:', deleteError);
      return {
        success: false,
        error: `Error al eliminar archivo: ${deleteError.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to delete media:', error);
    return {
      success: false,
      error: 'Error interno al eliminar archivo',
    };
  }
}

/**
 * Deletes multiple media files from Supabase Storage
 * Useful for batch cleanup operations
 *
 * @param paths - Array of storage paths to delete
 * @returns Delete result with success status or error
 */
export async function deleteMediaBatch(
  paths: string[]
): Promise<DeleteMediaResult> {
  try {
    // Verify authentication
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    if (!user.isActive) {
      return { success: false, error: 'Usuario desactivado' };
    }

    // Validate paths
    if (!Array.isArray(paths) || paths.length === 0) {
      return { success: false, error: 'Lista de archivos vacía' };
    }

    // Verify user has access to all projects in paths
    const projectIds = new Set<string>();
    for (const path of paths) {
      const segments = path.split('/');
      if (segments.length >= 4) {
        projectIds.add(segments[0]);
      }
    }

    for (const projectId of projectIds) {
      const hasAccess = await verifyProjectAccess(user.userId, projectId);
      if (!hasAccess) {
        return {
          success: false,
          error: `Sin permisos para proyecto: ${projectId}`,
        };
      }
    }

    // Create Supabase client
    const supabase = await createClient();

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(paths);

    if (deleteError) {
      console.error('Supabase storage batch delete error:', deleteError);
      return {
        success: false,
        error: `Error al eliminar archivos: ${deleteError.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to delete media batch:', error);
    return {
      success: false,
      error: 'Error interno al eliminar archivos',
    };
  }
}
