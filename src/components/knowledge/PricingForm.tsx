'use client';

import { useState, useCallback } from 'react';
import type { PricingData, ServiceItem } from '@/lib/knowledge/pricing';
import { CURRENCY_OPTIONS } from '@/lib/knowledge/pricing';

// =============================================================================
// Types
// =============================================================================

interface PricingFormProps {
  data: PricingData;
  onSave: (data: PricingData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

// =============================================================================
// Labels (hardcoded until i18n is added)
// =============================================================================

const labels = {
  title: 'Servicios y Precios',
  save: 'Guardar',
  cancel: 'Cancelar',
  saving: 'Guardando...',
  currency: 'Moneda (Global)',
  currencyGlobal: 'Global',
  addItem: 'Agregar servicio',
  remove: 'Quitar',
  serviceName: 'Nombre del servicio',
  serviceNamePlaceholder: 'Ej: Corte de cabello',
  price: 'Precio',
  pricePlaceholder: 'Ej: 50.00',
  description: 'Descripcion (opcional)',
  descriptionPlaceholder: 'Breve descripcion del servicio...',
  notes: 'Notas adicionales',
  notesPlaceholder: 'Notas sobre precios, descuentos, etc.',
  maxItems: 'Maximo 50 servicios',
  emptyState: 'No hay servicios agregados. Haz clic en "Agregar servicio" para comenzar.',
  itemNumber: 'Servicio',
};

const MAX_ITEMS = 50;

// =============================================================================
// Shared Styles
// =============================================================================

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent text-sm';

const selectClass =
  'w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent text-sm appearance-none cursor-pointer';

// =============================================================================
// Component
// =============================================================================

export function PricingForm({
  data,
  onSave,
  onCancel,
  isSaving,
}: PricingFormProps) {
  const [currency, setCurrency] = useState(data.currency);
  const [items, setItems] = useState<ServiceItem[]>(() => [...data.items]);
  const [notes, setNotes] = useState(data.notes || '');

  const addItem = useCallback(() => {
    setItems((prev) => {
      if (prev.length >= MAX_ITEMS) return prev;
      return [...prev, { name: '', price: '', description: '', currency: '' }];
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateItem = useCallback(
    (index: number, field: keyof ServiceItem, value: string) => {
      setItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    []
  );

  const handleSave = () => {
    // Clean up: remove empty currency overrides (they inherit global)
    const cleanedItems = items.map(item => ({
      ...item,
      currency: item.currency || undefined,
    }));
    onSave({ currency, items: cleanedItems, notes: notes || undefined });
  };

  return (
    <div className="space-y-6">
      {/* ---- Currency Selector ---- */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[var(--text-primary)]">
          {labels.currency}
        </label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className={selectClass}
        >
          {CURRENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          {labels.title}
        </h3>
        <span className="text-xs text-[var(--text-tertiary)]">
          {items.length}/{MAX_ITEMS}
        </span>
      </div>

      {/* ---- Service Items ---- */}
      {items.length === 0 ? (
        <div className="p-6 rounded-lg border border-dashed border-[var(--border-primary)] text-center">
          <p className="text-sm text-[var(--text-tertiary)]">
            {labels.emptyState}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
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

              {/* Name + Price + Currency row */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">
                    {labels.serviceName}
                  </label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    placeholder={labels.serviceNamePlaceholder}
                    maxLength={100}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1 sm:w-28">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">
                    {labels.price}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={item.price}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, '');
                      if (raw === '' || /^\d+\.?\d{0,2}$/.test(raw)) {
                        const parts = raw.split('.');
                        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                        updateItem(index, 'price', parts.join('.'));
                      }
                    }}
                    placeholder={labels.pricePlaceholder}
                    maxLength={20}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1 sm:w-28">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">
                    {labels.currency}
                  </label>
                  <select
                    value={item.currency || ''}
                    onChange={(e) => updateItem(index, 'currency', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">{labels.currencyGlobal}</option>
                    {CURRENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  {labels.description}
                </label>
                <textarea
                  value={item.description || ''}
                  onChange={(e) =>
                    updateItem(index, 'description', e.target.value)
                  }
                  placeholder={labels.descriptionPlaceholder}
                  maxLength={500}
                  rows={3}
                  className={inputClass + ' resize-y'}
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
          onClick={addItem}
          className="w-full text-sm px-3 py-2.5 rounded-lg border border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
        >
          + {labels.addItem}
        </button>
      )}

      {items.length >= MAX_ITEMS && (
        <p className="text-xs text-[var(--text-tertiary)] text-center italic">
          {labels.maxItems}
        </p>
      )}

      {/* ---- Notes ---- */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[var(--text-primary)]">
          {labels.notes}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={labels.notesPlaceholder}
          maxLength={500}
          rows={3}
          className={`${inputClass} resize-none`}
        />
        <p className="text-xs text-[var(--text-tertiary)] text-right">
          {notes.length}/500
        </p>
      </div>

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
