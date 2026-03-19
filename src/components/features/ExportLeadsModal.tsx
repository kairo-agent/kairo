'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
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
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!dateRange.start || !dateRange.end) {
      toast.error(locale === 'es' ? 'Selecciona un rango de fechas' : 'Select a date range');
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportLeadsToExcel(
        projectId,
        organizationId,
        dateRange.start.toISOString(),
        dateRange.end.toISOString(),
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
      setDateRange({ start: null, end: null });
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('export.title')} size="lg">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-secondary)]">
          {t('export.description')}
        </p>

        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          locale={locale}
        />

        <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border-primary)]">
          <Button variant="ghost" onClick={handleClose} disabled={isExporting}>
            {t('export.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={!dateRange.start || !dateRange.end || isExporting}
            isLoading={isExporting}
          >
            <ExcelIcon className="w-4 h-4" />
            {isExporting ? t('export.exporting') : t('export.download')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ExcelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="10" y1="9" x2="10" y2="9" />
    </svg>
  );
}
