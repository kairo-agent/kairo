'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  getProjectChannelInfo,
  setChannelEnabled,
  saveWebChatConfig,
} from '@/lib/actions/project-channels';
import type { ProjectChannelInfo } from '@/lib/types/project-channel';
import {
  DEFAULT_WEBCHAT_CONFIG,
  mergeWebChatConfig,
  type WebChatConfig,
} from '@/lib/types/webchat-config';
import { CollapsibleCard } from '@/components/settings/webchat/CollapsibleCard';
import { AppearanceForm } from '@/components/settings/webchat/AppearanceForm';
import { TextsForm } from '@/components/settings/webchat/TextsForm';
import { StarterQuestionsEditor } from '@/components/settings/webchat/StarterQuestionsEditor';
import { BehaviorForm } from '@/components/settings/webchat/BehaviorForm';
import { DomainsForm } from '@/components/settings/webchat/DomainsForm';
import { EmbedCodeCard } from '@/components/settings/webchat/EmbedCodeCard';
import { WidgetPreview } from '@/components/settings/webchat/WidgetPreview';

/**
 * `/settings/webchat` — configuracion del canal WebChat para owner/admin.
 *
 * Fase 3 (v0.25.0): pagina completa con 7 forms (apariencia, textos, starter
 * questions, behavior, allowed origins, embed code, preview).
 *
 * Patron de save: explicito (decision #12). hasUnsavedChanges via deep compare
 * de JSON. Boton sticky bottom solo visible cuando hay cambios.
 */
export default function WebChatSettingsPage() {
  const locale = useLocale() as 'es' | 'en';
  const { selectedProject, mounted } = useWorkspace();
  const [info, setInfo] = useState<ProjectChannelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Config state (separado del toggle)
  const [config, setConfig] = useState<WebChatConfig>(DEFAULT_WEBCHAT_CONFIG);
  const [originalConfig, setOriginalConfig] = useState<WebChatConfig>(DEFAULT_WEBCHAT_CONFIG);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadInfo = useCallback(() => {
    if (!selectedProject?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getProjectChannelInfo(selectedProject.id, 'webchat')
      .then((result) => {
        if (result.success) {
          setInfo(result.data);
          const merged = mergeWebChatConfig(result.data.config);
          setConfig(merged);
          setOriginalConfig(merged);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedProject?.id]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const handleToggle = useCallback(async () => {
    if (!selectedProject?.id || !info?.exists || savingToggle) return;
    setSavingToggle(true);
    const newEnabled = !info.enabled;
    const result = await setChannelEnabled(selectedProject.id, 'webchat', newEnabled);
    if (result.success) {
      setInfo({ ...info, enabled: newEnabled });
      showToast('success', newEnabled ? 'Widget visible' : 'Widget oculto');
    } else {
      showToast('error', result.error);
    }
    setSavingToggle(false);
  }, [selectedProject?.id, info, savingToggle, showToast]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(originalConfig),
    [config, originalConfig]
  );

  const handleSave = useCallback(async () => {
    if (!selectedProject?.id || !hasUnsavedChanges || savingConfig) return;
    setSavingConfig(true);
    const result = await saveWebChatConfig(selectedProject.id, config);
    if (result.success) {
      setOriginalConfig(config);
      showToast('success', 'Configuracion guardada');
    } else {
      showToast('error', result.error);
    }
    setSavingConfig(false);
  }, [selectedProject?.id, config, hasUnsavedChanges, savingConfig, showToast]);

  const handleDiscard = useCallback(() => {
    setConfig(originalConfig);
  }, [originalConfig]);

  // Pre-mount: avoid empty-state flash mientras WorkspaceContext lee localStorage
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-[var(--text-secondary)]">Selecciona un proyecto para configurar el canal Web.</p>
        <Link
          href="/select-workspace"
          className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--kairo-midnight)] font-medium hover:opacity-90"
        >
          Ir al selector de workspace
        </Link>
      </div>
    );
  }

  const channelNotProvisioned = !loading && info && !info.exists;

  return (
    <div className="p-4 sm:p-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Web (WebChat)</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Configuracion del widget WebChat embebible para este proyecto.
        </p>
      </div>

      {/* Toggle Mostrar/Ocultar (decision #17 — preservado de Fase 2) */}
      <div className="mb-6 p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              Mostrar / Ocultar widget
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Cuando esta oculto, el widget no se monta en tu sitio web. Las
              conversaciones existentes se preservan y los visitantes con
              sesion activa pueden completar su chat.
            </p>
          </div>

          {loading ? (
            <div className="w-11 h-6 rounded-full bg-[var(--bg-tertiary)] animate-pulse" />
          ) : !info?.exists ? (
            <span className="text-xs text-[var(--text-tertiary)] italic">No habilitado</span>
          ) : (
            <button
              type="button"
              onClick={handleToggle}
              disabled={savingToggle || !info.provisioned}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
                info.enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]',
                (savingToggle || !info.provisioned) && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                  info.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                )}
              />
            </button>
          )}
        </div>
      </div>

      {/* Si el canal no esta provisionado, mostrar empty state — el resto va deshabilitado */}
      {channelNotProvisioned ? (
        <div className="rounded-lg border border-dashed border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6 text-center">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Canal no contratado</h3>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Contacta al equipo de KAIRO para activar el canal WebChat en este proyecto.
          </p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* 3.1 Apariencia */}
          <CollapsibleCard
            title="Apariencia"
            description="Colores, posicion, forma del boton y logo del widget."
            defaultOpen
          >
            <AppearanceForm
              value={config.appearance}
              onChange={(appearance) => setConfig((c) => ({ ...c, appearance }))}
            />
          </CollapsibleCard>

          {/* 3.2 Textos */}
          <CollapsibleCard
            title="Textos"
            description="Titulo, subtitulo y teaser bilingue (es / en)."
          >
            <TextsForm
              value={config.texts}
              onChange={(texts) => setConfig((c) => ({ ...c, texts }))}
            />
          </CollapsibleCard>

          {/* 3.3 Starter Questions */}
          <CollapsibleCard
            title="Preguntas sugeridas"
            description="Botones de pregunta rapida al abrir el widget (max 5)."
            badge={
              <span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                {config.starterQuestions.length}/5
              </span>
            }
          >
            <StarterQuestionsEditor
              value={config.starterQuestions}
              onChange={(starterQuestions) => setConfig((c) => ({ ...c, starterQuestions }))}
            />
          </CollapsibleCard>

          {/* 3.4 Behavior */}
          <CollapsibleCard
            title="Comportamiento"
            description="Auto-abrir, sonido al recibir mensajes y duracion de sesion."
          >
            <BehaviorForm
              value={config.behavior}
              onChange={(behavior) => setConfig((c) => ({ ...c, behavior }))}
            />
          </CollapsibleCard>

          {/* 3.5 Allowed Origins */}
          <CollapsibleCard
            title="Dominios autorizados"
            description="Lista de sitios donde el widget puede embeberse (CORS)."
            badge={
              <span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                {config.allowedOrigins.length}
              </span>
            }
          >
            <DomainsForm
              value={config.allowedOrigins}
              onChange={(allowedOrigins) => setConfig((c) => ({ ...c, allowedOrigins }))}
            />
          </CollapsibleCard>

          {/* 3.6 Embed Code */}
          <CollapsibleCard
            title="Codigo de instalacion"
            description="Copia este snippet en tu sitio web para mostrar el widget."
          >
            <EmbedCodeCard publicKey={info?.publicKey ?? null} />
          </CollapsibleCard>

          {/* 3.7 Preview */}
          <CollapsibleCard
            title="Preview en vivo"
            description="Visualizacion del widget con la configuracion actual."
            defaultOpen
          >
            <WidgetPreview config={config} locale={locale} />
          </CollapsibleCard>
        </div>
      )}

      {/* Sticky save bar */}
      {!channelNotProvisioned && hasUnsavedChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]/95 backdrop-blur-sm px-4 py-3 sm:px-6 lg:left-64">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              <span className="hidden sm:inline">Tienes cambios sin guardar.</span>
              <span className="sm:hidden">Cambios pendientes</span>
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={savingConfig}>
                Descartar
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} isLoading={savingConfig}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3 shadow-lg">
          <p
            className={cn(
              'text-sm font-medium',
              toast.type === 'success' ? 'text-green-500' : 'text-red-500'
            )}
          >
            {toast.message}
          </p>
        </div>
      )}
    </div>
  );
}
