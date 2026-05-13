'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  MAX_STARTER_QUESTIONS,
  MAX_STARTER_QUESTION_LENGTH,
  type WebChatStarterQuestion,
} from '@/lib/types/webchat-config';

interface StarterQuestionsEditorProps {
  value: WebChatStarterQuestion[];
  onChange: (value: WebChatStarterQuestion[]) => void;
}

export function StarterQuestionsEditor({ value, onChange }: StarterQuestionsEditorProps) {
  const canAdd = value.length < MAX_STARTER_QUESTIONS;

  const updateAt = (idx: number, key: keyof WebChatStarterQuestion, val: string) => {
    const next = [...value];
    next[idx] = { ...next[idx], [key]: val };
    onChange(next);
  };

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= value.length) return;
    const next = [...value];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(next);
  };

  const add = () => {
    if (!canAdd) return;
    onChange([...value, { textEs: '', textEn: '' }]);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-tertiary)]">
        Botones de pregunta sugerida que aparecen al abrir el widget. Maximo {MAX_STARTER_QUESTIONS}.
      </p>

      {value.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-4 text-center text-sm text-[var(--text-tertiary)]">
          Sin preguntas sugeridas. Agrega hasta {MAX_STARTER_QUESTIONS}.
        </div>
      )}

      <div className="space-y-3">
        {value.map((q, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Pregunta #{idx + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Mover arriba"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === value.length - 1}
                  className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Mover abajo"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  className="rounded p-1 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-500"
                  aria-label="Eliminar"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Espanol"
                value={q.textEs}
                onChange={(e) => updateAt(idx, 'textEs', e.target.value)}
                maxLength={MAX_STARTER_QUESTION_LENGTH}
                placeholder="¿Cuales son sus precios?"
              />
              <Input
                label="English"
                value={q.textEn}
                onChange={(e) => updateAt(idx, 'textEn', e.target.value)}
                maxLength={MAX_STARTER_QUESTION_LENGTH}
                placeholder="What are your prices?"
              />
            </div>
          </div>
        ))}
      </div>

      <Button variant="secondary" size="sm" onClick={add} disabled={!canAdd}>
        + Agregar pregunta {!canAdd && `(max ${MAX_STARTER_QUESTIONS})`}
      </Button>
    </div>
  );
}
