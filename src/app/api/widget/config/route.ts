// ============================================
// KAIRO - Widget Config Endpoint (PUBLIC)
// GET /api/widget/config?key=<publicKey>
//
// Returns the appearance/behavior config the WebChat widget needs to mount.
// Auth: publicKey only (no user session). CORS validated against
// ProjectChannel.config.behavior.allowedOrigins.
//
// Cache: 60s edge cache + 5min SWR.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  resolveWebChatByPublicKey,
  resolveAppearance,
  resolveBehavior,
  getAllowedOrigins,
  buildCorsHeaders,
  resolveCorsOrigin,
  extractClientIp,
} from '@/lib/channels/webchat/public-helpers';

export const runtime = 'nodejs';

// --------------------------------------------
// OPTIONS — CORS preflight
// --------------------------------------------

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const key = request.nextUrl.searchParams.get('key');

  // Best-effort: lookup channel to honor allowedOrigins; fall back to permissive
  // if no key given (browser preflight may still need a 204).
  let allowedOrigin: string | null = origin;
  if (key) {
    const lookup = await resolveWebChatByPublicKey(key);
    if (lookup.ok) {
      const allowed = getAllowedOrigins(lookup.config);
      allowedOrigin = resolveCorsOrigin(origin, allowed);
    }
  }

  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(allowedOrigin),
  });
}

// --------------------------------------------
// GET — fetch widget config
// --------------------------------------------

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');

  try {
    // Light per-IP rate limit to discourage scraping (publicKey is not a secret).
    const ip = extractClientIp(request.headers);
    const rl = await checkRateLimit(`widget:config:${ip}`, {
      maxRequests: 120,
      windowMs: 60_000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { enabled: false, error: 'rate_limited' },
        { status: 429, headers: buildCorsHeaders(origin) }
      );
    }

    const key = request.nextUrl.searchParams.get('key');
    const lookup = await resolveWebChatByPublicKey(key);

    // Invalid key — surface 404 + enabled:false (widget will silently no-op)
    if (!lookup.ok && lookup.code === 'invalid_key') {
      console.log('[Widget config] invalid key', { ip, hasKey: !!key });
      return NextResponse.json(
        { enabled: false, error: 'invalid_key' },
        { status: lookup.status, headers: buildCorsHeaders(origin) }
      );
    }

    // Disabled / unprovisioned — return 200 + enabled:false so widget cleanly hides.
    // (Per spec: "widget no se monta", and we don't want browsers caching a 403.)
    if (!lookup.ok && lookup.code === 'channel_disabled') {
      console.log('[Widget config] channel disabled', { ip });
      return NextResponse.json(
        { enabled: false },
        {
          status: 200,
          headers: {
            ...buildCorsHeaders(origin),
            'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
          },
        }
      );
    }

    // Should not reach here unless lookup is ok=true
    if (!lookup.ok) {
      return NextResponse.json(
        { enabled: false, error: 'unknown' },
        { status: 500, headers: buildCorsHeaders(origin) }
      );
    }

    // CORS validation against allowedOrigins (Phase 3 permissive when empty)
    const allowedOrigins = getAllowedOrigins(lookup.config);
    const corsOrigin = resolveCorsOrigin(origin, allowedOrigins);

    if (origin && allowedOrigins.length > 0 && !corsOrigin) {
      console.warn('[Widget config] origin not allowed', {
        origin,
        allowedOrigins,
        publicKey: lookup.channel.publicKey,
      });
      return NextResponse.json(
        { enabled: false, error: 'origin_not_allowed' },
        { status: 403, headers: buildCorsHeaders(null) }
      );
    }

    // Look up org name for the response (denormalized, single shallow fetch)
    const project = await prisma.project.findUnique({
      where: { id: lookup.projectId },
      select: { organization: { select: { name: true } } },
    });

    const appearance = resolveAppearance(lookup.config);
    const behavior = resolveBehavior(lookup.config);

    // Fase 4.A: ship Realtime endpoint + ANON KEY (already public by design)
    // to the widget so it can open a Phoenix WS to Supabase Realtime. The
    // anon key is the same NEXT_PUBLIC_SUPABASE_ANON_KEY already exposed to
    // dashboard clients — no new secret material is being leaked. If env is
    // missing we ship `null` and the widget falls back to polling-only.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
    const realtime =
      supabaseUrl && supabaseAnonKey
        ? { url: supabaseUrl, key: supabaseAnonKey }
        : null;

    const body = {
      enabled: true,
      publicKey: lookup.channel.publicKey,
      appearance,
      behavior,
      orgName: project?.organization?.name ?? null,
      realtime,
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        ...buildCorsHeaders(corsOrigin),
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[Widget config] Unexpected error:', error);
    return NextResponse.json(
      { enabled: false, error: 'server_error' },
      { status: 500, headers: buildCorsHeaders(origin) }
    );
  }
}
