'use client';

/**
 * ReEngagementTab — Componente compartido para configurar reengagement.
 *
 * Movido aqui desde SettingsPageClient.tsx (Fase 2.2a) para poder reusarse
 * en `/settings/whatsapp`. La logica del agente (state, load, save) la maneja
 * el caller.
 *
 * Decision #4: reengagement es WhatsApp-only.
 */

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { ExpandableTextarea } from '@/components/ui/ExpandableTextarea';
import { FixedImageSlot } from '@/components/knowledge/FixedImageSlot';
import { FixedVideoSlot } from '@/components/knowledge/FixedVideoSlot';
import { generateTimeOptions, getWindowDurationHours, type ReEngagementConfig } from '@/lib/types/reengagement';

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export function ReEngagementTab({
  config,
  setConfig,
  loading,
  saving,
  hasUnsavedChanges,
  onSave,
  agentId,
  projectId,
}: {
  config: ReEngagementConfig;
  setConfig: React.Dispatch<React.SetStateAction<ReEngagementConfig>>;
  loading: boolean;
  saving: boolean;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  agentId?: string;
  projectId?: string;
}) {
  const t = useTranslations('settings');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const delayOptions = Array.from({ length: 5 }, (_, i) => i + 1);
  const timeOptions = generateTimeOptions();
  const windowStart = config.sendWindowStart || '17:00';
  const windowEnd = config.sendWindowEnd || '23:00';
  const windowDuration = getWindowDurationHours(windowStart, windowEnd);
  const isWindowTooSmall = windowDuration <= config.delayHours;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {t('reengagement.title')}
        </h3>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t('reengagement.description')}
        </p>
      </div>

      {/* Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {t('reengagement.enabled')}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {t('reengagement.enabledHelp')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            config.enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]'
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              config.enabled ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {config.enabled && (
        <div className="space-y-4">
          {/* Delay Dropdown */}
          <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              {t('reengagement.delay')}
            </label>
            <p className="text-xs text-[var(--text-tertiary)] mb-3">
              {t('reengagement.delayHelp')}
            </p>
            <select
              value={config.delayHours}
              onChange={(e) => setConfig(prev => ({ ...prev, delayHours: Number(e.target.value) }))}
              className="w-full sm:w-48 px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
            >
              {delayOptions.map((h) => (
                <option key={h} value={h}>
                  {h} {t('reengagement.delayUnit')}
                </option>
              ))}
            </select>
          </div>

          {/* Send Window */}
          <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              {t('reengagement.sendWindow')}
            </label>
            <p className="text-xs text-[var(--text-tertiary)] mb-3">
              {t('reengagement.sendWindowHelp')}
            </p>
            <div className="flex items-center gap-3">
              <select
                value={windowStart}
                onChange={(e) => setConfig(prev => ({ ...prev, sendWindowStart: e.target.value }))}
                className="w-36 px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
              >
                {timeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span className="text-sm text-[var(--text-tertiary)]">→</span>
              <select
                value={windowEnd}
                onChange={(e) => setConfig(prev => ({ ...prev, sendWindowEnd: e.target.value }))}
                className="w-36 px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
              >
                {timeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {isWindowTooSmall && (
              <p className="text-xs text-red-500 mt-2">
                {t('reengagement.sendWindowWarning', { minHours: config.delayHours + 1 })}
              </p>
            )}
          </div>

          {/* Prompt Template (Initial ReEngagement) */}
          <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              {t('reengagement.promptTemplate')}
            </label>
            <p className="text-xs text-[var(--text-tertiary)] mb-3">
              {t('reengagement.promptTemplateHelp')}
            </p>
            <ExpandableTextarea
              value={config.promptTemplate}
              onChange={(val) => setConfig(prev => ({ ...prev, promptTemplate: val }))}
              placeholder={t('reengagement.promptTemplatePlaceholder')}
              rows={4}
              maxLength={1000}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent resize-none"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1 text-right">
              {config.promptTemplate.length}/1000
            </p>
            {agentId && projectId && (
              <div className="mt-3 space-y-2">
                <FixedImageSlot
                  eventType="reengagement_0"
                  agentId={agentId}
                  projectId={projectId}
                  label={t('fixedImage.label')}
                  helpText={t('fixedImage.reengagementHelp')}
                />
                <FixedVideoSlot
                  eventType="reengagement_0_video"
                  agentId={agentId}
                  projectId={projectId}
                  label="Video de seguimiento inicial"
                  helpText="Se enviara despues de la imagen, antes del texto"
                />
              </div>
            )}
          </div>

          {/* Follow-up Attempts Section */}
          <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              {t('reengagement.followUpAttempts')}
            </label>
            <p className="text-xs text-[var(--text-tertiary)] mb-3">
              {t('reengagement.followUpAttemptsHelp')}
            </p>
            <select
              value={config.maxAttempts ?? 2}
              onChange={(e) => setConfig(prev => ({ ...prev, maxAttempts: Number(e.target.value) }))}
              className="w-full sm:w-48 px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
            >
              <option value={0}>{t('reengagement.noFollowUps')}</option>
              <option value={1}>1 {t('reengagement.followUp')}</option>
              <option value={2}>2 {t('reengagement.followUps')}</option>
            </select>
          </div>

          {/* Attempt 1 Instructions */}
          {(config.maxAttempts ?? 2) >= 1 && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                {t('reengagement.attempt1Title')}
              </label>
              <p className="text-xs text-[var(--text-tertiary)] mb-3">
                {t('reengagement.attempt1Help')}
              </p>
              <ExpandableTextarea
                value={config.attempt1Instructions || ''}
                onChange={(val) => setConfig(prev => ({ ...prev, attempt1Instructions: val }))}
                placeholder={t('reengagement.attempt1Placeholder')}
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent resize-none"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1 text-right">
                {(config.attempt1Instructions || '').length}/500
              </p>
              {agentId && projectId && (
                <div className="mt-3 space-y-2">
                  <FixedImageSlot
                    eventType="reengagement_1"
                    agentId={agentId}
                    projectId={projectId}
                    label={t('fixedImage.label')}
                    helpText={t('fixedImage.reengagementHelp')}
                  />
                  <FixedVideoSlot
                    eventType="reengagement_1_video"
                    agentId={agentId}
                    projectId={projectId}
                    label="Video de seguimiento #1"
                    helpText="Se enviara despues de la imagen, antes del texto"
                  />
                </div>
              )}
            </div>
          )}

          {/* Attempt 2 Instructions */}
          {(config.maxAttempts ?? 2) >= 2 && (
            <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/5">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                {t('reengagement.attempt2Title')}
              </label>
              <p className="text-xs text-[var(--text-tertiary)] mb-3">
                {t('reengagement.attempt2Help')}
              </p>
              <ExpandableTextarea
                value={config.attempt2Instructions || ''}
                onChange={(val) => setConfig(prev => ({ ...prev, attempt2Instructions: val }))}
                placeholder={t('reengagement.attempt2Placeholder')}
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent resize-none"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1 text-right">
                {(config.attempt2Instructions || '').length}/500
              </p>
              {agentId && projectId && (
                <div className="mt-3 space-y-2">
                  <FixedImageSlot
                    eventType="reengagement_2"
                    agentId={agentId}
                    projectId={projectId}
                    label={t('fixedImage.label')}
                    helpText={t('fixedImage.reengagementHelp')}
                  />
                  <FixedVideoSlot
                    eventType="reengagement_2_video"
                    agentId={agentId}
                    projectId={projectId}
                    label="Video de seguimiento #2"
                    helpText="Se enviara despues de la imagen, antes del texto"
                  />
                </div>
              )}
            </div>
          )}

          {/* Info Notes */}
          <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
            <div className="flex items-start gap-2">
              <ClockIcon className="w-4 h-4 text-[var(--text-tertiary)] mt-0.5 flex-shrink-0" />
              <div className="space-y-1.5">
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t('reengagement.sendWindowNote', {
                    start: timeOptions.find(o => o.value === windowStart)?.label || windowStart,
                    end: timeOptions.find(o => o.value === windowEnd)?.label || windowEnd,
                  })}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t('reengagement.antiSpamNote')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      {hasUnsavedChanges && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={onSave} disabled={saving || isWindowTooSmall} isLoading={saving}>
            {t('reengagement.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
