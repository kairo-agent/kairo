'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface DomainsFormProps {
  value: string[];
  onChange: (value: string[]) => void;
}

const URL_REGEX = /^https?:\/\/[^\s]+$/i;

function normalizeOrigin(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!URL_REGEX.test(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export function DomainsForm({ value, onChange }: DomainsFormProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addOrigin = () => {
    const normalized = normalizeOrigin(draft);
    if (!normalized) {
      setError('URL invalida (ej: https://miempresa.com)');
      return;
    }
    if (value.includes(normalized)) {
      setError('Este origen ya esta en la lista');
      return;
    }
    onChange([...value, normalized]);
    setDraft('');
    setError(null);
  };

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const isEmpty = value.length === 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-tertiary)]">
        Lista de dominios autorizados a embeber el widget (validacion CORS). Solo agrega los dominios donde instalaras el widget.
      </p>

      {isEmpty && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-400">
          <strong>Atencion:</strong> Sin dominios autorizados, el widget NO funcionara en ningun sitio externo. Agrega aqui el dominio donde instalaras el snippet (ej: https://misitio.com) antes de pegar el codigo en tu web.
        </div>
      )}

      <div className="space-y-2">
        {value.map((origin, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2"
          >
            <code className="text-xs text-[var(--text-primary)] truncate">{origin}</code>
            <button
              type="button"
              onClick={() => removeAt(idx)}
              className="rounded p-1 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-500 flex-shrink-0"
              aria-label={`Eliminar ${origin}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <div className="flex-1">
          <Input
            label="Agregar dominio"
            type="url"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOrigin();
              }
            }}
            placeholder="https://miempresa.com"
            error={error ?? undefined}
          />
        </div>
        <Button variant="secondary" onClick={addOrigin} className={cn(error && 'sm:mb-6')}>
          Agregar
        </Button>
      </div>
    </div>
  );
}
