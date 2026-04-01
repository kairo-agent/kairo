'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

// SVG Icons
const BellRingIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    <path d="M2 8c0-2.2.7-4.3 2-6" />
    <path d="M22 8a10 10 0 0 0-2-6" />
  </svg>
);

interface PushPermissionModalProps {
  onAccept: () => Promise<void>;
  onDismiss: () => void;
}

export default function PushPermissionModal({ onAccept, onDismiss }: PushPermissionModalProps) {
  const t = useTranslations('pushNotifications');
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    await onAccept();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onDismiss} />

      {/* Modal */}
      <div className="relative bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-[var(--kairo-cyan)]/10 flex items-center justify-center text-[var(--accent-text)]">
            <BellRingIcon />
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {t('modal.title')}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {t('modal.description')}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            onClick={handleAccept}
            isLoading={loading}
            className="w-full"
          >
            {t('modal.accept')}
          </Button>
          <button
            onClick={onDismiss}
            disabled={loading}
            className="w-full py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg"
          >
            {t('modal.dismiss')}
          </button>
        </div>

        {/* Note */}
        <p className="text-xs text-[var(--text-tertiary)] text-center">
          {t('modal.browserNote')}
        </p>
      </div>
    </div>
  );
}
