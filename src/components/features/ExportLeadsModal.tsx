'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { exportLeadsToExcel } from '@/lib/actions/leads';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import 'react-day-picker/style.css';

interface ExportLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  organizationId?: string;
}

export function ExportLeadsModal({
  isOpen,
  onClose,
  projectId,
  organizationId,
}: ExportLeadsModalProps) {
  const t = useTranslations('leads');
  const locale = useLocale() as 'es' | 'en';
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const dateLocale = locale === 'es' ? es : enUS;
  const isEs = locale === 'es';

  // Close picker on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActivePicker(null);
      }
    }
    if (activePicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activePicker]);

  const handleStartSelect = useCallback((date: Date | undefined) => {
    if (!date) return;
    setStartDate(date);
    // If end date is before new start, clear it
    if (endDate && date > endDate) setEndDate(undefined);
    // Auto-advance to end picker
    setTimeout(() => setActivePicker('end'), 150);
  }, [endDate]);

  const handleEndSelect = useCallback((date: Date | undefined) => {
    if (!date) return;
    setEndDate(date);
    setActivePicker(null);
  }, []);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error(isEs ? 'Selecciona ambas fechas' : 'Select both dates');
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportLeadsToExcel(
        projectId,
        organizationId,
        startDate.toISOString(),
        endDate.toISOString(),
        locale
      );

      if (!result.success || !result.data) {
        toast.error(result.error || (isEs ? 'Error al exportar' : 'Export failed'));
        return;
      }

      const byteCharacters = atob(result.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || 'leads.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(isEs ? `${result.count} leads exportados` : `${result.count} leads exported`);
      onClose();
    } catch {
      toast.error(isEs ? 'Error al exportar' : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      setStartDate(undefined);
      setEndDate(undefined);
      setActivePicker(null);
      onClose();
    }
  };

  const formatDisplay = (date: Date | undefined, placeholder: string) => {
    if (!date) return placeholder;
    return format(date, 'dd MMM yyyy', { locale: dateLocale });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('export.title')} size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-secondary)]">
          {t('export.description')}
        </p>

        {/* Date selector inputs - relative container for floating calendar */}
        <div className="relative" ref={containerRef}>
          <div className="flex gap-3">
            {/* From */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {isEs ? 'Desde' : 'From'}
              </label>
              <button
                type="button"
                onClick={() => setActivePicker(activePicker === 'start' ? null : 'start')}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border transition-all text-left',
                  activePicker === 'start'
                    ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20 bg-[var(--bg-secondary)]'
                    : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--text-tertiary)]',
                  startDate ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
                )}
              >
                <CalendarIcon className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                {formatDisplay(startDate, isEs ? 'Seleccionar' : 'Select')}
              </button>
            </div>

            {/* Arrow */}
            <div className="flex items-end pb-3">
              <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>

            {/* To */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {isEs ? 'Hasta' : 'To'}
              </label>
              <button
                type="button"
                onClick={() => setActivePicker(activePicker === 'end' ? null : 'end')}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border transition-all text-left',
                  activePicker === 'end'
                    ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20 bg-[var(--bg-secondary)]'
                    : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--text-tertiary)]',
                  endDate ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
                )}
              >
                <CalendarIcon className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                {formatDisplay(endDate, isEs ? 'Seleccionar' : 'Select')}
              </button>
            </div>
          </div>

          {/* Floating calendar (absolute, outside modal flow) */}
          {activePicker && (
            <div className="absolute left-0 right-0 top-full mt-2 z-50 export-date-picker rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-2xl overflow-hidden">
              <div className="px-3 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <span className="text-xs font-medium text-[var(--accent-primary)]">
                  {activePicker === 'start'
                    ? (isEs ? 'Fecha de inicio' : 'Start date')
                    : (isEs ? 'Fecha de fin' : 'End date')
                  }
                </span>
              </div>
              <div className="p-3 flex justify-center">
                <style jsx global>{`
                  .export-date-picker .rdp {
                    --rdp-accent-color: var(--accent-primary);
                    --rdp-accent-background-color: rgba(0, 229, 255, 0.15);
                    --rdp-day-height: 36px;
                    --rdp-day-width: 36px;
                    margin: 0;
                  }
                  .export-date-picker .rdp-root {
                    display: flex;
                    flex-direction: column;
                  }
                  .export-date-picker .rdp-month {
                    background: transparent;
                  }
                  .export-date-picker .rdp-month_caption {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 0.25rem 0 0.5rem;
                  }
                  .export-date-picker .rdp-caption_label {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    text-transform: capitalize;
                  }
                  .export-date-picker .rdp-nav {
                    display: flex;
                    gap: 0.25rem;
                  }
                  .export-date-picker .rdp-button_previous,
                  .export-date-picker .rdp-button_next {
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
                  .export-date-picker .rdp-button_previous:hover,
                  .export-date-picker .rdp-button_next:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                  }
                  .export-date-picker .rdp-weekdays {
                    display: flex;
                  }
                  .export-date-picker .rdp-weekday {
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
                  .export-date-picker .rdp-weeks {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                  }
                  .export-date-picker .rdp-week {
                    display: flex;
                  }
                  .export-date-picker .rdp-day {
                    width: var(--rdp-day-width);
                    height: var(--rdp-day-height);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  }
                  .export-date-picker .rdp-day_button {
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
                  .export-date-picker .rdp-day_button:hover:not(:disabled) {
                    background: var(--bg-hover);
                  }
                  .export-date-picker .rdp-today .rdp-day_button {
                    border: 1px solid var(--accent-primary);
                  }
                  .export-date-picker .rdp-outside .rdp-day_button {
                    color: var(--text-tertiary);
                    opacity: 0.5;
                  }
                  .export-date-picker .rdp-disabled .rdp-day_button {
                    color: var(--text-tertiary);
                    opacity: 0.3;
                    cursor: not-allowed;
                  }
                  .export-date-picker .rdp-selected .rdp-day_button {
                    background: var(--accent-primary) !important;
                    color: #0B1220 !important;
                    font-weight: 500;
                  }
                  .export-date-picker .rdp-day_button:focus {
                    outline: none;
                  }
                  .export-date-picker .rdp-day_button:focus-visible {
                    outline: 2px solid var(--accent-primary);
                    outline-offset: 2px;
                  }
                `}</style>
                <DayPicker
                  mode="single"
                  selected={activePicker === 'start' ? startDate : endDate}
                  onSelect={activePicker === 'start' ? handleStartSelect : handleEndSelect}
                  locale={dateLocale}
                  numberOfMonths={1}
                  showOutsideDays
                  disabled={
                    activePicker === 'start'
                      ? { after: new Date() }
                      : { before: startDate || undefined, after: new Date() }
                  }
                  defaultMonth={
                    activePicker === 'end' && startDate ? startDate : undefined
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-primary)]">
          <Button variant="ghost" onClick={handleClose} disabled={isExporting}>
            {t('export.cancel')}
          </Button>
          <button
            onClick={handleExport}
            disabled={!startDate || !endDate || isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#217346] hover:bg-[#1a5c38] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ExcelIcon className="w-4 h-4" />
            {isExporting ? t('export.exporting') : t('export.download')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('w-4 h-4', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ExcelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.17 3H7.83A1.83 1.83 0 0 0 6 4.83v2.34L14.58 9 6 13.83v2.34A1.83 1.83 0 0 0 7.83 18h13.34A1.83 1.83 0 0 0 23 16.17V4.83A1.83 1.83 0 0 0 21.17 3zM15 15h-2.5l-2-3.5L8.5 15H6l3.25-5L6 5h2.5l2 3.5L12.5 5H15l-3.25 5L15 15z" />
      <path d="M1 5v14h5v-2H3V7h3V5H1z" />
    </svg>
  );
}
