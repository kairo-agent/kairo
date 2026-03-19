'use client';

import { useState, useCallback, useRef } from 'react';
import { ExpandableTextarea } from '@/components/ui/ExpandableTextarea';
import { AlertModal } from '@/components/ui/Modal';
import { compressImage, formatFileSize } from '@/lib/utils/image-compression';
import type { AgentMediaEntry } from '@/lib/types/agent-media';
import { MAX_MEDIA_ITEMS, MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from '@/lib/types/agent-media';

// =============================================================================
// Types
// =============================================================================

interface MultimediaModalProps {
  items: AgentMediaEntry[];
  onAdd: (title: string, description: string, file: File) => Promise<void>;
  onEdit: (id: string, title: string, description: string) => Promise<void>;
  onDelete: (id: string, storagePath: string) => Promise<void>;
  isSaving: boolean;
  isLoading: boolean;
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
// Labels
// =============================================================================

const labels = {
  title: 'Multimedia del Agente',
  addImage: 'Agregar imagen',
  save: 'Agregar',
  saveEdit: 'Guardar',
  saving: 'Subiendo...',
  savingEdit: 'Guardando...',
  cancel: 'Cancelar',
  edit: 'Editar',
  remove: 'Eliminar',
  titleLabel: 'Titulo de la imagen',
  titlePlaceholder: 'Ej: Departamento de 2 dormitorios',
  descLabel: 'Descripcion (el agente usara esto para decidir cuando enviarla)',
  descPlaceholder: 'Describe la imagen en detalle. Ej: Vista frontal del departamento modelo de 85m2 con 2 dormitorios, sala-comedor amplia y cocina americana...',
  dropzone: 'Arrastra una imagen o haz clic para seleccionar',
  dropzoneFormats: 'JPG, PNG o WebP',
  emptyState: 'No hay imagenes configuradas',
  emptyStateDesc: 'Agrega imagenes para que tu agente las envie en las conversaciones con leads.',
  maxItems: 'Maximo 20 imagenes',
  deleteConfirm: 'Eliminar imagen?',
  deleteMessage: 'Esta accion no se puede deshacer. La imagen sera eliminada permanentemente.',
  tooSmall: 'La imagen debe ser al menos 200x200 pixeles',
  compressionInfo: 'Comprimido',
  images: 'imagenes',
};

// =============================================================================
// Shared Styles
// =============================================================================

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent text-sm';

// =============================================================================
// Component
// =============================================================================

export function MultimediaModal({ items, onAdd, onEdit, onDelete, isSaving, isLoading }: MultimediaModalProps) {
  // Add form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [compressInfo, setCompressInfo] = useState<CompressInfo | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressError, setCompressError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingItem, setEditingItem] = useState<{ id: string; title: string; description: string } | null>(null);

  // Delete confirmation
  const [deletingItem, setDeletingItem] = useState<{ id: string; storagePath: string } | null>(null);

  const resetForm = useCallback(() => {
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
        file: result.file,
        width: result.width,
        height: result.height,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        previewUrl,
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
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleAdd = useCallback(async () => {
    if (!compressInfo || !title.trim() || !description.trim()) return;
    await onAdd(title.trim(), description.trim(), compressInfo.file);
    resetForm();
  }, [compressInfo, title, description, onAdd, resetForm]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingItem || !editingItem.title.trim() || !editingItem.description.trim()) return;
    await onEdit(editingItem.id, editingItem.title.trim(), editingItem.description.trim());
    setEditingItem(null);
  }, [editingItem, onEdit]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingItem) return;
    await onDelete(deletingItem.id, deletingItem.storagePath);
    setDeletingItem(null);
  }, [deletingItem, onDelete]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          {labels.title}
        </h3>
        <span className="text-xs text-[var(--text-tertiary)]">
          {items.length}/{MAX_MEDIA_ITEMS} {labels.images}
        </span>
      </div>

      {/* ---- Existing Items ---- */}
      {items.length === 0 && !showAddForm ? (
        <div className="p-8 rounded-lg border border-dashed border-[var(--border-primary)] text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
          </svg>
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">{labels.emptyState}</p>
          <p className="text-xs text-[var(--text-tertiary)]">{labels.emptyStateDesc}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            editingItem?.id === item.id ? (
              /* ---- Inline Edit Form ---- */
              <div
                key={item.id}
                className="p-4 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-[var(--bg-tertiary)]">
                    <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-[var(--text-secondary)]">
                        {labels.titleLabel}
                      </label>
                      <input
                        type="text"
                        value={editingItem.title}
                        onChange={(e) => setEditingItem((prev) => prev ? { ...prev, title: e.target.value } : null)}
                        maxLength={MAX_TITLE_LENGTH}
                        className={inputClass}
                      />
                      <p className="text-xs text-[var(--text-tertiary)] text-right">
                        {editingItem.title.length}/{MAX_TITLE_LENGTH}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-[var(--text-secondary)]">
                        {labels.descLabel}
                      </label>
                      <ExpandableTextarea
                        value={editingItem.description}
                        onChange={(val) => setEditingItem((prev) => prev ? { ...prev, description: val } : null)}
                        maxLength={MAX_DESCRIPTION_LENGTH}
                        rows={3}
                        modalTitle={labels.descLabel}
                      />
                      <p className="text-xs text-[var(--text-tertiary)] text-right">
                        {editingItem.description.length}/{MAX_DESCRIPTION_LENGTH}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-sm"
                  >
                    {labels.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editingItem.title.trim() || !editingItem.description.trim()}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-colors text-sm font-medium"
                  >
                    {isSaving ? labels.savingEdit : labels.saveEdit}
                  </button>
                </div>
              </div>
            ) : (
              /* ---- Display Item ---- */
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] group"
              >
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-[var(--bg-tertiary)]">
                  <img
                    src={item.mediaUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-[var(--text-primary)] mb-0.5 truncate">
                    {item.title}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                    {item.description}
                  </p>
                </div>
                {/* Edit + Delete buttons */}
                <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => setEditingItem({ id: item.id, title: item.title, description: item.description })}
                    className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 transition-colors"
                    title={labels.edit}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeletingItem({ id: item.id, storagePath: item.storagePath })}
                    className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title={labels.remove}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* ---- Add Form ---- */}
      {showAddForm ? (
        <div className="p-4 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 space-y-4">
          {/* Image upload area */}
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
                  <p className="text-sm text-[var(--text-secondary)]">{labels.dropzone}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">{labels.dropzoneFormats}</p>
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
          ) : (
            <div className="flex items-start gap-4">
              {/* Preview */}
              <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-[var(--bg-tertiary)] relative">
                <img src={compressInfo.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => {
                    URL.revokeObjectURL(compressInfo.previewUrl);
                    setCompressInfo(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Compression info */}
              <div className="flex-1 text-xs text-[var(--text-tertiary)] space-y-0.5">
                <p>{compressInfo.width}x{compressInfo.height} px</p>
                <p>
                  {labels.compressionInfo}: {formatFileSize(compressInfo.originalSize)} → {formatFileSize(compressInfo.compressedSize)}
                </p>
              </div>
            </div>
          )}

          {compressError && (
            <p className="text-xs text-red-500">{compressError}</p>
          )}

          {/* Title */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              {labels.titleLabel}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={labels.titlePlaceholder}
              maxLength={MAX_TITLE_LENGTH}
              className={inputClass}
            />
            <p className="text-xs text-[var(--text-tertiary)] text-right">
              {title.length}/{MAX_TITLE_LENGTH}
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              {labels.descLabel}
            </label>
            <ExpandableTextarea
              value={description}
              onChange={setDescription}
              placeholder={labels.descPlaceholder}
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={3}
              modalTitle={labels.descLabel}
            />
            <p className="text-xs text-[var(--text-tertiary)] text-right">
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-sm"
            >
              {labels.cancel}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isSaving || !compressInfo || !title.trim() || !description.trim()}
              className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {isSaving ? labels.saving : labels.save}
            </button>
          </div>
        </div>
      ) : (
        items.length < MAX_MEDIA_ITEMS && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="w-full text-sm px-3 py-2.5 rounded-lg border border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            + {labels.addImage}
          </button>
        )
      )}

      {items.length >= MAX_MEDIA_ITEMS && !showAddForm && (
        <p className="text-xs text-[var(--text-tertiary)] text-center italic">
          {labels.maxItems}
        </p>
      )}

      {/* Delete Confirmation */}
      <AlertModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        type="confirm"
        title={labels.deleteConfirm}
        message={labels.deleteMessage}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
