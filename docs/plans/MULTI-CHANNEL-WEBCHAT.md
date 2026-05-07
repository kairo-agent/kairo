# Plan: Multi-Canal + WebChat Embebible — Decisiones y Arquitectura

> **Version objetivo:** v0.24.0 (refactor) + v0.25.0 (webchat MVP)
> **Estado:** Planificado, listo para iniciar Fase 1.1
> **Ultima revision:** 2026-05-06
> **Implementacion tecnica:** [MULTI-CHANNEL-IMPL.md](MULTI-CHANNEL-IMPL.md)

---

## Resumen Ejecutivo

Habilitar segundo canal (WebChat embebible) reutilizando el pipeline AI completo. Refactor previo de abstraccion de canal sin downtime para no afectar produccion (E&Z recibiendo leads activamente). Modelo `ProjectChannel` con doble control (super_admin provisiona, owner muestra/oculta). Widget servido desde subdominio dedicado (`widget.kairoagent.com`) con Shadow DOM y Supabase Realtime.

**Pipeline AI core (RAG, agente, form conversacional, Vision, Whisper, handoff) es reutilizado al 100%.** El trabajo es transporte + UI + abstraccion.

---

## Decisiones de Diseno

### Decisiones originales (validadas con Leo, 2026-04-29)

| # | Decision | Resultado |
|---|----------|-----------|
| 1 | Migracion `whatsappId` -> `externalId` | Zero-downtime con dual-write + backfill |
| 2 | Placeholder lead anonimo | `firstName = "Visitante"` |
| 3 | Pagina actual "Leads" | Renombrar a "Conversaciones". "Leads" unificada = feature futura (v1.1) |
| 4 | Reengagement | Solo WhatsApp (webchat no tiene canal de retorno) |
| 5 | Widget UI tech | Shadow DOM + DOM nativo (sin iframe) |
| 6 | Dominio del widget | `widget.kairoagent.com` (subdominio dedicado, Vercel project separado) |
| 7 | Multiples widgets por pagina | Soportado desde dia 1 |
| 8 | Orden de fases | Refactor primero, webchat despues |
| 9 | Modelo de canales | `ProjectChannel` 1-N. Solo super_admin provisiona en v1 (sin self-service) |
| 10 | Personalizacion visual | Solo WebChat (WhatsApp no tiene UI propia). Defaults brand KAIRO |
| 11 | Settings reorganizada | Subitems en sidebar: AI Settings (compartido) + WhatsApp + Web + Team |
| 12 | Persistencia de cambios | Boton Save explicito (no auto-save) |
| 13 | "Solicitar activacion" cliente | Pospuesto a v2 |
| 14 | Cards "Proximamente" (Instagram/FB/TikTok) | NO se muestran en v1 (Opcion A, limpia) |

### Decisiones nuevas (validadas con Leo, 2026-05-06)

| # | Decision | Resultado |
|---|----------|-----------|
| 15 | Modelo `ProjectChannel` | Dos boolean: `provisioned` (super_admin) + `enabled` (owner) |
| 16 | Acciones super_admin sobre canal | 3 acciones en `ProjectSettingsModal`: Activar / Desactivar / Eliminar-Resetear |
| 17 | Toggle owner en webchat | Se llama "Mostrar / Ocultar" (no "Activar / Desactivar") |
| 18 | UI WhatsApp para owner | **Sin switch en absoluto**. Subitem solo muestra config |
| 19 | Welcome message | **NO existe como config en KAIRO**. Se maneja via instrucciones del agente. Eliminado del plan |
| 20 | Notifications del usuario | **Quedan en `/profile`** (donde estan hoy). NO se mueven a Settings |
| 21 | Compliance / GDPR / borrado total | **Fuera de scope**. Ver [COMPLIANCE-GDPR.md](COMPLIANCE-GDPR.md) |
| 22 | Settings reorg | NO crear `/admin/organizations/[id]/page.tsx` (no existe). Extender `ProjectSettingsModal` existente |
| 23 | Eliminar/Resetear canal (super_admin) | Hard delete de fila `ProjectChannel`. Leads/Conversations/Messages NO se tocan |

---

## Sidebar Final

```
Settings ▾
├── AI Settings      → /settings              (compartido cross-channel)
├── WhatsApp         → /settings/whatsapp     (solo si canal provisioned=true)
├── Web              → /settings/webchat      (solo si canal provisioned=true)
└── Team             → /settings/team         (existente, sin cambios)
```

**Reglas de visibilidad:**
- Subitem aparece si y solo si `ProjectChannel` con `provisioned=true` existe para ese canal
- `enabled=false` (owner pauso) NO oculta el subitem (debe poder reactivarlo)
- Si super_admin hace `provisioned=false`, el subitem desaparece para el owner

---

## Clasificacion de Configuraciones

### AI Settings (`/settings`) — compartido cross-channel
Tabs dentro del `SettingsPageClient.tsx`:
- Instrucciones del agente
- Knowledge Base estructurada (horario, FAQs, precios, ubicacion, politicas, **multimedia incluida**)
- Form conversacional

### WhatsApp (`/settings/whatsapp`) — channel-specific
- Reengagement (config de tiempos y tono)
- Display del numero (read-only)
- (futuro) Templates aprobados por Meta
- **Sin switch** (decision #18)
- Credenciales (token, phone_number_id, app_secret) **NO viven aqui** — viven en `/admin` (super_admin only)

### WebChat (`/settings/webchat`) — channel-specific
- **Toggle "Mostrar / Ocultar"** (cambia `enabled` en BD)
- Apariencia (colores, logo, bubble) con defaults brand KAIRO
- Textos (header, teaser, transcript) bilingue es/en
- Starter questions (max 5)
- Behavior (auto-open delay, sonido)
- Allowed origins (CORS)
- Embed code (`<script>` para copiar)
- Preview en vivo

### `/admin` ProjectSettingsModal (super_admin only)
- Tabs existentes: General + Secretos OpenAI/Anthropic
- **NUEVO tab "Canales"**: 3 acciones por canal (Activar / Desactivar / Eliminar-Resetear)
  - WhatsApp: al activar, inputs de credenciales (token, phone_number_id, app_secret)
  - WebChat: al activar, auto-genera `publicKey`, muestra embed `<script>`

### Notifications del usuario — `/profile` (sin cambios)
Toggle email + CC emails + push devices. Son notificaciones del asesor sobre eventos del sistema (hot lead, follow-up, etc.). No es config de canal.

---

## Arquitectura Final

```
                 visitor del sitio cliente (anonimo)
                              |
                              v
        widget.kairoagent.com/kairo.js  (Vercel project #2)
                              |
                              v
        app.kairoagent.com/api/webhooks/webchat  (Vercel project #1)
                              |
                              v
        IChannelHandler -> WebChatChannelHandler.receive()
                              |
                              v
        Pipeline AI (mismo de WhatsApp): RAG + Vision + form + GPT-4o-mini
                              |
                              v
        WebChatChannelHandler.send() -> persist Message + emit Realtime
                              |
                              v
        widget recibe via Supabase Realtime (JWT scoped)
```

**Capa de abstraccion:**
- `src/lib/channels/IChannelHandler.ts` (interface)
- `src/lib/channels/whatsapp/WhatsAppChannelHandler.ts` (existente refactorizado)
- `src/lib/channels/webchat/WebChatChannelHandler.ts` (nuevo)

---

## Estado Actual del Codigo (verificado 2026-05-06)

| Item | Estado |
|------|--------|
| `Lead.externalId` | NO existe (Fase 1.1 lo crea) |
| `ProjectChannel` table | NO existe (Fase 1.2 la crea) |
| Enum `LeadChannel` con `webchat`, `instagram`, `facebook` | YA incluye los valores (no requiere migration) |
| `Project.whatsappPhoneNumber` | Existe (Fase 2.4 lo dropea) |
| `ProjectSecret` (encriptado) | Existe, sirve para credenciales WhatsApp |
| `whatsappId` en codigo | 8 archivos (Fase 1.7 los migra) |
| `src/lib/channels/` | NO existe (Fase 1 la crea) |
| `widget/` carpeta | NO existe (Fase 3 la crea) |
| `/admin` panel | Pagina unica con modales. NO `/admin/organizations/[id]` |
| `SettingsPageClient.tsx` | 4 tabs (instructions, knowledge, reengagement, form) — Fase 2.2 extrae reengagement |

---

## Riesgos Generales

| Riesgo | Mitigacion |
|--------|-----------|
| E&Z afectada durante refactor | Dual-write + deploy gradual + canary en proyecto de prueba |
| RLS permisiva accidentalmente | Test con user no-autorizado en cada PR |
| Widget JS roto en sitios cliente | Versionar bundle (`v1/kairo.js`), deploy conservador, rollback rapido |
| `allowedOrigins` mal seteado | Default = dominio del cliente al crear ProjectChannel; UI obliga |
| Bandwidth Vercel >80GB/mes | Cache immutable + Cloudflare delante |
| Visitor abuse | Rate limit IP+visitorId + hCaptcha si hay abuso |
| WebSocket bloqueado (corp) | Fallback polling automatico |
| Confusion super_admin/owner sobre estados | Copy diferenciado ("Activar" vs "Mostrar") |

---

## Variables de Entorno Nuevas

```env
# Fase 3
WIDGET_DOMAIN=https://widget.kairoagent.com
WEBCHAT_RATE_LIMIT_IP=30
WEBCHAT_RATE_LIMIT_VISITOR=60
# Fase 4
WEBCHAT_REALTIME_JWT_SECRET=
```

Existentes (DATABASE_URL, SUPABASE_*, WHATSAPP_*, OPENAI_API_KEY via ProjectSecret, UPSTASH_*) sin cambios.

---

## Dependencias entre Fases

```
Fase 0 -> Fase 1 -> Fase 2 -> Fase 3 -> Fase 4
              \-----> (paralelo posible: 2 y 3 si hay dos personas)
```

**Estimado total:** ~6-9 semanas (single developer).

Detalles completos por fase en [MULTI-CHANNEL-IMPL.md](MULTI-CHANNEL-IMPL.md).

---

## Checklist Validacion Final (post-fase 4)

- [ ] Org solo-WhatsApp / solo-WebChat / ambos: cada combo funciona E2E
- [ ] E&Z sin diferencia notable durante todo el rollout
- [ ] Multiples widgets en una pagina con publicKeys distintos: conversaciones aisladas
- [ ] Handoff humano webchat: asesor responde, llega <500ms via Realtime
- [ ] Visitor sube imagen/audio: Vision/Whisper responde contextual
- [ ] Reengagement WhatsApp sigue corriendo; WebChat NO tiene reengagement
- [ ] super_admin "Activar" canal -> subitem aparece para owner
- [ ] super_admin "Desactivar" canal -> subitem desaparece para owner
- [ ] super_admin "Eliminar/Resetear" canal -> subitem desaparece, leads preservados
- [ ] owner toggle "Mostrar/Ocultar" webchat -> widget desaparece, subitem persiste
- [ ] WhatsApp sin switch en `/settings/whatsapp` (decision #18)
- [ ] `widget.kairoagent.com` sirve con cache `immutable`; CORS OK
- [ ] RLS: visitor no autorizado no puede leer mensajes ajenos

---

## Referencias

- Memory: [GLOBAL-RULES.md](C:/Users/josel/.claude/projects/d--KAIRO-kairo-dashboard/memory/GLOBAL-RULES.md), [SUPABASE-RLS-AUTO.md](C:/Users/josel/.claude/projects/d--KAIRO-kairo-dashboard/memory/SUPABASE-RLS-AUTO.md), [SUPABASE-REALTIME.md](C:/Users/josel/.claude/projects/d--KAIRO-kairo-dashboard/memory/SUPABASE-REALTIME.md)
- Docs vivos: [ARCHITECTURE.md](../ARCHITECTURE.md), [SECURITY.md](../SECURITY.md), [DATABASE-MIGRATIONS.md](../DATABASE-MIGRATIONS.md)
- Plan compliance separado: [COMPLIANCE-GDPR.md](COMPLIANCE-GDPR.md)
- Referencia externa: ChatFlow360 widget (D:/LEON33-HMA/ChatFlow360/chatflow360-dashboard/src/widget/)
