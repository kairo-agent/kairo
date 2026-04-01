'use client';

import { useState, useCallback } from 'react';
import type { FAQsData, FAQItem } from '@/lib/knowledge/faqs';

// =============================================================================
// Types
// =============================================================================

interface FAQsFormProps {
  data: FAQsData;
  onSave: (data: FAQsData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

// =============================================================================
// Labels (hardcoded until i18n is added)
// =============================================================================

const labels = {
  title: 'Preguntas Frecuentes',
  save: 'Guardar',
  cancel: 'Cancelar',
  saving: 'Guardando...',
  addItem: 'Agregar pregunta',
  remove: 'Quitar',
  question: 'Pregunta',
  answer: 'Respuesta',
  questionPlaceholder: 'Escribe la pregunta...',
  answerPlaceholder: 'Escribe la respuesta...',
  maxItems: 'Maximo 20 preguntas',
  emptyState: 'No hay preguntas agregadas. Haz clic en "Agregar pregunta" para comenzar.',
  itemNumber: 'Pregunta',
};

const MAX_ITEMS = 20;
const MAX_QUESTION = 300;
const MAX_ANSWER = 1000;

// =============================================================================
// Shared Styles
// =============================================================================

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent text-sm';

// =============================================================================
// Component
// =============================================================================

export function FAQsForm({ data, onSave, onCancel, isSaving }: FAQsFormProps) {
  const [items, setItems] = useState<FAQItem[]>(() => [...data.items]);

  const addItem = useCallback(() => {
    setItems((prev) => {
      if (prev.length >= MAX_ITEMS) return prev;
      return [...prev, { question: '', answer: '' }];
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateItem = useCallback(
    (index: number, field: keyof FAQItem, value: string) => {
      setItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    []
  );

  const handleSave = () => {
    onSave({ items });
  };

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

      {/* ---- FAQ Items ---- */}
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

              {/* Question */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  {labels.question}
                </label>
                <input
                  type="text"
                  value={item.question}
                  onChange={(e) => updateItem(index, 'question', e.target.value)}
                  placeholder={labels.questionPlaceholder}
                  maxLength={MAX_QUESTION}
                  className={inputClass}
                />
                <p className="text-xs text-[var(--text-tertiary)] text-right">
                  {item.question.length}/{MAX_QUESTION}
                </p>
              </div>

              {/* Answer */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  {labels.answer}
                </label>
                <textarea
                  value={item.answer}
                  onChange={(e) => updateItem(index, 'answer', e.target.value)}
                  placeholder={labels.answerPlaceholder}
                  maxLength={MAX_ANSWER}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
                <p className="text-xs text-[var(--text-tertiary)] text-right">
                  {item.answer.length}/{MAX_ANSWER}
                </p>
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
          className="w-full text-sm px-3 py-2.5 rounded-lg border border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors"
        >
          + {labels.addItem}
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
