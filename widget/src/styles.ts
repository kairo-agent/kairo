import type { AppearanceConfig } from './types';

interface StyleVars {
  bubbleColor: string;
  bubbleIconColor: string;
  headerBg: string;
  headerText: string;
  visitorBg: string;
  visitorText: string;
  aiBg: string;
  aiText: string;
  agentBadgeBg: string;
  agentBadgeText: string;
  sendBtnColor: string;
  position: 'right' | 'left';
}

const KAIRO_CYAN = '#00E5FF';
const KAIRO_MIDNIGHT = '#0B1220';

export function resolveStyleVars(a: AppearanceConfig): StyleVars {
  return {
    bubbleColor: a.bubbleColor || KAIRO_CYAN,
    bubbleIconColor: a.bubbleIconColor || KAIRO_MIDNIGHT,
    headerBg: a.headerBgColor || KAIRO_MIDNIGHT,
    headerText: a.headerTextColor || '#FFFFFF',
    visitorBg: a.visitorBubbleBg || KAIRO_CYAN,
    visitorText: a.visitorBubbleText || KAIRO_MIDNIGHT,
    aiBg: a.aiBubbleBg || '#F1F5F9',
    aiText: a.aiBubbleText || '#0B1220',
    agentBadgeBg: a.agentBadgeBg || '#0E7490',
    agentBadgeText: a.agentBadgeText || '#FFFFFF',
    sendBtnColor: a.sendButtonColor || KAIRO_CYAN,
    position: a.position || 'right',
  };
}

/** Inline CSS injected into the Shadow DOM so host site styles can't leak in. */
export function buildStyles(v: StyleVars): string {
  const sideProp = v.position === 'left' ? 'left' : 'right';
  return `
:host, *, *::before, *::after { box-sizing: border-box; }
.k-host {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: #0B1220;
  -webkit-font-smoothing: antialiased;
}
button { font: inherit; cursor: pointer; }

/* ── Bubble (FAB) ─────────────────────────────────── */
.k-bubble {
  position: fixed;
  bottom: 20px;
  ${sideProp}: 20px;
  width: 56px; height: 56px;
  border-radius: 50%;
  background: ${v.bubbleColor};
  color: ${v.bubbleIconColor};
  border: none;
  box-shadow: 0 8px 24px rgba(11,18,32,0.18), 0 2px 6px rgba(11,18,32,0.12);
  display: flex; align-items: center; justify-content: center;
  z-index: 2147483645;
  transition: transform 180ms ease, box-shadow 180ms ease;
}
.k-bubble:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 12px 28px rgba(11,18,32,0.22); }
.k-bubble:focus-visible { outline: 2px solid ${KAIRO_CYAN}; outline-offset: 3px; }
.k-bubble svg { width: 28px; height: 28px; fill: currentColor; }
.k-bubble--logo { background: transparent; box-shadow: none; }
.k-bubble--logo img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

/* ── Teaser ───────────────────────────────────────── */
.k-teaser {
  position: fixed;
  bottom: 88px;
  ${sideProp}: 20px;
  max-width: 240px;
  background: #FFFFFF;
  color: #0B1220;
  padding: 10px 32px 10px 14px;
  border-radius: 14px;
  box-shadow: 0 8px 20px rgba(11,18,32,0.16);
  font-size: 13.5px;
  z-index: 2147483644;
  cursor: pointer;
  animation: k-pop 240ms ease-out;
}
.k-teaser-close {
  position: absolute;
  top: 6px; right: 6px;
  width: 20px; height: 20px;
  border: none;
  background: transparent;
  color: #64748B;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  padding: 0;
}
.k-teaser-close:hover { background: #F1F5F9; }
.k-teaser-close svg { width: 12px; height: 12px; fill: currentColor; }
@keyframes k-pop {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── Window ───────────────────────────────────────── */
.k-window {
  position: fixed;
  bottom: 88px;
  ${sideProp}: 20px;
  width: 360px; height: 600px; max-height: calc(100vh - 110px);
  background: #FFFFFF;
  border-radius: 16px;
  box-shadow: 0 24px 48px rgba(11,18,32,0.22), 0 4px 12px rgba(11,18,32,0.12);
  display: flex; flex-direction: column;
  overflow: hidden;
  z-index: 2147483646;
  animation: k-slide-up 220ms ease-out;
}
@keyframes k-slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 480px) {
  .k-window {
    inset: 0; width: 100vw; height: 100dvh; max-height: 100dvh;
    border-radius: 0;
  }
}

/* ── Header ───────────────────────────────────────── */
.k-header {
  background: ${v.headerBg};
  color: ${v.headerText};
  padding: 14px 16px;
  display: flex; align-items: center; gap: 12px;
  flex-shrink: 0;
}
.k-header-logo {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(255,255,255,0.1);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.k-header-logo img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.k-header-logo svg { width: 20px; height: 20px; fill: currentColor; }
.k-header-text { flex: 1; min-width: 0; }
.k-header-title { font-weight: 600; font-size: 15px; line-height: 1.2; }
.k-header-subtitle { font-size: 12px; opacity: 0.8; margin-top: 2px; }
.k-header-close {
  width: 32px; height: 32px; border: none; padding: 0;
  background: transparent; color: inherit; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.k-header-close:hover { background: rgba(255,255,255,0.12); }
.k-header-close svg { width: 18px; height: 18px; fill: currentColor; }

/* ── Messages list ────────────────────────────────── */
.k-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex; flex-direction: column; gap: 10px;
  background: #F8FAFC;
  scroll-behavior: smooth;
}
.k-messages::-webkit-scrollbar { width: 6px; }
.k-messages::-webkit-scrollbar-thumb { background: rgba(11,18,32,0.12); border-radius: 3px; }

.k-welcome {
  text-align: center;
  padding: 24px 12px 16px;
  color: #475569;
}
.k-welcome-title { font-weight: 600; font-size: 16px; color: #0B1220; margin-bottom: 4px; }
.k-welcome-subtitle { font-size: 13px; }

/* ── Bubble messages ──────────────────────────────── */
.k-msg { display: flex; flex-direction: column; max-width: 82%; word-wrap: break-word; }
.k-msg-visitor { align-self: flex-end; align-items: flex-end; }
.k-msg-ai, .k-msg-agent, .k-msg-system { align-self: flex-start; align-items: flex-start; }
.k-msg-bubble {
  padding: 9px 13px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
.k-msg-visitor .k-msg-bubble {
  background: ${v.visitorBg};
  color: ${v.visitorText};
  border-bottom-right-radius: 4px;
}
.k-msg-ai .k-msg-bubble, .k-msg-agent .k-msg-bubble {
  background: ${v.aiBg};
  color: ${v.aiText};
  border-bottom-left-radius: 4px;
}
.k-msg-system .k-msg-bubble {
  background: transparent;
  color: #64748B;
  font-size: 12px;
  font-style: italic;
  padding: 4px 8px;
}
.k-agent-badge {
  display: inline-block;
  background: ${v.agentBadgeBg};
  color: ${v.agentBadgeText};
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 6px;
  margin-bottom: 4px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

/* ── Typing indicator ─────────────────────────────── */
.k-typing { display: inline-flex; gap: 4px; padding: 12px 14px; background: ${v.aiBg}; border-radius: 16px; border-bottom-left-radius: 4px; }
.k-typing span { width: 6px; height: 6px; border-radius: 50%; background: #94A3B8; animation: k-bounce 1.2s infinite ease-in-out; }
.k-typing span:nth-child(2) { animation-delay: 0.15s; }
.k-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes k-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }

/* ── Starter questions ────────────────────────────── */
.k-starters { display: flex; flex-direction: column; gap: 8px; padding: 0 4px; }
.k-starter-btn {
  text-align: left;
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  color: #0B1220;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13.5px;
  transition: background 120ms ease, border-color 120ms ease;
}
.k-starter-btn:hover { background: #F1F5F9; border-color: ${v.sendBtnColor}; }

/* ── Composer ─────────────────────────────────────── */
.k-composer {
  border-top: 1px solid #E2E8F0;
  background: #FFFFFF;
  padding: 10px 12px;
  display: flex; align-items: flex-end; gap: 8px;
  flex-shrink: 0;
}
.k-input {
  flex: 1;
  resize: none;
  border: 1px solid #E2E8F0;
  border-radius: 18px;
  padding: 9px 14px;
  font: inherit;
  outline: none;
  max-height: 120px;
  min-height: 38px;
  background: #FFFFFF;
  color: #0B1220;
  transition: border-color 120ms ease;
  overflow-y: auto;
}
.k-input:focus { border-color: ${v.sendBtnColor}; }
.k-input::placeholder { color: #94A3B8; }
.k-send {
  width: 38px; height: 38px;
  border: none;
  border-radius: 50%;
  background: ${v.sendBtnColor};
  color: ${KAIRO_MIDNIGHT};
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: opacity 120ms ease;
}
.k-send:disabled { opacity: 0.45; cursor: not-allowed; }
.k-send svg { width: 18px; height: 18px; fill: currentColor; }

/* ── Footer ──────────────────────────────────────── */
.k-footer {
  text-align: center;
  font-size: 11px;
  color: #94A3B8;
  padding: 4px 12px 8px;
  background: #FFFFFF;
}
.k-footer a { color: inherit; text-decoration: none; }
.k-footer a:hover { color: ${v.sendBtnColor}; }

.k-error {
  background: #FEF2F2;
  color: #B91C1C;
  border: 1px solid #FECACA;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  margin: 8px 12px 0;
}

.k-preview-banner {
  background: #FEF3C7;
  color: #92400E;
  font-size: 11.5px;
  text-align: center;
  padding: 4px 8px;
  font-weight: 600;
}

/* ── Hidden util ──────────────────────────────────── */
.k-hidden { display: none !important; }
`;
}
