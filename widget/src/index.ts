/**
 * KAIRO WebChat widget — IIFE bundle.
 *
 * Embed:
 *   <script src="https://widget.kairoagent.com/kairo.js" data-key="<publicKey>" defer></script>
 *
 * Optional attributes:
 *   data-lang="es"|"en"   (override autodetect)
 *   data-preview="true"   (sandbox: no network, no localStorage)
 *   data-api="https://app.kairoagent.com"   (override API base — testing only)
 *
 * One bundle supports multiple <script> tags on the same page (multi-tenant
 * preview, multi-brand corporate sites). Each instance gets its own Shadow DOM
 * host scoped by `kairo-widget-<publicKey>`.
 */
import { fetchConfig, pollMessages, sendMessage } from './api';
import {
  ICON_CHAT,
  ICON_CLOSE,
  ICON_LOGO,
  ICON_SEND,
  el,
  escapeHtml,
} from './dom';
import { detectLang, t } from './i18n';
import { playBeep } from './sound';
import { startRealtime, type RealtimeClient } from './realtime';
import {
  clearConversation,
  getConversation,
  getOpen,
  getOrCreateVisitorId,
  newSessionId,
  setConversation,
  setOpen,
} from './storage';
import { buildStyles, resolveStyleVars } from './styles';
import type {
  AppearanceConfig,
  EmbedOptions,
  Lang,
  WidgetConfig,
  WidgetMessage,
  WidgetState,
} from './types';

const DEFAULT_API_BASE = 'https://app.kairoagent.com';
// Fase 4.A: polling becomes a fallback. With Realtime active, we still poll
// at 30s as a safety net (catches dropped WS frames, NAT timeouts, corp WS blocks).
const DEFAULT_POLL_MS = 30000;
const PREVIEW_AI_REPLY_MS = 900;

/**
 * Live widget contexts keyed by publicKey. Lets `Kairo.reset()` reach into a
 * running instance to tear down Realtime + timers cleanly before removing the
 * host element.
 */
const liveContexts = new Map<string, Ctx>();

/** Find every kairo.js <script> on the page and boot a widget per one. */
function bootAll(): void {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-key]');
  const seen = new Set<string>();
  scripts.forEach((s) => {
    const src = s.src || '';
    if (!/kairo\.js(\?|$)/.test(src) && s.getAttribute('data-kairo') !== 'true') return;
    const key = s.getAttribute('data-key') || '';
    if (!key || seen.has(key)) return;
    seen.add(key);
    const opts = parseEmbed(s, key);
    try {
      bootInstance(opts);
    } catch (err) {
      console.error('[KAIRO] failed to boot widget', err);
    }
  });
}

function parseEmbed(scriptTag: HTMLScriptElement, key: string): EmbedOptions {
  const langAttr = (scriptTag.getAttribute('data-lang') || '').toLowerCase() as Lang | '';
  const apiBase = scriptTag.getAttribute('data-api') || deriveApiBase(scriptTag.src);
  return {
    publicKey: key,
    apiBase,
    lang: langAttr === 'es' || langAttr === 'en' ? langAttr : detectLang(),
    preview: scriptTag.getAttribute('data-preview') === 'true',
  };
}

function deriveApiBase(src: string): string {
  // Convention: widget.kairoagent.com -> app.kairoagent.com
  // (Fallback to default if we can't parse.)
  try {
    const u = new URL(src, window.location.href);
    if (u.hostname.startsWith('widget.')) {
      u.hostname = 'app.' + u.hostname.substring('widget.'.length);
      return u.origin;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_API_BASE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-instance bootstrap
// ─────────────────────────────────────────────────────────────────────────────

function bootInstance(opts: EmbedOptions): void {
  const hostId = `kairo-widget-${opts.publicKey}`;
  if (document.getElementById(hostId)) return; // already mounted

  const host = document.createElement('div');
  host.id = hostId;
  host.style.all = 'initial';
  host.setAttribute('data-kairo-host', 'true');
  document.body.appendChild(host);

  // mode 'closed' so host site CSS/JS can't reach into our DOM.
  const shadow = host.attachShadow({ mode: 'closed' });

  const state: WidgetState = {
    open: false,
    loading: true,
    sending: false,
    error: null,
    visitorId: opts.preview ? 'preview-visitor' : getOrCreateVisitorId(),
    conversationId: null,
    sessionId: '',
    lastMessageAt: null,
    messages: [],
    config: null,
    teaserDismissed: false,
    starterUsed: false,
    realtimeTopicSecret: null,
  };

  if (!opts.preview) {
    const snap = getConversation(opts.publicKey);
    if (snap) {
      state.conversationId = snap.conversationId;
      state.sessionId = snap.sessionId;
      state.lastMessageAt = snap.lastMessageAt;
      state.realtimeTopicSecret = snap.realtimeTopicSecret ?? null;
    } else {
      state.sessionId = newSessionId();
    }
    state.open = getOpen(opts.publicKey);
  } else {
    state.sessionId = 'preview-session';
  }

  const ctx = createContext(opts, state, shadow);
  liveContexts.set(opts.publicKey, ctx);
  shadow.appendChild(ctx.styleNode);
  shadow.appendChild(ctx.rootNode);

  // Boot config fetch
  loadConfig(ctx);
}

// ─────────────────────────────────────────────────────────────────────────────
// Context (rendering closure)
// ─────────────────────────────────────────────────────────────────────────────

interface Ctx {
  opts: EmbedOptions;
  state: WidgetState;
  shadow: ShadowRoot;
  styleNode: HTMLStyleElement;
  rootNode: HTMLDivElement;
  // Mutable refs to mounted nodes:
  refs: {
    bubble: HTMLButtonElement | null;
    bubbleIcon: HTMLSpanElement | null;
    teaser: HTMLDivElement | null;
    window: HTMLDivElement | null;
    messages: HTMLDivElement | null;
    input: HTMLTextAreaElement | null;
    sendBtn: HTMLButtonElement | null;
    typingNode: HTMLDivElement | null;
    errorNode: HTMLDivElement | null;
  };
  pollTimer: ReturnType<typeof setInterval> | null;
  autoOpenTimer: ReturnType<typeof setTimeout> | null;
  /** Fase 4.A: live Realtime client (null when polling-only). */
  realtime: RealtimeClient | null;
  /** Coalesces Realtime signals + polling timer ticks into a single fetch. */
  fetchInflight: boolean;
}

function createContext(opts: EmbedOptions, state: WidgetState, shadow: ShadowRoot): Ctx {
  const styleNode = document.createElement('style');
  styleNode.textContent = ''; // populated after config load
  const rootNode = document.createElement('div');
  rootNode.className = 'k-host';
  return {
    opts,
    state,
    shadow,
    styleNode,
    rootNode,
    refs: {
      bubble: null,
      bubbleIcon: null,
      teaser: null,
      window: null,
      messages: null,
      input: null,
      sendBtn: null,
      typingNode: null,
      errorNode: null,
    },
    pollTimer: null,
    autoOpenTimer: null,
    realtime: null,
    fetchInflight: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Config + initial render
// ─────────────────────────────────────────────────────────────────────────────

async function loadConfig(ctx: Ctx): Promise<void> {
  if (ctx.opts.preview) {
    // Preview: synthesize default config so /settings/webchat can demo without backend.
    ctx.state.config = previewConfig();
    ctx.state.loading = false;
    renderAll(ctx);
    return;
  }

  try {
    const cfg = await fetchConfig(ctx.opts);
    if (!cfg.enabled) {
      // Channel disabled: do nothing (don't render bubble).
      ctx.state.loading = false;
      return;
    }
    ctx.state.config = cfg;
    ctx.state.loading = false;
    renderAll(ctx);
    scheduleAutoOpen(ctx);
  } catch (err) {
    console.warn('[KAIRO] config load failed', err);
    ctx.state.loading = false;
    // Fallback: render with KAIRO defaults so widget still appears
    ctx.state.config = previewConfig();
    renderAll(ctx);
  }
}

function previewConfig(): WidgetConfig {
  return {
    enabled: true,
    orgName: 'KAIRO',
    appearance: {},
    behavior: { autoOpenDelay: 0, soundEnabled: true, showBranding: true, pollingIntervalMs: DEFAULT_POLL_MS },
    realtime: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────────────────────

function renderAll(ctx: Ctx): void {
  const cfg = ctx.state.config;
  if (!cfg) return;
  const vars = resolveStyleVars(cfg.appearance);
  ctx.styleNode.textContent = buildStyles(vars);

  // Clean previous tree
  ctx.rootNode.innerHTML = '';

  ctx.rootNode.appendChild(buildLauncher(ctx));

  // Window only when open (saves DOM/render cost)
  if (ctx.state.open) {
    const win = buildWindow(ctx);
    ctx.rootNode.appendChild(win);
    afterWindowMounted(ctx);
  } else {
    stopPolling(ctx);
    stopRealtime(ctx);
  }
}

/**
 * Construye el launcher completo: wrapper clickeable con teaser inline (visible
 * en hover) + bubble dentro. Click en cualquier parte alterna el chat (open/close).
 * Hover expande mostrando el teaser; cuando el chat esta abierto, se reduce a
 * solo el bubble con icono X (rotacion via CSS).
 */
function buildLauncher(ctx: Ctx): HTMLButtonElement {
  const cfg = ctx.state.config!;
  const lang = ctx.opts.lang;
  const labels = t(lang);
  const a = cfg.appearance;

  const launcher = el('button', 'k-launcher');
  launcher.type = 'button';
  launcher.setAttribute('aria-label', ctx.state.open ? labels.close : labels.open);
  if (ctx.state.open) launcher.classList.add('k-launcher--open');

  // Contenido del teaser (visible en hover)
  const content = el('div', 'k-launcher-content');
  const teaserText = (lang === 'es' ? a.teaserTextEs : a.teaserTextEn) || labels.teaserDefault;
  const teaserCta = (lang === 'es' ? a.teaserCtaEs : a.teaserCtaEn) || labels.teaserCta;
  const textEl = el('p', 'k-launcher-text');
  textEl.textContent = teaserText;
  const ctaEl = el('span', 'k-launcher-cta');
  ctaEl.textContent = teaserCta;
  content.appendChild(textEl);
  content.appendChild(ctaEl);
  launcher.appendChild(content);

  // Bubble (siempre visible) — cambia entre icono chat y close via CSS rotation
  const bubble = el('div', 'k-bubble');
  if (a.bubbleLogoUrl) {
    bubble.classList.add('k-bubble--logo');
    bubble.innerHTML = `<img src="${escapeHtml(a.bubbleLogoUrl)}" alt="" />`;
  } else {
    bubble.innerHTML = `<span class="k-icon-chat">${ICON_CHAT}</span><span class="k-icon-close">${ICON_CLOSE}</span>`;
  }
  launcher.appendChild(bubble);

  launcher.addEventListener('click', () => toggleWindow(ctx));
  ctx.refs.bubble = launcher;
  return launcher;
}

function buildWindow(ctx: Ctx): HTMLDivElement {
  const cfg = ctx.state.config!;
  const a: AppearanceConfig = cfg.appearance;
  const lang = ctx.opts.lang;
  const labels = t(lang);
  const win = el('div', 'k-window');
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', labels.open);

  // Header
  const header = el('header', 'k-header');
  const logo = el('div', 'k-header-logo');
  if (a.bubbleLogoUrl) {
    logo.innerHTML = `<img src="${escapeHtml(a.bubbleLogoUrl)}" alt="" />`;
  } else {
    logo.innerHTML = ICON_LOGO;
  }
  // Online dot (estilo chatflow — indica que la conversacion esta activa)
  const onlineDot = el('span', 'k-online-dot');
  logo.appendChild(onlineDot);
  header.appendChild(logo);
  const headerText = el('div', 'k-header-text');
  const title = el('div', 'k-header-title');
  title.textContent =
    (lang === 'es' ? a.headerTitleEs : a.headerTitleEn) || cfg.orgName || labels.defaultHeaderTitle;
  const subtitle = el('div', 'k-header-subtitle');
  subtitle.textContent =
    (lang === 'es' ? a.headerSubtitleEs : a.headerSubtitleEn) || labels.defaultHeaderSubtitle;
  headerText.appendChild(title);
  headerText.appendChild(subtitle);
  header.appendChild(headerText);
  const closeBtn = el('button', 'k-header-close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', labels.close);
  closeBtn.innerHTML = ICON_CLOSE;
  closeBtn.addEventListener('click', () => closeWindow(ctx));
  header.appendChild(closeBtn);
  win.appendChild(header);

  // Preview banner
  if (ctx.opts.preview) {
    const banner = el('div', 'k-preview-banner');
    banner.textContent = labels.preview;
    win.appendChild(banner);
  }

  // Messages
  const list = el('div', 'k-messages');
  list.setAttribute('aria-live', 'polite');
  win.appendChild(list);
  ctx.refs.messages = list;

  // Composer
  const composer = el('form', 'k-composer');
  const textarea = el('textarea', 'k-input') as HTMLTextAreaElement;
  textarea.placeholder = labels.composerPlaceholder;
  textarea.rows = 1;
  textarea.setAttribute('aria-label', labels.composerPlaceholder);
  textarea.addEventListener('input', () => autoGrow(textarea));
  textarea.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitComposer(ctx);
    }
  });
  const sendBtn = el('button', 'k-send');
  sendBtn.type = 'submit';
  sendBtn.innerHTML = ICON_SEND;
  sendBtn.setAttribute('aria-label', labels.send);
  composer.appendChild(textarea);
  composer.appendChild(sendBtn);
  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    submitComposer(ctx);
  });
  win.appendChild(composer);
  ctx.refs.input = textarea;
  ctx.refs.sendBtn = sendBtn;

  // Footer
  if (cfg.behavior.showBranding !== false) {
    const footer = el('div', 'k-footer');
    footer.innerHTML = `<a href="https://kairoagent.com" target="_blank" rel="noopener noreferrer">${escapeHtml(labels.poweredBy)}</a>`;
    win.appendChild(footer);
  }

  ctx.refs.window = win;
  return win;
}

function afterWindowMounted(ctx: Ctx): void {
  renderMessages(ctx);
  // Focus input after slide-in animation
  setTimeout(() => ctx.refs.input?.focus(), 220);
  startPolling(ctx);
  startRealtimeIfPossible(ctx);
}

function autoGrow(ta: HTMLTextAreaElement): void {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
}

// ─────────────────────────────────────────────────────────────────────────────
// Messages render
// ─────────────────────────────────────────────────────────────────────────────

function renderMessages(ctx: Ctx): void {
  const list = ctx.refs.messages;
  if (!list) return;
  list.innerHTML = '';

  const cfg = ctx.state.config!;
  const lang = ctx.opts.lang;
  const labels = t(lang);

  // Welcome panel only if no messages yet
  if (ctx.state.messages.length === 0) {
    const wrap = el('div', 'k-welcome');
    const wTitle = el('div', 'k-welcome-title');
    wTitle.textContent =
      (lang === 'es' ? cfg.appearance.welcomeTitleEs : cfg.appearance.welcomeTitleEn) ||
      labels.defaultWelcomeTitle;
    const wSub = el('div', 'k-welcome-subtitle');
    wSub.textContent =
      (lang === 'es' ? cfg.appearance.welcomeSubtitleEs : cfg.appearance.welcomeSubtitleEn) ||
      labels.defaultWelcomeSubtitle;
    wrap.appendChild(wTitle);
    wrap.appendChild(wSub);
    list.appendChild(wrap);

    // Starter chips
    if (
      !ctx.state.starterUsed &&
      cfg.appearance.starterQuestions &&
      cfg.appearance.starterQuestions.length > 0
    ) {
      const sw = el('div', 'k-starters');
      cfg.appearance.starterQuestions.forEach((q) => {
        const btn = el('button', 'k-starter-btn');
        btn.type = 'button';
        btn.textContent = (lang === 'es' ? q.textEs : q.textEn) || q.textEn || q.textEs || '';
        btn.addEventListener('click', () => {
          ctx.state.starterUsed = true;
          if (ctx.refs.input) {
            ctx.refs.input.value = btn.textContent || '';
            autoGrow(ctx.refs.input);
          }
          submitComposer(ctx);
        });
        sw.appendChild(btn);
      });
      list.appendChild(sw);
    }
  }

  for (const msg of ctx.state.messages) {
    list.appendChild(renderMsgNode(msg, labels.agentBadge));
  }

  if (ctx.state.error) {
    const err = el('div', 'k-error');
    err.textContent = ctx.state.error;
    list.appendChild(err);
    ctx.refs.errorNode = err;
  }

  scrollMessagesToBottom(ctx);
}

function renderMsgNode(msg: WidgetMessage, agentBadge: string): HTMLDivElement {
  const wrap = el('div', `k-msg k-msg-${msg.senderType}`);
  if (msg.senderType === 'agent') {
    const badge = el('div', 'k-agent-badge');
    badge.textContent = agentBadge;
    wrap.appendChild(badge);
  }
  const bubble = el('div', 'k-msg-bubble');
  bubble.textContent = msg.content;
  wrap.appendChild(bubble);
  return wrap;
}

function scrollMessagesToBottom(ctx: Ctx): void {
  const list = ctx.refs.messages;
  if (!list) return;
  // Defer to allow layout
  requestAnimationFrame(() => {
    list.scrollTop = list.scrollHeight;
  });
}

function appendTyping(ctx: Ctx): void {
  removeTyping(ctx);
  const list = ctx.refs.messages;
  if (!list) return;
  const node = el('div', 'k-msg k-msg-ai');
  node.innerHTML = '<div class="k-typing"><span></span><span></span><span></span></div>';
  list.appendChild(node);
  ctx.refs.typingNode = node;
  scrollMessagesToBottom(ctx);
}

function removeTyping(ctx: Ctx): void {
  if (ctx.refs.typingNode && ctx.refs.typingNode.parentNode) {
    ctx.refs.typingNode.parentNode.removeChild(ctx.refs.typingNode);
  }
  ctx.refs.typingNode = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Open / Close window
// ─────────────────────────────────────────────────────────────────────────────

function toggleWindow(ctx: Ctx): void {
  if (ctx.state.open) closeWindow(ctx);
  else openWindow(ctx);
}

function openWindow(ctx: Ctx): void {
  ctx.state.open = true;
  ctx.state.teaserDismissed = true;
  if (!ctx.opts.preview) setOpen(ctx.opts.publicKey, true);
  renderAll(ctx);
}

function closeWindow(ctx: Ctx): void {
  ctx.state.open = false;
  if (!ctx.opts.preview) setOpen(ctx.opts.publicKey, false);
  stopPolling(ctx);
  stopRealtime(ctx);
  renderAll(ctx);
}

function scheduleAutoOpen(ctx: Ctx): void {
  if (ctx.opts.preview) return;
  const delay = ctx.state.config?.behavior.autoOpenDelay || 0;
  if (delay <= 0 || ctx.state.open) return;
  if (ctx.autoOpenTimer) clearTimeout(ctx.autoOpenTimer);
  ctx.autoOpenTimer = setTimeout(() => {
    if (!ctx.state.open) openWindow(ctx);
  }, delay * 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Send + polling
// ─────────────────────────────────────────────────────────────────────────────

function submitComposer(ctx: Ctx): void {
  const input = ctx.refs.input;
  if (!input) return;
  const text = input.value.trim();
  if (!text || ctx.state.sending) return;
  input.value = '';
  autoGrow(input);
  void doSend(ctx, text);
}

async function doSend(ctx: Ctx, text: string): Promise<void> {
  ctx.state.error = null;
  ctx.state.sending = true;
  if (ctx.refs.sendBtn) ctx.refs.sendBtn.disabled = true;

  const visitorMsg: WidgetMessage = {
    id: `local-${Date.now()}`,
    content: text,
    senderType: 'visitor',
    createdAt: new Date().toISOString(),
  };
  ctx.state.messages.push(visitorMsg);
  renderMessages(ctx);
  appendTyping(ctx);

  if (ctx.opts.preview) {
    setTimeout(() => {
      removeTyping(ctx);
      ctx.state.messages.push({
        id: `preview-${Date.now()}`,
        content:
          ctx.opts.lang === 'es'
            ? 'Esto es una vista previa — los mensajes no se envian al servidor.'
            : 'This is a preview — messages are not sent to the server.',
        senderType: 'ai',
        createdAt: new Date().toISOString(),
      });
      ctx.state.sending = false;
      if (ctx.refs.sendBtn) ctx.refs.sendBtn.disabled = false;
      renderMessages(ctx);
    }, PREVIEW_AI_REPLY_MS);
    return;
  }

  try {
    const isFirstMessage = ctx.state.lastMessageAt === null;
    const meta = isFirstMessage
      ? {
          referrer: document.referrer || undefined,
          queryString: window.location.search || undefined,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
        }
      : undefined;

    const res = await sendMessage(ctx.opts, {
      publicKey: ctx.opts.publicKey,
      visitorId: ctx.state.visitorId,
      sessionId: ctx.state.sessionId,
      conversationId: ctx.state.conversationId,
      message: text,
      meta,
    });
    if (!res.ok) throw new Error(res.error || 'send_failed');

    // Persist conversationId + topicSecret from the first response. The
    // topicSecret is shipped only on this initial POST (and refreshed if the
    // visitor clears localStorage). It enables Realtime broadcast subscription.
    const newConversationId = !ctx.state.conversationId;
    if (newConversationId) {
      ctx.state.conversationId = res.conversationId;
    }
    if (res.realtimeTopicSecret && !ctx.state.realtimeTopicSecret) {
      ctx.state.realtimeTopicSecret = res.realtimeTopicSecret;
    }
    if (newConversationId || res.realtimeTopicSecret) {
      setConversation(ctx.opts.publicKey, {
        conversationId: ctx.state.conversationId!,
        sessionId: ctx.state.sessionId,
        lastMessageAt: ctx.state.lastMessageAt,
        realtimeTopicSecret: ctx.state.realtimeTopicSecret,
      });
    }
    // NOTA: NO actualizamos lastMessageAt con visitorMsg.createdAt aqui.
    // Razon: visitorMsg.createdAt es client-time (Date.now() del browser),
    // mientras que el server persiste el message con su propio clock. Si hay
    // clock drift entre client y server (Vercel runs UTC, browser local time),
    // un since=client_time futurista hace que el polling EXCLUYA mensajes que
    // el server creo entremedio (visitor BD + AI response).
    // El polling se encarga de mantener lastMessageAt sincronizado con timestamps
    // del backend (linea ~688).
    startPolling(ctx);
    startRealtimeIfPossible(ctx);
  } catch (err) {
    console.warn('[KAIRO] send failed', err);
    removeTyping(ctx);
    ctx.state.error = t(ctx.opts.lang).errorSend;
    renderMessages(ctx);
  } finally {
    ctx.state.sending = false;
    if (ctx.refs.sendBtn) ctx.refs.sendBtn.disabled = false;
  }
}

function persistLastMsgTs(ctx: Ctx): void {
  if (ctx.opts.preview || !ctx.state.conversationId) return;
  setConversation(ctx.opts.publicKey, {
    conversationId: ctx.state.conversationId,
    sessionId: ctx.state.sessionId,
    lastMessageAt: ctx.state.lastMessageAt,
    // Preserve topicSecret across persists — without this, Realtime is lost
    // on the next reload after polling updates lastMessageAt.
    realtimeTopicSecret: ctx.state.realtimeTopicSecret,
  });
}

/**
 * Start the polling tick. Always fires an immediate `pollOnce` to catch up
 * on any messages that landed while the widget was offline/closed, then
 * arms a setInterval at DEFAULT_POLL_MS (or config override).
 *
 * Idempotent: callers can safely invoke this from multiple places (window
 * mount, WS disconnect, reset) without stacking timers.
 */
function startPolling(ctx: Ctx): void {
  if (ctx.opts.preview) return;
  if (!ctx.state.conversationId) return;
  // Always fire an immediate catch-up poll, even if the timer is already
  // armed — the `fetchInflight` flag in pollOnce coalesces concurrent calls.
  void pollOnce(ctx);
  if (ctx.pollTimer) return;
  const interval = ctx.state.config?.behavior.pollingIntervalMs || DEFAULT_POLL_MS;
  ctx.pollTimer = setInterval(() => void pollOnce(ctx), interval);
}

function stopPolling(ctx: Ctx): void {
  if (ctx.pollTimer) {
    clearInterval(ctx.pollTimer);
    ctx.pollTimer = null;
  }
}

/**
 * Fase 4.A — start the Realtime broadcast subscription when both the topic
 * secret and the Realtime config (URL + anon key) are available.
 *
 * Fase 4.B — when the channel joins successfully we PAUSE the polling timer
 * (saving ~120 redundant fetches/h while WS is healthy) and rely on broadcast
 * signals. If the WS later closes/heartbeat-times-out, `onDisconnect` re-arms
 * polling automatically — the widget never falls into a state where it
 * can't receive messages.
 */
function startRealtimeIfPossible(ctx: Ctx): void {
  if (ctx.opts.preview) return;
  if (ctx.realtime) return; // already running
  if (!ctx.state.conversationId || !ctx.state.realtimeTopicSecret) return;
  const rtCfg = ctx.state.config?.realtime;
  if (!rtCfg || !rtCfg.url || !rtCfg.key) return;

  ctx.realtime = startRealtime({
    supabaseUrl: rtCfg.url,
    anonKey: rtCfg.key,
    topicSecret: ctx.state.realtimeTopicSecret,
    onSignal: () => {
      // Coalesce: if a fetch is already in flight, the broadcast signal is
      // a no-op (the in-flight fetch will see the new message). Otherwise
      // trigger an immediate poll.
      void pollOnce(ctx);
    },
    onConnect: () => {
      // WS healthy → we're done depending on the polling timer.
      // Catch-up fetch first (covers any messages emitted between the last
      // polling tick and the WS join), then suspend the interval.
      void pollOnce(ctx);
      stopPolling(ctx);
    },
    onDisconnect: () => {
      // WS lost → re-arm polling so the widget keeps receiving messages.
      // `startPolling` is idempotent and fires an immediate catch-up poll.
      // Only re-arm if the widget is still open (otherwise the renderAll
      // path already stopped the timer intentionally).
      if (ctx.state.open) startPolling(ctx);
    },
  });
}

function stopRealtime(ctx: Ctx): void {
  if (ctx.realtime) {
    ctx.realtime.close();
    ctx.realtime = null;
  }
}

async function pollOnce(ctx: Ctx): Promise<void> {
  if (!ctx.state.conversationId) return;
  // Coalesce concurrent fetches (broadcast signal + polling tick): only one
  // in-flight at a time. The latest signal will hit the next tick or be
  // covered by the in-flight response.
  if (ctx.fetchInflight) return;
  ctx.fetchInflight = true;
  try {
    const msgs = await pollMessages(ctx.opts, ctx.state.conversationId, ctx.state.lastMessageAt);
    if (!msgs.length) return;

    const known = new Set(ctx.state.messages.map((m) => m.id));
    const fresh = msgs.filter((m) => !known.has(m.id));
    if (!fresh.length) return;

    removeTyping(ctx);
    let gotIncoming = false;
    for (const m of fresh) {
      // Dedup: si el mensaje visitor que llega del polling matchea un local-*
      // optimista, reemplazarlo en lugar de duplicar (mismo content + sender).
      if (m.senderType === 'visitor') {
        const localIdx = ctx.state.messages.findIndex(
          (x) =>
            x.id.startsWith('local-') &&
            x.senderType === 'visitor' &&
            x.content === m.content
        );
        if (localIdx !== -1) {
          ctx.state.messages[localIdx] = m;
          continue;
        }
      }
      ctx.state.messages.push(m);
      if (m.senderType !== 'visitor') gotIncoming = true;
    }
    // Track last message timestamp
    const newest = fresh[fresh.length - 1].createdAt;
    if (newest && (!ctx.state.lastMessageAt || newest > ctx.state.lastMessageAt)) {
      ctx.state.lastMessageAt = newest;
      persistLastMsgTs(ctx);
    }
    renderMessages(ctx);
    if (gotIncoming && ctx.state.config?.behavior.soundEnabled !== false) playBeep();
  } catch (err) {
    // Network blips happen — keep polling, don't surface to the user.
    console.debug('[KAIRO] poll error', err);
  } finally {
    ctx.fetchInflight = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API (so pages can boot manually if defer placement is awkward)
// ─────────────────────────────────────────────────────────────────────────────

interface KairoGlobal {
  reset: (publicKey: string) => void;
  boot: () => void;
}

const api: KairoGlobal = {
  reset(publicKey: string) {
    // Tear down Realtime + polling cleanly BEFORE removing the host so we
    // don't leak a WS connection or a setInterval against a vanished DOM.
    const ctx = liveContexts.get(publicKey);
    if (ctx) {
      stopRealtime(ctx);
      stopPolling(ctx);
      liveContexts.delete(publicKey);
    }
    clearConversation(publicKey);
    setOpen(publicKey, false);
    const host = document.getElementById(`kairo-widget-${publicKey}`);
    if (host) host.remove();
  },
  boot: bootAll,
};
(window as Window & typeof globalThis & { Kairo?: KairoGlobal }).Kairo = api;

// Boot now or on DOMContentLoaded.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAll, { once: true });
} else {
  bootAll();
}
