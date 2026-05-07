'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Link } from '@/i18n/routing';
import { toast } from 'sonner';
import { getProjectChannelInfo } from '@/lib/actions/project-channels';
import type { ProjectChannelInfo } from '@/lib/types/project-channel';
import { getProjectAgents, type AIAgentData } from '@/lib/actions/agents';
import { getReEngagementConfig, saveReEngagementConfig } from '@/lib/actions/reengagement';
import { DEFAULT_REENGAGEMENT_CONFIG, type ReEngagementConfig } from '@/lib/types/reengagement';
import { ReEngagementTab } from '@/components/settings/ReEngagementTab';

/**
 * `/settings/whatsapp` — configuracion del canal WhatsApp para el owner/admin.
 *
 * Fase 2.2a: tab `reengagement` movido aqui desde `/settings` (AI Settings).
 * Decision #4: reengagement es WhatsApp-only.
 * Decision #18: NO hay switch de Mostrar/Ocultar (control via /admin super_admin).
 *
 * El estado del canal se controla solo por super_admin via `/admin` (provisioned).
 */
export default function WhatsAppSettingsPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const { selectedProject, mounted } = useWorkspace();

  const [info, setInfo] = useState<ProjectChannelInfo | null>(null);
  const [loadingChannel, setLoadingChannel] = useState(true);

  const [activeAgent, setActiveAgent] = useState<AIAgentData | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(true);

  const [reEngagementConfig, setReEngagementConfig] = useState<ReEngagementConfig>({ ...DEFAULT_REENGAGEMENT_CONFIG });
  const [originalReEngagementConfig, setOriginalReEngagementConfig] = useState<ReEngagementConfig>({ ...DEFAULT_REENGAGEMENT_CONFIG });
  const [loadingReEngagement, setLoadingReEngagement] = useState(false);
  const [savingReEngagement, setSavingReEngagement] = useState(false);

  // Load channel info
  useEffect(() => {
    if (!selectedProject?.id) {
      setLoadingChannel(false);
      return;
    }
    setLoadingChannel(true);
    getProjectChannelInfo(selectedProject.id, 'whatsapp')
      .then((result) => {
        if (result.success) setInfo(result.data);
        setLoadingChannel(false);
      })
      .catch(() => setLoadingChannel(false));
  }, [selectedProject?.id]);

  // Load active agent (the one whose config we'll show)
  useEffect(() => {
    if (!selectedProject?.id) {
      setLoadingAgent(false);
      return;
    }
    setLoadingAgent(true);
    getProjectAgents(selectedProject.id)
      .then((result) => {
        if (result.success && result.agents) {
          const active = result.agents.find((a) => a.isActive) || result.agents[0] || null;
          setActiveAgent(active);
        }
        setLoadingAgent(false);
      })
      .catch(() => setLoadingAgent(false));
  }, [selectedProject?.id]);

  // Load reengagement config when active agent changes
  const loadReEngagement = useCallback(async () => {
    if (!activeAgent) return;
    setLoadingReEngagement(true);
    try {
      const result = await getReEngagementConfig(activeAgent.id);
      if (result.success && result.data) {
        setReEngagementConfig(result.data);
        setOriginalReEngagementConfig(result.data);
      }
    } catch {
      toast.error(tCommon('messages.error'));
    } finally {
      setLoadingReEngagement(false);
    }
  }, [activeAgent, tCommon]);

  useEffect(() => {
    if (activeAgent) {
      loadReEngagement();
    } else {
      setReEngagementConfig({ ...DEFAULT_REENGAGEMENT_CONFIG });
      setOriginalReEngagementConfig({ ...DEFAULT_REENGAGEMENT_CONFIG });
    }
  }, [activeAgent, loadReEngagement]);

  const hasUnsavedReEngagement = JSON.stringify(reEngagementConfig) !== JSON.stringify(originalReEngagementConfig);

  const handleSaveReEngagement = useCallback(async () => {
    if (!activeAgent) return;
    setSavingReEngagement(true);
    try {
      const result = await saveReEngagementConfig(activeAgent.id, reEngagementConfig);
      if (result.success) {
        setOriginalReEngagementConfig({ ...reEngagementConfig });
        toast.success(t('reengagement.savedSuccessfully'));
      } else {
        toast.error(result.error || t('reengagement.saveFailed'));
      }
    } catch {
      toast.error(t('reengagement.saveFailed'));
    } finally {
      setSavingReEngagement(false);
    }
  }, [activeAgent, reEngagementConfig, t]);

  // Pre-mount: evitar mostrar empty state durante flash inicial (selectedProject
  // se popula post-mount desde localStorage; ver WorkspaceContext.mounted).
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
        {loadingChannel ? (
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

      {/* ReEngagement config (movido desde AI Settings) */}
      {loadingAgent ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeAgent ? (
        <ReEngagementTab
          config={reEngagementConfig}
          setConfig={setReEngagementConfig}
          loading={loadingReEngagement}
          saving={savingReEngagement}
          hasUnsavedChanges={hasUnsavedReEngagement}
          onSave={handleSaveReEngagement}
          agentId={activeAgent.id}
          projectId={selectedProject.id}
        />
      ) : (
        <div className="p-6 rounded-lg border border-dashed border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          <p className="text-sm text-[var(--text-secondary)]">
            No hay un agente activo en este proyecto. Configura uno en{' '}
            <Link href="/settings" className="underline text-[var(--accent-text)]">AI Settings</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
