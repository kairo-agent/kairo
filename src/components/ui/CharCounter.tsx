'use client';

import { cn } from '@/lib/utils';

interface CharCounterProps {
  value: string;
  max: number;
  className?: string;
}

/**
 * Visual character counter for inputs/textareas with a maxLength limit.
 *
 * Color thresholds:
 *   - Normal (< 80% of max):    text-tertiary  (subtle gray)
 *   - Warning (≥ 80% of max):   amber-500      (heads up, approaching limit)
 *   - Critical (≥ 95% of max):  red-500        (almost full, edit will be truncated)
 *
 * Auto-imported into <Input /> and <ExpandableTextarea /> when their
 * `maxLength` prop is set. Can also be used standalone next to raw
 * <textarea>/<input> elements that don't go through those wrappers.
 *
 * Usage standalone:
 *   <CharCounter value={form.title} max={100} />
 */
export function CharCounter({ value, max, className }: CharCounterProps) {
  const length = value?.length ?? 0;
  const ratio = max > 0 ? length / max : 0;

  const color =
    ratio >= 0.95
      ? 'text-red-500'
      : ratio >= 0.8
      ? 'text-amber-500'
      : 'text-[var(--text-tertiary)]';

  return (
    <p
      className={cn(
        'text-xs text-right mt-1 tabular-nums select-none',
        color,
        className
      )}
      aria-live="polite"
    >
      {length} / {max}
    </p>
  );
}
