'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { DayPicker, DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import 'react-day-picker/style.css';

// ============================================
// Types
// ============================================

interface DateRangePickerProps {
  value: { start: Date | null; end: Date | null };
  onChange: (range: { start: Date | null; end: Date | null }) => void;
  onClose?: () => void;
  locale?: 'es' | 'en';
  className?: string;
}

// ============================================
// Icons
// ============================================

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

// ============================================
// Main Component
// ============================================

export function DateRangePicker({
  value,
  onChange,
  onClose,
  locale = 'es',
  className,
}: DateRangePickerProps) {
  const t = useTranslations('leads');
  const tCommon = useTranslations('common');

  const [range, setRange] = useState<DateRange | undefined>(() => {
    if (value.start || value.end) {
      return { from: value.start || undefined, to: value.end || undefined };
    }
    return undefined;
  });

  const dateLocale = locale === 'es' ? es : enUS;

  // Handle range selection
  const handleSelect = useCallback((selectedRange: DateRange | undefined) => {
    setRange(selectedRange);
  }, []);

  // Apply the selection
  const handleApply = useCallback(() => {
    onChange({
      start: range?.from || null,
      end: range?.to || null,
    });
    onClose?.();
  }, [range, onChange, onClose]);

  // Clear the selection
  const handleClear = useCallback(() => {
    setRange(undefined);
    onChange({ start: null, end: null });
  }, [onChange]);

  // Format display text
  const getDisplayText = () => {
    if (!range?.from) return t('dateRange.custom');
    if (!range.to) return format(range.from, 'dd MMM yyyy', { locale: dateLocale });
    return `${format(range.from, 'dd MMM', { locale: dateLocale })} - ${format(range.to, 'dd MMM yyyy', { locale: dateLocale })}`;
  };

  // Calculate days selected
  const getDaysSelected = () => {
    if (range?.from && range?.to) {
      return Math.ceil((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    return 0;
  };

  const daysText = locale === 'es' ? 'días seleccionados' : 'days selected';

  return (
    <div className={cn('bg-[var(--bg-primary)] rounded-xl shadow-2xl border border-[var(--border-primary)] overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="text-[var(--accent-primary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {getDisplayText()}
            </span>
          </div>
          {range?.from && (
            <button
              onClick={handleClear}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--status-lost)] transition-colors"
            >
              {tCommon('buttons.clear')}
            </button>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div className="p-4 date-picker-container">
        <style jsx global>{`
          .date-picker-container .rdp {
            --rdp-accent-color: var(--accent-primary);
            --rdp-accent-background-color: rgba(0, 229, 255, 0.15);
            --rdp-background-color: var(--bg-primary);
            --rdp-day-height: 36px;
            --rdp-day-width: 36px;
            margin: 0;
          }

          .date-picker-container .rdp-root {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          @media (min-width: 640px) {
            .date-picker-container .rdp-root {
              flex-direction: row;
            }
          }

          .date-picker-container .rdp-month {
            background: transparent;
          }

          .date-picker-container .rdp-month_caption {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 0.5rem 0;
          }

          .date-picker-container .rdp-caption_label {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--text-primary);
            text-transform: capitalize;
          }

          .date-picker-container .rdp-nav {
            display: flex;
            gap: 0.25rem;
          }

          .date-picker-container .rdp-button_previous,
          .date-picker-container .rdp-button_next {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 0.5rem;
            color: var(--text-secondary);
            background: transparent;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
          }

          .date-picker-container .rdp-button_previous:hover,
          .date-picker-container .rdp-button_next:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
          }

          .date-picker-container .rdp-weekdays {
            display: flex;
          }

          .date-picker-container .rdp-weekday {
            width: var(--rdp-day-width);
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 500;
            color: var(--text-tertiary);
            text-transform: uppercase;
          }

          .date-picker-container .rdp-weeks {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .date-picker-container .rdp-week {
            display: flex;
          }

          .date-picker-container .rdp-day {
            width: var(--rdp-day-width);
            height: var(--rdp-day-height);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .date-picker-container .rdp-day_button {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.875rem;
            color: var(--text-primary);
            background: transparent;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: all 0.15s;
          }

          .date-picker-container .rdp-day_button:hover:not(:disabled) {
            background: var(--bg-hover);
          }

          .date-picker-container .rdp-today .rdp-day_button {
            border: 1px solid var(--accent-primary);
          }

          .date-picker-container .rdp-outside .rdp-day_button {
            color: var(--text-tertiary);
            opacity: 0.5;
          }

          .date-picker-container .rdp-disabled .rdp-day_button {
            color: var(--text-tertiary);
            opacity: 0.3;
            cursor: not-allowed;
          }

          /* Range start */
          .date-picker-container .rdp-range_start .rdp-day_button {
            background: var(--accent-primary) !important;
            color: #0B1220 !important;
            border-radius: 0.5rem 0 0 0.5rem !important;
          }

          /* Range end */
          .date-picker-container .rdp-range_end .rdp-day_button {
            background: var(--accent-primary) !important;
            color: #0B1220 !important;
            border-radius: 0 0.5rem 0.5rem 0 !important;
          }

          /* Range start + end (same day) */
          .date-picker-container .rdp-range_start.rdp-range_end .rdp-day_button {
            border-radius: 0.5rem !important;
          }

          /* Range middle */
          .date-picker-container .rdp-range_middle .rdp-day_button {
            background: rgba(0, 229, 255, 0.2) !important;
            color: var(--text-primary) !important;
            border-radius: 0 !important;
          }

          .date-picker-container .rdp-range_middle .rdp-day_button:hover {
            background: rgba(0, 229, 255, 0.3) !important;
          }

          /* Selected state */
          .date-picker-container .rdp-selected .rdp-day_button {
            font-weight: 500;
          }

          /* Hide default focus ring, use custom */
          .date-picker-container .rdp-day_button:focus {
            outline: none;
          }

          .date-picker-container .rdp-day_button:focus-visible {
            outline: 2px solid var(--accent-primary);
            outline-offset: 2px;
          }
        `}</style>
        <DayPicker
          mode="range"
          selected={range}
          onSelect={handleSelect}
          numberOfMonths={2}
          locale={dateLocale}
          showOutsideDays
          disabled={{ after: new Date() }}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] flex items-center justify-between gap-3">
        <div className="text-xs text-[var(--text-tertiary)]">
          {getDaysSelected() > 0 && (
            <>{getDaysSelected()} {daysText}</>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tCommon('buttons.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApply}
            disabled={!range?.from}
          >
            {tCommon('buttons.apply')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Dropdown Wrapper Component
// ============================================

interface DateRangeDropdownProps {
  value: { start: Date | null; end: Date | null };
  onChange: (range: { start: Date | null; end: Date | null }) => void;
  isActive: boolean;
  onClick: () => void;
  locale?: 'es' | 'en';
}

export function DateRangeDropdown({
  value,
  onChange,
  isActive,
  onClick,
  locale = 'es',
}: DateRangeDropdownProps) {
  const t = useTranslations('leads');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dateLocale = locale === 'es' ? es : enUS;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleClick = () => {
    setIsOpen(!isOpen);
    onClick();
  };

  const handleChange = (range: { start: Date | null; end: Date | null }) => {
    onChange(range);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Get label for the button
  const getLabel = () => {
    if (value.start && value.end) {
      return `${format(value.start, 'dd MMM', { locale: dateLocale })} - ${format(value.end, 'dd MMM', { locale: dateLocale })}`;
    }
    if (value.start) {
      return format(value.start, 'dd MMM yyyy', { locale: dateLocale });
    }
    return t('dateRange.custom');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
          'transition-all duration-200 ease-out',
          'border border-transparent',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]',
          isActive || isOpen
            ? 'scale-[1.02] shadow-sm bg-[rgba(0,229,255,0.15)] text-[var(--accent-primary)] border-[var(--accent-primary)]'
            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
        )}
      >
        <CalendarIcon className="w-3.5 h-3.5" />
        <span>{getLabel()}</span>
      </button>

      {/* Dropdown - Fixed positioning */}
      {isOpen && (
        <>
          {/* Mobile: Full screen overlay */}
          <div className="fixed inset-0 bg-black/50 z-40 sm:hidden" onClick={handleClose} />

          {/* Mobile: Centered modal */}
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 sm:hidden">
            <DateRangePicker
              value={value}
              onChange={handleChange}
              onClose={handleClose}
              locale={locale}
              className="max-h-[80vh] overflow-y-auto"
            />
          </div>

          {/* Desktop: Dropdown */}
          <div className="hidden sm:block absolute top-full left-0 mt-2 z-50">
            <DateRangePicker
              value={value}
              onChange={handleChange}
              onClose={handleClose}
              locale={locale}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default DateRangePicker;
