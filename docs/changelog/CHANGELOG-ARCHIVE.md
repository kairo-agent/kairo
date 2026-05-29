# KAIRO - Changelog Archive (v0.27.0 y anteriores)

> Versiones antiguas archivadas. Ver [CHANGELOG.md](../CHANGELOG.md) para versiones recientes (v0.27.1+).

---

## [0.27.0] - 2026-05-11

### Active Agent = Runtime Source of Truth (multi-agent foundation)

Separa **agente activo del proyecto** (fuente de verdad runtime) de **`lead.assignedAgentId`** (historico inmutable). Permite multiples agentes por proyecto sin scripts de reasignacion. Nuevo helper `getActiveAgentForProject(projectId)` (cache Redis 5min + invalidacion explicita en todas las server actions que tocan agentes). `whatsapp/receive` + `WebChatChannelHandler` resuelven el agente activo via helper (ya no leen `lead.assignedAgent`). `createAgent` default `isActive:false`. Form data de `LeadDetailPanel` usa el schema del agente ACTIVO. Beneficio E&Z: activar otro agente hace que los 610 leads historicos respondan con la nueva logica sin UPDATE masivo. Sin migracion DB.

---

## [0.26.0] - 2026-05-08

### Fase 4 Multi-Canal: Realtime + paridad con WhatsApp

Cierra el loop multi-canal del widget WebChat (8 commits, `e599f7f` → `313bddd`):

- **4.A Realtime broadcast como senal** (`e599f7f`): server emite broadcast SIN payload, widget IGNORA payload y refetchea via endpoint autenticado (rechaza JWT+RLS y broadcast-con-content por spoof). Col `Conversation.realtimeTopicSecret` (UUID v4). Cliente Phoenix WS vanilla (-15KB sin SDK). Polling fallback 3s→30s.
- **4.B Polling pause/resume** (`ceb6fa3`): WS sano detiene polling; WS caido lo rearma. ~120 fetches/h ahorrados.
- **4.C Handoff humano UI banner** (`fffee0a` + `d1c0104`): banner sticky con `handoffMode='human'`. Bug: el dashboard persiste via `sendMessage()` (no `WebChatChannelHandler.send()`) y no emitia broadcast — emitter agregado a `sendMessage`/`toggleHandoffMode`.
- **4.D Media upload visitor**: imagen (Vision), audio (Whisper, guard SSRF por hostname), documento (sin AI). Endpoint `POST /api/widget/upload-token` (signed PUT, TTL 5min, MIME whitelist, max 10MB).
- **4.E CORS strict**: `resolveCorsOrigin` con lista vacia bloquea todo cross-origin. **Nota (v0.27.4):** este gate nunca respeto `allowedOrigins` por un bug en `getAllowedOrigins`. Corregido en v0.27.4.

---

## [0.25.0] - 2026-05-07

### Fase 3 Multi-Canal: WebChat MVP

Segundo canal en `widget.kairoagent.com` (Vercel #2), Shadow DOM + polling 3s, reusa pipeline AI. 3 endpoints publicos con rate limit + CORS. `WebChatChannelHandler` (IChannelHandler) con debounce Redis NX 5s; pipeline agnostico `whatsappId` → `externalUserId`. Bundle Vite vanilla TS = 7.8 KB gzip. UX chatflow360 (bubble pulse, hover-expand teaser), multi-instancia, localStorage, bilingue. Settings `/settings/webchat` 7 cards. Rename `/leads` → `/conversations` (redirects 307); tabla BD `leads` NO se renombra.

---

## [0.23.1] - 2026-04-20

### Filtro "Origen" en /leads (NEW)

Nuevo filtro por `LeadSource` en la pagina de leads. Dropdown dinamico que muestra solo los origenes con al menos 1 lead en el scope del usuario (paridad con el chart del dashboard). Los 9 valores del enum sin uso quedan ocultos automaticamente; aparecen solos cuando llegue el primer lead con ese source.

**Server action `getAvailableSources(projectId?, organizationId?)`** en `src/lib/actions/leads.ts`: reusa `verifyAuth() + getAccessibleProjectIds() + getVisibilityContext() + buildLeadWhereClause()` para garantizar RBAC y visibility correctos. `Prisma.groupBy({ by: ['source'] })` tipado (sin SQL raw). Devuelve solo las keys del enum.

**SourceDropdown** (`src/components/features/LeadFilters.tsx`): lazy-load al abrir, refetch al cambiar proyecto/org, ordenado por prioridad (Ads → Organico → Otro), spinner + empty state.

**Backend:** `buildLeadWhereClause` tambien filtra por `source`. `sourceLabels` del Excel export cubre los 13 valores del enum (antes solo 6). i18n: nueva seccion `leads.sources.*` con los 13 valores en snake_case (es/en).

**Mobile UX Fixes:** SourceDropdown y AssignedToDropdown usan `static + w-full` en mobile y `absolute + min-w-[220px]` en `sm+`. Fix max-h por breakpoint: `max-h-[2400px]` mobile / `1200px` tablet / `600px` desktop.

---

## [0.23.0] - 2026-04-07

### Team Settings Page (NEW)

Nueva pagina `/settings/team` con dos tabs: Lead Visibility Control (all_leads / assigned_and_unassigned / only_assigned almacenado en `Project.leadVisibilityMode`) y Lead Auto-Assignment (distribucion porcentual en `Project.leadAutoAssignment` JSONB, algoritmo ponderado con balance diario en `src/lib/auto-assign.ts`). Migraciones: `20260407_add_lead_visibility_mode`, `20260407_add_lead_auto_assignment`.

User Phone Field: `phone` (nullable) en modelo `User`. PhoneInput en Admin UserModal y pagina Perfil. User Avatar Upload: crop interactivo (react-easy-crop), compresion 400x400 JPEG 85%, Supabase Storage `avatars/{userId}/{uuid}.jpg`, cron protection. Debounce WhatsApp 3s → 5s. Filtro usuarios inactivos en dropdowns asignacion. Handoff personalizado con nombre del asesor + tarjeta advisor card. `LeadFormDataDisplay` con badge completitud + isValidPersonName(). Resumen IA form-aware. TikTokAds keyword detection. Nuevo `docs/RBAC.md`.

---

## [0.22.3] - 2026-04-07

### Date Filter Improvements

dateField selector (creacion vs ultimo contacto), preset "Este mes" con timezone (reemplaza "Ultimos 30 dias"), fix rango personalizado excluia ultimo dia (endDate a 23:59:59.999). Archivos: `src/types/index.ts`, `src/lib/actions/leads.ts`, `src/components/features/LeadFilters.tsx`, `LeadsPageClient.tsx`, `es.json`, `en.json`.

---

## [0.22.2] - 2026-04-03

### ReEngagement dual-model (Model A + Model B)

Los seguimientos ahora se envian tanto si el lead responde y vuelve a hacer silencio (Model A, existente) como si nunca responde (Model B, nuevo). El contador de attempts siempre avanza, nunca repite el mismo intento.

**Antes:** attempt 0 → lead debe responder → silencio → attempt 1 → lead debe responder → silencio → attempt 2.
**Ahora:** attempt 0 → (delayHours) → attempt 1 → (delayHours) → attempt 2, sin importar si el lead respondio o no.

**Cambio:** Query SQL en cron reengagement: eliminada condicion `lead_msg > last_re_at` que requeria respuesta. `completedCycles` reemplazado por `totalReengagements` (total enviados). UI descriptions actualizadas en es/en.

**Archivo:** `src/app/api/cron/reengagement/route.ts`, `es.json`, `en.json`

### Additional Instructions max length 2000 → 10000

**Archivos:** `SettingsPageClient.tsx` (maxLength + counter), `prompt-builder.ts` (zod schema)

### Fix: Save button disappears on hover (Form + ReEngagement tabs)

Causa raiz: `hover:bg-[var(--accent-hover)]` — variable CSS no existe. Fix: usar `Button variant="primary"` con `isLoading` prop. Boton ahora siempre visible con `disabled={!hasUnsavedChanges}` + texto "Tienes cambios sin guardar".

**Archivos:** `SettingsPageClient.tsx`, `es.json`, `en.json`

---

## [0.22.0] - 2026-04-01

### Conversational Form (NEW MAJOR FEATURE)

Los agentes IA ahora pueden recopilar datos estructurados de leads durante la conversacion de WhatsApp de forma natural. Por agente. Max 8 campos. Trigger modes: `immediate` o `on_interest` (WARM/HOT). Campo `formConfig` (JSONB) en `AIAgent` + tabla `lead_form_data`. Pipeline extrae marcador `[FORM-DATA: key=value]` de la respuesta GPT, guarda en `lead_form_data`, auto-llena campos del lead. UI: 4to tab "Formulario" en Settings.

---

## [0.21.0] - 2026-04-01

### Timezone-aware date handling

Toda la app respeta el `defaultTimezone` de la organizacion en vez de UTC. Principio: "Store UTC, Resolve on Read". Nuevo `src/lib/timezone.ts` con `Intl.DateTimeFormat`. Modificados: `dashboard.ts` (chart grouping), `leads.ts` (date filter + Excel), `WorkspaceContext`, `process-ai-response.ts`, webhooks, `utils.ts` (formatDate/Time acepta timezone). Sticker support agregado al pipeline Vision. Emoji cleanup (flags ES/EN reemplazados con texto).

---

## [0.20.1] - 2026-03-31

### Temperature Classification Guard

Guard en pipeline AI que impide clasificar temperatura hasta que lead haya enviado >=2 mensajes. Primer contacto siempre COLD. Drag & Drop en Criterios de Calificacion en Settings (con `@dnd-kit/sortable`). Fix contraste tabs Admin Panel (text-[var(--kairo-midnight)] sobre fondo cyan).

---

## [0.20.0] - 2026-03-30

### Incoming Lead Media (NEW FEATURE)

Descarga y renderizado de media entrante (imagen, video, audio, documento). `src/lib/whatsapp/download-media.ts` baja media WhatsApp API → Supabase Storage via `waitUntil`. Path: `incoming/{projectId}/{year}/{month}/{uuid}.{ext}`. Max 50MB. Chat UI: imagenes lightbox, video player nativo, AudioPlayer custom, documentos download link. Badge "Disponible hasta {date}". Expiracion: cron 5 dias.

### GPT-4o-mini Vision (NEW FEATURE)

Analisis imagenes entrantes via GPT Vision en modo AI. `detail: 'low'`. Fallback: si `downloadedUrl` no esta lista post-debounce, fetch directo de WhatsApp como base64. freshMediaId pattern para mediaId actualizado post-debounce.

### AudioPlayer + Whisper para todos los modos

Nuevo `src/components/ui/AudioPlayer.tsx`. Whisper transcription corre para TODOS los modos (AI + human). Integrado en download-media.ts post-upload.

### PWA + custom favicon + --accent-text + Discard terminology + Dashboard charts + Mobile fixes

PWA: `manifest.json` con maskable icons, meta tags iOS, viewport-fit cover, install banner createPortal. Favicon KAIRO custom. Variable CSS `--accent-text` reemplaza `--accent-primary` para textos cyan en ~40 archivos. "Archivar"→"Descartar" / "Archive"→"Discard". Chart labels visibles + cost-per-lead widget. Mobile: header titulo oculto, admin stats grid 2 cols, icon-only buttons.

---

## [0.19.0] - 2026-03-29

Archivado desde CHANGELOG.md. Contenido: RBAC Lead Assignment System completo (`src/lib/permissions.ts`: role hierarchy super_admin>owner>admin>manager>agent>viewer, getEffectiveRole, permission predicates). Hooks useEffectiveRole + useEffectiveRoleSafe. Server actions assignLead/getProjectTeamMembers/getProjectRole. Role guards en updateLead/updateLeadStatus/sendMessage/toggleHandoffMode. LeadAssignment component (admin dropdown, agent tomar lead, viewer sin acciones). Effective role badge en header. Owner toggle en edit user modal (updateOrganizationMemberOwnership). Agent → Asesor/Advisor (i18n). "Assigned to" filter (mis leads/sin asignar/multi-select). Excel export restringido a admin+. Project role editing en UserModal. Jitsi desbloqueado para todos los roles. Security fix: cross-session workspace leakage (clear localStorage on login, workspace validation, auto-select single org/project).

---

## [0.18.0] - 2026-03-27

Archivado desde CHANGELOG.md. Contenido: Dashboard 8 stat cards (total/activos/ganados/clientes/tasa cierre/tasa conversion/modo humano/archivados). 3 nuevos lead statuses: unqualified/no_response/customer (Prisma enum + UI + i18n). Auto-tipify new→no_response post-reengagement (cron 15min). WhatsApp 24h countdown en boton "Tomar control" (timer HH:MM:SS, reset via Realtime, getLeadHandoffStatus retorna channel+lastLeadMessageAt). Per-service currency en pricing KB (override o herencia global, PEN/USD/EUR/MXN). UX: dark text en accent buttons (9 archivos). Inline edit criterios HOT/WARM/COLD. Fix: sendMessage metadata merge (preserva mediaAttachments). Fix: todos los stats del dashboard respetan filtro de fecha. Source detection debug logging (Meta referral). Tooling: Vercel CLI + MCP.

---

## [0.17.0] - 2026-03-26

Archivado desde CHANGELOG.md. Contenido: Follow-up notifications via email + push (pg_cron llama `/api/cron/followup-notify` via pg_net; template KAIRO dark; i18n es/en; scheduledAt con timezone del usuario). Videollamada Jitsi Meet (sala unica, envia link al lead por WhatsApp; solo super_admin).

---

## [0.16.2] - 2026-03-25

Archivado desde CHANGELOG.md. Contenido: Fix post-login redirect sin locale prefix. `(dashboard)/page.tsx` usaba `redirect('/leads')` de `next/navigation`. Fix: `getLocale()` + redirect con locale explicito. Login page ignora `/` como destino de deep-link.

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

Pagina de config de agentes con tabs Instructions (`promptStructure` JSONB) y Knowledge Base (5 secciones estructuradas: Business Hours, FAQs, Pricing, Location & Contact, Policies — Zod → texto bilingue → embedding OpenAI → pgvector via RPC). Dual-name: `ai_agents.name` (admin) vs `promptStructure.agentName` (persona IA, default "Kaira"). 4 migraciones SQL (promptStructure + 3 RPCs). Regla: operaciones sobre `agent_knowledge` DEBEN usar RPCs SECURITY DEFINER (3 bugs RLS corregidos). 11 tests E2E WhatsApp OK.

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

Archivado desde CHANGELOG.md. Contenido: Notificaciones enriquecidas con deep-link al panel de lead (batch-fetch por metadata.leadId, badge temperatura, navegacion a /leads?leadId=xxx). Sistema de notificaciones in-app con polling 15s (Notification model + NotificationType enum, getNotifications/markAsRead/notifyProjectMembers, NotificationDropdown). Follow-up Scheduling (scheduleFollowUp server action, FollowUpModal con DayPicker + react-day-picker, badges rojo/naranja/gris en cards, optimistic updates en React Query). FollowUpModal reescrito con calendario visual. Fix: mobile notification dropdown overflow.

---

## [0.7.15] - 2026-02-06

Archivado desde CHANGELOG.md. Contenido: ExpandableTextarea (expand hover, modal 3xl, aplicado a Knowledge + Instructions). Modal Project Settings a max-w-5xl. Optimistic status updates + Sonner toasts (rollback en error). Fix i18n status badges en tabla. AI Summary en LeadDetailPanel (muestra resumen IA, caja punteada si sin resumen, timestamp relativo). WhatsApp Typing Indicator (typing_indicator en read receipt, auto-dismiss 25s). Performance P1-5/P1-1/P2-4 completados.

---

## [0.7.14] - 2026-02-05

Archivado desde CHANGELOG.md. Contenido: Archive Leads con campo `archivedAt` separado (Opcion B, preserva status original). Server actions archiveLead/unarchiveLead con transaccion. Filtro 3 estados: activos/archivados/todos. Badge gris "Archivado" en cards, tabla, y panel detalle. Boton Archivar/Desarchivar en footer del panel. Modal custom KAIRO reemplaza window.confirm. Indice compuesto [projectId, archivedAt].

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

12 de 15 optimizaciones tras auditoria de seguridad. **Frontend** (commit `4617060`): `verifyAuth()` lightweight + `verifyProjectAccess()` indexed, `getLeadPanelData()` consolidada, paralelizar count+messages en `getLeadConversation` y post-send ops, migrar 10 server actions a `verifyAuth`, indice compuesto `leads(projectId, whatsappId)`, batch read receipts WhatsApp. **Backend** (commit `38d2734`): atomic Lua script rate limiting Redis (fix race), cache OpenAI client SHA-256 + TTL 5min, parallel DB ops Promise.all en webhook, fire-and-forget status updates, eliminar retry en `handleStatusUpdate`, fetch paralelo audio transcription, phone masking en logs. Rechazado: P1-3 fire-and-forget audit logs (integridad obligatoria en SaaS B2B). **Docs:** CLAUDE.md 62KB → 6.5KB (90% reduccion, previene error serializacion JSON), `docs/INDEX.md` hub navegacion, `docs/RULES.md` protocolo context-safe Playwright MCP.

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
