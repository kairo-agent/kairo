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

// HTTP solo se permite para hostnames de desarrollo local. Todo lo demas
// debe ser HTTPS — un widget embebido en HTTP expone los mensajes en
// transito y los browsers marcan el sitio como inseguro.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

type NormalizeError = 'invalid_url' | 'http_not_allowed';

function normalizeOrigin(input: string): { ok: true; value: string } | { ok: false; error: NormalizeError } {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!URL_REGEX.test(trimmed)) return { ok: false, error: 'invalid_url' };
  try {
    const u = new URL(trimmed);
    if (u.protocol === 'http:' && !LOCAL_HOSTS.has(u.hostname.toLowerCase())) {
      return { ok: false, error: 'http_not_allowed' };
    }
    return { ok: true, value: `${u.protocol}//${u.host}` };
  } catch {
    return { ok: false, error: 'invalid_url' };
  }
}

export function DomainsForm({ value, onChange }: DomainsFormProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addOrigin = () => {
    const result = normalizeOrigin(draft);
    if (!result.ok) {
      setError(
        result.error === 'http_not_allowed'
          ? 'HTTP no permitido por seguridad. Usa HTTPS (http solo se acepta para localhost en desarrollo).'
          : 'URL invalida (ej: https://miempresa.com)'
      );
      return;
    }
    if (value.includes(result.value)) {
      setError('Este origen ya esta en la lista');
      return;
    }
    onChange([...value, result.value]);
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
