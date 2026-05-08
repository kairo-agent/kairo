'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CollapsibleCardProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  badge?: ReactNode;
}

/**
 * Card expandible/colapsable usada en /settings/webchat para los 7 forms.
 * Sin animaciones complejas — solo show/hide para evitar layout shift.
 */
export function CollapsibleCard({ title, description, defaultOpen = false, children, badge }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
            {badge}
          </div>
          {description && <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{description}</p>}
        </div>
        <svg
          className={cn('h-4 w-4 text-[var(--text-secondary)] transition-transform flex-shrink-0', open && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-[var(--border-primary)] px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}
