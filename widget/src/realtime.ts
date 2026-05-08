// ============================================
// KAIRO WebChat Widget — Realtime client (Fase 4.A)
//
// Phoenix Channels protocol over a vanilla WebSocket. Same wire-level shape
// the supabase-js Realtime client uses, but without the SDK weight (~15 KB
// gzip saved). Pattern reference: ChatFlow360 widget (read-only).
//
// Threat model: signal-only.
//   - The widget joins a topic `realtime:wc:<UUID>` (UUID v4 secret returned
//     by /api/webhooks/webchat). On any `broadcast.new_message` event, we
//     IGNORE the payload and call `onSignal()`, which triggers a polling
//     fetch through the authenticated /api/webchat/messages endpoint. So
//     even if an attacker somehow wrote to the topic, the widget never
//     renders attacker-controlled content.
//
//   - On any failure (connect timeout, phx_join error, close, heartbeat
//     timeout), we fall through to the existing 30s polling timer — the
//     widget never depends on Realtime being up.
//
// Notes for maintainers:
//   - We never log topicSecret nor the apikey.
//   - Reconnect is bounded with exponential backoff, capped at 30s.
//   - Closing during page unload is fine; the WS disconnects automatically.
// ============================================

const HEARTBEAT_MS = 25000;
const HEARTBEAT_TIMEOUT_MS = 35000; // if no reply within 35s, force-close
const RECONNECT_BASE_MS = 1500;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_MAX_ATTEMPTS = 8; // gives up after ~3min total — polling covers

export interface RealtimeClientOptions {
  /** https://xxx.supabase.co  — converted to wss://xxx.supabase.co/realtime/v1/websocket */
  supabaseUrl: string;
  /** Supabase anon key (already public). */
  anonKey: string;
  /** UUID v4 from Conversation.realtimeTopicSecret. */
  topicSecret: string;
  /** Called when a new message signal arrives (payload is intentionally ignored). */
  onSignal: () => void;
  /** Called when connect transitions; useful for telemetry / fallback toggles. */
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface RealtimeClient {
  /** Tear down the WS, cancel timers, prevent further reconnects. */
  close: () => void;
  /** True if the underlying WS is OPEN and we've successfully joined the topic. */
  isJoined: () => boolean;
}

interface PhoenixMessage {
  topic: string;
  event: string;
  payload?: unknown;
  ref?: string;
}

export function startRealtime(opts: RealtimeClientOptions): RealtimeClient {
  let ws: WebSocket | null = null;
  let ref = 0;
  let joinRef: string | null = null;
  let joined = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastHeartbeatAck = Date.now();
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let closed = false;
  const topic = `wc:${opts.topicSecret}`;

  function nextRef(): string {
    ref += 1;
    return String(ref);
  }

  function buildWsUrl(): string | null {
    try {
      const u = new URL(opts.supabaseUrl);
      const proto = u.protocol === 'http:' ? 'ws:' : 'wss:';
      return `${proto}//${u.host}/realtime/v1/websocket?apikey=${encodeURIComponent(opts.anonKey)}&vsn=1.0.0`;
    } catch {
      return null;
    }
  }

  function clearTimers(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function send(msg: PhoenixMessage): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* WS will fire onerror/onclose */
    }
  }

  function startHeartbeat(): void {
    lastHeartbeatAck = Date.now();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: nextRef() });
      // If no ack arrives within HEARTBEAT_TIMEOUT_MS, force a reconnect.
      if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
      heartbeatTimeout = setTimeout(() => {
        if (Date.now() - lastHeartbeatAck > HEARTBEAT_TIMEOUT_MS) {
          try {
            ws?.close();
          } catch {
            /* noop */
          }
        }
      }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_MS);
  }

  function joinTopic(): void {
    joinRef = nextRef();
    send({
      topic: `realtime:${topic}`,
      event: 'phx_join',
      // Subscribe to broadcast events; we don't need presence or postgres_changes.
      payload: {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: '' },
          // private:false keeps Fase 4.A simple. Fase 4.B may flip to private channels.
          private: false,
        },
        access_token: opts.anonKey,
      },
      ref: joinRef,
    });
  }

  function scheduleReconnect(): void {
    if (closed) return;
    if (reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      // Give up — polling fallback is responsible from here on.
      return;
    }
    reconnectAttempts += 1;
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts - 1),
      RECONNECT_MAX_MS
    );
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, delay);
  }

  function connect(): void {
    if (closed) return;
    const url = buildWsUrl();
    if (!url) return;

    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      // Reset backoff on a successful socket open (we still need phx_join ack
      // before considering the channel "joined", but the socket is up).
      reconnectAttempts = 0;
      startHeartbeat();
      joinTopic();
    };

    ws.onmessage = (ev: MessageEvent) => {
      let msg: PhoenixMessage | null = null;
      try {
        msg = JSON.parse(ev.data) as PhoenixMessage;
      } catch {
        return; // ignore malformed
      }
      if (!msg || typeof msg !== 'object') return;

      // Heartbeat ack
      if (msg.topic === 'phoenix' && msg.event === 'phx_reply') {
        lastHeartbeatAck = Date.now();
        return;
      }

      // Join ack
      if (
        msg.topic === `realtime:${topic}` &&
        msg.event === 'phx_reply' &&
        msg.ref === joinRef
      ) {
        const payload = msg.payload as { status?: string } | undefined;
        if (payload?.status === 'ok') {
          joined = true;
          opts.onConnect?.();
        } else {
          // join error: close and let reconnect/back-off handle
          try {
            ws?.close();
          } catch {
            /* noop */
          }
        }
        return;
      }

      // Broadcast event from server
      if (
        msg.topic === `realtime:${topic}` &&
        msg.event === 'broadcast'
      ) {
        const payload = msg.payload as { event?: string } | undefined;
        if (payload?.event === 'new_message') {
          // Signal-only: ignore payload, refetch via authenticated polling.
          try {
            opts.onSignal();
          } catch {
            /* widget callbacks must not bring down the WS */
          }
        }
      }
    };

    ws.onclose = () => {
      joined = false;
      clearTimers();
      opts.onDisconnect?.();
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire; nothing to do here. Don't log: noisy on flaky nets.
    };
  }

  function close(): void {
    closed = true;
    clearTimers();
    if (ws) {
      try {
        ws.close();
      } catch {
        /* noop */
      }
      ws = null;
    }
  }

  // Boot
  connect();

  return {
    close,
    isJoined: () => joined && ws?.readyState === WebSocket.OPEN,
  };
}
