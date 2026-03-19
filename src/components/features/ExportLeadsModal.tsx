'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { exportLeadsToExcel } from '@/lib/actions/leads';
import { toast } from 'sonner';

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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Today in YYYY-MM-DD for max attribute
  const today = new Date().toISOString().slice(0, 10);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error(locale === 'es' ? 'Selecciona ambas fechas' : 'Select both dates');
      return;
    }

    if (startDate > endDate) {
      toast.error(locale === 'es' ? 'La fecha inicial no puede ser mayor a la final' : 'Start date cannot be after end date');
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportLeadsToExcel(
        projectId,
        organizationId,
        new Date(startDate).toISOString(),
        new Date(endDate).toISOString(),
        locale
      );

      if (!result.success || !result.data) {
        toast.error(result.error || (locale === 'es' ? 'Error al exportar' : 'Export failed'));
        return;
      }

      // Convert base64 to blob and download
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

      toast.success(
        locale === 'es'
          ? `${result.count} leads exportados`
          : `${result.count} leads exported`
      );
      onClose();
    } catch {
      toast.error(locale === 'es' ? 'Error al exportar' : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      setStartDate('');
      setEndDate('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('export.title')} size="sm">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-[var(--text-secondary)]">
          {t('export.description')}
        </p>

        {/* Date inputs */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {locale === 'es' ? 'Desde' : 'From'}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate || today}
              className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all [color-scheme:dark]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {locale === 'es' ? 'Hasta' : 'To'}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              max={today}
              className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all [color-scheme:dark]"
            />
          </div>
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

function ExcelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.17 3H7.83A1.83 1.83 0 0 0 6 4.83v2.34L14.58 9 6 13.83v2.34A1.83 1.83 0 0 0 7.83 18h13.34A1.83 1.83 0 0 0 23 16.17V4.83A1.83 1.83 0 0 0 21.17 3zM15 15h-2.5l-2-3.5L8.5 15H6l3.25-5L6 5h2.5l2 3.5L12.5 5H15l-3.25 5L15 15z" />
      <path d="M1 5v14h5v-2H3V7h3V5H1z" />
    </svg>
  );
}
