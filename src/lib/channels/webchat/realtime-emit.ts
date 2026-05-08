// ============================================
// KAIRO - WebChat Realtime Signal Emitter (Fase 4.A)
//
// Modelo "broadcast como senal":
//   - El servidor emite un broadcast SIN payload sensible al topic
//     `wc:<realtimeTopicSecret>`. El widget recibe la senal y dispara un
//     fetch al endpoint polling /api/webchat/messages (que ya valida
//     publicKey + tenant). El payload del broadcast es ignorado — un
//     atacante con la anon key publica NO puede inyectar mensajes falsos.
//
//   - Topic secret = UUID v4 (~122 bits) almacenado en
//     Conversation.realtimeTopicSecret. Desacoplado del Conversation.id
//     (cuid) para que un leak de id no comprometa el canal Realtime.
//
//   - Emit via REST endpoint de Supabase Realtime (POST /realtime/v1/api/broadcast),
//     autenticado con SERVICE_ROLE_KEY. Mas eficiente que abrir un WebSocket
//     server-to-server por cada emit. Sin overhead de subscribe/unsubscribe.
//
// NO lanza excepciones: si el broadcast falla (red, Supabase down, env mal
// configurado, etc.), el widget cae automaticamente a polling cada 30s.
// La emision es best-effort.
// ============================================

const EMIT_TIMEOUT_MS = 2500;
const MIN_TOPIC_LEN = 16; // defensive: refuse to emit on guessable topics

let warnedMissingEnv = false;

/**
 * Emit a "new message" signal to the widget listening on this conversation's
 * private topic. Best-effort: errors are logged but never thrown.
 *
 * Caller should wrap in `waitUntil()` when called from a route handler so
 * the response isn't blocked by Realtime latency.
 */
export async function emitWebChatSignal(topicSecret: string | null | undefined): Promise<void> {
  if (!topicSecret || typeof topicSecret !== 'string' || topicSecret.length < MIN_TOPIC_LEN) {
    // Skip silently. A missing topic means polling is the only path — fine.
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    if (!warnedMissingEnv) {
      console.warn('[emitWebChatSignal] missing env (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY) — Realtime disabled, polling fallback active');
      warnedMissingEnv = true;
    }
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMIT_TIMEOUT_MS);

  try {
    const res = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        // Realtime REST API expects both apikey and Authorization with service role.
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `wc:${topicSecret}`,
            event: 'new_message',
            // Payload deliberately empty: signal-only model. Widget refetches
            // via authenticated polling endpoint and never trusts this content.
            payload: { ts: Date.now() },
            // Public broadcast (Fase 4.A). Private Channels deferred to Fase 4.B
            // if/when threat model shifts.
            private: false,
          },
        ],
      }),
    });

    if (!res.ok) {
      // Diagnostic body, sanitized: Supabase echoes the topic (which contains
      // our UUID secret) in some 4xx error bodies. We strip any `wc:<uuid>`
      // pattern before logging so secrets never reach Vercel/Datadog logs.
      const raw = await res.text().catch(() => '');
      const sanitized = raw.replace(/wc:[a-f0-9-]{8,}/gi, 'wc:<redacted>').slice(0, 200);
      console.warn('[emitWebChatSignal] non-OK response', {
        status: res.status,
        body: sanitized,
      });
    }
  } catch (err) {
    // Never log the raw error: undici/fetch error messages can include the
    // request URL (which contains the apikey) on some implementations.
    const errName = err instanceof Error ? err.name : 'unknown';
    if (errName === 'AbortError') {
      console.warn('[emitWebChatSignal] timeout — polling fallback will cover');
    } else {
      console.warn('[emitWebChatSignal] failed:', { errName });
    }
  } finally {
    clearTimeout(timeout);
  }
}
