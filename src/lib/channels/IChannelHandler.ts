/**
 * IChannelHandler — Interface comun para todos los canales (WhatsApp, WebChat, etc.)
 *
 * Cada canal implementa receive() para procesar webhooks/eventos entrantes y
 * send() para enviar mensajes salientes. El pipeline AI (processAIResponse)
 * sigue siendo agnostico al canal y reusa la misma logica de RAG, Vision,
 * form conversacional, handoff, etc.
 *
 * Plan multi-canal: docs/plans/MULTI-CHANNEL-IMPL.md Fase 1.3
 *
 * NOTA: Este archivo solo define tipos. La implementacion concreta de cada
 * canal vive en src/lib/channels/{whatsapp,webchat}/. El registry de handlers
 * vive en src/lib/channels/registry.ts (Fase 1.8).
 */

import type { Lead, LeadChannel } from '@prisma/client';

// ============================================================
// Mensajes entrantes (del transporte hacia KAIRO)
// ============================================================

export type ChannelMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker';

/**
 * Mensaje entrante normalizado, agnostico al canal.
 *
 * - externalUserId: identificador del remitente en el canal
 *   (wa_id en WhatsApp, visitorId en WebChat, psid en Messenger, etc.)
 * - externalMessageId: id del mensaje en el canal externo (para idempotencia
 *   y dedup; opcional porque algunos canales no lo proveen)
 * - mediaPayload: shape varia por canal (ej. WhatsApp: { id, mime_type, sha256 };
 *   WebChat: { url, mimeType, size }). Cada handler lo descarga/persiste a su modo.
 * - metadata: campos extra del payload original que algun handler quiera preservar
 */
export interface ChannelMessageInbound {
  externalUserId: string;
  externalMessageId?: string;
  type: ChannelMessageType;
  text?: string;
  mediaPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Mensajes salientes (de KAIRO hacia el transporte)
// ============================================================

export type OutboundMediaType = 'image' | 'video' | 'document';

/**
 * Mensaje saliente normalizado.
 *
 * - text solo: mensaje de texto puro
 * - mediaUrl + mediaType: envia media (con caption opcional)
 * - text + mediaUrl: combina ambos segun convencion del canal
 *   (ej. WhatsApp envia media con caption en lugar de 2 mensajes separados)
 */
export interface ChannelMessageOutbound {
  text?: string;
  mediaUrl?: string;
  mediaType?: OutboundMediaType;
  caption?: string;
}

/**
 * Resultado del send(). externalMessageId es opcional porque no todos los
 * canales devuelven un id sincrono al enviar (ej. webchat realtime).
 */
export interface ChannelSendResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
}

// ============================================================
// Resultado de descarga de media (canales que reciben media por referencia)
// ============================================================

export interface ChannelMediaDownloadResult {
  url: string;          // URL persistente (Supabase Storage signed URL o public URL)
  mimeType: string;
  storagePath?: string; // ruta interna en Storage
}

// ============================================================
// Interface principal
// ============================================================

/**
 * Cada canal debe implementar esta interface. El registry (Fase 1.8) la usa
 * para enrutar webhooks entrantes y mensajes salientes al handler correcto
 * segun el LeadChannel del lead.
 */
export interface IChannelHandler {
  /**
   * Identificador del canal. Debe coincidir con el valor del enum LeadChannel.
   */
  readonly channel: LeadChannel;

  /**
   * Procesar un evento entrante del canal (webhook payload, mensaje del widget,
   * etc.). El handler es responsable de:
   * 1. Validar que el canal esta provisioned + enabled (via ProjectChannel)
   * 2. Crear/buscar el Lead (por externalId)
   * 3. Persistir el Message
   * 4. Disparar el pipeline AI si corresponde (processAIResponse)
   *
   * El payload llega como `unknown` porque cada canal tiene shape distinto;
   * el handler hace narrowing/parsing interno.
   */
  receive(projectId: string, payload: unknown): Promise<void>;

  /**
   * Enviar un mensaje saliente al lead via el canal correspondiente.
   * Llamado por: pipeline AI, asesor manual desde dashboard, cron de
   * reengagement (solo WhatsApp), etc.
   */
  send(projectId: string, lead: Lead, message: ChannelMessageOutbound): Promise<ChannelSendResult>;

  /**
   * Descargar media referenciada por id (ej. WhatsApp Cloud API entrega media
   * por id, no por URL). Algunos canales no necesitan esto (webchat sube
   * directo a Storage); por eso es opcional.
   */
  downloadMedia?(projectId: string, mediaId: string): Promise<ChannelMediaDownloadResult>;

  /**
   * Validar la firma del webhook para prevenir requests forjados.
   * Implementacion varia por canal (HMAC para WhatsApp, JWT para webchat, etc.).
   * Opcional porque algunos endpoints validan via Origin/CORS en lugar de signature.
   */
  validateWebhookSignature?(rawBody: string, headers: Headers): Promise<boolean>;
}
