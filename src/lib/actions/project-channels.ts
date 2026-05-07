'use server';

/**
 * Server actions para ProjectChannel — Fase 2.
 *
 * Lectura/Toggle (cualquier rol del proyecto):
 * - getProjectChannelInfo: lectura del estado del canal.
 * - getProvisionedChannels: lista compacta para Sidebar.
 * - setChannelEnabled: toggle "Mostrar/Ocultar" para owner/admin en webchat.
 *
 * Provisioning (super_admin only — decision #15, #16):
 * - provisionProjectChannel: crear/reactivar fila (provisioned=true, enabled=true).
 *   Auto-genera publicKey si channel='webchat'.
 * - unprovisionProjectChannel: pausa (provisioned=false, conserva config).
 * - deleteProjectChannel: hard delete de la fila (decision #23, leads no se tocan).
 */

import { prisma } from '@/lib/prisma';
import type { LeadChannel } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/lib/auth-helpers';
import { verifySuperAdmin } from '@/lib/auth-helpers';
import { verifyAuth, getProjectRole } from '@/lib/actions/auth';
import { getEffectiveRole } from '@/lib/permissions';
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
 * Lista compacta de canales provisionados para un proyecto.
 * Usado por el Sidebar para mostrar subitems condicionalmente.
 *
 * Retorna solo canales con `provisioned=true` (no importa `enabled`, porque
 * incluso si owner ocultó el widget, el subitem en sidebar debe permanecer
 * para que pueda volver a activarlo).
 */
export async function getProvisionedChannels(
  projectId: string
): Promise<{ success: true; channels: LeadChannel[] } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'No autorizado' };
  }

  const rows = await prisma.projectChannel.findMany({
    where: { projectId, provisioned: true },
    select: { channel: true },
  });

  return {
    success: true,
    channels: rows.map((r) => r.channel),
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
  // Fase 2.3: gate owner/admin/super_admin (decision #16/#17/permisos).
  // El toggle "Mostrar/Ocultar" es accion del owner del proyecto, no de cualquier
  // miembro autenticado. Uses el mismo patron que team-settings.ts.
  const user = await verifyAuth();
  if (!user) return { success: false, error: 'No autorizado' };

  const roleInfo = await getProjectRole(user.id, user.systemRole, projectId);
  if (!roleInfo.hasAccess) return { success: false, error: 'Sin acceso al proyecto' };

  const effectiveRole = getEffectiveRole(
    user.systemRole,
    roleInfo.isOrgOwner ?? false,
    roleInfo.projectRole
  );

  if (effectiveRole !== 'super_admin' && effectiveRole !== 'owner' && effectiveRole !== 'admin') {
    return { success: false, error: 'Permisos insuficientes' };
  }

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

/**
 * super_admin: provisiona el canal para un proyecto.
 * Si la fila no existe, la crea con provisioned=true, enabled=true.
 * Si existe (estaba unprovisioned), la reactiva preservando config.
 * Para webchat, genera publicKey si no tiene.
 */
export async function provisionProjectChannel(
  projectId: string,
  channel: LeadChannel
): Promise<{ success: true; publicKey: string | null } | { success: false; error: string }> {
  if (!(await verifySuperAdmin()).isAdmin) {
    return { success: false, error: 'Solo super_admin puede provisionar canales' };
  }

  try {
    const existing = await prisma.projectChannel.findUnique({
      where: { projectId_channel: { projectId, channel } },
      select: { publicKey: true },
    });

    // Generar publicKey solo para webchat y si no existe
    const needsPublicKey = channel === 'webchat' && !existing?.publicKey;
    const publicKey = needsPublicKey ? randomUUID().replace(/-/g, '').substring(0, 24) : (existing?.publicKey ?? null);

    await prisma.projectChannel.upsert({
      where: { projectId_channel: { projectId, channel } },
      create: {
        projectId,
        channel,
        provisioned: true,
        enabled: true,
        publicKey,
        config: {},
      },
      update: {
        provisioned: true,
        enabled: true,
        ...(needsPublicKey ? { publicKey } : {}),
      },
    });

    revalidatePath('/admin');
    revalidatePath('/settings');
    return { success: true, publicKey };
  } catch (error) {
    console.error('[provisionProjectChannel] Error:', error);
    return { success: false, error: 'Error al provisionar el canal' };
  }
}

/**
 * super_admin: pausa el canal (provisioned=false). Preserva config para reactivar.
 * El subitem desaparece del sidebar del owner.
 */
export async function unprovisionProjectChannel(
  projectId: string,
  channel: LeadChannel
): Promise<{ success: true } | { success: false; error: string }> {
  if (!(await verifySuperAdmin()).isAdmin) {
    return { success: false, error: 'Solo super_admin puede pausar canales' };
  }

  try {
    await prisma.projectChannel.update({
      where: { projectId_channel: { projectId, channel } },
      data: { provisioned: false },
    });

    revalidatePath('/admin');
    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    console.error('[unprovisionProjectChannel] Error:', error);
    return { success: false, error: 'Error al pausar el canal' };
  }
}

/**
 * super_admin: elimina por completo la fila ProjectChannel (decision #23).
 * Leads/Conversations/Messages NO se tocan (data del proyecto persiste).
 * Si super_admin reactiva el canal despues, se genera nueva publicKey.
 */
export async function deleteProjectChannel(
  projectId: string,
  channel: LeadChannel
): Promise<{ success: true } | { success: false; error: string }> {
  if (!(await verifySuperAdmin()).isAdmin) {
    return { success: false, error: 'Solo super_admin puede eliminar canales' };
  }

  try {
    await prisma.projectChannel.delete({
      where: { projectId_channel: { projectId, channel } },
    });

    revalidatePath('/admin');
    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    console.error('[deleteProjectChannel] Error:', error);
    return { success: false, error: 'Error al eliminar el canal' };
  }
}
