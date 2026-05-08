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

/* ── Launcher wrapper (estilo chatflow360) ───────────
   El wrapper esta pegado al borde derecho (right:0).
   Collapsed: solo bubble visible (max-width 80px).
   Hover: expande hacia la izquierda mostrando teaser + CTA.
   Open: solo bubble con icono X.
   Click en cualquier parte del wrapper: alterna chat.
*/
.k-launcher {
  position: fixed;
  bottom: 24px;
  ${sideProp}: 0;
  display: flex;
  align-items: center;
  flex-direction: ${v.position === 'left' ? 'row' : 'row-reverse'};
  background: transparent;
  border-radius: ${v.position === 'left' ? '0 40px 40px 0' : '40px 0 0 40px'};
  overflow: hidden;
  max-width: 80px;
  cursor: pointer;
  transition: max-width 320ms cubic-bezier(0.16, 1, 0.3, 1),
              background 240ms ease,
              padding 240ms ease,
              box-shadow 240ms ease;
  z-index: 2147483645;
  border: none;
  padding: 12px;
  font-family: inherit;
}
.k-launcher:hover:not(.k-launcher--open),
.k-launcher--expanded:not(.k-launcher--open) {
  max-width: 340px;
  background: #FFFFFF;
  box-shadow: 0 10px 28px rgba(11,18,32,0.18), 0 2px 6px rgba(11,18,32,0.10);
  padding: 8px;
  gap: 14px;
}
.k-launcher-content {
  display: none;
  flex-direction: column;
  align-items: ${v.position === 'left' ? 'flex-start' : 'flex-end'};
  justify-content: center;
  gap: 2px;
  white-space: nowrap;
  flex-shrink: 0;
  padding: 0 6px;
}
.k-launcher:hover:not(.k-launcher--open) .k-launcher-content,
.k-launcher--expanded:not(.k-launcher--open) .k-launcher-content {
  display: flex;
}
.k-launcher-text {
  font-size: 12.5px;
  color: #64748B;
  font-weight: 500;
  margin: 0;
  line-height: 1.3;
  letter-spacing: 0.01em;
}
.k-launcher-cta {
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.25;
  color: ${v.headerBg};
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  cursor: inherit;
  font-family: inherit;
}
.k-bubble {
  width: 56px; height: 56px;
  min-width: 56px;
  border-radius: 50%;
  background: ${v.bubbleColor};
  color: ${v.bubbleIconColor};
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  position: relative;
  box-shadow: 0 4px 14px rgba(11,18,32,0.22);
  animation: k-pulse 2.4s ease-in-out infinite;
}
.k-launcher:hover .k-bubble,
.k-launcher--open .k-bubble {
  animation: none;
}
.k-bubble svg { width: 26px; height: 26px; fill: currentColor; transition: transform 240ms ease, opacity 200ms ease; }
.k-icon-chat, .k-icon-close {
  display: flex; align-items: center; justify-content: center;
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  transition: transform 240ms ease, opacity 200ms ease;
}
.k-icon-close {
  transform: translate(-50%, -50%) rotate(-90deg) scale(0);
  opacity: 0;
}
.k-launcher--open .k-icon-chat {
  transform: translate(-50%, -50%) rotate(90deg) scale(0);
  opacity: 0;
}
.k-launcher--open .k-icon-close {
  transform: translate(-50%, -50%) rotate(0) scale(1);
  opacity: 1;
}
.k-bubble--logo { background: transparent; }
.k-bubble--logo img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

@keyframes k-pulse {
  0%, 100% { box-shadow: 0 4px 14px rgba(11,18,32,0.22), 0 0 0 0 ${v.bubbleColor}66; }
  50% { box-shadow: 0 6px 18px rgba(11,18,32,0.26), 0 0 0 12px ${v.bubbleColor}00; }
}

/* ── Window — side panel pegado al borde, full-height ─ */
.k-window {
  position: fixed;
  top: 0;
  ${sideProp}: 0;
  bottom: 0;
  width: 420px;
  height: 100vh;
  height: 100dvh;
  background: #FFFFFF;
  box-shadow: ${v.position === 'left' ? '4px' : '-4px'} 0 24px rgba(11,18,32,0.16);
  border-radius: 0;
  display: flex; flex-direction: column;
  overflow: hidden;
  z-index: 2147483646;
  animation: k-slide-side 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes k-slide-side {
  from { opacity: 0; transform: translateX(${v.position === 'left' ? '-' : ''}32px); }
  to { opacity: 1; transform: translateX(0); }
}

@media (max-width: 480px) {
  .k-window {
    width: 100vw;
    inset: 0;
  }
}

/* ── Header — gradient + avatar prominente + curva overlap ─ */
.k-header {
  background: linear-gradient(135deg, ${v.headerBg} 0%, ${v.headerBg}EE 100%);
  color: ${v.headerText};
  padding: 18px 20px 30px;
  display: flex; align-items: center; gap: 14px;
  flex-shrink: 0;
  position: relative;
}
.k-header-logo {
  width: 42px; height: 42px; border-radius: 50%;
  background: rgba(255,255,255,0.15);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  position: relative;
}
.k-header-logo img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.k-header-logo svg { width: 22px; height: 22px; fill: currentColor; }
.k-online-dot {
  position: absolute;
  bottom: 0; right: 0;
  width: 11px; height: 11px;
  border-radius: 50%;
  background: #10B981;
  border: 2px solid ${v.headerBg};
}
.k-header-text { flex: 1; min-width: 0; }
.k-header-title { font-weight: 600; font-size: 16px; line-height: 1.2; letter-spacing: -0.01em; }
.k-header-subtitle { font-size: 12px; opacity: 0.75; margin-top: 3px; }
.k-header-close {
  width: 32px; height: 32px; border: none; padding: 0;
  background: transparent; color: inherit; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  opacity: 0.75;
  transition: opacity 120ms ease, background 120ms ease;
}
.k-header-close:hover { background: rgba(255,255,255,0.12); opacity: 1; }
.k-header-close svg { width: 18px; height: 18px; fill: currentColor; }

/* ── Messages list — overlap header con curva top ─── */
.k-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
  display: flex; flex-direction: column; gap: 10px;
  background: #F8FAFC;
  border-radius: 16px 16px 0 0;
  margin-top: -16px;
  position: relative;
  z-index: 1;
  scroll-behavior: smooth;
}
.k-messages::-webkit-scrollbar { width: 6px; }
.k-messages::-webkit-scrollbar-thumb { background: rgba(11,18,32,0.12); border-radius: 3px; }
.k-messages::-webkit-scrollbar-thumb:hover { background: rgba(11,18,32,0.22); }

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

/* Fase 4.D.1 — paperclip attach button + image preview/thumbnail */
.k-attach {
  width: 36px; height: 36px;
  border: none;
  background: transparent;
  border-radius: 50%;
  color: #64748B;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background 120ms ease, color 120ms ease;
}
.k-attach:hover { background: #F1F5F9; color: ${v.sendBtnColor}; }
.k-attach:disabled { opacity: 0.45; cursor: not-allowed; }
.k-attach svg { width: 18px; height: 18px; fill: currentColor; }
.k-msg-image {
  max-width: 220px;
  max-height: 220px;
  border-radius: 14px;
  display: block;
  cursor: pointer;
  object-fit: cover;
}
/* Fase 4.D.2 — native audio player. Width matches typical bubble copy. */
.k-msg-audio {
  width: 240px;
  max-width: 100%;
  height: 36px;
  border-radius: 18px;
  background: ${v.aiBg};
  display: block;
}
.k-upload-status {
  font-size: 11.5px;
  color: #94A3B8;
  font-style: italic;
  padding: 0 12px 4px;
}

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

/* Fase 4.C — sticky banner shown when an advisor takes over the chat. */
.k-handoff-banner {
  background: ${v.agentBadgeBg};
  color: ${v.agentBadgeText};
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  padding: 8px 12px;
  margin: 0 0 8px 0;
  border-radius: 6px;
  letter-spacing: 0.01em;
}

/* ── Hidden util ──────────────────────────────────── */
.k-hidden { display: none !important; }
`;
}
