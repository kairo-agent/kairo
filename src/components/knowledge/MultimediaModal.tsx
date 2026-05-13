'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ExpandableTextarea } from '@/components/ui/ExpandableTextarea';
import { AlertModal } from '@/components/ui/Modal';
import { compressImage, formatFileSize } from '@/lib/utils/image-compression';
import { FixedImageSlot } from '@/components/knowledge/FixedImageSlot';
import { FixedVideoSlot } from '@/components/knowledge/FixedVideoSlot';
import type { AgentMediaEntry } from '@/lib/types/agent-media';
import { extractThumbnailFromUrl } from '@/lib/utils/video-thumbnail';
import { uploadVideoToStorage } from '@/lib/utils/video-upload';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { CharCounter } from '@/components/ui/CharCounter';
import { MAX_MEDIA_ITEMS, MAX_VIDEO_ITEMS, MAX_VIDEO_SIZE_MB, MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from '@/lib/types/agent-media';

// =============================================================================
// Types
// =============================================================================

type TabType = 'images' | 'videos';

interface MultimediaModalProps {
  items: AgentMediaEntry[];
  videoItems: AgentMediaEntry[];
  onAdd: (title: string, description: string, file: File) => Promise<void>;
  onAddVideo: (title: string, description: string, file: File) => Promise<void>;
  onEdit: (id: string, title: string, description: string, replaceFile?: File, replaceVideoData?: { mediaUrl: string; storagePath: string }) => Promise<void>;
  onDelete: (id: string, storagePath: string) => Promise<void>;
  isSaving: boolean;
  isLoading: boolean;
  isLoadingVideos: boolean;
  agentId: string;
  projectId: string;
}

interface CompressInfo {
  file: File;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  previewUrl: string;
}

// =============================================================================
// Shared Styles
// =============================================================================

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent text-sm';

// =============================================================================
// Component
// =============================================================================

export function MultimediaModal({
  items, videoItems, onAdd, onAddVideo, onEdit, onDelete,
  isSaving, isLoading, isLoadingVideos, agentId, projectId,
}: MultimediaModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('images');

  // Image add form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [compressInfo, setCompressInfo] = useState<CompressInfo | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressError, setCompressError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video add form state
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState('');
  const [showVideoAddForm, setShowVideoAddForm] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Edit state (shared for both tabs)
  const [editingItem, setEditingItem] = useState<{ id: string; title: string; description: string } | null>(null);
  const [editingNewFile, setEditingNewFile] = useState<File | null>(null);
  const [editingPreviewUrl, setEditingPreviewUrl] = useState<string | null>(null);
  const [editingCompressing, setEditingCompressing] = useState(false);
  const [editingFileError, setEditingFileError] = useState('');
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deletingItem, setDeletingItem] = useState<{ id: string; storagePath: string } | null>(null);

  // Lightbox state (images only — videos open in new tab due to CORS)
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string } | null>(null);

  // --- Image handlers ---
  const resetImageForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setCompressInfo((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setCompressError('');
    setShowAddForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setCompressError('Solo se aceptan imagenes (JPG, PNG, WebP)');
      return;
    }
    setCompressing(true);
    setCompressError('');
    try {
      const result = await compressImage(file);
      const previewUrl = URL.createObjectURL(result.file);
      setCompressInfo({
        file: result.file, width: result.width, height: result.height,
        originalSize: result.originalSize, compressedSize: result.compressedSize, previewUrl,
      });
    } catch (err) {
      setCompressError(err instanceof Error ? err.message : 'Error al procesar imagen');
    } finally {
      setCompressing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (activeTab === 'images') handleFileSelect(file);
      else handleVideoFileSelect(file);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleAdd = useCallback(async () => {
    if (!compressInfo || !title.trim() || !description.trim()) return;
    await onAdd(title.trim(), description.trim(), compressInfo.file);
    resetImageForm();
  }, [compressInfo, title, description, onAdd, resetImageForm]);

  // --- Video handlers ---
  const resetVideoForm = useCallback(() => {
    setVideoTitle('');
    setVideoDescription('');
    setVideoFile(null);
    setVideoError('');
    setShowVideoAddForm(false);
    if (videoInputRef.current) videoInputRef.current.value = '';
  }, []);

  const handleVideoFileSelect = useCallback((file: File) => {
    if (file.type !== 'video/mp4') {
      setVideoError('Solo se aceptan videos en formato MP4');
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      setVideoError(`El video no debe superar ${MAX_VIDEO_SIZE_MB}MB`);
      return;
    }
    setVideoError('');
    setVideoFile(file);
  }, []);

  const handleVideoInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleVideoFileSelect(file);
  }, [handleVideoFileSelect]);

  const handleAddVideo = useCallback(async () => {
    if (!videoFile || !videoTitle.trim() || !videoDescription.trim()) return;
    await onAddVideo(videoTitle.trim(), videoDescription.trim(), videoFile);
    resetVideoForm();
  }, [videoFile, videoTitle, videoDescription, onAddVideo, resetVideoForm]);

  // --- Shared handlers ---
  const clearEditFileState = useCallback(() => {
    if (editingPreviewUrl) URL.revokeObjectURL(editingPreviewUrl);
    setEditingNewFile(null);
    setEditingPreviewUrl(null);
    setEditingFileError('');
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  }, [editingPreviewUrl]);

  const handleEditFileSelect = useCallback(async (file: File, mediaType: 'image' | 'video') => {
    setEditingFileError('');
    if (mediaType === 'image') {
      if (!file.type.startsWith('image/')) {
        setEditingFileError('Solo se aceptan imagenes (JPG, PNG, WebP)');
        return;
      }
      setEditingCompressing(true);
      try {
        const result = await compressImage(file);
        if (editingPreviewUrl) URL.revokeObjectURL(editingPreviewUrl);
        setEditingNewFile(result.file);
        setEditingPreviewUrl(URL.createObjectURL(result.file));
      } catch (err) {
        setEditingFileError(err instanceof Error ? err.message : 'Error al procesar imagen');
      } finally {
        setEditingCompressing(false);
      }
    } else {
      if (file.type !== 'video/mp4') {
        setEditingFileError('Solo se aceptan videos en formato MP4');
        return;
      }
      if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
        setEditingFileError(`El video no debe superar ${MAX_VIDEO_SIZE_MB}MB`);
        return;
      }
      setEditingNewFile(file);
      setEditingPreviewUrl(null);
    }
  }, [editingPreviewUrl]);

  const handleCancelEdit = useCallback(() => {
    clearEditFileState();
    setEditingItem(null);
  }, [clearEditFileState]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingItem || !editingItem.title.trim() || !editingItem.description.trim()) return;

    const currentMediaType = [...items, ...videoItems].find(i => i.id === editingItem.id)?.mediaType || 'image';

    if (editingNewFile && currentMediaType === 'video') {
      // Video: upload client-side first, then pass URL to server
      const uploadResult = await uploadVideoToStorage(projectId, editingNewFile);
      if (!uploadResult.success || !uploadResult.url || !uploadResult.path) {
        setEditingFileError(uploadResult.error || 'Error al subir video');
        return;
      }
      await onEdit(editingItem.id, editingItem.title.trim(), editingItem.description.trim(), undefined, {
        mediaUrl: uploadResult.url,
        storagePath: uploadResult.path,
      });
    } else if (editingNewFile && currentMediaType === 'image') {
      // Image: pass compressed file to server action
      await onEdit(editingItem.id, editingItem.title.trim(), editingItem.description.trim(), editingNewFile);
    } else {
      // No file change
      await onEdit(editingItem.id, editingItem.title.trim(), editingItem.description.trim());
    }

    clearEditFileState();
    setEditingItem(null);
  }, [editingItem, editingNewFile, items, videoItems, projectId, onEdit, clearEditFileState]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingItem) return;
    await onDelete(deletingItem.id, deletingItem.storagePath);
    setDeletingItem(null);
  }, [deletingItem, onDelete]);

  const currentLoading = activeTab === 'images' ? isLoading : isLoadingVideos;

  if (currentLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ---- Tabs ---- */}
      <div className="flex border-b border-[var(--border-primary)]">
        <button
          type="button"
          onClick={() => setActiveTab('images')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'images'
              ? 'border-[var(--accent-primary)] text-[var(--accent-text)]'
              : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
          </svg>
          Imagenes
          <span className="text-xs text-[var(--text-tertiary)]">({items.length}/{MAX_MEDIA_ITEMS})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('videos')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'videos'
              ? 'border-[var(--accent-primary)] text-[var(--accent-text)]'
              : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          Videos
          <span className="text-xs text-[var(--text-tertiary)]">({videoItems.length}/{MAX_VIDEO_ITEMS})</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* IMAGES TAB */}
      {/* ================================================================= */}
      {activeTab === 'images' && (
        <div className="space-y-4">
          {/* Fixed first-contact image */}
          {agentId && projectId && (
            <div className="p-3 rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5">
              <FixedImageSlot
                eventType="first_contact"
                agentId={agentId}
                projectId={projectId}
                label="Imagen de primer contacto"
                helpText="Se envia automaticamente en el primer mensaje al lead"
              />
            </div>
          )}

          {/* Existing image items */}
          {items.length === 0 && !showAddForm ? (
            <div className="p-8 rounded-lg border border-dashed border-[var(--border-primary)] text-center">
              <svg className="w-10 h-10 mx-auto mb-3 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
              </svg>
              <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">No hay imagenes configuradas</p>
              <p className="text-xs text-[var(--text-tertiary)]">Agrega imagenes para que tu agente las envie en las conversaciones con leads.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                editingItem?.id === item.id ? (
                  <EditForm
                    key={item.id}
                    item={item}
                    editingItem={editingItem}
                    setEditingItem={setEditingItem}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    isSaving={isSaving}
                    mediaType="image"
                    newPreviewUrl={editingPreviewUrl}
                    hasNewFile={!!editingNewFile}
                    isCompressing={editingCompressing}
                    fileError={editingFileError}
                    onFileSelect={(file) => handleEditFileSelect(file, 'image')}
                    onFileClear={clearEditFileState}
                    editFileInputRef={editFileInputRef}
                  />
                ) : (
                  <MediaItemRow
                    key={item.id}
                    item={item}
                    onEdit={() => setEditingItem({ id: item.id, title: item.title, description: item.description })}
                    onDelete={() => setDeletingItem({ id: item.id, storagePath: item.storagePath })}
                    mediaType="image"
                    onLightbox={(url, alt) => setLightboxImage({ url, alt })}
                  />
                )
              ))}
            </div>
          )}

          {/* Add image form */}
          {showAddForm ? (
            <div className="p-4 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 space-y-4">
              {!compressInfo ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 rounded-lg border-2 border-dashed border-[var(--border-primary)] hover:border-[var(--accent-primary)] cursor-pointer transition-colors text-center"
                >
                  {compressing ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--accent-primary)]" />
                      <span className="text-sm text-[var(--text-secondary)]">Comprimiendo...</span>
                    </div>
                  ) : (
                    <>
                      <svg className="w-8 h-8 mx-auto mb-2 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-sm text-[var(--text-secondary)]">Arrastra una imagen o haz clic para seleccionar</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">JPG, PNG o WebP</p>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleInputChange} className="hidden" />
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-[var(--bg-tertiary)] relative">
                    <img src={compressInfo.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => { URL.revokeObjectURL(compressInfo.previewUrl); setCompressInfo(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 text-xs text-[var(--text-tertiary)] space-y-0.5">
                    <p>{compressInfo.width}x{compressInfo.height} px</p>
                    <p>Comprimido: {formatFileSize(compressInfo.originalSize)} → {formatFileSize(compressInfo.compressedSize)}</p>
                  </div>
                </div>
              )}
              {compressError && <p className="text-xs text-red-500">{compressError}</p>}
              <TitleDescriptionFields title={title} setTitle={setTitle} description={description} setDescription={setDescription} titleLabel="Titulo de la imagen" titlePlaceholder="Ej: Departamento de 2 dormitorios" />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={resetImageForm} className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-sm">Cancelar</button>
                <button type="button" onClick={handleAdd} disabled={isSaving || !compressInfo || !title.trim() || !description.trim()} className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--kairo-midnight)] hover:opacity-90 disabled:opacity-50 transition-colors text-sm font-medium">{isSaving ? 'Subiendo...' : 'Agregar'}</button>
              </div>
            </div>
          ) : (
            items.length < MAX_MEDIA_ITEMS && (
              <button type="button" onClick={() => setShowAddForm(true)} className="w-full text-sm px-3 py-2.5 rounded-lg border border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors">
                + Agregar imagen
              </button>
            )
          )}
          {items.length >= MAX_MEDIA_ITEMS && !showAddForm && (
            <p className="text-xs text-[var(--text-tertiary)] text-center italic">Maximo {MAX_MEDIA_ITEMS} imagenes</p>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* VIDEOS TAB */}
      {/* ================================================================= */}
      {activeTab === 'videos' && (
        <div className="space-y-4">
          {/* Fixed first-contact video */}
          {agentId && projectId && (
            <div className="p-3 rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5">
              <FixedVideoSlot
                eventType="first_contact_video"
                agentId={agentId}
                projectId={projectId}
                label="Video de primer contacto"
                helpText="Se envia despues de la imagen de bienvenida, antes del texto"
              />
            </div>
          )}

          {/* Existing video items */}
          {videoItems.length === 0 && !showVideoAddForm ? (
            <div className="p-8 rounded-lg border border-dashed border-[var(--border-primary)] text-center">
              <svg className="w-10 h-10 mx-auto mb-3 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">No hay videos configurados</p>
              <p className="text-xs text-[var(--text-tertiary)]">Agrega videos para que tu agente los envie en las conversaciones con leads.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {videoItems.map((item) => (
                editingItem?.id === item.id ? (
                  <EditForm
                    key={item.id}
                    item={item}
                    editingItem={editingItem}
                    setEditingItem={setEditingItem}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    isSaving={isSaving}
                    mediaType="video"
                    newPreviewUrl={editingPreviewUrl}
                    hasNewFile={!!editingNewFile}
                    isCompressing={editingCompressing}
                    fileError={editingFileError}
                    onFileSelect={(file) => handleEditFileSelect(file, 'video')}
                    onFileClear={clearEditFileState}
                    editFileInputRef={editFileInputRef}
                  />
                ) : (
                  <MediaItemRow
                    key={item.id}
                    item={item}
                    onEdit={() => setEditingItem({ id: item.id, title: item.title, description: item.description })}
                    onDelete={() => setDeletingItem({ id: item.id, storagePath: item.storagePath })}
                    mediaType="video"
                    onLightbox={(url, alt) => setLightboxImage({ url, alt })}
                  />
                )
              ))}
            </div>
          )}

          {/* Add video form */}
          {showVideoAddForm ? (
            <div className="p-4 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 space-y-4">
              {!videoFile ? (
                <div
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleVideoFileSelect(f); }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => videoInputRef.current?.click()}
                  className="p-6 rounded-lg border-2 border-dashed border-[var(--border-primary)] hover:border-[var(--accent-primary)] cursor-pointer transition-colors text-center"
                >
                  <svg className="w-8 h-8 mx-auto mb-2 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  <p className="text-sm text-[var(--text-secondary)]">Arrastra un video o haz clic para seleccionar</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">MP4, max {MAX_VIDEO_SIZE_MB}MB</p>
                  <input ref={videoInputRef} type="file" accept="video/mp4" onChange={handleVideoInputChange} className="hidden" />
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center relative">
                    <svg className="w-8 h-8 text-[var(--accent-text)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    <button
                      onClick={() => { setVideoFile(null); if (videoInputRef.current) videoInputRef.current.value = ''; }}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 text-xs text-[var(--text-tertiary)] space-y-0.5">
                    <p className="truncate">{videoFile.name}</p>
                    <p>{formatFileSize(videoFile.size)}</p>
                  </div>
                </div>
              )}
              {videoError && <p className="text-xs text-red-500">{videoError}</p>}
              <TitleDescriptionFields title={videoTitle} setTitle={setVideoTitle} description={videoDescription} setDescription={setVideoDescription} titleLabel="Titulo del video" titlePlaceholder="Ej: Recorrido virtual del departamento" />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={resetVideoForm} className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-sm">Cancelar</button>
                <button type="button" onClick={handleAddVideo} disabled={isSaving || !videoFile || !videoTitle.trim() || !videoDescription.trim()} className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--kairo-midnight)] hover:opacity-90 disabled:opacity-50 transition-colors text-sm font-medium">{isSaving ? 'Subiendo...' : 'Agregar'}</button>
              </div>
            </div>
          ) : (
            videoItems.length < MAX_VIDEO_ITEMS && (
              <button type="button" onClick={() => setShowVideoAddForm(true)} className="w-full text-sm px-3 py-2.5 rounded-lg border border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors">
                + Agregar video
              </button>
            )
          )}
          {videoItems.length >= MAX_VIDEO_ITEMS && !showVideoAddForm && (
            <p className="text-xs text-[var(--text-tertiary)] text-center italic">Maximo {MAX_VIDEO_ITEMS} videos</p>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        type="confirm"
        title={activeTab === 'images' ? 'Eliminar imagen?' : 'Eliminar video?'}
        message="Esta accion no se puede deshacer. El archivo sera eliminado permanentemente."
        onConfirm={handleConfirmDelete}
      />

      {/* Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage.url}
          alt={lightboxImage.alt}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Subcomponents (shared between tabs)
// =============================================================================

/** Extracts a thumbnail from a video URL via Canvas and displays it */
function VideoThumbnail({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    extractThumbnailFromUrl(url).then((dataUrl) => {
      if (!cancelled && dataUrl) setThumb(dataUrl);
    });
    return () => { cancelled = true; };
  }, [url]);

  if (thumb) {
    return <img src={thumb} alt={alt} className={className || 'w-full h-full object-cover'} />;
  }

  // Fallback: camera icon while loading or if extraction fails
  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg className="w-6 h-6 text-[var(--accent-text)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    </div>
  );
}

function formatMediaDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function MediaItemRow({ item, onEdit, onDelete, mediaType, onLightbox }: {
  item: AgentMediaEntry;
  onEdit: () => void;
  onDelete: () => void;
  mediaType: 'image' | 'video';
  onLightbox?: (url: string, alt: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] group">
      {/* Thumbnail */}
      <div
        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-[var(--bg-tertiary)] relative cursor-pointer hover:ring-2 hover:ring-[var(--accent-primary)] transition-all`}
        onClick={() => mediaType === 'video' ? window.open(item.mediaUrl, '_blank') : onLightbox?.(item.mediaUrl, item.title)}
      >
        {mediaType === 'image' ? (
          <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <>
            <VideoThumbnail url={item.mediaUrl} alt={item.title} />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <svg className="w-5 h-5 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </>
        )}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-[var(--text-primary)] mb-0.5 truncate">{item.title}</h4>
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{item.description}</p>
        {item.createdAt && (
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{formatMediaDate(item.createdAt)}</p>
        )}
      </div>
      {/* Edit + Delete buttons */}
      <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button onClick={onEdit} className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--accent-text)] hover:bg-[var(--accent-primary)]/10 transition-colors" title="Editar">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Eliminar">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function EditForm({ item, editingItem, setEditingItem, onSave, onCancel, isSaving, mediaType, newPreviewUrl, hasNewFile, isCompressing, fileError, onFileSelect, onFileClear, editFileInputRef }: {
  item: AgentMediaEntry;
  editingItem: { id: string; title: string; description: string };
  setEditingItem: (val: { id: string; title: string; description: string } | null) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  mediaType: 'image' | 'video';
  newPreviewUrl: string | null;
  hasNewFile: boolean;
  isCompressing: boolean;
  fileError: string;
  onFileSelect: (file: File) => void;
  onFileClear: () => void;
  editFileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  const showNewPreview = mediaType === 'image' && newPreviewUrl;
  const showNewVideoLabel = mediaType === 'video' && hasNewFile;

  return (
    <div className="p-4 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 space-y-3">
      <div className="flex items-start gap-3">
        {/* Thumbnail with change overlay */}
        <div className="flex-shrink-0 space-y-1.5">
          <div
            className="w-16 h-16 rounded-lg overflow-hidden bg-[var(--bg-tertiary)] relative group/thumb cursor-pointer"
            onClick={() => editFileInputRef.current?.click()}
          >
            {showNewPreview ? (
              <>
                <img src={newPreviewUrl} alt="Nueva imagen" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onFileClear(); }}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : mediaType === 'image' ? (
              <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <>
                <VideoThumbnail url={item.mediaUrl} alt={item.title} />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <svg className="w-5 h-5 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </>
            )}
            {/* Change overlay */}
            {!isCompressing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
              </div>
            )}
            {isCompressing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              </div>
            )}
          </div>
          <input
            ref={editFileInputRef}
            type="file"
            accept={mediaType === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4'}
            onChange={handleFileInputChange}
            className="hidden"
          />
          {showNewVideoLabel && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-green-500 font-medium">Nuevo video</span>
              <button type="button" onClick={onFileClear} className="text-[var(--text-tertiary)] hover:text-red-500">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <TitleDescriptionFields
            title={editingItem.title}
            setTitle={(val) => setEditingItem({ ...editingItem, title: val })}
            description={editingItem.description}
            setDescription={(val) => setEditingItem({ ...editingItem, description: val })}
            titleLabel={mediaType === 'image' ? 'Titulo de la imagen' : 'Titulo del video'}
          />
        </div>
      </div>
      {fileError && <p className="text-xs text-red-500">{fileError}</p>}
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-sm">Cancelar</button>
        <button type="button" onClick={onSave} disabled={isSaving || isCompressing || !editingItem.title.trim() || !editingItem.description.trim()} className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--kairo-midnight)] hover:opacity-90 disabled:opacity-50 transition-colors text-sm font-medium">{isSaving ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </div>
  );
}

function TitleDescriptionFields({ title, setTitle, description, setDescription, titleLabel, titlePlaceholder }: {
  title: string;
  setTitle: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  titleLabel?: string;
  titlePlaceholder?: string;
}) {
  const inputCls = 'w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent text-sm';
  return (
    <>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-[var(--text-secondary)]">{titleLabel || 'Titulo'}</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={titlePlaceholder} maxLength={MAX_TITLE_LENGTH} className={inputCls} />
        <CharCounter value={title} max={MAX_TITLE_LENGTH} />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-[var(--text-secondary)]">Descripcion (el agente usara esto para decidir cuando enviarlo)</label>
        <ExpandableTextarea value={description} onChange={setDescription} placeholder="Describe el contenido en detalle..." maxLength={MAX_DESCRIPTION_LENGTH} rows={3} modalTitle="Descripcion" />
      </div>
    </>
  );
}
