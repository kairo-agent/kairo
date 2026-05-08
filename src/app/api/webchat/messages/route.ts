// ============================================
// KAIRO - WebChat Polling Endpoint (PUBLIC)
// GET /api/webchat/messages?key=<publicKey>&conversationId=<uuid>&since=<iso>
//
// Phase 3 transport: widget polls this every N seconds for new messages.
// Phase 4 will switch to Supabase Realtime over WebSocket.
//
// Auth: publicKey + conversation→project tenant check (RLS-style).
// Cache: no-store (response is per-request and time-sensitive).
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  resolveWebChatByPublicKey,
  getAllowedOrigins,
  buildCorsHeaders,
  resolveCorsOrigin,
  extractClientIp,
} from '@/lib/channels/webchat/public-helpers';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const MAX_MESSAGES_PER_POLL = 100;

// --------------------------------------------
// Sender derivation
// --------------------------------------------

type WidgetSenderType = 'visitor' | 'ai' | 'agent';

interface MessageRow {
  id: string;
  content: string;
  createdAt: Date;
  sender: 'ai' | 'human' | 'lead';
  sentByUserId: string | null;
  metadata: Prisma.JsonValue | null;
}

function deriveSenderType(msg: MessageRow): WidgetSenderType {
  // Human asesor messages have sentByUserId set
  if (msg.sender === 'human' && msg.sentByUserId) return 'agent';

  // AI messages: prisma sender='ai' OR metadata.role==='ai'
  if (msg.sender === 'ai') return 'ai';
  const meta = msg.metadata && typeof msg.metadata === 'object' ? (msg.metadata as Record<string, unknown>) : null;
  if (meta?.role === 'ai') return 'ai';

  // Otherwise: from the lead/visitor
  return 'visitor';
}

// --------------------------------------------
// OPTIONS — CORS preflight
// --------------------------------------------

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: buildCorsHeaders(origin) });
}

// --------------------------------------------
// GET
// --------------------------------------------

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');

  try {
    // Per-IP rate limit (polling can burst)
    const ip = extractClientIp(request.headers);
    const rl = await checkRateLimit(`webchat:poll:${ip}`, {
      maxRequests: 240, // up to ~4/s sustained per IP
      windowMs: 60_000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: buildCorsHeaders(origin) }
      );
    }

    const params = request.nextUrl.searchParams;
    const key = params.get('key');
    const conversationId = params.get('conversationId');
    const sinceRaw = params.get('since');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'missing_conversation_id' },
        { status: 400, headers: buildCorsHeaders(origin) }
      );
    }

    // Validate publicKey
    const lookup = await resolveWebChatByPublicKey(key);
    if (!lookup.ok) {
      return NextResponse.json(
        { error: lookup.code },
        { status: lookup.status, headers: buildCorsHeaders(origin) }
      );
    }

    // CORS gate
    const allowedOrigins = getAllowedOrigins(lookup.config);
    const corsOrigin = resolveCorsOrigin(origin, allowedOrigins);
    if (origin && allowedOrigins.length > 0 && !corsOrigin) {
      return NextResponse.json(
        { error: 'origin_not_allowed' },
        { status: 403, headers: buildCorsHeaders(null) }
      );
    }

    // Parse `since` (ISO timestamp, optional)
    let sinceDate: Date | undefined;
    if (sinceRaw) {
      const d = new Date(sinceRaw);
      if (isNaN(d.getTime())) {
        return NextResponse.json(
          { error: 'invalid_since' },
          { status: 400, headers: buildCorsHeaders(corsOrigin) }
        );
      }
      sinceDate = d;
    }

    // Tenant check: conversation must belong to a Lead in this projectId.
    // Single query that joins Lead → projectId, avoiding cross-tenant leak.
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, lead: { select: { projectId: true } } },
    });

    if (!conversation || conversation.lead.projectId !== lookup.projectId) {
      // Don't leak whether the conversation exists in another tenant.
      return NextResponse.json(
        { error: 'conversation_not_found' },
        { status: 404, headers: buildCorsHeaders(corsOrigin) }
      );
    }

    // Fetch messages
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        ...(sinceDate ? { createdAt: { gt: sinceDate } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: MAX_MESSAGES_PER_POLL,
      select: {
        id: true,
        content: true,
        createdAt: true,
        sender: true,
        sentByUserId: true,
        metadata: true,
      },
    });

    const out = messages.map((m) => ({
      id: m.id,
      content: m.content,
      senderType: deriveSenderType(m),
      createdAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json(
      { messages: out },
      {
        status: 200,
        headers: {
          ...buildCorsHeaders(corsOrigin),
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('[Webchat poll] Unexpected error:', error);
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500, headers: buildCorsHeaders(origin) }
    );
  }
}
