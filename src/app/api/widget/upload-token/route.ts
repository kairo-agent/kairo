// ============================================
// KAIRO - WebChat Upload Token Endpoint (PUBLIC)
// POST /api/widget/upload-token
//
// Issued before the widget uploads a file to Supabase Storage. The visitor
// authenticates via publicKey + conversation tenant check (NOT a logged-in
// user). The endpoint returns a SINGLE-USE signed PUT URL scoped to a
// generated path under `media/webchat/{projectId}/{year}/{month}/...`.
//
// Auth model:
//   - publicKey resolves to a webchat channel (provisioned + enabled)
//   - conversationId must belong to a Lead in the same projectId
//   - The visitor cannot pick the path; the server generates it. This
//     prevents path traversal and cross-tenant overwrites.
//
// Limits:
//   - Image (Sub-fase 4.D.1):   <= 10 MB, MIME in IMAGE_MIME_WHITELIST
//   - Audio (Sub-fase 4.D.2):   future
//   - Document (Sub-fase 4.D.3):future
//
// Rate limits:
//   - per-IP:        5 token issuances / minute
//   - per-publicKey: 30 / minute (per project)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  resolveWebChatByPublicKey,
  getAllowedOrigins,
  buildCorsHeaders,
  resolveCorsOrigin,
  extractClientIp,
} from '@/lib/channels/webchat/public-helpers';

export const runtime = 'nodejs';

// --------------------------------------------
// Limits + whitelists
// --------------------------------------------

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

const IMAGE_MIME_WHITELIST: ReadonlyMap<string, string> = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

const ALLOWED_KINDS = new Set(['image']); // 4.D.2 will add 'audio', 4.D.3 'document'

const SIGNED_URL_TTL_SECONDS = 300; // 5 min — visitor uploads quickly; expired tokens are refused by Supabase

// --------------------------------------------
// OPTIONS — CORS preflight
// --------------------------------------------

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: buildCorsHeaders(origin) });
}

// --------------------------------------------
// POST
// --------------------------------------------

interface UploadTokenBody {
  publicKey: string;
  sessionId?: string;
  conversationId: string;
  kind: 'image'; // future: 'audio' | 'document'
  mime: string;
  size: number;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');

  try {
    // ---- Parse + shape validation ----
    const raw = await request.text();
    if (raw.length > 4_000) {
      return NextResponse.json(
        { error: 'payload_too_large' },
        { status: 413, headers: buildCorsHeaders(origin) }
      );
    }

    let parsed: Partial<UploadTokenBody>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: 'invalid_json' },
        { status: 400, headers: buildCorsHeaders(origin) }
      );
    }

    const publicKey = typeof parsed.publicKey === 'string' ? parsed.publicKey : '';
    const conversationId =
      typeof parsed.conversationId === 'string' ? parsed.conversationId : '';
    const kind = typeof parsed.kind === 'string' ? parsed.kind : '';
    const mime = typeof parsed.mime === 'string' ? parsed.mime.toLowerCase() : '';
    const size = typeof parsed.size === 'number' ? parsed.size : -1;

    if (!publicKey || !conversationId || !ALLOWED_KINDS.has(kind)) {
      return NextResponse.json(
        { error: 'invalid_payload' },
        { status: 400, headers: buildCorsHeaders(origin) }
      );
    }

    // Per-kind validation (only `image` accepted in 4.D.1)
    let extension: string | undefined;
    if (kind === 'image') {
      extension = IMAGE_MIME_WHITELIST.get(mime);
      if (!extension) {
        return NextResponse.json(
          { error: 'unsupported_mime' },
          { status: 400, headers: buildCorsHeaders(origin) }
        );
      }
      if (size <= 0 || size > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { error: 'size_out_of_range', maxBytes: MAX_IMAGE_SIZE },
          { status: 413, headers: buildCorsHeaders(origin) }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'kind_not_supported_yet' },
        { status: 400, headers: buildCorsHeaders(origin) }
      );
    }

    // ---- publicKey -> ProjectChannel ----
    const lookup = await resolveWebChatByPublicKey(publicKey);
    if (!lookup.ok) {
      return NextResponse.json(
        { error: lookup.code },
        { status: lookup.status, headers: buildCorsHeaders(origin) }
      );
    }

    // ---- CORS ----
    const allowedOrigins = getAllowedOrigins(lookup.config);
    const corsOrigin = resolveCorsOrigin(origin, allowedOrigins);
    if (origin && allowedOrigins.length > 0 && !corsOrigin) {
      return NextResponse.json(
        { error: 'origin_not_allowed' },
        { status: 403, headers: buildCorsHeaders(null) }
      );
    }

    // ---- Rate limits (per-IP + per-publicKey) ----
    const ip = extractClientIp(request.headers);
    const ipRl = await checkRateLimit(`webchat:upload-tok:ip:${ip}`, {
      maxRequests: 5,
      windowMs: 60_000,
    });
    if (!ipRl.success) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: buildCorsHeaders(corsOrigin) }
      );
    }
    const keyRl = await checkRateLimit(`webchat:upload-tok:key:${lookup.channel.publicKey}`, {
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (!keyRl.success) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: buildCorsHeaders(corsOrigin) }
      );
    }

    // ---- Tenant check: conversation must belong to a Lead in this projectId ----
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

    // ---- Generate path ----
    // Path shape: webchat/{projectId}/{YYYY}/{MM}/{conversationId}-{uuid}.{ext}
    // - Predictable structure for cleanup cron (mirrors `incoming/{projectId}/...`).
    // - UUID guarantees no collisions even if visitor races multiple uploads.
    // - conversationId prefix lets us scope listing/cleanup by conversation if needed.
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const path = `webchat/${lookup.projectId}/${yyyy}/${mm}/${conversation.id}-${randomUUID()}.${extension}`;

    // ---- Issue signed upload URL ----
    const supabase = createAdminClient();
    const { data: signed, error: signErr } = await supabase.storage
      .from('media')
      .createSignedUploadUrl(path, { upsert: false });
    if (signErr || !signed?.signedUrl) {
      console.error('[Webchat upload-token] sign error:', signErr?.message);
      return NextResponse.json(
        { error: 'sign_failed' },
        { status: 500, headers: buildCorsHeaders(corsOrigin) }
      );
    }

    // Public URL (bucket `media` is public — verified with Leo). The visitor
    // sends this back in /api/webhooks/webchat. AI Vision pulls it directly.
    const publicUrlData = supabase.storage.from('media').getPublicUrl(path);
    const publicUrl = publicUrlData.data.publicUrl;

    return NextResponse.json(
      {
        ok: true,
        path,
        uploadUrl: signed.signedUrl,
        token: signed.token, // Supabase requires this header on PUT
        publicUrl,
        // The widget should send `mediaUrl: publicUrl` and `kind: 'image'`
        // back to /api/webhooks/webchat after a successful upload.
      },
      { status: 200, headers: buildCorsHeaders(corsOrigin) }
    );
  } catch (error) {
    console.error('[Webchat upload-token] Unexpected error:', error);
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500, headers: buildCorsHeaders(origin) }
    );
  }
}
