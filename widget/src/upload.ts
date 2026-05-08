// ============================================
// KAIRO WebChat Widget — Image upload (Sub-fase 4.D.1)
//
// Two-step flow that mirrors `incoming` (WhatsApp) media handling but on
// the visitor side:
//   1. POST /api/widget/upload-token → server validates publicKey + tenant
//      + MIME + size and returns a signed Supabase Storage upload URL.
//   2. PUT the file directly to that signed URL. Bucket is public, so the
//      `publicUrl` returned in step 1 is what we ship in /webhooks/webchat.
//
// Every error path is enumerated so the widget can show actionable copy.
// ============================================

import type { EmbedOptions } from './types';

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type UploadErrorCode =
  | 'too_large'
  | 'unsupported_format'
  | 'token_failed'
  | 'put_failed'
  | 'network';

export interface UploadResult {
  ok: true;
  publicUrl: string;
  mime: string;
}

export interface UploadFailure {
  ok: false;
  error: UploadErrorCode;
}

interface TokenResponse {
  ok?: boolean;
  uploadUrl?: string;
  token?: string;
  publicUrl?: string;
  path?: string;
  error?: string;
}

/**
 * Upload a single image. Validates client-side first to avoid a server roundtrip
 * for obviously bad files (size > 10MB, wrong MIME).
 */
export async function uploadImage(
  opts: EmbedOptions,
  conversationId: string,
  sessionId: string,
  file: File
): Promise<UploadResult | UploadFailure> {
  // Client-side guards (server enforces these too — defense in depth)
  if (!ALLOWED_IMAGE_MIMES.has(file.type)) {
    return { ok: false, error: 'unsupported_format' };
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'too_large' };
  }

  // Step 1: token
  let tokenData: TokenResponse;
  try {
    const r = await fetch(`${opts.apiBase}/api/widget/upload-token`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        publicKey: opts.publicKey,
        sessionId,
        conversationId,
        kind: 'image',
        mime: file.type,
        size: file.size,
      }),
    });
    if (!r.ok) return { ok: false, error: 'token_failed' };
    tokenData = (await r.json()) as TokenResponse;
  } catch {
    return { ok: false, error: 'network' };
  }

  if (!tokenData.uploadUrl || !tokenData.publicUrl) {
    return { ok: false, error: 'token_failed' };
  }

  // Step 2: PUT to Supabase signed URL.
  // Supabase signed upload URLs accept either of:
  //   - PUT with Authorization: Bearer <token>
  //   - PUT to URL with `?token=<token>` query param (which createSignedUploadUrl
  //     already includes in `uploadUrl`).
  // We use the URL-as-issued (token already embedded). Setting Content-Type
  // matters — Supabase enforces it against the signed MIME at validation time.
  try {
    const putRes = await fetch(tokenData.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!putRes.ok) return { ok: false, error: 'put_failed' };
  } catch {
    return { ok: false, error: 'network' };
  }

  return { ok: true, publicUrl: tokenData.publicUrl, mime: file.type };
}
