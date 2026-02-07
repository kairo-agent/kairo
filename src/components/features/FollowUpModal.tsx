'use client';

import { useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import 'react-day-picker/style.css';

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
  const locale = useLocale();
  const dateLocale = locale === 'es' ? es : enUS;

  // Default to tomorrow 9am
  const getDefaultDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  };

  const initialDate = currentDate ? new Date(currentDate) : getDefaultDate();

  const [selectedDay, setSelectedDay] = useState<Date>(initialDate);
  const [selectedHour, setSelectedHour] = useState(initialDate.getHours());
  const [selectedMinute, setSelectedMinute] = useState(initialDate.getMinutes());

  const now = new Date();
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  // Check if selected day is today
  const isToday = selectedDay.toDateString() === now.toDateString();

  // When today is selected, only allow future hours
  const minHour = isToday ? now.getHours() + 1 : 0;

  const handleDaySelect = useCallback((day: Date | undefined) => {
    if (day) {
      setSelectedDay(day);
      // If selecting today, auto-adjust hour to next valid hour
      const currentNow = new Date();
      if (day.toDateString() === currentNow.toDateString()) {
        const nextHour = currentNow.getHours() + 1;
        if (selectedHour < nextHour) {
          setSelectedHour(Math.min(nextHour, 23));
          setSelectedMinute(0);
        }
      }
    }
  }, [selectedHour]);

  const handleQuickOption = useCallback((hours: number) => {
    const quickDate = new Date();
    quickDate.setHours(quickDate.getHours() + hours);
    quickDate.setMinutes(0, 0, 0);
    setSelectedDay(quickDate);
    setSelectedHour(quickDate.getHours());
    setSelectedMinute(0);
  }, []);

  const handleSubmit = () => {
    const date = new Date(selectedDay);
    date.setHours(selectedHour, selectedMinute, 0, 0);
    if (date <= new Date()) return;
    onSchedule(date);
    onClose();
  };

  const handleClear = () => {
    onClear?.();
    onClose();
  };

  // Build the final date for display
  const finalDate = new Date(selectedDay);
  finalDate.setHours(selectedHour, selectedMinute, 0, 0);
  const isValidFuture = finalDate > new Date();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('title')} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          {t('description', { name: leadName })}
        </p>

        {/* Quick options */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: t('in1Hour'), hours: 1 },
            { label: t('in3Hours'), hours: 3 },
            { label: t('tomorrow'), hours: 24 },
            { label: t('in3Days'), hours: 72 },
            { label: t('nextWeek'), hours: 168 },
          ].map((option) => (
            <button
              key={option.hours}
              type="button"
              onClick={() => handleQuickOption(option.hours)}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]/30 transition-colors"
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Calendar */}
        <div className="follow-up-calendar flex justify-center">
          <style jsx global>{`
            .follow-up-calendar .rdp {
              --rdp-accent-color: var(--accent-primary);
              --rdp-accent-background-color: rgba(0, 229, 255, 0.15);
              --rdp-background-color: var(--bg-primary);
              --rdp-day-height: 36px;
              --rdp-day-width: 36px;
              margin: 0;
            }
            .follow-up-calendar .rdp-root {
              display: flex;
              flex-direction: column;
            }
            .follow-up-calendar .rdp-month {
              background: transparent;
            }
            .follow-up-calendar .rdp-month_caption {
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 0.25rem 0;
            }
            .follow-up-calendar .rdp-caption_label {
              font-size: 0.875rem;
              font-weight: 600;
              color: var(--text-primary);
              text-transform: capitalize;
            }
            .follow-up-calendar .rdp-nav {
              display: flex;
              gap: 0.25rem;
            }
            .follow-up-calendar .rdp-button_previous,
            .follow-up-calendar .rdp-button_next {
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
            .follow-up-calendar .rdp-button_previous:hover,
            .follow-up-calendar .rdp-button_next:hover {
              background: var(--bg-hover);
              color: var(--text-primary);
            }
            .follow-up-calendar .rdp-weekdays {
              display: flex;
            }
            .follow-up-calendar .rdp-weekday {
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
            .follow-up-calendar .rdp-weeks {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }
            .follow-up-calendar .rdp-week {
              display: flex;
            }
            .follow-up-calendar .rdp-day {
              width: var(--rdp-day-width);
              height: var(--rdp-day-height);
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .follow-up-calendar .rdp-day_button {
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
            .follow-up-calendar .rdp-day_button:hover:not(:disabled) {
              background: var(--bg-hover);
            }
            .follow-up-calendar .rdp-today .rdp-day_button {
              border: 1px solid var(--accent-primary);
            }
            .follow-up-calendar .rdp-outside .rdp-day_button {
              color: var(--text-tertiary);
              opacity: 0.5;
            }
            .follow-up-calendar .rdp-disabled .rdp-day_button {
              color: var(--text-tertiary);
              opacity: 0.3;
              cursor: not-allowed;
            }
            .follow-up-calendar .rdp-selected .rdp-day_button {
              background: var(--accent-primary) !important;
              color: #0B1220 !important;
              font-weight: 600;
              border-radius: 0.5rem !important;
            }
            .follow-up-calendar .rdp-day_button:focus {
              outline: none;
            }
            .follow-up-calendar .rdp-day_button:focus-visible {
              outline: 2px solid var(--accent-primary);
              outline-offset: 2px;
            }
          `}</style>
          <DayPicker
            mode="single"
            selected={selectedDay}
            onSelect={handleDaySelect}
            locale={dateLocale}
            showOutsideDays
            disabled={{ before: todayMidnight }}
          />
        </div>

        {/* Time selector */}
        <div className="flex items-center gap-3 px-1">
          <label className="text-sm font-medium text-[var(--text-primary)] whitespace-nowrap">
            {t('dateLabel')}:
          </label>
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            <select
              value={selectedHour}
              onChange={(e) => setSelectedHour(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm text-center appearance-none cursor-pointer min-w-[52px]"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i} disabled={i < minHour}>
                  {i.toString().padStart(2, '0')}
                </option>
              ))}
            </select>
            <span className="text-lg font-bold text-[var(--text-secondary)]">:</span>
            <select
              value={selectedMinute}
              onChange={(e) => setSelectedMinute(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm text-center appearance-none cursor-pointer min-w-[52px]"
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  {m.toString().padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected date preview */}
        {isValidFuture && (
          <div className="text-center text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] rounded-lg py-2">
            {format(finalDate, "EEEE d 'de' MMMM, HH:mm", { locale: dateLocale })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {currentDate && onClear && (
            <Button variant="ghost" onClick={handleClear} className="text-red-500">
              {t('clear')}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!isValidFuture}>
            {t('schedule')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
