'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { getProjectChannelInfo, setChannelEnabled } from '@/lib/actions/project-channels';
import type { ProjectChannelInfo } from '@/lib/types/project-channel';

/**
 * `/settings/webchat` — configuracion del canal WebChat para el owner/admin.
 *
 * Estado actual (Fase 2 scaffolding nocturno): placeholder con toggle
 * "Mostrar / Ocultar" (decision #17 del plan). La configuracion real
 * (apariencia, textos, starter questions, behavior, allowed origins, embed
 * code, preview) se construye en Fase 3 cuando habilitemos el widget MVP.
 */
export default function WebChatSettingsPage() {
  const { selectedProject } = useWorkspace();
  const [info, setInfo] = useState<ProjectChannelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedProject?.id]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const handleToggle = useCallback(async () => {
    if (!selectedProject?.id || !info?.exists || saving) return;
    setSaving(true);
    const newEnabled = !info.enabled;
    const result = await setChannelEnabled(selectedProject.id, 'webchat', newEnabled);
    if (result.success) {
      setInfo({ ...info, enabled: newEnabled });
      setToast({ type: 'success', message: newEnabled ? 'Widget visible' : 'Widget oculto' });
    } else {
      setToast({ type: 'error', message: result.error });
    }
    setSaving(false);
    setTimeout(() => setToast(null), 3000);
  }, [selectedProject?.id, info, saving]);

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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Web</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Configuración del widget WebChat embebible para este proyecto.
        </p>
      </div>

      {/* Toggle Mostrar/Ocultar (decision #17) */}
      <div className="mb-6 p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              Mostrar / Ocultar widget
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Cuando está oculto, el widget no se monta en tu sitio web. Las
              conversaciones existentes se preservan y los visitantes con
              sesión activa pueden completar su chat.
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
              disabled={saving || !info.provisioned}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
                info.enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]',
                (saving || !info.provisioned) && 'opacity-50 cursor-not-allowed'
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
        {toast && (
          <p className={cn('mt-2 text-xs font-medium', toast.type === 'success' ? 'text-green-500' : 'text-red-500')}>
            {toast.message}
          </p>
        )}
      </div>

      {/* Placeholder: la configuracion real del widget viene en Fase 3 */}
      <div className="p-6 rounded-lg border border-dashed border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Configuración (Fase 3 — v0.25.0)</h3>
        <ul className="space-y-1 text-sm text-[var(--text-secondary)] list-disc ml-5">
          <li>Apariencia (colores, logo, bubble)</li>
          <li>Textos (header, teaser, transcript) bilingüe es/en</li>
          <li>Starter questions (max 5)</li>
          <li>Behavior (auto-open delay, sonido)</li>
          <li>Allowed origins (CORS)</li>
          <li>Embed code (&lt;script&gt; para copiar)</li>
          <li>Preview en vivo</li>
        </ul>
        <p className="mt-4 text-xs text-[var(--text-tertiary)]">
          Esta página se construirá completa en Fase 3 cuando habilitemos el widget MVP.
          Por ahora solo expone el toggle Mostrar/Ocultar para validar el flujo.
        </p>
      </div>
    </div>
  );
}
