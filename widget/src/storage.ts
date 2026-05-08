// Lightweight typed wrapper over localStorage. Silently no-ops if storage is
// unavailable (private browsing / disabled cookies) so the widget still works.

const VISITOR_KEY = 'kairo_visitor_id';

function uuid(): string {
  // RFC4122 v4 — uses crypto.getRandomValues when available.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return (crypto as Crypto & { randomUUID: () => string }).randomUUID();
    } catch {
      /* fallthrough */
    }
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* no-op */
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* no-op */
  }
}

export function getOrCreateVisitorId(): string {
  let id = safeGet(VISITOR_KEY);
  if (!id) {
    id = uuid();
    safeSet(VISITOR_KEY, id);
  }
  return id;
}

interface ConvSnapshot {
  conversationId: string;
  sessionId: string;
  lastMessageAt: string | null;
  /**
   * Fase 4.A: per-conversation Realtime topic secret (UUID v4).
   * Treated as a session secret — never logged, never sent to other origins.
   * Cleared when the visitor calls `Kairo.reset(publicKey)`.
   */
  realtimeTopicSecret?: string | null;
}

export function getConversation(publicKey: string): ConvSnapshot | null {
  const raw = safeGet(`kairo_conv_${publicKey}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ConvSnapshot;
  } catch {
    return null;
  }
}

export function setConversation(publicKey: string, snap: ConvSnapshot): void {
  safeSet(`kairo_conv_${publicKey}`, JSON.stringify(snap));
}

export function clearConversation(publicKey: string): void {
  safeRemove(`kairo_conv_${publicKey}`);
}

export function getOpen(publicKey: string): boolean {
  return safeGet(`kairo_open_${publicKey}`) === '1';
}

export function setOpen(publicKey: string, open: boolean): void {
  if (open) safeSet(`kairo_open_${publicKey}`, '1');
  else safeRemove(`kairo_open_${publicKey}`);
}

export function newSessionId(): string {
  return uuid();
}
