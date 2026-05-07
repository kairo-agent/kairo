/**
 * WhatsAppChannelHandler — Implementacion de IChannelHandler para WhatsApp Cloud API
 *
 * Plan multi-canal: docs/plans/MULTI-CHANNEL-IMPL.md Fase 1.4
 *
 * Estado actual (Fase 1.4b1): handler funcional para send(). receive() y
 * validateWebhookSignature() son placeholders — su logica sigue viviendo en
 * src/app/api/webhooks/whatsapp/route.ts. La extraccion completa es Fase 1.4b2.
 */

import type { Lead } from '@prisma/client';
import { LeadChannel } from '@prisma/client';
import type {
  IChannelHandler,
  ChannelMessageOutbound,
  ChannelSendResult,
} from '../IChannelHandler';
import {
  sendImageToWhatsApp,
  sendVideoToWhatsApp,
  sendTextToWhatsApp,
} from './send';

export class WhatsAppChannelHandler implements IChannelHandler {
  readonly channel = LeadChannel.whatsapp;

  /**
   * TODO Fase 1.4b2: extraer la logica de
   * src/app/api/webhooks/whatsapp/route.ts (POST handler + processMessagesChange
   * + handleIncomingMessage + handleStatusUpdate) a este metodo.
   *
   * Hasta entonces, el endpoint /api/webhooks/whatsapp/route.ts maneja la
   * recepcion directamente sin pasar por este handler.
   */
  async receive(_projectId: string, _payload: unknown): Promise<void> {
    throw new Error(
      '[WhatsAppChannelHandler.receive] Not implemented yet (Fase 1.4b2). ' +
        'Webhook handler in src/app/api/webhooks/whatsapp/route.ts processes ' +
        'incoming messages directly until the refactor is complete.'
    );
  }

  /**
   * Envia un mensaje saliente al lead via WhatsApp Cloud API.
   * Delega a las funciones existentes en ./send segun el shape del mensaje.
   *
   * Mapping de ChannelMessageOutbound a la API:
   * - mediaUrl + mediaType='image' -> sendImageToWhatsApp (caption opcional)
   * - mediaUrl + mediaType='video' -> sendVideoToWhatsApp (caption opcional)
   * - mediaUrl + mediaType='document' -> NO soportado todavia (returns error)
   * - text solo -> sendTextToWhatsApp (fire-and-forget, sin DB record update)
   *
   * Notas:
   * - WhatsApp espera el numero en formato sin '+' (las funciones helper lo limpian).
   * - sendToWhatsApp con messageId+DB update sigue disponible para callers que
   *   necesiten persistir whatsappMsgId/isDelivered en el Message record. Este
   *   handler NO toca BD; el caller es responsable de la persistencia.
   */
  async send(
    projectId: string,
    lead: Lead,
    message: ChannelMessageOutbound
  ): Promise<ChannelSendResult> {
    if (!lead.phone) {
      return { success: false, error: 'Lead has no phone number' };
    }

    const phone = lead.phone;

    // Media first (con caption opcional, fallback a text si caption no se setea)
    if (message.mediaUrl && message.mediaType) {
      const caption = message.caption ?? message.text;

      if (message.mediaType === 'image') {
        const result = await sendImageToWhatsApp(projectId, phone, message.mediaUrl, caption);
        return result.success
          ? { success: true }
          : { success: false, error: 'WhatsApp image send failed' };
      }

      if (message.mediaType === 'video') {
        const result = await sendVideoToWhatsApp(projectId, phone, message.mediaUrl, caption);
        return result.success
          ? { success: true }
          : { success: false, error: 'WhatsApp video send failed' };
      }

      if (message.mediaType === 'document') {
        return {
          success: false,
          error: 'Document send not yet supported by WhatsApp helper (v0.24.0)',
        };
      }
    }

    // Text only (fire-and-forget). Caller debe persistir whatsappMsgId si lo necesita,
    // usando sendToWhatsApp directamente o adaptando este handler en el futuro.
    if (message.text) {
      const result = await sendTextToWhatsApp(projectId, phone, message.text);
      return result.success
        ? { success: true }
        : { success: false, error: 'WhatsApp text send failed' };
    }

    return { success: false, error: 'Empty message: neither text nor media provided' };
  }

  // downloadMedia: NO implementado en este handler porque la firma de la
  // interfaz (mediaId solo) no encaja con downloadAndStoreMedia que necesita
  // conversationId + whatsappMsgId + mimeType + messageType para persistir
  // en BD y disparar Whisper. El webhook llama directamente a
  // downloadAndStoreMedia desde ./download-media. Si en el futuro un caller
  // generico necesita descargar media de WhatsApp, agregamos un metodo aqui.

  // validateWebhookSignature: NO implementado en 1.4b1. La logica HMAC con
  // per-project secret + global fallback vive en route.ts y se mueve aqui en
  // Fase 1.4b2 cuando extraigamos la logica de receive().
}

/**
 * Singleton instance para el registry (Fase 1.8). Ningun otro lugar debe
 * importar la clase directamente; usar registry.getChannelHandler('whatsapp', ...).
 */
export const whatsappChannelHandler = new WhatsAppChannelHandler();
