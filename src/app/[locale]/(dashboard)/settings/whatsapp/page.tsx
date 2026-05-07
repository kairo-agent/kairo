'use client';

import { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Link } from '@/i18n/routing';
import { getProjectChannelInfo } from '@/lib/actions/project-channels';
import type { ProjectChannelInfo } from '@/lib/types/project-channel';

/**
 * `/settings/whatsapp` — configuracion del canal WhatsApp para el owner/admin.
 *
 * Estado actual (Fase 2 scaffolding nocturno): placeholder informativo. Cuando
 * Leo apruebe la reorganizacion, se movera el tab `reengagement` desde
 * `SettingsPageClient.tsx` aqui y se agregara display del numero + futuros
 * templates aprobados.
 *
 * Decision #18: WhatsApp NO tiene switch "Mostrar/Ocultar". El estado del canal
 * se controla solo por super_admin via `/admin` (provisioned).
 */
export default function WhatsAppSettingsPage() {
  const { selectedProject } = useWorkspace();
  const [info, setInfo] = useState<ProjectChannelInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedProject?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getProjectChannelInfo(selectedProject.id, 'whatsapp')
      .then((result) => {
        if (result.success) {
          setInfo(result.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedProject?.id]);

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-[var(--text-secondary)]">Selecciona un proyecto para configurar el canal WhatsApp.</p>
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
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">WhatsApp</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Configuración del canal WhatsApp Business para este proyecto.
        </p>
      </div>

      {/* Estado del canal */}
      <div className="mb-6 p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Estado del canal</h2>
        {loading ? (
          <div className="h-4 w-32 rounded bg-[var(--bg-tertiary)] animate-pulse" />
        ) : info?.provisioned && info?.enabled ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-green-500 font-medium">Activo</span>
          </div>
        ) : info?.provisioned && !info?.enabled ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm text-amber-500 font-medium">Pausado</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)]" />
            <span className="text-sm text-[var(--text-tertiary)]">No habilitado</span>
          </div>
        )}
      </div>

      {/* Placeholder: la configuracion real (reengagement, display number, templates)
          vendra cuando se haga la extraccion del tab desde SettingsPageClient. */}
      <div className="p-6 rounded-lg border border-dashed border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Configuración (próximamente)</h3>
        <ul className="space-y-1 text-sm text-[var(--text-secondary)] list-disc ml-5">
          <li>Reengagement (config de tiempos y tono)</li>
          <li>Display del número de WhatsApp</li>
          <li>Templates aprobados (futuro)</li>
        </ul>
        <p className="mt-4 text-xs text-[var(--text-tertiary)]">
          La configuración del canal WhatsApp se moverá aquí desde la página AI Settings
          en una próxima fase. Por ahora, sigue accediendo desde la pestaña Reengagement
          de <Link href="/settings" className="underline text-[var(--accent-text)]">AI Settings</Link>.
        </p>
      </div>
    </div>
  );
}
