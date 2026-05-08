/**
 * Channel handler registry — Fase 1.8
 *
 * Punto unico de entrada para obtener el handler de un canal dado, con
 * validacion automatica de provisioned + enabled del ProjectChannel.
 *
 * Returns null si:
 * - El canal no tiene handler registrado (todavia no implementado)
 * - El ProjectChannel no existe para este proyecto
 * - super_admin desactivo el canal (provisioned=false)
 * - owner pauso el canal (enabled=false)
 *
 * Uso:
 *   const handler = await getChannelHandler('whatsapp', projectId);
 *   if (!handler) return; // canal no disponible para este proyecto
 *   await handler.receive(projectId, payload);
 */

import type { LeadChannel } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { IChannelHandler } from './IChannelHandler';

// Lazy imports para evitar bundle bloat — cada handler solo se carga cuando se usa.
const handlerFactories: Partial<Record<LeadChannel, () => Promise<IChannelHandler>>> = {
  whatsapp: async () =>
    (await import('./whatsapp/WhatsAppChannelHandler')).whatsappChannelHandler,
  webchat: async () =>
    (await import('./webchat/WebChatChannelHandler')).webchatChannelHandler,
  // instagram, facebook, tiktok: lazy-loaded en futuras versiones
};

export async function getChannelHandler(
  channel: LeadChannel,
  projectId: string
): Promise<IChannelHandler | null> {
  const projectChannel = await prisma.projectChannel.findUnique({
    where: { projectId_channel: { projectId, channel } },
    select: { provisioned: true, enabled: true },
  });

  if (!projectChannel || !projectChannel.provisioned || !projectChannel.enabled) {
    return null;
  }

  const factory = handlerFactories[channel];
  if (!factory) return null;

  return await factory();
}

/**
 * Verifica solo si un canal esta disponible (sin retornar el handler).
 * Util para validacion de webhook antes de procesar payload.
 */
export async function isChannelAvailable(
  channel: LeadChannel,
  projectId: string
): Promise<boolean> {
  const projectChannel = await prisma.projectChannel.findUnique({
    where: { projectId_channel: { projectId, channel } },
    select: { provisioned: true, enabled: true },
  });

  return !!(projectChannel?.provisioned && projectChannel?.enabled);
}
