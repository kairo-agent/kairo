'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface EmbedCodeCardProps {
  publicKey: string | null;
}

export function EmbedCodeCard({ publicKey }: EmbedCodeCardProps) {
  const [copied, setCopied] = useState(false);

  if (!publicKey) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-4 text-sm text-[var(--text-tertiary)]">
        El embed code se generara cuando el canal este completamente provisionado (publicKey requerida).
      </div>
    );
  }

  const code = `<script
  src="https://widget.kairoagent.com/kairo.js"
  data-key="${publicKey}"
  defer
></script>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-tertiary)]">
        Pega este codigo justo antes del cierre de <code className="rounded bg-[var(--bg-tertiary)] px-1">&lt;/body&gt;</code> en tu sitio web. El widget se cargara solo en los dominios autorizados arriba.
      </p>

      <div className="relative">
        <pre className="overflow-x-auto rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-4 pr-14 text-xs text-[var(--text-primary)] leading-relaxed">
          <code>{code}</code>
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'absolute right-2 top-2 rounded-md p-2 transition-colors',
            copied
              ? 'bg-green-500/15 text-green-500'
              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
          )}
          aria-label={copied ? 'Copiado' : 'Copiar codigo'}
        >
          {copied ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>

      <Button variant="ghost" size="sm" onClick={handleCopy}>
        {copied ? 'Copiado' : 'Copiar codigo'}
      </Button>
    </div>
  );
}
