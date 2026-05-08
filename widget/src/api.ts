import type {
  EmbedOptions,
  HandoffMode,
  PollMessagesResponse,
  SendMessageResponse,
  WidgetConfig,
  WidgetMessage,
} from './types';

export interface PollResult {
  messages: WidgetMessage[];
  handoffMode: HandoffMode;
}

interface SendMessageInput {
  publicKey: string;
  visitorId: string;
  sessionId: string;
  conversationId: string | null;
  message: string;
  meta?: {
    referrer?: string;
    queryString?: string;
    pageUrl?: string;
    userAgent?: string;
  };
}

async function jsonFetch<T>(url: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
      mode: 'cors',
      credentials: 'omit',
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchConfig(opts: EmbedOptions): Promise<WidgetConfig> {
  const url = `${opts.apiBase}/api/widget/config?key=${encodeURIComponent(opts.publicKey)}`;
  return jsonFetch<WidgetConfig>(url, { method: 'GET' });
}

export async function sendMessage(
  opts: EmbedOptions,
  input: SendMessageInput
): Promise<SendMessageResponse> {
  const url = `${opts.apiBase}/api/webhooks/webchat`;
  // Shape acordado con /api/webhooks/webchat (Fase 3.2): message es objeto
  // tipado para extensibilidad a image/audio/document (Fase 4).
  return jsonFetch<SendMessageResponse>(url, {
    method: 'POST',
    body: JSON.stringify({
      publicKey: input.publicKey,
      visitorId: input.visitorId,
      sessionId: input.sessionId,
      conversationId: input.conversationId,
      message: {
        type: 'text',
        text: input.message,
      },
      meta: input.meta || null,
    }),
  });
}

export async function pollMessages(
  opts: EmbedOptions,
  conversationId: string,
  since: string | null
): Promise<PollResult> {
  const params = new URLSearchParams({
    key: opts.publicKey,
    conversationId,
  });
  if (since) params.set('since', since);
  const url = `${opts.apiBase}/api/webchat/messages?${params.toString()}`;
  const res = await jsonFetch<PollMessagesResponse>(url, { method: 'GET' });
  return {
    messages: res.messages || [],
    // Default 'ai' for older backends that may not include the field.
    handoffMode: res.handoffMode ?? 'ai',
  };
}
