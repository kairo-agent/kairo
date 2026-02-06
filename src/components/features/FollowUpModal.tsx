'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (date: Date) => void;
  onClear?: () => void;
  currentDate?: Date | null;
  leadName: string;
}

export function FollowUpModal({
  isOpen,
  onClose,
  onSchedule,
  onClear,
  currentDate,
  leadName,
}: FollowUpModalProps) {
  const t = useTranslations('leads.followUp');

  // Default to tomorrow 9am
  const getDefaultDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  };

  const initialDate = currentDate ? new Date(currentDate) : getDefaultDate();

  const [selectedDate, setSelectedDate] = useState(
    initialDate.toISOString().slice(0, 16)
  );

  const handleSubmit = () => {
    const date = new Date(selectedDate);
    if (isNaN(date.getTime())) return;
    if (date <= new Date()) return; // Must be in the future
    onSchedule(date);
    onClose();
  };

  const handleClear = () => {
    onClear?.();
    onClose();
  };

  // Minimum date: now
  const minDate = new Date().toISOString().slice(0, 16);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('title')} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          {t('description', { name: leadName })}
        </p>

        {/* Date/Time picker */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
            {t('dateLabel')}
          </label>
          <input
            type="datetime-local"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={minDate}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
          />
        </div>

        {/* Quick options */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: t('tomorrow'), hours: 24 },
            { label: t('in3Days'), hours: 72 },
            { label: t('nextWeek'), hours: 168 },
          ].map((option) => {
            const quickDate = new Date();
            quickDate.setHours(quickDate.getHours() + option.hours);
            quickDate.setMinutes(0, 0, 0);
            return (
              <button
                key={option.hours}
                type="button"
                onClick={() => setSelectedDate(quickDate.toISOString().slice(0, 16))}
                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {currentDate && onClear && (
            <Button variant="ghost" onClick={handleClear} className="text-red-500">
              {t('clear')}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {t('schedule')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
