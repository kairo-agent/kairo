/**
 * WhatsAppChannelHandler — Implementacion de IChannelHandler para WhatsApp Cloud API
 *
 * Plan multi-canal: docs/plans/MULTI-CHANNEL-IMPL.md Fase 1.4
 *
 * - send(): delega a sendImageToWhatsApp / sendVideoToWhatsApp / sendTextToWhatsApp
 *   segun el shape del ChannelMessageOutbound.
 * - receive(): orquesta el procesamiento del webhook (Fase 1.4b2 — logica
 *   movida desde route.ts a ./receive).
 * - validateWebhookSignature(): HMAC con per-project app_secret + global fallback.
 * - downloadMedia(): NO implementado (la firma generica no encaja con
 *   downloadAndStoreMedia que necesita conversationId/whatsappMsgId; el flujo
 *   de download corre dentro de processWhatsAppWebhookPayload via waitUntil).
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
import {
  processWhatsAppWebhookPayload,
  validateWhatsAppWebhookSignature,
  type WhatsAppWebhookPayload,
} from './receive';

export class WhatsAppChannelHandler implements IChannelHandler {
  readonly channel = LeadChannel.whatsapp;

  /**
   * Procesa un payload de webhook de WhatsApp Cloud API ya verificado.
   * El endpoint /api/webhooks/whatsapp/route.ts es responsable de:
   *  1. Rate limiting por IP
   *  2. Leer rawBody y parsear JSON
   *  3. Validar `payload.object === 'whatsapp_business_account'`
   *  4. Llamar a validateWebhookSignature() ANTES de invocar receive()
   *
   * El parametro `_projectId` se ignora porque WhatsApp determina el proyecto
   * a partir del `phone_number_id` en cada `entry.change.value.metadata`.
   * Se mantiene en la firma por compatibilidad con la interfaz IChannelHandler
   * (otros canales como webchat si lo usan).
   */
  async receive(_projectId: string, payload: unknown): Promise<void> {
    if (!isWhatsAppWebhookPayload(payload)) {
      console.warn('[WhatsAppChannelHandler.receive] Invalid payload shape');
      return;
    }
    await processWhatsAppWebhookPayload(payload);
  }

  /**
   * Envia un mensaje saliente al lead via WhatsApp Cloud API.
   * Mapping de ChannelMessageOutbound a la API:
   * - mediaUrl + mediaType='image' -> sendImageToWhatsApp (caption opcional)
   * - mediaUrl + mediaType='video' -> sendVideoToWhatsApp (caption opcional)
   * - mediaUrl + mediaType='document' -> NO soportado todavia
   * - text solo -> sendTextToWhatsApp (fire-and-forget, sin DB record update)
   *
   * Notas:
   * - WhatsApp espera el numero sin '+' (las funciones helper lo limpian).
   * - sendToWhatsApp con messageId+DB update sigue disponible para callers que
   *   necesiten persistir whatsappMsgId/isDelivered. Este handler NO toca BD;
   *   el caller es responsable de la persistencia.
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

    if (message.text) {
      const result = await sendTextToWhatsApp(projectId, phone, message.text);
      return result.success
        ? { success: true }
        : { success: false, error: 'WhatsApp text send failed' };
    }

    return { success: false, error: 'Empty message: neither text nor media provided' };
  }

  /**
   * Valida la firma HMAC del webhook (X-Hub-Signature-256).
   * Logica delegada a ./receive: per-project app_secret first, fallback a
   * WHATSAPP_APP_SECRET global solo si no hay per-project secret configurado.
   */
  async validateWebhookSignature(rawBody: string, headers: Headers): Promise<boolean> {
    return validateWhatsAppWebhookSignature(rawBody, headers);
  }
}

// Type guard for incoming payload
function isWhatsAppWebhookPayload(payload: unknown): payload is WhatsAppWebhookPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return p.object === 'whatsapp_business_account' && Array.isArray(p.entry);
}

/**
 * Singleton instance para el registry (Fase 1.8). Ningun otro lugar debe
 * importar la clase directamente; usar registry.getChannelHandler('whatsapp', ...).
 */
export const whatsappChannelHandler = new WhatsAppChannelHandler();
