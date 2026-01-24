'use client';

/**
 * Hook for Direct Browser-to-Supabase Media Upload
 *
 * Bypasses Vercel's 4.5MB Server Action limit by uploading
 * directly from the browser to Supabase Storage.
 *
 * Security: RLS policies verify ProjectMember access server-side.
 */

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// Configuration constants (must match media.ts)
const BUCKET_NAME = 'media';
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB for images
const MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16MB for videos

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
// WhatsApp only supports MP4 (H.264 + AAC) - WebM is NOT supported
const VIDEO_TYPES = ['video/mp4'] as const;
const ALLOWED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES] as const;

type AllowedMimeType = (typeof ALLOWED_TYPES)[number];

interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

interface UseMediaUploadReturn {
  upload: (projectId: string, file: File) => Promise<UploadResult>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  reset: () => void;
}

function isVideoType(mimeType: string): boolean {
  return VIDEO_TYPES.includes(mimeType as (typeof VIDEO_TYPES)[number]);
}

function getExtensionFromMimeType(mimeType: AllowedMimeType): string {
  const extensions: Record<AllowedMimeType, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
  };
  return extensions[mimeType];
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file type
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

function generateFilePath(projectId: string, mimeType: AllowedMimeType): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const extension = getExtensionFromMimeType(mimeType);
  const uniqueId = generateUUID();

  return `${projectId}/${year}/${month}/${uniqueId}.${extension}`;
}

export function useMediaUpload(): UseMediaUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  const upload = useCallback(
    async (projectId: string, file: File): Promise<UploadResult> => {
      try {
        setIsUploading(true);
        setProgress(0);
        setError(null);

        // Validate projectId
        if (!projectId || typeof projectId !== 'string') {
          const errorMsg = 'ID de proyecto inválido';
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
          setError(validation.error || 'Error de validación');
          return { success: false, error: validation.error };
        }

        setProgress(10);

        // Generate secure file path
        const filePath = generateFilePath(projectId, file.type as AllowedMimeType);

        setProgress(20);

        // Create Supabase client
        const supabase = createClient();

        // Upload directly to Supabase Storage
        // RLS policies will verify the user has ProjectMember access
        const { data, error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, file, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Supabase storage upload error:', uploadError);

          // Handle specific RLS error
          if (uploadError.message.includes('row-level security')) {
            const errorMsg = 'Sin permisos para subir a este proyecto';
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          const errorMsg = `Error al subir archivo: ${uploadError.message}`;
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        setProgress(80);

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(data.path);

        setProgress(100);

        return {
          success: true,
          url: publicUrlData.publicUrl,
          path: data.path,
        };
      } catch (err) {
        console.error('Failed to upload media:', err);
        const errorMsg = 'Error interno al subir archivo';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  return {
    upload,
    isUploading,
    progress,
    error,
    reset,
  };
}
