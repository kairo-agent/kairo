# Fase 4 Multi-Canal — Realtime + Paridad de Features (HISTORICO)

> **Version:** v0.26.0
> **Estado:** ✅ COMPLETADA — deployed 2026-05-08, validada en prod (Leon33/Disruptivo)
> **Commits:** `e599f7f → ceb6fa3 → fffee0a → d1c0104 → 9813908 → bbd0594 → 780068c → 313bddd → 328d6d9 → 9827d89` (10 commits, 1 sesion)
> **Resultado real:** plan ejecutado al 100% + bug critico encontrado/arreglado en QA (sendMessage server action no emitia broadcast) + mejora extra HTTPS-only para domains.

Detalle ejecutivo en [docs/CHANGELOG.md](../CHANGELOG.md#0260---2026-05-08). El plan original se mantiene a continuacion como referencia de lo que se planeo vs lo que se entrego.

---

## Resumen

Llevar el widget WebChat de polling 3s a paridad de features con WhatsApp. Mensajes en vivo via Supabase Realtime, handoff humano funcional, media upload con Vision/Whisper.

## Decisiones cerradas heredadas de Fase 3

Ver historial completo en [docs/done/MULTI-CHANNEL-WEBCHAT-V0.25.md](../done/MULTI-CHANNEL-WEBCHAT-V0.25.md). Decisiones #1-23 ya validadas.

## Tareas Fase 4

### 4.1 Supabase Realtime con JWT efimero
- Endpoint `POST /api/widget/realtime-token`: recibe `{ publicKey, sessionId, conversationId }`, genera JWT con claims `{ projectId, channel: 'webchat', conversationId, exp: now + 1h }`.
- RLS policy nueva en `messages`: select permitido si `auth.jwt() ->> 'channel' = 'webchat' AND conversation_id = (jwt ->> 'conversationId')::uuid`.

### 4.2 Widget WebSocket directo a Supabase Realtime
- Patron de ChatFlow360 (sin SDK): WebSocket a `wss://<project>.supabase.co/realtime/v1/websocket?apikey=<jwt>`, Phoenix Channels protocol, heartbeat 30s, subscribe a `realtime:messages:conversation_id=<x>`.
- Polling como fallback automatico si WS bloqueado (corp networks).

### 4.3 Handoff humano webchat
- Asesor toma control desde dashboard → `Lead.handoffMode = 'human'` → UI del widget muestra "Un asesor se unio al chat".
- Mensajes salientes del asesor llegan via Realtime al widget en <500ms.
- Indicador "asesor escribiendo": Realtime broadcast (no persiste en BD).

### 4.4 Media en webchat
- **Visitor sube archivo:**
  1. Widget pide signed URL: `POST /api/widget/upload-token` con tipo y tamano.
  2. Widget sube directo a Supabase Storage `webchat-uploads/{projectId}/{year}/{month}/{visitorId}-{uuid}.ext`.
  3. Widget envia mensaje con `mediaUrl` resultante.
  4. Backend: lee Storage, ejecuta Vision/Whisper segun tipo, guarda transcripcion.
- **Limites:** Imagen 10 MB, Video 25 MB, Audio 10 MB, Documento 10 MB.

### 4.5 Cleanup de media
- `src/app/api/cron/cleanup-media/route.ts`: agregar bucket `webchat-uploads/` al cleanup despues de 5 dias.

### 4.6 CORS strict (post-Fase 3 permisivo)
- En Fase 3, `allowedOrigins` vacio = permite cualquier origin. En Fase 4 se obliga: si vacio, NO se permite ningun origin (warning en /settings/webchat para que owner agregue su dominio).

### 4.7 Validacion Fase 4
- Visitor escribe → aparece en dashboard EN <500ms (Realtime).
- Asesor responde desde dashboard → aparece en widget EN <500ms.
- Visitor sube imagen → AI analiza con Vision → responde contextualmente.
- Visitor envia audio → Whisper transcribe → AI responde al texto.
- Realtime cae (simulacion: bloquear WS) → widget cae a polling sin perder mensajes.

## Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| RLS muy permisiva accidentalmente | Test con user no-autorizado por cada PR |
| WebSocket bloqueado en corp networks | Fallback polling automatico |
| `webchat-uploads` storage bandwidth | Cleanup cron + limites de tamano enforced |

## Variables de entorno nuevas

```env
WEBCHAT_REALTIME_JWT_SECRET=  # secret para firmar JWTs efimeros del widget
```

## Referencias

- Fase 3 historica: [docs/done/MULTI-CHANNEL-WEBCHAT-V0.25.md](../done/MULTI-CHANNEL-WEBCHAT-V0.25.md), [docs/done/MULTI-CHANNEL-IMPL-V0.25.md](../done/MULTI-CHANNEL-IMPL-V0.25.md)
- Memory: [SUPABASE-REALTIME.md](C:/Users/josel/.claude/projects/d--KAIRO-kairo-dashboard/memory/SUPABASE-REALTIME.md)
- Codigo del WebSocket Phoenix de referencia: ChatFlow360 widget en `D:/LEON33-HMA/ChatFlow360/chatflow360-dashboard/src/widget/index.ts` (solo lectura).
