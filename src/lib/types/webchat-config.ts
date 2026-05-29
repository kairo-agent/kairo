/**
 * Tipos compartidos para WebChat config (Fase 3 — v0.25.0).
 *
 * Vive aqui (no en project-channels.ts) porque ese archivo es 'use server'
 * y solo puede exportar funciones async (regla KAIRO 12).
 */

export type WebChatPosition = 'bottom-right' | 'bottom-left';
export type WebChatBubbleShape = 'circle' | 'square';

export interface WebChatAppearance {
  position: WebChatPosition;
  bubbleColor: string;
  bubbleShape: WebChatBubbleShape;
  headerBgColor: string;
  /**
   * @deprecated v0.27.5 — ya no se configura ni se usa. El color del texto del
   * header se calcula con la formula YIQ segun `headerBgColor` (igual que la
   * burbuja y el boton de enviar). Se conserva en el tipo/schema para no romper
   * configs guardadas; el formulario ya no lo expone y el widget lo ignora.
   */
  headerTextColor: string;
  visitorBubbleBg: string;
  visitorBubbleText: string;
  aiBubbleBg: string;
  aiBubbleText: string;
  logoUrl: string | null;
}

export interface WebChatTexts {
  headerTitleEs: string;
  headerTitleEn: string;
  headerSubtitleEs: string;
  headerSubtitleEn: string;
  teaserTextEs: string;
  teaserTextEn: string;
}

export interface WebChatStarterQuestion {
  textEs: string;
  textEn: string;
}

export interface WebChatBehavior {
  autoOpenDelay: number; // 0 = no auto-open. range 0-60 seconds
  soundEnabled: boolean;
  sessionTimeoutHours: number; // range 1-24
}

export interface WebChatConfig {
  appearance: WebChatAppearance;
  texts: WebChatTexts;
  starterQuestions: WebChatStarterQuestion[]; // max 5
  behavior: WebChatBehavior;
  allowedOrigins: string[];
}

export const MAX_STARTER_QUESTIONS = 5;
export const MAX_HEADER_TITLE_LENGTH = 40;
export const MAX_HEADER_SUBTITLE_LENGTH = 80;
export const MAX_TEASER_LENGTH = 120;
export const MAX_STARTER_QUESTION_LENGTH = 80;

export const DEFAULT_WEBCHAT_CONFIG: WebChatConfig = {
  appearance: {
    position: 'bottom-right',
    bubbleColor: '#00E5FF',
    bubbleShape: 'circle',
    headerBgColor: '#0B1220',
    headerTextColor: '#FFFFFF',
    visitorBubbleBg: '#00E5FF',
    visitorBubbleText: '#0B1220',
    aiBubbleBg: '#F1F5F9',
    aiBubbleText: '#0B1220',
    logoUrl: null,
  },
  texts: {
    headerTitleEs: 'Hola, soy KAIRO',
    headerTitleEn: 'Hi, I am KAIRO',
    headerSubtitleEs: 'Estoy aqui para ayudarte',
    headerSubtitleEn: 'I am here to help you',
    teaserTextEs: '¿Necesitas ayuda? Escribeme',
    teaserTextEn: 'Need help? Chat with me',
  },
  starterQuestions: [],
  behavior: {
    autoOpenDelay: 0,
    soundEnabled: true,
    sessionTimeoutHours: 2,
  },
  allowedOrigins: [],
};

/**
 * Merge user-stored config (raw JSON from BD, may be partial / outdated)
 * con defaults. Asegura backward-compat cuando agregamos campos nuevos.
 */
export function mergeWebChatConfig(raw: Record<string, unknown> | null | undefined): WebChatConfig {
  const r = (raw ?? {}) as Partial<WebChatConfig>;
  return {
    appearance: { ...DEFAULT_WEBCHAT_CONFIG.appearance, ...(r.appearance ?? {}) },
    texts: { ...DEFAULT_WEBCHAT_CONFIG.texts, ...(r.texts ?? {}) },
    starterQuestions: Array.isArray(r.starterQuestions) ? r.starterQuestions.slice(0, MAX_STARTER_QUESTIONS) : [],
    behavior: { ...DEFAULT_WEBCHAT_CONFIG.behavior, ...(r.behavior ?? {}) },
    allowedOrigins: Array.isArray(r.allowedOrigins) ? r.allowedOrigins : [],
  };
}
