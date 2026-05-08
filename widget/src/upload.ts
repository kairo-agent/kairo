// ============================================
// KAIRO WebChat Widget — File upload (Sub-fase 4.D.1 image, 4.D.2 audio)
//
// Two-step flow:
//   1. POST /api/widget/upload-token → server validates publicKey + tenant +
//      MIME + size and returns a signed Supabase Storage upload URL.
//   2. PUT the file directly to that signed URL. Bucket is public, so the
//      `publicUrl` returned in step 1 is what we ship in /webhooks/webchat.
// ============================================

import type { EmbedOptions } from './types';

export type UploadKind = 'image' | 'audio' | 'document';

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/opus',
]);
const ALLOWED_DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);
const MAX_BYTES = 10 * 1024 * 1024;

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
  kind: UploadKind;
  /** Original filename — preserved so the asesor sees a human-readable name. */
  filename: string;
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
 * Detect the upload kind from a File's MIME type. Returns null when the file
 * is not in any whitelist — caller should surface an `unsupported_format`
 * error to the user.
 */
export function detectKind(file: File): UploadKind | null {
  if (ALLOWED_IMAGE_MIMES.has(file.type)) return 'image';
  if (ALLOWED_AUDIO_MIMES.has(file.type)) return 'audio';
  if (ALLOWED_DOCUMENT_MIMES.has(file.type)) return 'document';
  return null;
}

/**
 * Upload a single file (image or audio). Validates client-side first to avoid
 * a server roundtrip for obviously bad files. Server enforces the same rules.
 */
export async function uploadFile(
  opts: EmbedOptions,
  conversationId: string,
  sessionId: string,
  file: File
): Promise<UploadResult | UploadFailure> {
  const kind = detectKind(file);
  if (!kind) return { ok: false, error: 'unsupported_format' };
  if (file.size <= 0 || file.size > MAX_BYTES) {
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
        kind,
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

  return { ok: true, publicUrl: tokenData.publicUrl, mime: file.type, kind, filename: file.name };
}
