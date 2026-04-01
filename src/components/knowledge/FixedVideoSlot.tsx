'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { getFixedEventMedia, uploadFixedEventVideoByUrl, deleteFixedEventMedia } from '@/lib/actions/agent-media';
import { uploadVideoToStorage } from '@/lib/utils/video-upload';
import { extractThumbnailFromFile, extractThumbnailFromUrl } from '@/lib/utils/video-thumbnail';
import type { FixedEventType, FixedEventMedia } from '@/lib/types/agent-media';
import { MAX_VIDEO_SIZE_MB } from '@/lib/types/agent-media';

// =============================================================================
// Types
// =============================================================================

interface FixedVideoSlotProps {
  eventType: FixedEventType; // Must be a video event type (e.g., 'first_contact_video')
  agentId: string;
  projectId: string;
  label: string;
  helpText?: string;
}

// =============================================================================
// Helpers
// =============================================================================

const DEFAULT_TITLES: Record<string, string> = {
  first_contact_video: 'Video de bienvenida',
  reengagement_0_video: 'Video de seguimiento inicial',
  reengagement_1_video: 'Video de segundo seguimiento',
  reengagement_2_video: 'Video de tercer seguimiento',
};

// =============================================================================
// Component
// =============================================================================

export function FixedVideoSlot({ eventType, agentId, projectId, label, helpText }: FixedVideoSlotProps) {
  const [media, setMedia] = useState<FixedEventMedia | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing media on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getFixedEventMedia(agentId, projectId, eventType);
        if (!cancelled && result.success && result.data) {
          setMedia(result.data);
          // Extract thumbnail from existing video URL
          extractThumbnailFromUrl(result.data.mediaUrl).then((thumb) => {
            if (!cancelled && thumb) setThumbnail(thumb);
          });
        }
      } catch {
        // silent - slot just shows empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [agentId, projectId, eventType]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (file.type !== 'video/mp4') {
      toast.error('Solo se aceptan videos en formato MP4');
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      toast.error(`El video no debe superar ${MAX_VIDEO_SIZE_MB}MB`);
      return;
    }

    setUploading(true);
    try {
      // Upload video directly to Supabase Storage from client (bypasses Vercel 4.5MB limit)
      const uploadResult = await uploadVideoToStorage(projectId, file);
      if (!uploadResult.success || !uploadResult.url || !uploadResult.path) {
        toast.error(uploadResult.error || 'Error al subir video');
        return;
      }

      // Register in DB via server action (only sends URL, not file)
      const defaultTitle = DEFAULT_TITLES[eventType] || 'Video';
      const result = await uploadFixedEventVideoByUrl({
        agentId,
        projectId,
        eventType,
        title: defaultTitle,
        description: defaultTitle,
        mediaUrl: uploadResult.url,
        storagePath: uploadResult.path,
      });

      if (result.success && result.data) {
        setMedia(result.data);
        // Extract thumbnail from the original file (more reliable than URL)
        extractThumbnailFromFile(file).then((thumb) => setThumbnail(thumb)).catch(() => {});
        toast.success('Video subido');
      } else {
        toast.error(result.error || 'Error al subir video');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir video');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [agentId, projectId, eventType]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDelete = useCallback(async () => {
    if (!media) return;
    setDeleting(true);
    try {
      const result = await deleteFixedEventMedia(agentId, projectId, eventType);
      if (result.success) {
        setMedia(null);
        setThumbnail(null);
        toast.success('Video eliminado');
      } else {
        toast.error(result.error || 'Error al eliminar video');
      }
    } catch {
      toast.error('Error al eliminar video');
    } finally {
      setDeleting(false);
    }
  }, [media, agentId, projectId, eventType]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--accent-primary)]" />
        <span className="text-xs text-[var(--text-tertiary)]">{label}</span>
      </div>
    );
  }

  // Has video - compact display row
  if (media) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-3 p-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          {/* Video thumbnail - click to lightbox */}
          <div
            className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-tertiary)] relative cursor-pointer hover:ring-2 hover:ring-[var(--accent-primary)] transition-all"
            onClick={() => window.open(media.mediaUrl, '_blank')}
          >
            {thumbnail ? (
              <img src={thumbnail} alt={media.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--accent-text)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
            )}
            {/* Play icon overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <svg className="w-4 h-4 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Title + date */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {media.title}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
            {media.createdAt && (
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                {new Date(media.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          {/* Delete button */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-shrink-0 p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            title="Eliminar video"
          >
            {deleting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        </div>
        {helpText && (
          <p className="text-xs text-[var(--text-tertiary)] pl-1">{helpText}</p>
        )}

      </div>
    );
  }

  // No video - upload area
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </p>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-[var(--border-primary)] hover:border-[var(--accent-primary)] cursor-pointer transition-colors"
      >
        {uploading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--accent-primary)]" />
            <span className="text-xs text-[var(--text-secondary)]">Subiendo video...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <span className="text-xs text-[var(--text-secondary)]">
              Arrastra un video o haz clic para seleccionar
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              MP4, max {MAX_VIDEO_SIZE_MB}MB
            </span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {helpText && (
        <p className="text-xs text-[var(--text-tertiary)] pl-1">{helpText}</p>
      )}
    </div>
  );
}
