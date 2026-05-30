// ─── Public API: embed payload (matches /api/widget/config response) ──────────

export type Lang = 'es' | 'en';

export interface AppearanceConfig {
  // Header
  headerTitleEs?: string;
  headerTitleEn?: string;
  headerSubtitleEs?: string;
  headerSubtitleEn?: string;
  headerBgColor?: string;
  headerTextColor?: string;

  // Bubble
  bubbleColor?: string;
  bubbleIconColor?: string;
  bubbleLogoUrl?: string;
  bubbleShape?: 'circle' | 'square';
  position?: 'right' | 'left';

  // Welcome / Teaser
  welcomeTitleEs?: string;
  welcomeTitleEn?: string;
  welcomeSubtitleEs?: string;
  welcomeSubtitleEn?: string;
  teaserTextEs?: string;
  teaserTextEn?: string;
  teaserCtaEs?: string;
  teaserCtaEn?: string;

  // Messages
  visitorBubbleBg?: string;
  visitorBubbleText?: string;
  aiBubbleBg?: string;
  aiBubbleText?: string;
  agentBadgeBg?: string;
  agentBadgeText?: string;

  // Composer
  sendButtonColor?: string;

  // Starter questions
  starterQuestions?: StarterQuestion[];
}

export interface StarterQuestion {
  textEs: string;
  textEn: string;
}

export interface BehaviorConfig {
  autoOpenDelay?: number; // seconds; 0 = disabled
  soundEnabled?: boolean;
  showBranding?: boolean; // "Powered by KAIRO"
  pollingIntervalMs?: number; // Fase 4.A: fallback polling interval (default 30s)
  sessionTimeoutHours?: number; // v0.27.5: inactividad tras la cual la sesion se "cierra" visualmente (default 2)
}

/** Fase 4.A: Realtime broadcast endpoint shipped by /api/widget/config. */
export interface RealtimeConfig {
  url: string; // Supabase project URL (https://xxx.supabase.co)
  key: string; // anon key (already public in dashboard clients)
}

export interface WidgetConfig {
  enabled: boolean;
  orgName: string;
  appearance: AppearanceConfig;
  behavior: BehaviorConfig;
  /** Fase 4.A: optional. If absent, widget falls back to polling-only. */
  realtime?: RealtimeConfig | null;
}

// ─── Messages ────────────────────────────────────────────────────────────────

export type SenderType = 'visitor' | 'ai' | 'agent' | 'system';

/** Fase 4.D.1: media kinds the widget knows how to render. */
export type MediaKind = 'image' | 'audio' | 'document';

export interface WidgetMessage {
  id: string;
  conversationId?: string;
  content: string;
  senderType: SenderType;
  createdAt: string; // ISO
  /** Fase 4.D.1: optional media URL — drives thumbnail/audio/file rendering. */
  mediaUrl?: string;
  mediaKind?: MediaKind;
  /** Fase 4.D.3: original filename for documents (rendered in the file card). */
  filename?: string;
}

// ─── Backend responses ───────────────────────────────────────────────────────

export interface SendMessageResponse {
  ok: boolean;
  conversationId: string;
  messageId?: string;
  error?: string;
  /** Fase 4.A: per-conversation Realtime topic secret (UUID v4). */
  realtimeTopicSecret?: string;
}

/** Fase 4.C: handoff state shared with the widget per poll response. */
export type HandoffMode = 'ai' | 'human';

export interface PollMessagesResponse {
  ok: boolean;
  messages: WidgetMessage[];
  /** Fase 4.C: 'human' triggers the "advisor joined" banner in the widget. */
  handoffMode?: HandoffMode;
}

// ─── Widget runtime state ────────────────────────────────────────────────────

export interface WidgetState {
  open: boolean;
  loading: boolean;
  sending: boolean;
  error: string | null;
  visitorId: string;
  conversationId: string | null;
  sessionId: string;
  lastMessageAt: string | null;
  messages: WidgetMessage[];
  config: WidgetConfig | null;
  teaserDismissed: boolean;
  starterUsed: boolean;
  /** Fase 4.A: secret topic name for the Realtime broadcast (per conversation). */
  realtimeTopicSecret: string | null;
  /** Fase 4.C: tracked from polling responses; drives the "advisor joined" banner. */
  handoffMode: HandoffMode;
  /**
   * v0.27.5: cursor que marca el inicio de la sesion visible actual.
   * - null = sesion original (se muestra todo el historial).
   * - ISO ts = frontera tras una expiracion por inactividad; solo se muestran
   *   mensajes posteriores (el backend sigue siendo el mismo lead/conversacion).
   */
  sessionStartedAt: string | null;
  /**
   * v0.27.5: true en el arranque en frio cuando se restaura una conversacion
   * existente. El primer poll usa `since=sessionStartedAt` para recargar el
   * transcript visible (sin esto, el chat aparecia vacio tras un refresh).
   */
  coldBoot: boolean;
}

// ─── Embed-time options (parsed from <script> attributes) ────────────────────

export interface EmbedOptions {
  publicKey: string;
  apiBase: string; // e.g. https://app.kairoagent.com
  lang: Lang;
  preview: boolean;
}
