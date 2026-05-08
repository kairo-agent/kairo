// ============================================
// KAIRO - WebChat Inbound Webhook (PUBLIC)
// POST /api/webhooks/webchat
//
// Receives messages from the embeddable WebChat widget.
// Auth: publicKey + Origin validation (no user session).
//
// PHASE 3.2 SCOPE:
//   - Validate publicKey, channel, origin, rate limit.
//   - Persist Lead/Conversation/Message stub so the dashboard can render the chat.
//   - Return 200 quickly.
//
// Pipeline AI integration (RAG, Vision, Whisper, processAIResponse) is wired in
// Phase 3.6 via WebChatChannelHandler. See TODO marker below.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  resolveWebChatByPublicKey,
  getAllowedOrigins,
  buildCorsHeaders,
  resolveCorsOrigin,
  extractClientIp,
} from '@/lib/channels/webchat/public-helpers';
import { getChannelHandler } from '@/lib/channels/registry';
import { emitWebChatSignal } from '@/lib/channels/webchat/realtime-emit';

export const runtime = 'nodejs';
export const maxDuration = 30;

// --------------------------------------------
// Payload types
// --------------------------------------------

type WebChatMessageType = 'text' | 'image' | 'audio' | 'document';

interface WebChatInboundPayload {
  publicKey: string;
  visitorId: string;
  sessionId?: string;
  message: {
    type: WebChatMessageType;
    text?: string;
    mediaUrl?: string;
  };
}

const MAX_BODY_SIZE = 100_000;       // 100 KB per inbound message (excludes media — uploaded separately)
const MAX_TEXT_LENGTH = 4_000;       // mirror WhatsApp Cloud API ceiling
const VALID_MESSAGE_TYPES: ReadonlySet<WebChatMessageType> = new Set([
  'text',
  'image',
  'audio',
  'document',
]);

// --------------------------------------------
// OPTIONS — CORS preflight
// --------------------------------------------

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    // Preflight cannot read the publicKey from a JSON body,
    // so be permissive here. POST handler does the real check.
    headers: buildCorsHeaders(origin),
  });
}

// --------------------------------------------
// POST
// --------------------------------------------

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');

  try {
    // Read raw body with size guard
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_SIZE) {
      console.warn('[Webchat webhook] payload too large:', rawBody.length);
      return NextResponse.json(
        { error: 'payload_too_large' },
        { status: 413, headers: buildCorsHeaders(origin) }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'invalid_json' },
        { status: 400, headers: buildCorsHeaders(origin) }
      );
    }

    const payload = parsed as Partial<WebChatInboundPayload>;

    // Shape validation
    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.publicKey !== 'string' ||
      typeof payload.visitorId !== 'string' ||
      !payload.message ||
      typeof payload.message !== 'object'
    ) {
      return NextResponse.json(
        { error: 'invalid_payload' },
        { status: 400, headers: buildCorsHeaders(origin) }
      );
    }

    const visitorId = payload.visitorId.trim();
    const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : null;
    if (!visitorId || visitorId.length > 128) {
      return NextResponse.json(
        { error: 'invalid_visitor_id' },
        { status: 400, headers: buildCorsHeaders(origin) }
      );
    }

    const messageType = payload.message.type;
    if (typeof messageType !== 'string' || !VALID_MESSAGE_TYPES.has(messageType as WebChatMessageType)) {
      return NextResponse.json(
        { error: 'invalid_message_type' },
        { status: 400, headers: buildCorsHeaders(origin) }
      );
    }

    const text = typeof payload.message.text === 'string' ? payload.message.text : '';
    const mediaUrl = typeof payload.message.mediaUrl === 'string' ? payload.message.mediaUrl : null;
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: 'text_too_long' },
        { status: 400, headers: buildCorsHeaders(origin) }
      );
    }
    if (messageType === 'text' && !text.trim()) {
      return NextResponse.json(
        { error: 'empty_text' },
        { status: 400, headers: buildCorsHeaders(origin) }
      );
    }
    if (messageType !== 'text' && !mediaUrl) {
      return NextResponse.json(
        { error: 'media_url_required' },
        { status: 400, headers: buildCorsHeaders(origin) }
      );
    }

    // Validate publicKey -> ProjectChannel
    const lookup = await resolveWebChatByPublicKey(payload.publicKey);
    if (!lookup.ok) {
      return NextResponse.json(
        { error: lookup.code },
        { status: lookup.status, headers: buildCorsHeaders(origin) }
      );
    }

    const allowedOrigins = getAllowedOrigins(lookup.config);
    const corsOrigin = resolveCorsOrigin(origin, allowedOrigins);

    // Origin gate — only enforced when allowedOrigins is non-empty (Phase 3 permissive)
    if (origin && allowedOrigins.length > 0 && !corsOrigin) {
      console.warn('[Webchat webhook] origin not allowed', {
        origin,
        allowedOrigins,
        publicKey: lookup.channel.publicKey,
      });
      return NextResponse.json(
        { error: 'origin_not_allowed' },
        { status: 403, headers: buildCorsHeaders(null) }
      );
    }

    // Rate limit: per IP and per visitorId
    const ip = extractClientIp(request.headers);
    const ipRl = await checkRateLimit(`webchat:ip:${ip}`, {
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (!ipRl.success) {
      console.warn('[Webchat webhook] IP rate limit exceeded', { ip });
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: buildCorsHeaders(corsOrigin) }
      );
    }

    const visitorRl = await checkRateLimit(
      `webchat:${lookup.channel.publicKey}:${visitorId}`,
      { maxRequests: 60, windowMs: 60_000 }
    );
    if (!visitorRl.success) {
      console.warn('[Webchat webhook] visitor rate limit exceeded', {
        visitorId,
        publicKey: lookup.channel.publicKey,
      });
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: buildCorsHeaders(corsOrigin) }
      );
    }

    // ----------------------------------------
    // Persist stub Lead + Conversation + Message
    // ----------------------------------------
    // We minimally store the inbound so the dashboard can render the chat.
    // Full pipeline (debounce, RAG, AI response, media download) is wired in
    // Phase 3.6 via WebChatChannelHandler.
    // ----------------------------------------
    const projectId = lookup.projectId;

    // No @@unique on (projectId, channel, externalId) — only an @@index — so
    // we cannot use prisma.lead.upsert() directly. Use findFirst + create/update.
    // (WebChatChannelHandler in Fase 3.6 will own this lookup logic.)
    const existingLead = await prisma.lead.findFirst({
      where: { projectId, channel: 'webchat', externalId: visitorId },
      select: { id: true },
    });

    const lead = existingLead
      ? await prisma.lead.update({
          where: { id: existingLead.id },
          data: { lastContactAt: new Date() },
          select: { id: true },
        })
      : await prisma.lead.create({
          data: {
            firstName: 'Visitante',
            lastName: '',
            channel: 'webchat',
            type: 'ai_agent',
            projectId,
            externalId: visitorId,
            source: 'other',
            lastContactAt: new Date(),
          },
          select: { id: true },
        });

    // Ensure Conversation exists. Pull realtimeTopicSecret so we can
    // (a) emit the Realtime signal after persisting the inbound message and
    // (b) return it to the widget so it can subscribe.
    const conversation = await prisma.conversation.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id },
      update: {},
      select: { id: true, realtimeTopicSecret: true },
    });

    // Persist inbound message stub
    const messageContent =
      messageType === 'text' ? text : `[${messageType}] ${mediaUrl ?? ''}`;

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: 'lead',
        content: messageContent,
        metadata: {
          channel: 'webchat',
          type: messageType,
          mediaUrl: mediaUrl ?? undefined,
          visitorId,
          sessionId: sessionId ?? undefined,
        },
      },
      select: { id: true },
    });

    // Fase 3.6: invocar pipeline AI via WebChatChannelHandler.
    // El handler aplica debounce Redis 5s + concatena mensajes pendientes y llama
    // processAIResponse(). El AI message se persiste en BD por el pipeline; el
    // widget lo recibe via polling (/api/webchat/messages). Realtime broadcast
    // se agrega en Fase 4.
    const handler = await getChannelHandler('webchat', projectId);
    if (handler) {
      // Fire-and-forget: el handler maneja waitUntil internamente para no
      // bloquear la respuesta al widget.
      await handler.receive(projectId, {
        leadId: lead.id,
        conversationId: conversation.id,
        messageId: message.id,
        visitorId,
        sessionId,
        type: messageType,
        text,
        mediaUrl,
      });
    } else {
      console.warn('[Webchat webhook] handler not available', {
        projectId,
        publicKey: lookup.channel.publicKey,
      });
    }

    console.log('[Webchat webhook] processed', {
      projectId,
      leadId: lead.id,
      conversationId: conversation.id,
      messageId: message.id,
      type: messageType,
      handlerAvailable: !!handler,
    });

    // Fase 4.A: emit Realtime signal so any open widget tab refreshes
    // immediately. Wrapped in waitUntil so the 2.5s emit timeout can NEVER
    // block the response path — polling fallback covers any failure.
    waitUntil(emitWebChatSignal(conversation.realtimeTopicSecret));

    return NextResponse.json(
      {
        ok: true,
        received: true,
        messageId: message.id,
        conversationId: conversation.id,
        // Widget needs the topic secret to subscribe to the broadcast channel.
        // Treated as a session secret on the widget side (localStorage).
        realtimeTopicSecret: conversation.realtimeTopicSecret,
      },
      { status: 200, headers: buildCorsHeaders(corsOrigin) }
    );
  } catch (error) {
    console.error('[Webchat webhook] Unexpected error:', error);
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500, headers: buildCorsHeaders(origin) }
    );
  }
}
