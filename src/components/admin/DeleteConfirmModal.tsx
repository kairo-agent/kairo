'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<{ error?: string; success?: boolean }>;
  title: string;
  message: string;
  itemName?: string;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
}: DeleteConfirmModalProps) {
  const tCommon = useTranslations('common.buttons');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Determine if there's a blocking error (dependency error that prevents deletion)
  const hasBlockingError = error.length > 0;

  const handleConfirm = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await onConfirm();
      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    } catch {
      setError('Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="sm"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center text-center py-2">
          {/* Warning icon */}
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          {itemName && (
            <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              {itemName}
            </p>
          )}

          <p className="text-sm text-[var(--text-secondary)]">
            {message}
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-primary)]">
          {hasBlockingError ? (
            // When there's a blocking error, show only the "Understood" button
            <Button type="button" variant="ghost" onClick={handleClose}>
              {tCommon('understood')}
            </Button>
          ) : (
            // Normal state: show Cancel and Delete buttons
            <>
              <Button type="button" variant="ghost" onClick={handleClose}>
                {tCommon('cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirm}
                isLoading={loading}
                className="!bg-red-500 hover:!bg-red-600"
              >
                {tCommon('delete')}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
