'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { compressImage } from '@/lib/utils/image-compression';
import { getFixedEventMedia, uploadFixedEventMedia, deleteFixedEventMedia } from '@/lib/actions/agent-media';
import type { FixedEventType, FixedEventMedia } from '@/lib/types/agent-media';
import { MAX_TITLE_LENGTH } from '@/lib/types/agent-media';

// =============================================================================
// Types
// =============================================================================

interface FixedImageSlotProps {
  eventType: FixedEventType;
  agentId: string;
  projectId: string;
  label: string;
  helpText?: string;
}

// =============================================================================
// Helpers
// =============================================================================

const DEFAULT_TITLES: Record<FixedEventType, string> = {
  first_contact: 'Imagen de bienvenida',
  reengagement_0: 'Imagen de seguimiento inicial',
  reengagement_1: 'Imagen de segundo seguimiento',
  reengagement_2: 'Imagen de tercer seguimiento',
};

// =============================================================================
// Component
// =============================================================================

export function FixedImageSlot({ eventType, agentId, projectId, label, helpText }: FixedImageSlotProps) {
  const t = useTranslations('settings');

  const [media, setMedia] = useState<FixedEventMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [title, setTitle] = useState(DEFAULT_TITLES[eventType] || '');
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing media on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getFixedEventMedia(agentId, projectId, eventType);
        if (!cancelled && result.success && result.data) {
          setMedia(result.data);
          setTitle(result.data.title);
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
    if (!file.type.startsWith('image/')) {
      toast.error(t('fixedImage.invalidFormat'));
      return;
    }

    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setCompressing(false);
      setUploading(true);

      const finalTitle = title.trim() || DEFAULT_TITLES[eventType];
      const result = await uploadFixedEventMedia({
        agentId,
        projectId,
        eventType,
        title: finalTitle,
        description: finalTitle,
        file: compressed.file,
      });

      if (result.success && result.data) {
        setMedia(result.data);
        setTitle(result.data.title);
        toast.success(t('fixedImage.uploaded'));
      } else {
        toast.error(result.error || t('fixedImage.uploadError'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('fixedImage.uploadError'));
    } finally {
      setCompressing(false);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [agentId, projectId, eventType, title, t]);

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
        setTitle(DEFAULT_TITLES[eventType] || '');
        toast.success(t('fixedImage.deleted'));
      } else {
        toast.error(result.error || t('fixedImage.deleteError'));
      }
    } catch {
      toast.error(t('fixedImage.deleteError'));
    } finally {
      setDeleting(false);
    }
  }, [media, agentId, projectId, eventType, t]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--accent-primary)]" />
        <span className="text-xs text-[var(--text-tertiary)]">{label}</span>
      </div>
    );
  }

  // Has image - compact display row
  if (media) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-3 p-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-tertiary)]">
            <img
              src={media.mediaUrl}
              alt={media.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {media.title}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
          </div>

          {/* Delete button */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-shrink-0 p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            title={t('fixedImage.remove')}
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

  // No image - upload area
  return (
    <div className="space-y-2">
      {/* Editable title */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-[var(--text-secondary)] flex-shrink-0">
          {label}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TITLE_LENGTH}
          placeholder={DEFAULT_TITLES[eventType]}
          className="flex-1 px-2 py-1 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        />
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !uploading && !compressing && fileInputRef.current?.click()}
        className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-[var(--border-primary)] hover:border-[var(--accent-primary)] cursor-pointer transition-colors"
      >
        {compressing || uploading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--accent-primary)]" />
            <span className="text-xs text-[var(--text-secondary)]">
              {compressing ? t('fixedImage.compressing') : t('fixedImage.uploading')}
            </span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-xs text-[var(--text-secondary)]">
              {t('fixedImage.dragOrClick')}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              JPG, PNG, WebP
            </span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
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
