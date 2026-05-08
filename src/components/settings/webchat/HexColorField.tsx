'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

interface HexColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
}

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Color picker (native input[type="color"]) + text input para hex.
 * Patron usado en los 9 colores del AppearanceForm.
 */
export function HexColorField({ label, value, onChange, helperText }: HexColorFieldProps) {
  const id = useId();
  const isValid = HEX_REGEX.test(value);

  // input[type=color] solo acepta formato #RRGGBB de 6 chars
  const colorInputValue = isValid && value.length === 7 ? value : '#000000';

  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={colorInputValue}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--border-primary)] bg-[var(--bg-input)] p-1"
          aria-label={`${label} color picker`}
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#00E5FF"
          maxLength={7}
          className={cn(
            'w-full rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] text-sm',
            'border border-[var(--border-primary)] px-3 py-2',
            'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent',
            !isValid && 'border-[var(--status-lost)] focus:ring-[var(--status-lost)]'
          )}
        />
      </div>
      {(helperText || !isValid) && (
        <p className={cn('mt-1 text-xs', !isValid ? 'text-[var(--status-lost)]' : 'text-[var(--text-tertiary)]')}>
          {!isValid ? 'Formato hex invalido (ej: #00E5FF)' : helperText}
        </p>
      )}
    </div>
  );
}
