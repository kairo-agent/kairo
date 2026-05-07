// ============================================
// KAIRO - WhatsApp Webhook Endpoints
// Receives messages directly from Meta WhatsApp Cloud API
//
// THIN WRAPPER (Fase 1.4b2): toda la logica vive en
// src/lib/channels/whatsapp/{receive,WhatsAppChannelHandler}.ts
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import { whatsappChannelHandler } from '@/lib/channels/whatsapp/WhatsAppChannelHandler';

// Vercel serverless config
export const maxDuration = 55; // 55s max for audio transcription pipeline (200 sent immediately via waitUntil)

// Re-export para preservar API publica (alguien podria importarla en el futuro
// para invalidar el cache cuando se editen credenciales WhatsApp en /admin)
export { invalidatePhoneNumberCache } from '@/lib/channels/whatsapp/receive';

// ============================================
// GET Handler - Webhook Verification
// Meta sends a GET request to verify the webhook URL
// ============================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!VERIFY_TOKEN) {
    console.error('WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Timing-safe comparison
  if (
    mode === 'subscribe' &&
    token &&
    VERIFY_TOKEN &&
    token.length === VERIFY_TOKEN.length &&
    crypto.timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(VERIFY_TOKEN, 'utf8'))
  ) {
    console.log('[OK] WhatsApp webhook verified successfully');
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.warn('[FAIL] WhatsApp webhook verification failed', {
    mode,
    hasToken: !!token,
    tokenLength: token?.length || 0,
  });
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ============================================
// POST Handler - Incoming Messages (thin wrapper)
//
// Responsibilities here (kept in route.ts):
//   1. Rate limit by IP (anti-DDoS, Meta can burst)
//   2. Read raw body, validate size, parse JSON
//   3. Sanity-check `object === 'whatsapp_business_account'`
//   4. HMAC signature verification (delegated to handler)
//   5. Track HMAC failures per IP (anti-spoofing)
//   6. Delegate processing to WhatsAppChannelHandler.receive()
//   7. Always return 200 to prevent Meta retry storms
//
// Everything else (parsing payloads, finding projects, processing messages,
// AI pipeline kickoff, status updates) lives in
// src/lib/channels/whatsapp/{receive,WhatsAppChannelHandler}.ts.
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limit by IP
    const rawIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                  request.headers.get('x-real-ip')?.trim();

    if (!rawIp && process.env.NODE_ENV === 'production') {
      console.warn('[WhatsApp Webhook] Request without identifiable IP rejected');
      return NextResponse.json({ success: true });
    }

    const clientIp = rawIp || `dev-${Date.now()}`;

    const rateLimit = await checkRateLimit(`webhook:whatsapp:${clientIp}`, {
      maxRequests: 300, // 300 requests per minute per IP
      windowMs: 60_000,
    });

    if (!rateLimit.success) {
      console.warn(`[WhatsApp Webhook] Rate limit exceeded for IP: ${clientIp}`);
      return NextResponse.json({ success: true });
    }

    // 2. Read raw body (needed for HMAC verification)
    const rawBody = await request.text();

    const MAX_WEBHOOK_BODY_SIZE = 1_048_576; // 1MB
    if (rawBody.length > MAX_WEBHOOK_BODY_SIZE) {
      console.warn(`[WhatsApp Webhook] Payload too large: ${rawBody.length} bytes`);
      return NextResponse.json({ success: true });
    }

    // 3. Parse JSON tentatively (size already capped above)
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[WhatsApp Webhook] Invalid JSON payload:', parseError);
      return NextResponse.json({ success: true });
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      (payload as Record<string, unknown>).object !== 'whatsapp_business_account'
    ) {
      console.warn('[WhatsApp Webhook] Invalid payload object');
      return NextResponse.json({ success: true });
    }

    // 4. HMAC signature verification (delegated to handler)
    const hmacVerified = await whatsappChannelHandler.validateWebhookSignature(rawBody, request.headers);

    if (!hmacVerified) {
      // 5. Track HMAC failures per IP (block after 10 in 5 min)
      const hmacFailLimit = await checkRateLimit(`webhook:hmac-fail:${clientIp}`, {
        maxRequests: 10,
        windowMs: 5 * 60_000,
      });

      if (!hmacFailLimit.success) {
        console.warn(`[WhatsApp Webhook] HMAC failure rate limit exceeded for IP: ${clientIp}`);
      }

      // Always return 200 to not trigger Meta retries
      return NextResponse.json({ success: true });
    }

    // 6. Delegate processing to handler (the heavy lifting)
    // Note: projectId is determined inside the handler from the payload's
    // phone_number_id, so we pass an empty string here (interface compatibility).
    await whatsappChannelHandler.receive('', payload);

    // 7. Always return 200 quickly to acknowledge receipt
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WhatsApp Webhook] Unexpected error:', error);
    return NextResponse.json({ success: true });
  }
}
