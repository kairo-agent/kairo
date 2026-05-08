import type { Lang } from './types';

interface Strings {
  defaultHeaderTitle: string;
  defaultHeaderSubtitle: string;
  defaultWelcomeTitle: string;
  defaultWelcomeSubtitle: string;
  defaultTeaser: string;
  teaserDefault: string;
  teaserCta: string;
  composerPlaceholder: string;
  send: string;
  close: string;
  open: string;
  sending: string;
  agentBadge: string;
  errorSend: string;
  errorLoad: string;
  poweredBy: string;
  reconnect: string;
  preview: string;
  /** Fase 4.C — banner shown when an advisor takes over the conversation */
  handoffBanner: string;
  /** Fase 4.D.1 — media upload labels */
  attachImage: string;
  uploading: string;
  uploadFailed: string;
  fileTooLarge: string;
  unsupportedFormat: string;
}

const en: Strings = {
  defaultHeaderTitle: 'Chat with us',
  defaultHeaderSubtitle: 'We typically reply within minutes',
  defaultWelcomeTitle: 'Hi there!',
  defaultWelcomeSubtitle: 'How can we help you today?',
  defaultTeaser: 'Have a question?',
  teaserDefault: 'Have questions?',
  teaserCta: "Let's chat!",
  composerPlaceholder: 'Type a message...',
  send: 'Send',
  close: 'Close',
  open: 'Open chat',
  sending: 'Sending...',
  agentBadge: 'Advisor',
  errorSend: "Couldn't send. Try again.",
  errorLoad: "Couldn't load chat.",
  poweredBy: 'Powered by KAIRO',
  reconnect: 'Reconnecting...',
  preview: 'Preview mode',
  handoffBanner: 'An advisor has joined the chat',
  attachImage: 'Attach image',
  uploading: 'Uploading…',
  uploadFailed: 'Upload failed. Try again.',
  fileTooLarge: 'File too large (max 10 MB)',
  unsupportedFormat: 'Unsupported format. JPEG, PNG, WEBP or GIF only.',
};

const es: Strings = {
  defaultHeaderTitle: 'Habla con nosotros',
  defaultHeaderSubtitle: 'Respondemos en minutos',
  defaultWelcomeTitle: 'Hola!',
  defaultWelcomeSubtitle: 'En que podemos ayudarte hoy?',
  defaultTeaser: 'Tienes alguna pregunta?',
  teaserDefault: 'Tienes preguntas?',
  teaserCta: 'Conversemos!',
  composerPlaceholder: 'Escribe un mensaje...',
  send: 'Enviar',
  close: 'Cerrar',
  open: 'Abrir chat',
  sending: 'Enviando...',
  agentBadge: 'Asesor',
  errorSend: 'No se pudo enviar. Intenta de nuevo.',
  errorLoad: 'No se pudo cargar el chat.',
  poweredBy: 'Con tecnologia KAIRO',
  reconnect: 'Reconectando...',
  preview: 'Modo vista previa',
  handoffBanner: 'Un asesor se ha unido al chat',
  attachImage: 'Adjuntar imagen',
  uploading: 'Subiendo…',
  uploadFailed: 'No se pudo subir. Intenta de nuevo.',
  fileTooLarge: 'Archivo muy grande (max 10 MB)',
  unsupportedFormat: 'Formato no soportado. Solo JPEG, PNG, WEBP o GIF.',
};

const dict: Record<Lang, Strings> = { en, es };

export function detectLang(): Lang {
  const nav = (navigator.language || 'en').toLowerCase();
  return nav.startsWith('es') ? 'es' : 'en';
}

export function t(lang: Lang): Strings {
  return dict[lang] || en;
}
