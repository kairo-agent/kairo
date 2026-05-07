'use server';

/**
 * Server actions para ProjectChannel — Fase 2.
 *
 * - getProjectChannelInfo: lectura del estado del canal (cualquier rol del proyecto).
 * - setChannelEnabled: cambia `enabled` (toggle "Mostrar/Ocultar" para owner/admin
 *   en webchat). En whatsapp este toggle no existe (decision #18 del plan).
 *
 * Acciones de super_admin (provisionProjectChannel, unprovisionProjectChannel,
 * deleteProjectChannel) se agregaran cuando se extienda ProjectSettingsModal.
 */

import { prisma } from '@/lib/prisma';
import type { LeadChannel } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth-helpers';
import { revalidatePath } from 'next/cache';
import type { ProjectChannelInfo } from '@/lib/types/project-channel';

/**
 * Obtiene info del ProjectChannel para mostrar en `/settings/{channel}`.
 * Si la fila no existe, retorna `exists: false` (canal no contratado).
 */
export async function getProjectChannelInfo(
  projectId: string,
  channel: LeadChannel
): Promise<{ success: true; data: ProjectChannelInfo } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'No autorizado' };
  }

  // RLS de project_channels valida acceso via user_has_project_access(projectId).
  const projectChannel = await prisma.projectChannel.findUnique({
    where: { projectId_channel: { projectId, channel } },
    select: {
      provisioned: true,
      enabled: true,
      publicKey: true,
      config: true,
    },
  });

  if (!projectChannel) {
    return {
      success: true,
      data: {
        exists: false,
        provisioned: false,
        enabled: false,
        publicKey: null,
        config: {},
      },
    };
  }

  return {
    success: true,
    data: {
      exists: true,
      provisioned: projectChannel.provisioned,
      enabled: projectChannel.enabled,
      publicKey: projectChannel.publicKey,
      config: (projectChannel.config as Record<string, unknown>) || {},
    },
  };
}

/**
 * Toggle "Mostrar / Ocultar" del canal (solo aplica a webchat por ahora).
 * Cambia `ProjectChannel.enabled`. NO toca `provisioned` (control super_admin).
 *
 * NOTA: para v0.24.0 acepta cualquier `LeadChannel`, pero la UI solo expone el
 * toggle en webchat (decision #18: WhatsApp sin switch).
 */
export async function setChannelEnabled(
  projectId: string,
  channel: LeadChannel,
  enabled: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'No autorizado' };
  }

  // TODO Fase 2.3: chequear permisos owner/admin del proyecto via permissions.ts.
  // Por ahora, RLS solo valida lectura; este action corre con prisma client server-side
  // que bypassa RLS, asi que cualquier usuario autenticado podria llamarlo. Restringir
  // antes de exponer en UI.

  try {
    await prisma.projectChannel.update({
      where: { projectId_channel: { projectId, channel } },
      data: { enabled },
    });

    revalidatePath('/settings/whatsapp');
    revalidatePath('/settings/webchat');
    return { success: true };
  } catch (error) {
    console.error('[setChannelEnabled] Error:', error);
    return { success: false, error: 'Error al actualizar el canal' };
  }
}
