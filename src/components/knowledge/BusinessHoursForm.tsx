'use client';

import { useState, useCallback } from 'react';
import {
  type BusinessHoursData,
  type DayOfWeek,
  type HolidayEntry,
  DAYS_OF_WEEK,
  HOLIDAY_PRESETS,
} from '@/lib/knowledge/business-hours';

// =============================================================================
// Types
// =============================================================================

interface BusinessHoursFormProps {
  data: BusinessHoursData;
  onSave: (data: BusinessHoursData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

// =============================================================================
// Labels (hardcoded until i18n is added)
// =============================================================================

const labels = {
  title: 'Horario de Atencion',
  save: 'Guardar',
  cancel: 'Cancelar',
  saving: 'Guardando...',
  open: 'Abierto',
  closed: 'Cerrado',
  copyMondayToWeekdays: 'Copiar Lunes a Mar-Vie',
  holidays: 'Dias Festivos',
  addHoliday: 'Agregar feriado personalizado',
  addFromPresets: 'Agregar desde presets',
  holidayName: 'Nombre del feriado',
  holidayDate: 'Fecha (MM-DD)',
  holidayClosed: 'Cerrado',
  remove: 'Quitar',
  timezone: 'Zona horaria',
  notes: 'Notas adicionales',
  notesPlaceholder: 'Notas sobre horarios especiales, excepciones, etc.',
  notesMax: '500 caracteres max.',
  presetsPeru: 'Peru',
  presetsUSA: 'USA',
  presetsBoth: 'Ambos',
  noPresetsAvailable: 'Todos los presets ya fueron agregados',
  openTime: 'Apertura',
  closeTime: 'Cierre',
};

const DAY_LABELS_ES: Record<DayOfWeek, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miercoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sabado',
  sunday: 'Domingo',
};

// =============================================================================
// Shared Styles
// =============================================================================

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent text-sm';

const timeInputClass =
  'px-2 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent text-sm';

// =============================================================================
// Component
// =============================================================================

export function BusinessHoursForm({
  data,
  onSave,
  onCancel,
  isSaving,
}: BusinessHoursFormProps) {
  const [formData, setFormData] = useState<BusinessHoursData>(() => ({
    ...data,
    schedule: { ...data.schedule },
    holidays: [...data.holidays],
  }));
  const [showPresets, setShowPresets] = useState(false);

  // --- Schedule handlers ---

  const toggleDay = useCallback((day: DayOfWeek) => {
    setFormData((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: { ...prev.schedule[day], open: !prev.schedule[day].open },
      },
    }));
  }, []);

  const updateTime = useCallback(
    (day: DayOfWeek, field: 'openTime' | 'closeTime', value: string) => {
      setFormData((prev) => ({
        ...prev,
        schedule: {
          ...prev.schedule,
          [day]: { ...prev.schedule[day], [field]: value },
        },
      }));
    },
    []
  );

  const copyMondayToWeekdays = useCallback(() => {
    setFormData((prev) => {
      const monday = prev.schedule.monday;
      return {
        ...prev,
        schedule: {
          ...prev.schedule,
          tuesday: { ...monday },
          wednesday: { ...monday },
          thursday: { ...monday },
          friday: { ...monday },
        },
      };
    });
  }, []);

  // --- Holiday handlers ---

  const addCustomHoliday = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      holidays: [
        ...prev.holidays,
        { name: '', date: '', closed: true },
      ],
    }));
  }, []);

  const addPresetHoliday = useCallback(
    (preset: (typeof HOLIDAY_PRESETS)[number]) => {
      setFormData((prev) => {
        const alreadyExists = prev.holidays.some((h) => h.date === preset.date);
        if (alreadyExists) return prev;
        return {
          ...prev,
          holidays: [
            ...prev.holidays,
            { name: preset.nameEs, date: preset.date, closed: true },
          ],
        };
      });
    },
    []
  );

  const updateHoliday = useCallback(
    (index: number, field: keyof HolidayEntry, value: string | boolean) => {
      setFormData((prev) => {
        const updated = [...prev.holidays];
        updated[index] = { ...updated[index], [field]: value };
        return { ...prev, holidays: updated };
      });
    },
    []
  );

  const removeHoliday = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      holidays: prev.holidays.filter((_, i) => i !== index),
    }));
  }, []);

  // --- General fields ---

  const updateField = useCallback(
    (field: 'timezone' | 'notes', value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // --- Save ---

  const handleSave = () => {
    onSave(formData);
  };

  // --- Determine which presets are not yet added ---

  const existingDates = new Set(formData.holidays.map((h) => h.date));
  const availablePresets = HOLIDAY_PRESETS.filter(
    (p) => !existingDates.has(p.date)
  );

  return (
    <div className="space-y-6">
      {/* ---- Weekly Schedule ---- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
            {labels.title}
          </h3>
          <button
            type="button"
            onClick={copyMondayToWeekdays}
            className="text-xs px-3 py-1.5 rounded-md border border-[var(--border-primary)] text-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            {labels.copyMondayToWeekdays}
          </button>
        </div>

        <div className="space-y-2">
          {DAYS_OF_WEEK.map((day) => {
            const sched = formData.schedule[day];
            return (
              <div
                key={day}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg bg-[var(--bg-secondary)]"
              >
                {/* Day name + toggle */}
                <div className="flex items-center justify-between sm:justify-start gap-3 min-w-[140px]">
                  <span className="text-sm font-medium text-[var(--text-primary)] w-24">
                    {DAY_LABELS_ES[day]}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`
                      relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                      border-2 border-transparent transition-colors duration-200 ease-in-out
                      focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2
                      ${sched.open ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-primary)]'}
                    `}
                    role="switch"
                    aria-checked={sched.open}
                    aria-label={`${DAY_LABELS_ES[day]} ${sched.open ? labels.open : labels.closed}`}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full
                        bg-white shadow ring-0 transition duration-200 ease-in-out
                        ${sched.open ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>

                {/* Time pickers */}
                {sched.open ? (
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs text-[var(--text-tertiary)] sr-only">
                      {labels.openTime}
                    </label>
                    <input
                      type="time"
                      value={sched.openTime}
                      onChange={(e) => updateTime(day, 'openTime', e.target.value)}
                      className={timeInputClass}
                      aria-label={`${DAY_LABELS_ES[day]} - ${labels.openTime}`}
                    />
                    <span className="text-[var(--text-tertiary)] text-sm">-</span>
                    <label className="text-xs text-[var(--text-tertiary)] sr-only">
                      {labels.closeTime}
                    </label>
                    <input
                      type="time"
                      value={sched.closeTime}
                      onChange={(e) => updateTime(day, 'closeTime', e.target.value)}
                      className={timeInputClass}
                      aria-label={`${DAY_LABELS_ES[day]} - ${labels.closeTime}`}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-[var(--text-tertiary)] italic">
                    {labels.closed}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Timezone ---- */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[var(--text-primary)]">
          {labels.timezone}
        </label>
        <input
          type="text"
          value={formData.timezone || ''}
          onChange={(e) => updateField('timezone', e.target.value)}
          placeholder="America/Lima (PET)"
          className={inputClass}
        />
      </div>

      {/* ---- Holidays ---- */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          {labels.holidays}
        </h3>

        {/* Existing holidays */}
        {formData.holidays.length > 0 && (
          <div className="space-y-2">
            {formData.holidays.map((holiday, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg bg-[var(--bg-secondary)]"
              >
                <input
                  type="text"
                  value={holiday.name}
                  onChange={(e) => updateHoliday(index, 'name', e.target.value)}
                  placeholder={labels.holidayName}
                  className={`${inputClass} flex-1`}
                  maxLength={100}
                />
                <input
                  type="text"
                  value={holiday.date}
                  onChange={(e) => updateHoliday(index, 'date', e.target.value)}
                  placeholder="MM-DD"
                  className={`${inputClass} w-full sm:w-24`}
                  maxLength={5}
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={holiday.closed}
                      onChange={(e) =>
                        updateHoliday(index, 'closed', e.target.checked)
                      }
                      className="rounded border-[var(--border-primary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                    />
                    {labels.holidayClosed}
                  </label>
                  <button
                    type="button"
                    onClick={() => removeHoliday(index)}
                    className="text-xs px-2 py-1 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                    aria-label={`${labels.remove} ${holiday.name}`}
                  >
                    {labels.remove}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Holiday time pickers for non-closed holidays */}
        {formData.holidays.map((holiday, index) =>
          !holiday.closed ? (
            <div
              key={`time-${index}`}
              className="flex items-center gap-2 pl-3 text-sm text-[var(--text-secondary)]"
            >
              <span className="min-w-[80px] truncate">{holiday.name || `#${index + 1}`}:</span>
              <input
                type="time"
                value={holiday.openTime || '09:00'}
                onChange={(e) => updateHoliday(index, 'openTime', e.target.value)}
                className={timeInputClass}
              />
              <span className="text-[var(--text-tertiary)]">-</span>
              <input
                type="time"
                value={holiday.closeTime || '13:00'}
                onChange={(e) =>
                  updateHoliday(index, 'closeTime', e.target.value)
                }
                className={timeInputClass}
              />
            </div>
          ) : null
        )}

        {/* Add buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addCustomHoliday}
            className="text-sm px-3 py-1.5 rounded-lg border border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            + {labels.addHoliday}
          </button>
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="text-sm px-3 py-1.5 rounded-lg border border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            + {labels.addFromPresets}
          </button>
        </div>

        {/* Presets dropdown */}
        {showPresets && (
          <div className="p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] space-y-2 max-h-60 overflow-y-auto">
            {availablePresets.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] italic">
                {labels.noPresetsAvailable}
              </p>
            ) : (
              <>
                {['PE', 'US', 'both'].map((country) => {
                  const filtered = availablePresets.filter(
                    (p) => p.country === country
                  );
                  if (filtered.length === 0) return null;
                  const countryLabel =
                    country === 'PE'
                      ? labels.presetsPeru
                      : country === 'US'
                        ? labels.presetsUSA
                        : labels.presetsBoth;
                  return (
                    <div key={country}>
                      <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-1">
                        {countryLabel}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {filtered.map((preset) => (
                          <button
                            key={preset.date}
                            type="button"
                            onClick={() => addPresetHoliday(preset)}
                            className="text-xs px-2 py-1 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--accent-primary)] hover:text-[var(--kairo-midnight)] transition-colors"
                          >
                            {preset.nameEs} ({preset.date})
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* ---- Notes ---- */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[var(--text-primary)]">
          {labels.notes}
        </label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder={labels.notesPlaceholder}
          maxLength={500}
          rows={3}
          className={`${inputClass} resize-none`}
        />
        <p className="text-xs text-[var(--text-tertiary)] text-right">
          {(formData.notes || '').length}/500
        </p>
      </div>

      {/* ---- Actions ---- */}
      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-primary)]">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-sm"
        >
          {labels.cancel}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--kairo-midnight)] hover:opacity-90 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {isSaving ? labels.saving : labels.save}
        </button>
      </div>
    </div>
  );
}
