// ============================================
// KAIRO - WebChat Public Endpoints Helpers
// Shared utilities for /api/widget/* and /api/webhooks/webchat
//
// Used by:
//   - src/app/api/widget/config/route.ts
//   - src/app/api/webhooks/webchat/route.ts
//   - src/app/api/webchat/messages/route.ts
//
// NOT 'use server' (these are sync helpers used inside route handlers).
// Auth model is publicKey-based, NOT user-session-based.
// ============================================

import { prisma } from '@/lib/prisma';
import type { ProjectChannel } from '@prisma/client';

// --------------------------------------------
// Types
// --------------------------------------------

export interface WebChatBehaviorConfig {
  autoOpenDelay?: number;
  soundEnabled?: boolean;
  sessionTimeoutHours?: number;
  allowedOrigins?: string[];
}

export interface WebChatStarterQuestion {
  textEs?: string;
  textEn?: string;
}

export interface WebChatAppearanceConfig {
  position?: 'bottom-right' | 'bottom-left';
  bubbleColor?: string;
  headerBgColor?: string;
  visitorBubbleBg?: string;
  visitorBubbleText?: string;
  aiBubbleBg?: string;
  aiBubbleText?: string;
  logoUrl?: string | null;
  bubbleShape?: 'circle' | 'square';
  // Legacy: estos textos vivian en `appearance`. El form actual los guarda en
  // `config.texts` (ver WebChatTextsConfig). Se conservan aqui solo como
  // fallback de lectura defensivo en resolveAppearance().
  headerTitleEs?: string;
  headerTitleEn?: string;
  headerSubtitleEs?: string;
  headerSubtitleEn?: string;
  teaserTextEs?: string;
  teaserTextEn?: string;
  starterQuestions?: WebChatStarterQuestion[];
}

/** Textos del widget — ubicacion canonica (config.texts) que persiste el form. */
export interface WebChatTextsConfig {
  headerTitleEs?: string;
  headerTitleEn?: string;
  headerSubtitleEs?: string;
  headerSubtitleEn?: string;
  teaserTextEs?: string;
  teaserTextEn?: string;
}

export interface WebChatChannelConfig {
  appearance?: WebChatAppearanceConfig;
  behavior?: WebChatBehaviorConfig;
  // Ubicacion canonica de textos y preguntas sugeridas (las guarda el form en
  // estos campos top-level, NO dentro de `appearance`). resolveAppearance los
  // lee de aqui con fallback a `appearance.*` por compatibilidad.
  texts?: WebChatTextsConfig;
  starterQuestions?: WebChatStarterQuestion[];
  // Canonical location for the CORS whitelist (matches WebChatConfig type, the
  // settings form, and saveWebChatConfig). The legacy `behavior.allowedOrigins`
  // path is kept only as a defensive read fallback in getAllowedOrigins().
  allowedOrigins?: string[];
}

// --------------------------------------------
// Defaults (KAIRO brand)
// --------------------------------------------

export const DEFAULT_APPEARANCE: Required<
  Omit<WebChatAppearanceConfig, 'logoUrl' | 'starterQuestions'>
> & {
  logoUrl: string | null;
  starterQuestions: WebChatStarterQuestion[];
} = {
  position: 'bottom-right',
  bubbleColor: '#00E5FF',       // KAIRO cyan
  headerBgColor: '#0B1220',     // KAIRO midnight
  visitorBubbleBg: '#00E5FF',
  visitorBubbleText: '#0B1220',
  aiBubbleBg: '#F1F5F9',
  aiBubbleText: '#0B1220',
  logoUrl: null,
  bubbleShape: 'circle',
  headerTitleEs: 'Hola, ¿en qué te ayudamos?',
  headerTitleEn: 'Hi, how can we help?',
  headerSubtitleEs: 'Respondemos en minutos',
  headerSubtitleEn: 'We reply in minutes',
  teaserTextEs: '',
  teaserTextEn: '',
  starterQuestions: [],
};

export const DEFAULT_BEHAVIOR: Required<Omit<WebChatBehaviorConfig, 'allowedOrigins'>> & {
  allowedOrigins: string[];
} = {
  autoOpenDelay: 0,
  soundEnabled: true,
  sessionTimeoutHours: 2,
  allowedOrigins: [],
};

// --------------------------------------------
// CORS handling
// --------------------------------------------

/**
 * Decide which Origin to echo back in CORS headers.
 *
 * Sub-fase 4.E policy (strict): an empty `allowedOrigins` list blocks every
 * cross-origin request. The widget's /settings/webchat surface MUST surface
 * a warning to the project owner so they configure the list before pasting
 * the embed snippet on a real site.
 *
 * Why strict-by-default: the public widget endpoints accept anonymous traffic
 * (publicKey is in the embed snippet, world-readable). Exact-match origin
 * checking is the only line preventing a hostile site from instantiating a
 * KAIRO widget under another tenant's publicKey and harvesting visitors.
 *
 * Same-origin requests (no Origin header) are unaffected — those go through
 * the `null` short-circuit at the top.
 */
export function resolveCorsOrigin(
  requestOrigin: string | null,
  allowedOrigins: string[] | undefined
): string | null {
  if (!requestOrigin) return null;
  if (!allowedOrigins || allowedOrigins.length === 0) return null;

  // Exact-match list (case-insensitive)
  const lowered = requestOrigin.toLowerCase();
  const match = allowedOrigins.find((o) => o.toLowerCase() === lowered);
  return match ? requestOrigin : null;
}

/**
 * Build CORS headers for a public widget endpoint response.
 * `null` allowedOrigin = no CORS allowed (caller may still return data
 * for same-origin/no-origin requests like server-to-server, but browser will block).
 */
export function buildCorsHeaders(allowedOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Vary': 'Origin',
  };
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

// --------------------------------------------
// publicKey validation
// --------------------------------------------

export type WebChatChannelLookup =
  | { ok: true; channel: ProjectChannel; projectId: string; config: WebChatChannelConfig }
  | { ok: false; status: number; code: string };

/**
 * Resolve a publicKey to its ProjectChannel row, scoped to channel='webchat'.
 * Returns a typed discriminated union to keep route handlers thin.
 */
export async function resolveWebChatByPublicKey(
  publicKey: string | null | undefined
): Promise<WebChatChannelLookup> {
  if (!publicKey || typeof publicKey !== 'string' || publicKey.length < 8) {
    return { ok: false, status: 400, code: 'invalid_key' };
  }

  const channel = await prisma.projectChannel.findFirst({
    where: { publicKey, channel: 'webchat' },
  });

  if (!channel) {
    return { ok: false, status: 404, code: 'invalid_key' };
  }

  if (!channel.provisioned || !channel.enabled) {
    return { ok: false, status: 403, code: 'channel_disabled' };
  }

  const config = (channel.config as WebChatChannelConfig | null) ?? {};
  return { ok: true, channel, projectId: channel.projectId, config };
}

// --------------------------------------------
// Appearance / behavior resolution with defaults
// --------------------------------------------

export function resolveAppearance(cfg: WebChatChannelConfig | undefined) {
  const a = cfg?.appearance ?? {};
  // Textos: ubicacion canonica `config.texts`; fallback al legacy `appearance.*`.
  const t = cfg?.texts ?? {};
  // Preguntas sugeridas: top-level `config.starterQuestions`; fallback legacy.
  const starters = Array.isArray(cfg?.starterQuestions)
    ? cfg!.starterQuestions!
    : Array.isArray(a.starterQuestions)
      ? a.starterQuestions
      : DEFAULT_APPEARANCE.starterQuestions;
  return {
    // El widget espera 'right' | 'left'. El form persiste 'bottom-right' |
    // 'bottom-left' — se mapea (antes 'bottom-left' renderizaba a la derecha).
    position: (a.position ?? DEFAULT_APPEARANCE.position) === 'bottom-left' ? 'left' : 'right',
    bubbleColor: a.bubbleColor ?? DEFAULT_APPEARANCE.bubbleColor,
    headerBgColor: a.headerBgColor ?? DEFAULT_APPEARANCE.headerBgColor,
    visitorBubbleBg: a.visitorBubbleBg ?? DEFAULT_APPEARANCE.visitorBubbleBg,
    visitorBubbleText: a.visitorBubbleText ?? DEFAULT_APPEARANCE.visitorBubbleText,
    aiBubbleBg: a.aiBubbleBg ?? DEFAULT_APPEARANCE.aiBubbleBg,
    aiBubbleText: a.aiBubbleText ?? DEFAULT_APPEARANCE.aiBubbleText,
    logoUrl: a.logoUrl ?? DEFAULT_APPEARANCE.logoUrl,
    // El widget lee `bubbleLogoUrl` (burbuja + logo del header). El form/config
    // persiste el campo como `logoUrl` — se mapea aqui para que el logo se
    // renderice (antes el widget caia siempre al icono default).
    bubbleLogoUrl: a.logoUrl ?? DEFAULT_APPEARANCE.logoUrl,
    bubbleShape: a.bubbleShape ?? DEFAULT_APPEARANCE.bubbleShape,
    // Textos desde config.texts (canonico) con fallback al legacy appearance.*.
    headerTitleEs: t.headerTitleEs ?? a.headerTitleEs ?? DEFAULT_APPEARANCE.headerTitleEs,
    headerTitleEn: t.headerTitleEn ?? a.headerTitleEn ?? DEFAULT_APPEARANCE.headerTitleEn,
    headerSubtitleEs: t.headerSubtitleEs ?? a.headerSubtitleEs ?? DEFAULT_APPEARANCE.headerSubtitleEs,
    headerSubtitleEn: t.headerSubtitleEn ?? a.headerSubtitleEn ?? DEFAULT_APPEARANCE.headerSubtitleEn,
    teaserTextEs: t.teaserTextEs ?? a.teaserTextEs ?? DEFAULT_APPEARANCE.teaserTextEs,
    teaserTextEn: t.teaserTextEn ?? a.teaserTextEn ?? DEFAULT_APPEARANCE.teaserTextEn,
    starterQuestions: starters,
  };
}

export function resolveBehavior(cfg: WebChatChannelConfig | undefined) {
  const b = cfg?.behavior ?? {};
  return {
    autoOpenDelay: typeof b.autoOpenDelay === 'number' ? b.autoOpenDelay : DEFAULT_BEHAVIOR.autoOpenDelay,
    soundEnabled: typeof b.soundEnabled === 'boolean' ? b.soundEnabled : DEFAULT_BEHAVIOR.soundEnabled,
    sessionTimeoutHours:
      typeof b.sessionTimeoutHours === 'number' ? b.sessionTimeoutHours : DEFAULT_BEHAVIOR.sessionTimeoutHours,
  };
}

export function getAllowedOrigins(cfg: WebChatChannelConfig | undefined): string[] {
  // Read the canonical root-level `allowedOrigins` first (where the settings
  // form + saveWebChatConfig persist it). Fall back to the legacy
  // `behavior.allowedOrigins` path for defense-in-depth — no rows use it today,
  // but this keeps the gate working if an older-shaped row ever appears.
  const list = cfg?.allowedOrigins ?? cfg?.behavior?.allowedOrigins;
  if (!Array.isArray(list)) return [];
  return list.filter((s) => typeof s === 'string' && s.length > 0);
}

// --------------------------------------------
// IP extraction (consistent with whatsapp webhook)
// --------------------------------------------

export function extractClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (xff) return xff;
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  return 'unknown';
}
