# KAIRO - Changelog

> Solo se mantienen las ultimas 5 versiones (v0.9.2+). Versiones anteriores en [docs/changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

---

## [0.11.0] - 2026-03-16

### ReEngagement - Auto Follow-up for Silent Leads

Cuando un lead deja de responder, el sistema envia automaticamente UN mensaje de seguimiento generado por IA, dentro de la ventana de 24h de WhatsApp (sin costo adicional).

**Nuevos archivos:**

| Archivo | Funcion |
|---------|---------|
| `src/lib/types/reengagement.ts` | Interface `ReEngagementConfig` + default config |
| `src/lib/actions/reengagement.ts` | Server actions: get/save config por agente |
| `src/lib/ai/generate-reengagement.ts` | Generador de mensaje IA (GPT-4o-mini, max 250 chars) |
| `src/lib/whatsapp/send.ts` | Helper compartido de envio WhatsApp (extraido de process-ai-response) |
| `src/app/api/cron/reengagement/route.ts` | Endpoint cron con logica de elegibilidad |

**Settings UI (`SettingsPageClient.tsx`):**

Tercer tab "ReEngagement" con toggle, dropdown de horas (1-20, default 6), textarea para prompt template, notas informativas.

**Cron Jobs migrados a Supabase:**

Vercel Hobby solo permite crons diarios. Ambos crons migrados a Supabase `pg_cron` + `pg_net`:

| Job | Schedule | Endpoint |
|-----|----------|----------|
| `kairo-reengagement` | `*/15 * * * *` | `/api/cron/reengagement` |
| `kairo-cleanup-media` | `0 3 * * *` | `/api/cron/cleanup-media` |

`vercel.json` vaciado de crons. Supabase llama los endpoints via `net.http_get()` con Bearer token.

**DB Migration:**

- `leads`: `lastReEngagementAt` (DateTime?), `reEngagementCount` (Int, default 0)
- `ai_agents`: `reEngagementConfig` (Json?)

**Condiciones de elegibilidad:**

1. Agente con `reEngagementConfig.enabled = true`
2. Lead en modo AI, no archivado, con whatsappId
3. Ultimo mensaje es del AI (lead no respondio)
4. Ultimo mensaje del lead fue > delayHours pero < 24h
5. No se ha enviado re-engagement para este periodo de silencio
6. Horario comercial (9 AM - 8 PM timezone del proyecto)

**Fix critico:** Tipos y constantes extraidos de archivo `'use server'` a `src/lib/types/reengagement.ts`. Next.js no permite exportar objetos/tipos desde archivos `'use server'` (solo funciones async).

---

## [0.10.2] - 2026-03-15

### RAG Query Enrichment + UI/UX Improvements

**RAG Search Enhancement (`process-ai-response.ts`):**

Nueva funcion `buildRAGQuery()` que enriquece mensajes cortos antes de la busqueda semantica.

| Aspecto | Detalle |
|---------|---------|
| Problema | Mensajes de 1 palabra como "Si" o "Ok" generaban similarity scores muy bajos (< 0.35) contra el Knowledge Base |
| Solucion | Si `message.length < 15` chars, concatenar con las ultimas 2 respuestas del asistente (context window) |
| Cap | Query enriquecida cappada en 500 chars para no degradar performance de pgvector |
| Fallback | Si no hay contexto previo (primer mensaje), se usa el mensaje original sin cambios |
| Impacto | Mensajes ambiguos obtienen contexto semantico del hilo -> mejores matches en KB |

**URL Word Wrap (`LeadChat.tsx`):**

Clase CSS `break-words` agregada a los bubbles de mensajes de chat. Previene que URLs largas (ej: links de WhatsApp, links de propiedades) causen scroll horizontal en el panel de chat.

**Timestamp Standardization (`utils.ts` + componentes):**

Timestamps en toda la app ahora incluyen hora ademas de la fecha relativa.

| Formato | Antes | Ahora |
|---------|-------|-------|
| Hoy | "Hoy" | "Hoy 3:45 PM" |
| Ayer | "Ayer" | "Ayer 3:45 PM" |
| Esta semana | "hace 2 d" | "hace 2 d 3:45 PM" |
| Mas de una semana | "14 mar. 2026" | "14 mar. 2026 3:45 PM" |

Funciones modificadas: `formatRelativeTime()`, `formatDate()`. Nueva helper: `formatTime12h()`.
Aplicado en: `NotificationDropdown.tsx`, `LeadDetailPanel.tsx`.

**Drag & Drop Rule Reordering (`SettingsPageClient.tsx`):**

Reordenamiento de reglas por drag & drop en la seccion de reglas especificas del agente (Settings).

| Aspecto | Detalle |
|---------|---------|
| Libreria | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Componente | `SortableRuleItem` con grip handle (icono de 6 puntos) |
| Persistencia | Solo se guarda al hacer click en "Guardar" (no auto-save) |
| Scope | Solo reglas del agente (no Global Rules, que son read-only para no-super_admin) |

**Collapsible Instruction Sections (`SettingsPageClient.tsx`):**

Secciones de configuracion del agente ahora son colapsables para reducir el scroll y mejorar la legibilidad de la pagina de Settings.

| Seccion | Estado por defecto |
|---------|-------------------|
| Rules | Colapsada |
| Temperature Criteria | Colapsada |
| Personality | Colapsada |
| Additional Instructions | Colapsada |
| Global Rules | Colapsada (con border styling unificado) |

**Global Rule: WhatsApp Text-Only Format:**

Nueva regla global agregada al sistema de Global Rules instruyendo a los agentes a formatear respuestas para WhatsApp: saltos de linea entre ideas, *negrita* para destacar, emojis como bullets, maximo 2-3 lineas por bloque.

---

## [0.10.1] - 2026-03-14

### Admin UserModal Redesign + Push Prompt Persistence

**UserModal (crear usuario):**
- Password: reemplazados radio buttons por boton "Generar" + campo con show/hide + copy + checklist de validacion (8 chars, mayuscula, minuscula, numero, especial)
- Selects: opcion vacia "Seleccionar..." por defecto en organizacion y proyecto (fix bug que pre-seleccionaba el primero sin setear el value)
- Reset al cambiar rol: al cambiar entre Super Admin y Usuario se limpian org/proyecto/isOrgOwner
- Rol de proyecto oculto para super_admin (irrelevante, tiene acceso total)
- Default project role: Admin (antes Viewer)
- autoComplete="off" en form + todos los inputs (previene autofill del browser)
- Generacion segura con `crypto.getRandomValues()` + Fisher-Yates shuffle

**Push notification prompt:**
- Migrado de `sessionStorage` a `localStorage` con cooldown persistente
- 3 dias entre re-prompts, maximo 3 intentos, despues no vuelve a preguntar
- Key: `kairo_push_dismiss_${userId}` (JSON: `{count, dismissedAt}`)

---

## [0.10.0] - 2026-03-12

### Supabase Realtime + Region Co-location + Auth Optimization

Migracion de polling HTTP a Supabase Realtime (WebSocket push) para notificaciones, leads list y chat AI. Co-locacion de regiones Vercel/Supabase en Sao Paulo. Optimizacion de auth chain y reduccion de providers.

**Region Co-location (infraestructura):**

| Componente | Antes | Despues | Beneficio |
|-----------|-------|---------|-----------|
| Vercel Function Region | Washington DC (iad1) | Sao Paulo (gru1) | ~150ms menos por query DB |
| Supabase | Sao Paulo (sa-east-1) | Sin cambio | 10-12 queries/page = 1.5-2s ahorrados |

**Auth Chain Optimization (commit `4369412`):**

| Cambio | Detalle |
|--------|---------|
| `getSupabaseUser()` con `React.cache()` | Single Supabase auth call por request (auth.ts) |
| `getLeadsPaginatedSSR()` | Acepta auth pre-verificado, evita round-trips redundantes |
| `getLeadsStatsFromDBSSR()` | Idem, para stats |
| Ahorro total | ~2 Supabase auth round-trips + ~1 Prisma query por page load |

**Provider Reduction (commit `4369412`):**

| Cambio | Detalle |
|--------|---------|
| ModalProvider removido de dashboard | Solo se usaba en login |
| WorkspaceContext | 3 useEffects -> 0 (lazy state initializers) |
| ThemeContext | 1 mount useEffect removido (lazy initializer) |
| LoadingContext | Simplificado, rAF chain removido |
| Total | 7 -> 6 providers, 6 -> 1 mount useEffects |

**Supabase Realtime - Notifications (commit `4369412`):**

| Aspecto | Antes | Despues |
|---------|-------|---------|
| Mecanismo | HTTP polling 30s | WebSocket push (Realtime) |
| Polling fallback | N/A | 120s (solo respaldo) |
| Sonido, badge, deep-link | Intactos | Intactos |

**Supabase Realtime - Leads List (commits `4369412`, `807fbfc`, `4dd1a57`):**

| Cambio | Detalle |
|--------|---------|
| Hook `useRealtimeLeads.ts` | Suscripcion a INSERT/UPDATE en tabla leads |
| Debounce 500ms | Para eventos rapidos (webhook cascade) |
| Cache invalidation | Invalida leads + stats en TanStack Query |
| Fix: auth antes de subscribe | `await auth.getUser()` antes de suscribirse (RLS requiere sesion) |
| Fix: UPDATE sin projectId filter | REPLICA IDENTITY DEFAULT solo tiene PK en WAL |

**Supabase Realtime - AI Chat (commit `4369412`):**

Removida condicion `isHumanMode` de `useRealtimeMessages`. Conversaciones AI ahora visibles en tiempo real. Indicador "Live" en ambos modos.

**RLS Policies completas (commit `8f9ad52`):**

| Aspecto | Detalle |
|---------|---------|
| Tablas cubiertas | 16 tablas con RLS habilitado |
| Script | `scripts/rls-all-tables-policies.sql` |
| Helper functions | `user_has_project_access()`, `is_super_admin()`, `user_has_org_access()` |
| Critico para Realtime | SELECT policies necesarias para que Realtime filtre eventos |

**Fix: Human messages not showing (commit `b246aa0`):**

Race condition de deduplicacion: `sendMessage` agregaba ID a `processedMessageIds` antes de que Realtime INSERT llegara. Fix: agregar mensaje directamente al cache TanStack Query despues de enviar. Realtime INSERT correctamente deduplicado despues.

**REPLICA IDENTITY FULL en leads:**

`ALTER TABLE leads REPLICA IDENTITY FULL` - permite que Supabase Realtime evalue filtros en eventos UPDATE (por defecto solo tiene PK en WAL).

---

## [0.9.5] - 2026-03-11

### Performance + Security Audit v3 (4 Phases)

Auditoria integral de rendimiento y seguridad en 4 fases (7 commits). Consolida Prisma, elimina auth redundante, endurece endpoints.

**Phase 1 - Infrastructure + Endpoint Hardening (commit `7e894f5`):**

| ID | Cambio | Archivo |
|----|--------|---------|
| C2 | Consolidar Prisma singleton (eliminar duplicado en supabase/server.ts, centralizar en prisma.ts) | `prisma.ts`, `supabase/server.ts` |
| M3 | `serverExternalPackages` en next.config.ts (prisma, openai, web-push, resend) | `next.config.ts` |
| L1 | Guardia en script `db:push` en package.json (previene ejecucion accidental) | `package.json` |
| H5 | ThemeProvider render fix (no mas null return, renderiza children inmediatamente) | `ThemeContext.tsx` |
| C4 | n8n webhook hardening: rate limiting 60req/min, timingSafeEqual, fix null-key bypass | `webhooks/n8n/route.ts` |
| H6 | Access check en scheduleFollowUp (verificacion de acceso al proyecto) | `leads.ts` |
| H7 | Push subscription validation: HTTPS endpoint, p256dh/auth length, 10 suscripciones max/usuario | `push-subscriptions.ts` |
| M5 | CSP unsafe-eval solo en development (removido de produccion) | `next.config.ts` |

**Phase 2 - Auth Migration + Middleware (commits `38eceba`, `ee5e038`, `e72b3e2`):**

| ID | Cambio | Archivo |
|----|--------|---------|
| H4 | Migrar `getCurrentUser()` a `verifyAuth()` en 5 server actions (leads, messages, knowledge, secrets, media) | `leads.ts`, `messages.ts`, `knowledge.ts`, `secrets.ts`, `media.ts` |
| M1 | Unificar `verifyProjectAccess` en agents.ts (eliminar duplicado local) | `agents.ts` |
| M6 | Middleware redirige usuarios no autenticados de rutas protegidas a login | `middleware.ts` |
| M7 | Validacion de redirect hardened con decodeURIComponent | `middleware.ts` |
| -- | Login redirect usa `window.location.href` en vez de `router.push` (mas rapido) | `login/page.tsx` |
| -- | Fix double-locale bug en post-login redirect | `login/page.tsx` |

**Phase 3 - Frontend Caching (commit `f568484`):**

| ID | Cambio | Archivo |
|----|--------|---------|
| M2 | React Query staleTime 30s en leads + stats queries (reduce refetches) | `useLeadsQuery.ts` |
| H3 | Settings page parallel fetch con Promise.all (elimina waterfall) | `SettingsPageClient.tsx` |

**Phase 4 - Admin Security (commit `14a3651`):**

| ID | Cambio | Archivo |
|----|--------|---------|
| M8 | verify-admin endpoint sanitizado: no expone userId, systemRole ni reason en response | `verify-admin/route.ts` |
| -- | Admin stats usa `select: { systemRole: true }` en vez de fetch completo de usuario | `admin.ts` |

**Bug Fix - Human chat messages not reaching WhatsApp (commit `fc9f381`):**

`sendMessage()` en `messages.ts` enviaba mensajes del chat humano via n8n webhook (`lead.project.n8nWebhookUrl`), pero n8n fue removido del critical path en v0.8.0. Los mensajes se guardaban en DB pero nunca llegaban a WhatsApp.

| Cambio | Detalle |
|--------|---------|
| Reemplazar llamada a n8n webhook | Llamadas directas a WhatsApp Cloud API (mismo patron que `process-ai-response.ts`). Soporta text, image, video y document con captions. |
| Limpiar codigo obsoleto | Removido bloque de notificacion handoff de n8n y `n8nWebhookUrl` de los Prisma selects del mismo archivo. |

**Archivo modificado:** `src/lib/actions/messages.ts`

**Bug Fix - Emoji picker no renderizaba (commit `ad56a11`):**

El picker `@emoji-mart/react` renderizaba en el DOM con `width: 0` (Shadow DOM solo tenia un STYLE tag, sin contenido). Causa raiz: `dynamic()` import de Next.js + lazy-loading de datos en `useEffect` hacian que el core vanilla JS de `emoji-mart` no recibiera el prop `data` correctamente y fallara silenciosamente al intentar fetch de `cdn.jsdelivr.net`.

| Cambio | Detalle |
|--------|---------|
| Reemplazar `dynamic()` con imports directos | `@emoji-mart/data` y `@emoji-mart/react` importados estaticamente |
| Pre-inicializar datos | `emojiInit({ data: emojiData })` a nivel de modulo (antes del render) |
| Usar emojis nativos del sistema | `set="native"` en el componente (elimina dependencia de sprite sheets via CDN) |
| Eliminar estado y efecto de datos | `emojiData` state y `useEffect` de lazy-loading removidos |
| Fix race condition click-outside | `onMouseDown stopPropagation` en boton de emoji en `ChatInput.tsx` para prevenir que el handler click-outside cierre el picker antes de que abra |

**Archivos modificados:** `src/components/features/LeadChat.tsx`, `src/components/features/ChatInput.tsx`

---

## [0.9.4] - 2026-03-11

### Web Push Notifications (3er canal de notificacion)

Notificaciones push del navegador como 3er canal junto a campana (in-app) y email. Patron pre-permission para evitar estado `denied` del browser.

**Canales de notificacion (3):**

| Canal | Tipo | Default | Control |
|-------|------|---------|---------|
| Bell (in-app) | Siempre activo | ON | No desactivable |
| Email (Resend) | Opt-out | ON | Toggle en Profile |
| Web Push | Opt-in | OFF | Pre-permission modal + toggle en Profile |

**Pre-permission modal:**

| Paso | Descripcion |
|------|-------------|
| 1 | Usuario se loguea, 3s despues aparece modal KAIRO |
| 2 | "Activar" -> dispara `Notification.requestPermission()` del browser |
| 3 | "Ahora no" -> dismiss (sessionStorage), browser queda en `default` |
| 4 | Proximo login: modal vuelve a aparecer si permission sigue en `default` |

**Per-device subscriptions:**

| Aspecto | Detalle |
|---------|---------|
| Modelo | `PushSubscription` (1 row por browser/device, N por usuario) |
| Constraint | `@@unique([userId, endpoint])` - evita duplicados por device |
| Toggle Profile | ON = tiene 1+ suscripciones activas. OFF = desactiva TODAS las suscripciones |
| Auto-cleanup | Subscriptions expiradas (410/404 del push service) se eliminan automaticamente |

**Archivos nuevos:**

| Archivo | Proposito |
|---------|-----------|
| `src/lib/push/send-push.ts` | VAPID config + `sendPush()` con web-push library |
| `src/lib/actions/push-subscriptions.ts` | Server actions: subscribe, unsubscribe, toggleAll, getStatus |
| `src/hooks/usePushNotifications.ts` | Hook cliente: SW registration, permission state, subscription lifecycle |
| `src/components/features/PushPermissionModal.tsx` | Modal pre-permission con bell icon |
| `public/sw.js` | Service Worker: push events + notification clicks + deep-link |
| `public/manifest.json` | PWA manifest (KAIRO branding) |
| `prisma/schema.prisma` | Modelo `PushSubscription` + relacion User |

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/actions/notifications.ts` | `sendPushToUsers()` integrado en `notifyProjectMembers()` como 3er canal (fire-and-forget) |
| `src/app/[locale]/(dashboard)/DashboardLayoutClient.tsx` | Push modal con 3s delay post-login |
| `src/app/[locale]/(dashboard)/profile/page.tsx` | Toggle push en seccion notificaciones |
| `src/app/[locale]/layout.tsx` | `<link rel="manifest">` + `<meta name="theme-color">` |
| `next.config.ts` | CSP connect-src: FCM, Mozilla, Windows, Apple push domains |
| `src/messages/es.json` + `en.json` | Keys `pushNotifications.modal.*` y `pushNotifications.profile.*` |
| `package.json` | Dependencias `web-push` + `https-proxy-agent` |

**Env vars nuevas:**

| Variable | Proposito |
|----------|-----------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clave publica VAPID (baked at build time) |
| `VAPID_PRIVATE_KEY` | Clave privada VAPID (server-side only) |
| `VAPID_SUBJECT` | Email de contacto VAPID (`mailto:ia@kairoagent.com`) |

**Migracion:** Prisma migration para tabla `push_subscriptions` + RLS policies en Supabase SQL Editor.

---

## [0.9.3] - 2026-03-10

### Coming-Soon Features Ocultas (UX)

Items del sidebar sin funcionalidad (Conversaciones, Sub-agentes, Reportes) y boton "Nuevo Lead" ahora solo visibles para `super_admin`.

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/Sidebar.tsx` | Items `disabled` ocultos si `!isSuperAdmin` |
| `src/app/[locale]/(dashboard)/leads/LeadsPageClient.tsx` | Boton "Nuevo Lead" condicionado a `isSuperAdmin` |

---

### AI Summary Mejorado

Resumen IA en panel de detalle ya no se corta a mitad de frase. Limite aumentado de 500 a 1000 caracteres con prompt mejorado que prioriza informacion accionable.

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Limite chars | 500 | 1000 |
| max_tokens | 200 | 400 |
| Prompt | Generico | Prioriza: intereses, decisiones, next steps. Nunca corta mid-sentence |
| Estilo | Libre | Tercera persona, oraciones completas |

**Archivo:** `src/lib/ai/process-ai-response.ts` (funcion `generateSummary`)

---

### Email Notifications on Handoff (Resend)

Notificacion por email cuando el agente IA transfiere una conversacion a modo humano. Usa Resend como proveedor de email.

| Aspecto | Detalle |
|---------|---------|
| Trigger | AI handoff (`[HANDOFF]` marker detectado) |
| Destinatario | Miembros del proyecto con `emailNotifications: true` en su perfil |
| Contenido | Email HTML branded (KAIRO dark theme) con nombre del lead, agente, proyecto y boton CTA |
| Deep-link | Boton "Ver en KAIRO" apunta a `/{locale}/leads?leadId=xxx` |
| i18n | Templates en ES y EN segun locale del destinatario |
| CC | Otros miembros del proyecto incluidos como CC |
| Fire-and-forget | Nunca bloquea el pipeline; errores se loguean sin propagar |

**Archivos:**

| Archivo | Proposito |
|---------|-----------|
| `src/lib/email.ts` | Cliente Resend singleton, HTML builder, `sendHandoffEmail()` |
| `src/lib/actions/notifications.ts` | Invoca `sendHandoffEmail()` tras crear notificacion de handoff |
| `src/app/[locale]/(dashboard)/profile/ProfilePageClient.tsx` | Toggle "Email Notifications" en preferencias de perfil |

**Env vars:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (default: `KAIRO <no-reply@kairoagent.com>`)

---

### Deep-Link Post-Login Redirect Fix

Cuando un usuario no autenticado accede a una URL con query params (ej: `/es/leads?leadId=xxx` desde el email de handoff), ahora se preserva la URL completa tras el login.

**Problema:** `redirect()` de Next.js App Router crea una nueva respuesta HTTP que descarta headers del middleware, query params y cookies. Intentos con middleware redirect, cookies, hash fragments - todos fallaban por limitaciones de Vercel Edge Runtime.

**Solucion:** `AuthRedirect` client component + `sessionStorage`.

| Paso | Descripcion |
|------|-------------|
| 1 | Dashboard layout detecta usuario no autenticado |
| 2 | Renderiza `<AuthRedirect />` en vez de `redirect()` server-side |
| 3 | AuthRedirect guarda `pathname + search` en `sessionStorage` |
| 4 | Redirige a login via `window.location.href` |
| 5 | Login page post-auth lee `sessionStorage` y navega a la URL guardada |

**Archivos:**

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/AuthRedirect.tsx` | Nuevo: guarda URL en sessionStorage antes de redirect a login |
| `src/app/[locale]/(dashboard)/layout.tsx` | `<AuthRedirect />` en vez de `redirect()` para usuarios no autenticados |
| `src/app/[locale]/(auth)/login/page.tsx` | Post-login: lee `sessionStorage` para deep-link redirect |

---

### Boton Llamar Oculto para No-Super_Admin

Boton "Llamar" en panel de detalle del lead solo visible para `super_admin` (feature no lista para usuarios regulares).

---

### Mobile Tabs (Icon-Only Pattern)

Tabs en paginas con pestanas usan solo iconos en mobile para evitar overflow horizontal, con labels completos en desktop.

---

## [0.9.2] - 2026-03-09

### AI-Initiated Handoff System

El agente IA puede transferir automaticamente la conversacion a un asesor humano cuando detecta que el lead lo necesita (agendar cita, negociar precio, pide hablar con alguien).

**Mecanismo:**

| Paso | Descripcion |
|------|-------------|
| 1 | System prompt instruye al agente sobre cuando transferir + formato `[HANDOFF]` |
| 2 | AI pipeline detecta `[HANDOFF]` en respuesta via regex |
| 3 | Marker removido del mensaje enviado al lead |
| 4 | Lead actualizado a `HandoffMode.human` |
| 5 | Activity log creado (tipo `handoff_change`) |
| 6 | Notificacion `handoff_request` enviada al equipo |

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/ai/build-system-prompt.ts` | Instruccion de handoff antes del cierre anti-injection |
| `src/lib/ai/process-ai-response.ts` | Deteccion `[HANDOFF]`, limpieza, update lead, activity log, notificacion |
| `src/app/api/webhooks/whatsapp/route.ts` | `organizationId` en query + `maxDuration` 25->55s (audio pipeline) |
| `prisma/schema.prisma` | `handoff_request` en enum `NotificationType` |
| `src/components/layout/NotificationDropdown.tsx` | HandoffIcon SVG + estilo rojo para handoff_request |

---

### Notification Sound (Web Audio API)

Sonido de notificacion (beep 800Hz, 0.15s) cuando llegan nuevas notificaciones.

| Aspecto | Detalle |
|---------|---------|
| AudioContext | Singleton reutilizado (no crea nuevo por beep) |
| Autoplay policy | Listeners `click`/`touchstart`/`keydown` desbloquean AudioContext suspendido |
| Inicializacion | AudioContext creado al montar el hook (listeners listos desde inicio) |
| Deteccion | `count > previousUnreadCountRef` entre polls (no suena al cargar pagina) |
| Reset | `previousUnreadCountRef` se resetea al cambiar de proyecto |

**Archivo:** `src/hooks/useNotifications.ts`

---

### Per-Project Notification Filtering

Notificaciones filtradas por proyecto seleccionado en el workspace.

| Archivo | Cambio |
|---------|--------|
| `src/lib/actions/notifications.ts` | `projectId` opcional en `getNotifications()`, `getUnreadNotificationCount()`, `markAllNotificationsRead()` |
| `src/hooks/useNotifications.ts` | Acepta `projectId`, lo pasa a todas las server actions |
| `src/components/layout/NotificationDropdown.tsx` | Usa `useWorkspaceOptional()` + pasa `selectedProject?.id` |
| `src/contexts/WorkspaceContext.tsx` | Nuevo hook `useWorkspaceOptional()` (retorna null sin provider, no lanza error) |

**Fix:** Admin page crash resuelto - `useWorkspace()` lanzaba error en `/admin` que no tiene WorkspaceProvider.

---

### Smart Notification Routing

Notificaciones `new_message` solo se envian cuando el lead esta en modo `human`. En modo `ai`, el pipeline maneja sus propias notificaciones via handoff.

| Archivo | Cambio |
|---------|--------|
| `src/app/api/webhooks/whatsapp/route.ts` | `notifyProjectMembers` condicionado a `lead.handoffMode === HandoffMode.human` |

---

### KB & UI Improvements

| Mejora | Archivo | Detalle |
|--------|---------|---------|
| Precio con thousand separators | `PricingForm.tsx` | `inputMode="decimal"`, regex validation, auto-format con `,` y `.` |
| Descripcion como textarea | `PricingForm.tsx` | Campo descripcion de `<input>` a `<textarea rows={3}>` |
| ExpandableTextarea en 5 campos | `SettingsPageClient.tsx` | KB free text, role, personality, additional instructions, pricing description |
| KB free-text edit | `SettingsPageClient.tsx` | Boton editar (lapiz) en cada entry, modal dinamico add/edit |

**Regla 11 agregada:** Usar `ExpandableTextarea` para textareas de contenido largo.

---

## Formato de Changelog

Cada entrada sigue el formato:

```markdown
## [VERSION] - YYYY-MM-DD

### Agregado
- Nuevas features

### Cambiado
- Cambios en features existentes

### Corregido
- Bug fixes

### Eliminado
- Features removidas

### Seguridad
- Fixes de seguridad
```
