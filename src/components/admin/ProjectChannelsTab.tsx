'use client';

/**
 * Tab "Canales" del ProjectSettingsModal admin.
 *
 * Permite a super_admin (Fase 2.1):
 * - Activar canal: crea/reactiva ProjectChannel(provisioned=true, enabled=true).
 *   WebChat auto-genera publicKey al activar.
 * - Pausar canal: provisioned=false (subitem desaparece para owner).
 * - Eliminar/Resetear canal: hard delete de la fila (decision #23).
 *   Leads/Conversations historicos NO se tocan.
 */

import { useState, useEffect, useCallback } from 'react';
import type { LeadChannel } from '@prisma/client';
import { cn } from '@/lib/utils';
import {
  getProjectChannelInfo,
  provisionProjectChannel,
  unprovisionProjectChannel,
  deleteProjectChannel,
} from '@/lib/actions/project-channels';
import type { ProjectChannelInfo } from '@/lib/types/project-channel';

type ChannelKey = 'whatsapp' | 'webchat';

interface ChannelDef {
  key: ChannelKey;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const CHANNELS: ChannelDef[] = [
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    description: 'Recibe mensajes via WhatsApp Business API. Configura credenciales en la pestaña WhatsApp.',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    key: 'webchat',
    name: 'Web (WebChat)',
    description: 'Widget embebible en el sitio del cliente. Disponible en Fase 3 (v0.25.0).',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 000 18M12.5 3a17 17 0 010 18" />
      </svg>
    ),
  },
];

interface ChannelStatusProps {
  info: ProjectChannelInfo | null;
  loading: boolean;
}

function ChannelStatusBadge({ info, loading }: ChannelStatusProps) {
  if (loading) {
    return <div className="h-5 w-24 rounded bg-[var(--bg-tertiary)] animate-pulse" />;
  }
  if (!info?.exists) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]" />
        No habilitado
      </span>
    );
  }
  if (info.provisioned && info.enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-600">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Activo
      </span>
    );
  }
  if (info.provisioned && !info.enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-600">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Owner pauso visibilidad
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]" />
      Pausado por super_admin
    </span>
  );
}

export function ProjectChannelsTab({
  projectId,
  onError,
  onSuccess,
}: {
  projectId: string;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}) {
  const [channelInfos, setChannelInfos] = useState<Record<ChannelKey, ProjectChannelInfo | null>>({
    whatsapp: null,
    webchat: null,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<ChannelKey | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ChannelKey | null>(null);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    const [whatsapp, webchat] = await Promise.all([
      getProjectChannelInfo(projectId, 'whatsapp'),
      getProjectChannelInfo(projectId, 'webchat'),
    ]);
    setChannelInfos({
      whatsapp: whatsapp.success ? whatsapp.data : null,
      webchat: webchat.success ? webchat.data : null,
    });
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const handleProvision = useCallback(async (channel: LeadChannel) => {
    setActionLoading(channel as ChannelKey);
    const result = await provisionProjectChannel(projectId, channel);
    setActionLoading(null);
    if (result.success) {
      onSuccess(`Canal ${channel} activado`);
      await loadChannels();
    } else {
      onError(result.error);
    }
  }, [projectId, onError, onSuccess, loadChannels]);

  const handleUnprovision = useCallback(async (channel: LeadChannel) => {
    setActionLoading(channel as ChannelKey);
    const result = await unprovisionProjectChannel(projectId, channel);
    setActionLoading(null);
    if (result.success) {
      onSuccess(`Canal ${channel} pausado`);
      await loadChannels();
    } else {
      onError(result.error);
    }
  }, [projectId, onError, onSuccess, loadChannels]);

  const handleDelete = useCallback(async (channel: LeadChannel) => {
    setActionLoading(channel as ChannelKey);
    const result = await deleteProjectChannel(projectId, channel);
    setActionLoading(null);
    setConfirmDelete(null);
    if (result.success) {
      onSuccess(`Canal ${channel} eliminado/reseteado`);
      await loadChannels();
    } else {
      onError(result.error);
    }
  }, [projectId, onError, onSuccess, loadChannels]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Activa, pausa o elimina los canales disponibles para este proyecto. El owner solo ve los canales activados.
      </p>

      {CHANNELS.map((ch) => {
        const info = channelInfos[ch.key];
        const isLoadingThis = actionLoading === ch.key;
        const exists = !!info?.exists;
        const provisioned = info?.provisioned ?? false;

        return (
          <div
            key={ch.key}
            className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)]">
                  {ch.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{ch.name}</h3>
                    <ChannelStatusBadge info={info} loading={loading} />
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">{ch.description}</p>
                  {info?.publicKey && (
                    <p className="text-xs font-mono text-[var(--text-tertiary)] mt-1 break-all">
                      publicKey: {info.publicKey}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {!provisioned && (
                <button
                  type="button"
                  onClick={() => handleProvision(ch.key)}
                  disabled={isLoadingThis || loading}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    'bg-[var(--accent-primary)] text-[var(--kairo-midnight)]',
                    'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isLoadingThis ? '...' : exists ? 'Reactivar canal' : 'Activar canal'}
                </button>
              )}
              {provisioned && (
                <button
                  type="button"
                  onClick={() => handleUnprovision(ch.key)}
                  disabled={isLoadingThis || loading}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                    'border-amber-500/40 text-amber-600 bg-amber-500/5',
                    'hover:bg-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isLoadingThis ? '...' : 'Pausar canal'}
                </button>
              )}
              {exists && confirmDelete !== ch.key && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(ch.key)}
                  disabled={isLoadingThis || loading}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                    'border-red-500/40 text-red-600 bg-red-500/5',
                    'hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  Eliminar / Resetear
                </button>
              )}
              {confirmDelete === ch.key && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/5">
                  <span className="text-xs text-red-600">Confirmar eliminacion?</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(ch.key)}
                    disabled={isLoadingThis}
                    className="px-2 py-0.5 rounded text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    {isLoadingThis ? '...' : 'Si, eliminar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    className="px-2 py-0.5 rounded text-xs font-medium border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-[var(--text-tertiary)] mt-2">
        <strong>Nota:</strong> Pausar conserva la configuracion (puedes reactivar despues).
        Eliminar/Resetear borra la fila ProjectChannel; los leads y mensajes historicos
        NO se tocan. WebChat regenera publicKey al reactivar (el cliente debe re-embeber).
      </p>
    </div>
  );
}
