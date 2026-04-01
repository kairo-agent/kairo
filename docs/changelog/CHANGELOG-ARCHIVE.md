# KAIRO - Changelog Archive (v0.16.1 y anteriores)

> Versiones antiguas archivadas. Ver [CHANGELOG.md](../CHANGELOG.md) para versiones recientes (v0.16.2+).

---

## [0.16.1] - 2026-03-24

Archivado desde CHANGELOG.md. Contenido: Lead Source Auto-Detection (Meta Referral CTWA Ads + hashtags en primer mensaje). 7 nuevos LeadSource enum values. Dashboard Source Chart (horizontal bar). Migraciones: `20260324_add_lead_source_platforms`, `20260324_add_fb_ig_organic_sources`.

---

## [0.16.0] - 2026-03-22

Archivado desde CHANGELOG.md. Contenido: Dashboard Charts (recharts: leads/dia bar, temperatura donut, status horizontal bar, conversion stat card). Cron cleanup-media failsafe. Image Lightbox (full-screen overlay). Upload timestamps en agent media. Fixes: SSR flash, ESC lightbox, dashboard default 30 days.

---

## [0.15.1] - 2026-03-21

Archivado desde CHANGELOG.md. Contenido: Cron cleanup-media protege agent_media (excluye storage_path de agent_media table). Edit media con reemplazo de archivo (overlay hover, old file cleanup). RPC `update_agent_media_file`.

---

## [0.15.0] - 2026-03-20

Archivado desde CHANGELOG.md. Contenido: Agent Video Support (upload client-side, video-upload.ts, video-thumbnail.ts, FixedVideoSlot, searchRelevantVideos, sendVideoToWhatsApp, [VIDEO-X] markers, position tagging, send order img→text→video→RAG). Fixes: ReEngagement sendWindow Zod schema, Redis debounce provisionado (Upstash sa-east-1), WhatsApp send order.

---

## [0.14.0] - 2026-03-19

Archivado desde CHANGELOG.md. Contenido: Debounce 3s en Webhook WhatsApp (Redis `SET NX EX 3` + `waitUntil` + concatenacion). Fixed Event Images (4 tipos: first_contact, reengagement_0/1/2, RPCs SECURITY DEFINER). Horario de envio configurable para ReEngagement (selectores AM/PM, cruce de medianoche). Mobile Lead Panel botones en fila horizontal (icon-only mobile, texto completo sm+).

---

## [0.13.0] - 2026-03-19

Archivado desde CHANGELOG.md. Contenido: Chat Media Rendering (imagenes inline como thumbnails clickeables, mediaAttachments en metadata). Excel Export (SheetJS dynamic import, FloatingCalendar con Portal, server action con auth + project access). ReEngagement Media Support (protocolo [MEDIA-X] en todos los intentos).

---

## [0.12.0] - 2026-03-18

Archivado desde CHANGELOG.md. Contenido: Agent Media - Imagenes via WhatsApp con RAG Semantico (tabla agent_media + pgvector, search-media.ts, markers [MEDIA-X], compresion client-side Canvas API, feature flag projectHasMedia()). Login Fixes (ERR_TOO_MANY_REDIRECTS cookies middleware, loading overlay post-logout).

---

## [0.11.1] - 2026-03-18

- **ReEngagement business hours extendido:** Horario cambiado de 9 AM - 8 PM a 9 AM - 10 PM.
- **AI response instructions mejoradas:** Reglas explicitas para no repetir info, no re-presentarse, avanzar conversacion.

---

## [0.11.0] - 2026-03-16

Archivado desde CHANGELOG.md. Contenido: ReEngagement auto follow-up para leads silenciosos. Cron jobs migrados a Supabase pg_cron + pg_net. DB migration: `lastReEngagementAt`, `reEngagementCount`, `reEngagementConfig`. Elegibilidad: agente enabled, lead AI mode, ultimo msg es del AI, lead silencioso > delayHours < 24h, horario comercial. Fix critico: tipos extraidos de 'use server' a `lib/types/reengagement.ts`.

---

## [0.10.2] - 2026-03-15

Archivado desde CHANGELOG.md. Contenido: RAG Query Enrichment (`buildRAGQuery()` para mensajes < 15 chars, ctx window 2 respuestas, cap 500 chars). URL word wrap en chat. Timestamp con hora en toda la app. Drag & drop rule reordering (@dnd-kit). Collapsible sections en Settings. Global Rule WhatsApp text-only format.

---

---

## [0.9.5] - 2026-03-11

Archivado desde CHANGELOG.md. Contenido: Performance + Security Audit v3 (4 fases: Prisma consolidation, auth optimization, frontend caching, security hardening). Bug fixes: human chat messages reaching WhatsApp (n8n bypass removido), emoji picker rendering (static import + emojiInit).

---

## [0.9.4] - 2026-03-11

### Web Push Notifications (3er canal de notificacion)

Archivado desde CHANGELOG.md. Contenido: 3er canal push (campana + email + push), pre-permission modal, per-device subscriptions (`PushSubscription` model), VAPID config, Service Worker, PWA manifest.

---

## [0.9.3] - 2026-03-10

Archivado desde CHANGELOG.md. Contenido: Coming-soon features ocultas para no-super_admin, AI Summary mejorado (1000 chars), Email Notifications on Handoff (Resend), Deep-link post-login redirect (AuthRedirect + sessionStorage), boton llamar oculto, mobile tabs icon-only pattern.

---

## [0.9.2] - 2026-03-09

Archivado desde CHANGELOG.md. Contenido: AI-initiated handoff system ([HANDOFF] marker), notification sound (Web Audio API), per-project notification filtering, smart notification routing (human mode only), KB & UI improvements (pricing separators, ExpandableTextarea, KB free-text edit).

---

## [0.9.1] - 2026-03-09

Archivado desde CHANGELOG.md. Contenido: RAG Search Fix (SECURITY DEFINER + threshold 0.35), Global Rules System, Temperature Criteria UI, Audio Transcription Fix (fbsbx.com CDN), Full-Width Layout Fix.

---

## [0.9.0] - 2026-03-07

### Settings / Configuration Page + Structured Knowledge Base

Nueva pagina de configuracion de agentes con dos tabs: **Instructions** (prompt structure) y **Knowledge Base** (conocimiento estructurado + RAG free-text).

**Dual-Name System:** `ai_agents.name` = admin label, `promptStructure.agentName` = AI persona (default "Kaira"). Webhook lee `promptStructure.agentName` con fallback Kaira.

**Tab Instructions:** Agent Name, Role, Rules (dynamic list), Personality, Additional Instructions. Guardado en `ai_agents.promptStructure` (JSONB).

**Tab Knowledge Base - 5 secciones estructuradas:** Business Hours, FAQs, Pricing, Location & Contact, Policies. Cada seccion: Zod validation -> compose bilingual text -> OpenAI embedding -> pgvector via RPC.

**Archivos nuevos:** `settings/page.tsx`, `settings/SettingsPageClient.tsx`, `src/lib/knowledge/` (6 files), `src/components/knowledge/` (5 forms).

**Migraciones SQL (4):** `promptStructure JSONB`, `insert_agent_knowledge` (12 params), `list_agent_knowledge` (+ category/structured_data), `delete_structured_knowledge`.

**Bugs RLS corregidos (3):** `.update()` sin UPDATE policy, `.select()` con RLS rota, duplicate key en upsert. Todas las operaciones sobre `agent_knowledge` DEBEN usar RPCs SECURITY DEFINER.

**E2E Testing:** 11 tests WhatsApp pasaron (nombre, rol, reglas, personalidad, instrucciones, 5 KB secciones, RAG free-text).

---

## [0.8.2] - 2026-02-20

### Per-Project WhatsApp App Secret (Multi-Tenant HMAC)

Soporte para App Secret por proyecto. Smart fallback (no global bypass si existe per-project), HMAC failure rate limiting, cache de App Secret (5min TTL, 500 LRU).

---

## [0.8.1] - 2026-02-15

### Security Audit v2 + Vercel Serverless Fix

19 hallazgos resueltos (2 criticos, 3 altos, 5 medios, 4 bajos, 10 aprobados). `waitUntil()` para fire-and-forget en Vercel. Anti-prompt-injection. Contact sanitization. Rate limiting por proyecto.

---

## [0.8.0] - 2026-02-15

### Internal AI Pipeline - n8n removal

Pipeline IA migrado de n8n (Railway) a funciones internas Next.js. -400 a -1200ms latencia. -$5-10/mes costo.

---

## [0.7.16] - 2026-02-06

### Enriched notifications + deep-link to lead panel (commit `36aef6a`)

Notificaciones enriquecidas con datos del lead y navegacion directa al panel de detalle.

| Archivo | Cambio |
|---------|--------|
| `src/lib/actions/notifications.ts` | Batch-fetch de leads por `metadata.leadId` en `getNotifications()` - datos siempre frescos sin tocar pg-cron |
| `src/hooks/useNotifications.ts` | Interface `NotificationLead` con firstName, lastName, temperature, nextFollowUpAt |
| `src/components/layout/NotificationDropdown.tsx` | Nombre completo, badge de temperatura (Alto/Medio/Bajo), fecha de seguimiento, click navega a `/leads?leadId=xxx` |
| `src/lib/actions/leads.ts` | Nueva `getLeadById()` server action para fetch individual con access check |
| `LeadsPageClient.tsx` | Lee `searchParams.leadId`, busca en cache o fetch remoto, abre panel, limpia URL |
| `es.json` / `en.json` | Key `notifications.scheduledFor` |

### Notification System + Follow-up Scheduling (commit `c942341`)

Sistema de notificaciones in-app con polling y programacion de seguimientos para leads.

**Notificaciones:**

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Modelo `Notification` + enum `NotificationType` (new_message, follow_up_due, lead_assigned) |
| `prisma/migrations/20260206_add_notifications_table` | Tabla con RLS policies nativas PostgreSQL |
| `src/lib/actions/notifications.ts` | Server actions: getNotifications, markAsRead, markAllAsRead, createNotification, notifyProjectMembers |
| `src/hooks/useNotifications.ts` | Hook polling cada 15s con optimistic updates para markAsRead/markAllAsRead |
| `src/components/layout/NotificationDropdown.tsx` | Dropdown con bell icon, badge de conteo, lista de notificaciones con iconos por tipo |
| `src/components/layout/Header.tsx` | Reemplaza bell estatico con NotificationDropdown |
| `src/app/api/webhooks/whatsapp/route.ts` | Crea notificacion fire-and-forget en inbound de WhatsApp |
| `scripts/pg-cron-followup-notifications.sql` | SQL para pg_cron: genera notificaciones cuando follow-ups vencen |

**Follow-up Scheduling:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/actions/leads.ts` | `scheduleFollowUp(leadId, date)` server action con activity log |
| `src/components/features/FollowUpModal.tsx` | Modal con datetime-local + quick options (Manana, En 3 dias, Proxima semana) |
| `src/components/features/LeadCard.tsx` | Badge follow-up: rojo=vencido, naranja=proximo (<24h), gris=programado |
| `LeadsPageClient.tsx` | Badge en tabla inline + integracion FollowUpModal + estado followUpTarget |
| `es.json` / `en.json` | Keys para notificaciones y follow-ups |

**Seguridad:** RLS nativo, sanitizacion de inputs, ownership checks, rate limit en notifyProjectMembers (max 10), fallback project solo en dev.

Ver [NOTIFICATIONS.md](docs/NOTIFICATIONS.md) para arquitectura completa.

### Follow-up badge in detail panel + optimistic updates (commits `517488d`, `1a3d2e7`)

Badge de follow-up y card detallada con fecha/hora exacta en LeadDetailPanel. Optimistic update instantaneo al programar seguimientos.

| Archivo | Cambio |
|---------|--------|
| `src/components/features/LeadDetailPanel.tsx` | Badge coloreado en header (rojo/naranja/gris) + card con borde lateral, fecha exacta (date-fns PPPp), boton "Reprogramar" |
| `src/hooks/useLeadsQuery.ts` | `optimisticFollowUpUpdate()` - actualiza `nextFollowUpAt` en cache React Query al instante |
| `LeadsPageClient.tsx` | `handleScheduleFollowUp/handleClearFollowUp` usan optimistic update + rollback. Sync effect incluye `nextFollowUpAt` |
| `es.json` / `en.json` | Key `followUp.reschedule` (Reprogramar/Reschedule) |

### FollowUpModal rewrite: Calendar + same-day scheduling (commit `0623747`)

Reemplazo de input `datetime-local` nativo por calendario visual con `react-day-picker` (single mode). Permite programar seguimientos el mismo dia (horas futuras solamente).

| Archivo | Cambio |
|---------|--------|
| `src/components/features/FollowUpModal.tsx` | DayPicker + selects hora/minuto + quick options "En 1 hora"/"En 3 horas" + validacion horas pasadas |
| `src/components/features/LeadDetailPanel.tsx` | Prop `onScheduleFollowUp` + boton naranja en footer |
| `LeadsPageClient.tsx` | Wire `onScheduleFollowUp` callback al panel |
| `es.json` / `en.json` | Keys `in1Hour`, `in3Hours`, `dateLabel` actualizado |

### Mobile notification dropdown fix (commit `21cb62b`)

Dropdown de notificaciones se cortaba por la izquierda en mobile (390px). Fix: `fixed inset-x-3 top-14` en mobile, `sm:absolute sm:right-0 sm:w-96` en desktop.

---

## [0.7.15] - 2026-02-06

### ExpandableTextarea + Modal Fullscreen (commits `d5c0f47`, `e0e8123`)

Nuevo componente `ExpandableTextarea` con icono de expand (hover) que abre modal 3xl con textarea grande (~60vh). Aplicado a:
- Textarea de contenido en Knowledge (tab Conocimiento)
- Textarea de instrucciones del agente (tab Agente)

Label "Instrucciones del Sistema" renombrado a "Instrucciones" (ES) / "Instructions" (EN).

### Wider Project Settings Modal (commit `8bf8a92`)

Modal de configuracion de proyecto ampliado a `max-w-5xl` (~1024px). Nuevos sizes `2xl` y `3xl` en `Modal.tsx`. Body con `overflow-y-auto max-h-[calc(100vh-8rem)]`.

### Optimistic Status Updates + Sonner Toasts (commits `5b7484c`, `9dc2f38`, `1c5db17`)

Cambio de status instantaneo sin spinner. Rollback + toast de error si el servidor falla.

| Archivo | Cambio |
|---------|--------|
| `useLeadsQuery.ts` | `optimisticStatusUpdate()` actualiza cache React Query. `refetchStats()` silencioso. `isFetching` desacoplado de stats |
| `LeadsPageClient.tsx` | `handleStatusChange` con optimistic update + `toast.error()` en rollback |
| `DashboardLayoutClient.tsx` | `<Toaster />` de sonner (bottom-right, richColors, closeButton) |
| `package.json` | Dependencia `sonner` agregada |
| `es.json` / `en.json` | Key `errors.statusUpdateFailed` |

### i18n Fix: Status badges in table view (commit `ae63119`)

Los badges de status en la vista tabla usaban labels hardcodeados en espanol (`statusConfig.label`). Corregido a `t('status.${lead.status}')`.

### AI Summary in Lead Detail Panel (commit `f1a9581`)

Muestra el resumen de conversacion generado por IA en el panel de detalle del lead para toma de decisiones rapida.

| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | `summary?: string`, `summaryUpdatedAt?: Date` en Lead |
| `src/lib/actions/leads.ts` | `summary` y `summaryUpdatedAt` en LeadGridItem + ambos selects Prisma |
| `src/hooks/useLeadsQuery.ts` | Campos en TransformedLead + transformLeads |
| `LeadsPageClient.tsx` | `summary` y `summaryUpdatedAt` en selectedLeadForPanel transform |
| `LeadDetailPanel.tsx` | Seccion resumen entre contacto y chat (con/sin resumen). Icono SummaryIcon |
| `es.json` / `en.json` | Keys `aiSummary`, `noSummary`, `summaryUpdated` |

Sin resumen: caja punteada indicando que se genera despues de 5+ mensajes. Con resumen: caja con titulo, timestamp relativo y texto.

### WhatsApp Typing Indicator (commit `0727509`)

El lead ahora ve "escribiendo..." en WhatsApp mientras el AI procesa su mensaje.

| Archivo | Cambio |
|---------|--------|
| `webhooks/whatsapp/route.ts` | `typing_indicator: { type: 'text' }` agregado al request de read receipt |

Se auto-dismissea a los 25s o cuando llega la respuesta del AI.

### Performance: P1-5 + P1-1 + P2-4 (commit `4a13b2b`)

Todos los items de performance cerrados (14/15, P1-3 rechazado).

| ID | Cambio | Archivo |
|----|--------|---------|
| P1-5 | OpenAI key fetch en paralelo con descarga de audio | `audio/transcribe/route.ts` |
| P1-1 | `maskPhone()` enmascara telefonos en logs (muestra ultimos 4 digitos) | `whatsapp/send/route.ts` |
| P2-4 | Batch read receipts (ya implementado, solo doc update) | `messages.ts` |

---

## [0.7.14] - 2026-02-05

### Archive Leads (commits `d7530c3`, `8fb8d3c`, `340c801`, `ea41ee6`, `a59dcaf`)

Los leads ahora se pueden archivar sin perder su estado original. Usa campo separado `archivedAt` (Opcion B) en lugar de status, preservando datos historicos.

**Cambios backend + schema (commit `d7530c3`):**

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Campo `archivedAt DateTime?` + indice compuesto `[projectId, archivedAt]` |
| `prisma/migrations/20260205_add_lead_archived_at` | Migracion SQL aplicada a produccion |
| `src/types/index.ts` | `archivedAt?: Date` en Lead, `archiveFilter: 'active' / 'archived' / 'all'` en LeadFilters |
| `src/lib/actions/leads.ts` | Server actions `archiveLead()` / `unarchiveLead()` con transaccion. `buildLeadWhereClause()` soporta filtro 3 estados |
| `src/hooks/useLeadsQuery.ts` | `archivedAt` en TransformedLead + transformLeads |

**Cambios UX (commit `8fb8d3c`):**

| Archivo | Cambio |
|---------|--------|
| `LeadsPageClient.tsx` | Modal custom de confirmacion (reemplaza `window.confirm`), icono rojo=archivar / azul=desarchivar |
| `LeadCard.tsx` | Badge gris "Archivado" junto al badge de status cuando `isArchived` |
| `LeadFilters.tsx` | Chips 3 estados: Activos (default), Archivados (chip rojo), Todos |
| `es.json` / `en.json` | Keys para modal, filtros, badge |

**Mejoras adicionales (commit `340c801`):**

| Archivo | Cambio |
|---------|--------|
| `LeadDetailPanel.tsx` | Badge gris "Archivado" en panel lateral de detalle del lead |
| `LeadTable.tsx` | Badge gris "Archivado" en columna Status de vista tabla |
| `es.json` / `en.json` | Filtro "Mostrar todos" (antes "Mostrar archivados") |

**Fixes y panel (commits `ea41ee6`, `a59dcaf`):**

| Archivo | Cambio |
|---------|--------|
| `LeadsPageClient.tsx` | Badge "Archivado" en tabla inline (fix: se editaba componente equivocado). `archivedAt` en `selectedLeadForPanel` transform |
| `LeadDetailPanel.tsx` | Boton Archivar/Desarchivar en footer (3er boton: Llamar, Editar, Archivar). Prop `onArchiveLead`, iconos ArchiveIcon/UnarchiveIcon |

**Decisiones tecnicas:**
- **Opcion B elegida** (sobre Opcion A): Campo `archivedAt` separado en vez de status `archived`, preserva el status original del lead (WON archivado sigue siendo WON)
- Desarchivar = `archivedAt: null`, restaura lead a vista activa con status intacto
- Server actions con transaccion: update + activity log atomico
- Indice compuesto `[projectId, archivedAt]` para queries eficientes
- Modal custom KAIRO en vez de `window.confirm()` para mejor UX
- Filtro 3 estados (chips) en vez de checkbox para separar vistas activas/archivadas

---

## [0.7.13] - 2026-02-05

### Audio Transcription Display in Chat (commit `847398a`)

Mensajes de audio ahora muestran la transcripcion directamente en el chat de KAIRO con badge visual "Audio", en lugar de solo "[Audio recibido]".

**Cambios (3 archivos, 74 lineas):**

| Archivo | Cambio |
|---------|--------|
| `api/audio/transcribe/route.ts` | Paso 5: Persiste transcripcion en `metadata.transcription` del mensaje. Busca por `mediaId` en JSON metadata con verificacion de ownership (conversation > lead > projectId). Trunca a 10K chars. Non-blocking: si falla, flujo de IA continua. |
| `lib/actions/messages.ts` | Agrega `metadata` a tipo `MessageForChat` y al select de Prisma |
| `components/features/LeadChat.tsx` | Badge "Audio" con icono microfono + transcripcion para mensajes tipo audio. Fallback a "[Audio recibido]" si no hay transcripcion |

**Decisiones tecnicas:**
- **Opcion A elegida** (sobre Opcion B): transcripcion se guarda en mismo endpoint que transcribe, sin cambios en n8n ni webhook
- Busqueda por `metadata.mediaId` via JSON path query (PostgreSQL), sin necesidad de pasar messageId
- PII (transcripcion) nunca transita por n8n/Railway - se queda dentro del backend KAIRO
- Audios anteriores al deploy siguen mostrando "[Audio recibido]" (esperado)

---

## [0.7.12] - 2026-02-05

### Performance Optimizations (Security-Audited)

12 de 15 optimizaciones implementadas tras auditoria de seguridad.

#### Frontend - IMPLEMENTADO (commit `4617060`)

| ID | Optimizacion | Estado | Archivo |
|----|-------------|--------|---------|
| P2-1 | `verifyAuth()` lightweight auth (sin memberships) + `verifyProjectAccess()` indexed | DONE | `auth.ts` |
| P2-2 | `getLeadPanelData()` consolidada (notas+actividades) | DONE | `LeadDetailPanel.tsx`, `leads.ts` |
| P2-3 | Paralelizar count + messages en `getLeadConversation` | DONE | `messages.ts` |
| P2-5 | Paralelizar post-send ops (lastContactAt + activity) | DONE | `messages.ts` |
| P2-6 | Migrar 10 server actions de `getCurrentUser` a `verifyAuth` | DONE | `leads.ts`, `messages.ts` |
| P2-7 | Indice compuesto `leads(projectId, whatsappId)` | DONE | `schema.prisma` |
| P2-4 | Batch read receipts WhatsApp | DONE | `messages.ts`, `whatsapp/mark-read/route.ts` |

#### Backend - IMPLEMENTADO (commit `38d2734`)

| ID | Optimizacion | Estado | Archivo |
|----|-------------|--------|---------|
| P1-7 | Atomic Lua script para rate limiting Redis (fix race condition) | DONE | `rate-limit.ts` |
| P1-2 | Cache OpenAI client con SHA-256 key hashing (TTL 5min) | DONE | `openai/embeddings.ts` |
| P1-4 | Parallel DB ops via Promise.all en webhook handler | DONE | `webhooks/whatsapp/route.ts` |
| P1-6 | Fire-and-forget status updates (non-blocking) | DONE | `webhooks/whatsapp/route.ts` |
| P1-8 | Eliminar retry loop en handleStatusUpdate (depende de retries de Meta) | DONE | `webhooks/whatsapp/route.ts` |
| P1-5 | Fetch paralelo en audio transcription | DONE | `audio/transcribe/route.ts` |
| P1-1 | Phone number masking en logs | DONE | `whatsapp/send/route.ts` |
| P1-3 | Fire-and-forget audit logs | RECHAZADO | Integridad obligatoria en SaaS B2B |

### Documentacion

- **CLAUDE.md** reducido de 62KB a 6.5KB (90% reduccion) - previene error de serializacion JSON
- **docs/INDEX.md** actualizado como hub de navegacion
- **docs/RULES.md** protocolo context-safe para Playwright MCP
- Limpieza de emojis above-BMP en CHANGELOG.md

---

## [0.7.11] - 2026-02-04

### Features
- **Audio Transcription (OpenAI Whisper)**
  - Nuevo endpoint `/api/audio/transcribe` para transcribir notas de voz de WhatsApp
  - Integracion con OpenAI Whisper API ($0.006/minuto de audio)
  - Flujo: WhatsApp -> KAIRO -> Descargar audio -> Whisper -> Texto transcrito
  - Soporta formatos: OGG/Opus (notas de voz), MP3, M4A, WAV, WebM
  - Limite: 16MB por archivo

### Security
- Endpoint protegido con `X-N8N-Secret` header
- Rate limit: 30 req/min por proyecto
- Fail-closed: rechaza si N8N_CALLBACK_SECRET no esta configurado en produccion

### Archivos
- **Nuevo:** `src/app/api/audio/transcribe/route.ts`
- **Modificado:** `src/app/api/webhooks/whatsapp/route.ts` (+ mediaId en payload)

---

## [0.7.10] - 2026-02-04

### Verificacion
- **RAG System 100% Operativo** - Confirmado funcionamiento end-to-end
  - Verificacion en n8n: Ejecucion #89 muestra RAG Search retornando resultados con similarity 0.704
- Threshold configurado: 0.5
- Ultimas 4 ejecuciones: 100% exitosas

---

## [0.7.9] - 2026-02-02

### Features
- **Memoria de Conversacion IA (8 mensajes)**
  - El webhook ahora envia los ultimos 8 mensajes como `conversationHistory` a n8n
  - Formato compatible con OpenAI: `[{ role: 'user'|'assistant', content: string }]`
- **Fecha y Hora Actual para el Bot**
  - Webhook envia `currentDate` y `currentTime` con timezone America/Lima
- **Lead Summary (Fase 2.5) - Contexto historico para conversaciones largas**
- **Lead Temperature Scoring - Calificacion automatica de leads por IA**
  - HOT/WARM/COLD marcados con `[TEMPERATURA: HOT]` en respuesta del modelo
  - n8n extrae con regex y envia a KAIRO via `/api/ai/respond`

### Archivos Modificados
- `src/app/api/webhooks/whatsapp/route.ts`
- `src/app/api/ai/respond/route.ts`
- `prisma/schema.prisma` - Campos `summary` y `summaryUpdatedAt`

---

## [0.7.0 - 0.7.8] - 2026-01-29 a 2026-01-31

Resumen: RAG Fases 1-4 completadas (pgvector, embeddings, UI admin, endpoint /api/rag/search). Security hardening (OWASP headers, rate limiting, Redis, CVE fixes, fail-closed, timingSafeEqual). API /api/ai/respond. Read receipts automaticos. n8n Railway integracion. Fix: search_agent_knowledge SQL, Supabase Realtime RLS.

---

## [0.5.0 - 0.6.2] - 2026-01-20 a 2026-01-24

Resumen: Performance 4 fases (React.cache, in-memory cache, paginacion cursor, React Query useInfiniteQuery, composite indexes, partial selects, server action consolidation). WhatsApp Cloud API integracion directa. Read receipts. Rate limiting. HMAC-SHA256 webhook. Agentes IA CRUD + secrets encriptados (AES-256-GCM).

---

## [0.4.x - 0.1.0] - 2026-01-11 hasta 2024-12-31

Versiones tempranas: Admin panel, multi-tenant RBAC, i18n, paginacion server-side, filtros, chat UI, componentes base, login, tema dark/light. Ver git log para detalle completo.
