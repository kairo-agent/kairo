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
  pollingIntervalMs?: number; // default 3000
}

export interface WidgetConfig {
  enabled: boolean;
  orgName: string;
  appearance: AppearanceConfig;
  behavior: BehaviorConfig;
}

// ─── Messages ────────────────────────────────────────────────────────────────

export type SenderType = 'visitor' | 'ai' | 'agent' | 'system';

export interface WidgetMessage {
  id: string;
  conversationId?: string;
  content: string;
  senderType: SenderType;
  createdAt: string; // ISO
}

// ─── Backend responses ───────────────────────────────────────────────────────

export interface SendMessageResponse {
  ok: boolean;
  conversationId: string;
  messageId?: string;
  error?: string;
}

export interface PollMessagesResponse {
  ok: boolean;
  messages: WidgetMessage[];
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
}

// ─── Embed-time options (parsed from <script> attributes) ────────────────────

export interface EmbedOptions {
  publicKey: string;
  apiBase: string; // e.g. https://app.kairoagent.com
  lang: Lang;
  preview: boolean;
}
