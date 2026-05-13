'use client';

import { useState, useCallback } from 'react';
import type { PoliciesData, PolicyItem } from '@/lib/knowledge/policies';
import { POLICY_PRESETS } from '@/lib/knowledge/policies';
import { ExpandableTextarea } from '@/components/ui/ExpandableTextarea';
import { CharCounter } from '@/components/ui/CharCounter';

// =============================================================================
// Types
// =============================================================================

interface PoliciesFormProps {
  data: PoliciesData;
  onSave: (data: PoliciesData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

// =============================================================================
// Labels (hardcoded until i18n is added)
// =============================================================================

const labels = {
  title: 'Politicas',
  save: 'Guardar',
  cancel: 'Cancelar',
  saving: 'Guardando...',
  addPolicy: 'Agregar politica',
  remove: 'Quitar',
  policyTitle: 'Titulo de la politica',
  policyTitlePlaceholder: 'Ej: Politica de devolucion',
  policyContent: 'Contenido',
  policyContentPlaceholder: 'Describe la politica en detalle...',
  maxItems: 'Maximo 20 politicas',
  emptyState:
    'No hay politicas agregadas. Usa los presets o agrega una manualmente.',
  presetsTitle: 'Presets disponibles',
  presetsCommon: 'Comunes',
  presetsOther: 'Otras',
  presetsHint: 'Haz clic en un preset para agregarlo como nueva politica',
  alreadyAdded: '(ya agregada)',
  itemNumber: 'Politica',
};

const MAX_ITEMS = 20;
const MAX_CONTENT = 2000;

// =============================================================================
// Shared Styles
// =============================================================================

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent text-sm';

// =============================================================================
// Component
// =============================================================================

export function PoliciesForm({
  data,
  onSave,
  onCancel,
  isSaving,
}: PoliciesFormProps) {
  const [items, setItems] = useState<PolicyItem[]>(() => [...data.items]);
  const [showPresets, setShowPresets] = useState(false);

  const addItem = useCallback((title: string = '') => {
    setItems((prev) => {
      if (prev.length >= MAX_ITEMS) return prev;
      return [...prev, { title, content: '' }];
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateItem = useCallback(
    (index: number, field: keyof PolicyItem, value: string) => {
      setItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    []
  );

  const addFromPreset = useCallback(
    (preset: (typeof POLICY_PRESETS)[number]) => {
      setItems((prev) => {
        if (prev.length >= MAX_ITEMS) return prev;
        // Check if a policy with this exact title already exists
        const exists = prev.some(
          (p) =>
            p.title.toLowerCase() === preset.nameEs.toLowerCase() ||
            p.title.toLowerCase() === preset.name.toLowerCase()
        );
        if (exists) return prev;
        return [...prev, { title: preset.nameEs, content: '' }];
      });
    },
    []
  );

  const handleSave = () => {
    onSave({ items });
  };

  // Determine which preset titles are already used
  const usedTitles = new Set(
    items.map((p) => p.title.toLowerCase())
  );

  const commonPresets = POLICY_PRESETS.filter((p) => p.group === 'common');
  const otherPresets = POLICY_PRESETS.filter((p) => p.group === 'other');

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          {labels.title}
        </h3>
        <span className="text-xs text-[var(--text-tertiary)]">
          {items.length}/{MAX_ITEMS}
        </span>
      </div>

      {/* ---- Presets Section ---- */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="text-sm font-medium text-[var(--accent-text)] hover:underline transition-colors"
        >
          {showPresets ? '- Ocultar presets' : '+ Mostrar presets'}
        </button>

        {showPresets && (
          <div className="p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] space-y-3">
            <p className="text-xs text-[var(--text-tertiary)]">
              {labels.presetsHint}
            </p>

            {/* Common presets */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">
                {labels.presetsCommon}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {commonPresets.map((preset) => {
                  const isUsed =
                    usedTitles.has(preset.nameEs.toLowerCase()) ||
                    usedTitles.has(preset.name.toLowerCase());
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => !isUsed && addFromPreset(preset)}
                      disabled={isUsed || items.length >= MAX_ITEMS}
                      className={`
                        text-xs px-3 py-1.5 rounded-md transition-colors
                        ${
                          isUsed
                            ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed line-through'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--accent-primary)] hover:text-[var(--kairo-midnight)] cursor-pointer'
                        }
                        disabled:opacity-50
                      `}
                    >
                      {preset.nameEs}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Other presets */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">
                {labels.presetsOther}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {otherPresets.map((preset) => {
                  const isUsed =
                    usedTitles.has(preset.nameEs.toLowerCase()) ||
                    usedTitles.has(preset.name.toLowerCase());
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => !isUsed && addFromPreset(preset)}
                      disabled={isUsed || items.length >= MAX_ITEMS}
                      className={`
                        text-xs px-3 py-1.5 rounded-md transition-colors
                        ${
                          isUsed
                            ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed line-through'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--accent-primary)] hover:text-[var(--kairo-midnight)] cursor-pointer'
                        }
                        disabled:opacity-50
                      `}
                    >
                      {preset.nameEs}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- Policy Items ---- */}
      {items.length === 0 ? (
        <div className="p-6 rounded-lg border border-dashed border-[var(--border-primary)] text-center">
          <p className="text-sm text-[var(--text-tertiary)]">
            {labels.emptyState}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={index}
              className="p-4 rounded-lg bg-[var(--bg-secondary)] space-y-3"
            >
              {/* Item header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">
                  {labels.itemNumber} {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-xs px-2 py-1 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                  aria-label={`${labels.remove} ${labels.itemNumber} ${index + 1}`}
                >
                  {labels.remove}
                </button>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  {labels.policyTitle}
                </label>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(index, 'title', e.target.value)}
                  placeholder={labels.policyTitlePlaceholder}
                  maxLength={100}
                  className={inputClass}
                />
                <CharCounter value={item.title} max={100} />
              </div>

              {/* Content */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  {labels.policyContent}
                </label>
                <ExpandableTextarea
                  value={item.content}
                  onChange={(val) => updateItem(index, 'content', val)}
                  placeholder={labels.policyContentPlaceholder}
                  maxLength={MAX_CONTENT}
                  rows={5}
                  modalTitle={item.title || labels.policyContent}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- Add Button ---- */}
      {items.length < MAX_ITEMS && (
        <button
          type="button"
          onClick={() => addItem()}
          className="w-full text-sm px-3 py-2.5 rounded-lg border border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors"
        >
          + {labels.addPolicy}
        </button>
      )}

      {items.length >= MAX_ITEMS && (
        <p className="text-xs text-[var(--text-tertiary)] text-center italic">
          {labels.maxItems}
        </p>
      )}

      {/* ---- Actions ---- */}
      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-primary)]">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-sm"
        >
          {labels.cancel}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--kairo-midnight)] hover:opacity-90 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {isSaving ? labels.saving : labels.save}
        </button>
      </div>
    </div>
  );
}
