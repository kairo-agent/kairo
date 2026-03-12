# KAIRO - Changelog

> Solo se mantienen las ultimas 5 versiones (v0.9.1+). Versiones anteriores en [docs/changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

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

## [0.9.1] - 2026-03-09

### RAG Search Fix - SECURITY DEFINER + Threshold Optimization

**Bug critico**: RAG search retornaba 0 resultados en produccion. El bot inventaba datos (ubicacion, redes sociales, telefonos) en lugar de usar el Knowledge Base.

**Causa raiz (cadena de 3 problemas):**

| # | Problema | Efecto |
|---|---------|--------|
| 1 | `search_agent_knowledge` usaba `SECURITY INVOKER` (unica RPC sin migrar) | RLS se aplica al caller |
| 2 | Webhook WhatsApp no tiene sesion de usuario (anon key, sin cookies) | RLS evalua como usuario anonimo |
| 3 | RLS policies referencian `pm.project_id` pero columna real es `pm."projectId"` | RLS filtra silenciosamente TODOS los rows |

**Resultado**: GPT nunca recibia datos del KB -> inventaba respuestas -> datos falsos se guardaban en lead summary -> se auto-reforzaban via historial.

**Fix aplicado:**

| Cambio | Archivo | Detalle |
|--------|---------|---------|
| RPC a SECURITY DEFINER | `search_agent_knowledge` (SQL) | Bypasea RLS rota, consistente con insert/list/delete |
| GRANT a anon | RPC search | Webhook context sin sesion puede ejecutar la funcion |
| Threshold 0.5 -> 0.35 | `process-ai-response.ts` | Alineado con ChatFlow360 (probado en produccion) |
| Threshold default 0.7 -> 0.35 | RPC SQL + setup script | Default mas permisivo para mejor recall |

**Fixes adicionales (misma sesion):**

| Fix | Archivo | Detalle |
|-----|---------|---------|
| Temperatura visible al usuario | `build-system-prompt.ts` | GPT usaba formato libre `*Temperatura*: texto` en vez de `[TEMPERATURA: HOT]`. Fix: instruccion explicita del formato + regex fallback en `process-ai-response.ts` |
| Emoji en setup SQL | `scripts/setup-rag-complete.sql` | Pre-commit hook bloqueaba por emojis above-BMP |

**Migracion SQL:**

| Archivo | Cambio |
|---------|--------|
| `prisma/migrations/20260309_fix_search_knowledge_rpc/migration.sql` | DROP + CREATE con SECURITY DEFINER, threshold 0.35, GRANT authenticated + anon |

**Patron obligatorio (actualizado):**

> TODAS las operaciones sobre `agent_knowledge` (INSERT, SELECT, UPDATE, DELETE, **SEARCH**) DEBEN usar RPCs SECURITY DEFINER.
> Nunca usar SECURITY INVOKER ni queries directas con anon key.
> Threshold RAG: **0.35** (no 0.5 ni 0.7).

**Verificacion E2E**: Bot respondio con datos exactos del KB (direccion, telefono, email, redes sociales con URLs correctas, politicas, precios).

---

### Global Rules System

Sistema de reglas globales que el super admin puede crear y que aplican automaticamente a TODOS los agentes de TODOS los proyectos.

**Modelo de datos:**

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `GlobalRule.id` | String (cuid) | Identificador unico |
| `GlobalRule.content` | Text | Contenido de la regla |
| `GlobalRule.order` | Int | Orden de aplicacion |
| `GlobalRule.isActive` | Boolean | Activa/inactiva |
| `GlobalRule.createdAt` | DateTime | Fecha de creacion |

No hay limite maximo de reglas. RLS habilitado.

**Inyeccion en system prompt:**

Las reglas globales activas se inyectan en `build-system-prompt.ts` como una seccion antes de las reglas especificas del agente:

```
=== REGLAS GLOBALES (OBLIGATORIAS) ===
1. [contenido de regla global 1]
2. [contenido de regla global 2]
...
```

El delimitador `=== ===` mantiene coherencia con el patron anti-prompt-injection existente.

**UI:**

| Ubicacion | Descripcion |
|-----------|-------------|
| `/admin/global-rules` | Panel de administracion solo para super_admin. CRUD completo (crear, editar, reordenar, activar/desactivar, eliminar). Layout full-width. |
| `Settings > Instructions` | Vista de solo lectura de las reglas globales activas, antes de las reglas especificas del agente. |

**Archivos:**

| Archivo | Proposito |
|---------|-----------|
| `prisma/schema.prisma` | Modelo `GlobalRule` |
| `prisma/migrations/20260309_add_global_rules/` | Migracion con tabla + RLS |
| `src/lib/actions/global-rules.ts` | Server Actions CRUD (solo super_admin) |
| `src/app/[locale]/(admin)/admin/global-rules/` | Pagina de admin |
| `src/lib/ai/build-system-prompt.ts` | Inyeccion de reglas globales |
| `src/app/[locale]/(dashboard)/settings/SettingsPageClient.tsx` | Vista read-only de reglas globales |
| `src/messages/es.json` + `en.json` | Keys i18n para global rules |

---

### Temperature Criteria UI

Criterios de calificacion HOT/WARM/COLD ahora son editables por agente desde Settings > Instructions.

**Implementacion:**

| Campo | Ubicacion | Descripcion |
|-------|-----------|-------------|
| `promptStructure.temperatureCriteria` | `ai_agents.promptStructure` (JSONB) | Objeto con campos `hot`, `warm`, `cold` (strings) |

No requiere migracion de BD. El campo JSONB existente `promptStructure` ya soporta campos arbitrarios.

**UI en Settings > Instructions:**

Seccion "Lead Qualification Criteria" con 3 textareas, una por temperatura:
- HOT: icono FlameIcon (red-500), criterios para leads calientes
- WARM: icono SunIcon (amber-500), criterios para leads tibios
- COLD: icono SnowflakeIcon (blue-400), criterios para leads frios

Los iconos son los mismos SVG components usados en la pagina de leads (`src/components/features/LeadIcons.tsx`).

**Composicion en system prompt:**

Si `temperatureCriteria` tiene contenido, reemplaza el bloque generico de calificacion:

```
LEAD QUALIFICATION CRITERIA:
- HOT: [criterio configurado por el admin]
- WARM: [criterio configurado por el admin]
- COLD: [criterio configurado por el admin]
```

Si no hay criterios configurados, se usa el fallback generico existente.

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/knowledge/prompt-builder.ts` | `TemperatureCriteria` interface + `temperatureCriteria` en `PromptStructure` |
| `src/lib/ai/build-system-prompt.ts` | Composicion de criterios custom vs fallback generico |
| `src/app/[locale]/(dashboard)/settings/SettingsPageClient.tsx` | Seccion UI con 3 textareas + iconos |
| `src/messages/es.json` + `en.json` | Keys i18n para temperatura criteria |

---

### Audio Transcription Fix - Facebook CDN Hostname

**Bug:** Transcripcion de audio fallaba silenciosamente en produccion. El audio no se descargaba de WhatsApp porque el hostname `lookaside.fbsbx.com` era rechazado por la validacion de CDN.

**Causa raiz:** La funcion `transcribeAudio()` en `process-ai-response.ts` validaba que la URL del audio viniera de dominios de Facebook CDN, pero solo incluia `fbcdn.net` y `facebook.com`. El dominio primario que usa WhatsApp Cloud API para media es `lookaside.fbsbx.com`.

**Fix:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/ai/process-ai-response.ts` | Agregado `fbsbx.com` a la whitelist de hostnames permitidos para Facebook CDN |

**Dominios CDN permitidos (ahora 3):**

```typescript
const FACEBOOK_CDN_HOSTNAMES = ['fbcdn.net', 'facebook.com', 'fbsbx.com'];
```

**Impacto:** Transcripciones de audio de WhatsApp Cloud API ahora funcionan correctamente en produccion.

---

### Full-Width Layout Fix

Removido `max-w-4xl mx-auto` de las paginas Settings y Global Rules que los dejaba con contenido centrado angosto en lugar de aprovechar todo el ancho disponible.

| Archivo | Cambio |
|---------|--------|
| `src/app/[locale]/(dashboard)/settings/page.tsx` | Removido `max-w-4xl mx-auto` del wrapper |
| `src/app/[locale]/(admin)/admin/global-rules/page.tsx` | Layout full-width desde creacion |

Consistente con la Regla 5 del proyecto: "Full-width layout".

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
