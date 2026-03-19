# KAIRO - Changelog

> Solo se mantienen las ultimas 5 versiones (v0.10.0+). Versiones anteriores en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

---

## [0.13.0] - 2026-03-19

### Chat Media Rendering

Imagenes enviadas por el agente IA y archivos adjuntos del humano ahora se muestran inline en el historial del chat como thumbnails clickeables. Cero storage adicional (usa URLs existentes de Supabase Storage).

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/ai/process-ai-response.ts` | Guarda `mediaAttachments` (url + title) en metadata del mensaje AI |
| `src/lib/actions/messages.ts` | Guarda `mediaAttachments` en metadata del mensaje humano con adjunto |
| `src/components/features/LeadChat.tsx` | Renderiza imagenes de `metadata.mediaAttachments` como thumbnails |

**Nota:** Solo mensajes nuevos (post-deploy) muestran imagenes. Mensajes anteriores no tienen `mediaAttachments` en metadata.

### Excel Export

Boton "Excel" (verde #217346) al lado del refresh en la pagina de leads. Abre modal con date picker KAIRO (calendario flotante via React Portal) para seleccionar rango de fechas. Genera .xlsx con headers traducidos (es/en).

**Nuevos archivos:**

| Archivo | Funcion |
|---------|---------|
| `src/components/features/ExportLeadsModal.tsx` | Modal con FloatingCalendar (Portal) + date range + export |

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/actions/leads.ts` | Nueva `exportLeadsToExcel()` - server action con SheetJS |
| `src/app/[locale]/(dashboard)/leads/LeadsPageClient.tsx` | Boton Excel + ExportLeadsModal |
| `src/messages/es.json` + `en.json` | Claves i18n export |
| `package.json` | Dependencia `xlsx` (SheetJS) - dynamic import |

**Arquitectura:**

- SheetJS importado dinamicamente (`await import('xlsx')`) para no inflar el bundle
- FloatingCalendar usa `createPortal(document.body)` para escapar del modal overflow
- Desktop: `position: fixed` + `getBoundingClientRect()` cerca del boton
- Mobile: overlay centrado con backdrop
- Server action valida acceso (auth + project access), visible para todos los usuarios
- react-day-picker en modo `single` (un calendario a la vez, auto-advance start→end)

### ReEngagement Media Support

El pipeline de reengagement ahora soporta envio de imagenes con el mismo protocolo `[MEDIA-X]` del AI pipeline regular. Funciona en todos los intentos (initial + follow-up 1 + follow-up 2).

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/app/api/cron/reengagement/route.ts` | Media search, marker extraction, mediaAttachments en metadata, sendImageToWhatsApp |
| `src/lib/ai/generate-reengagement.ts` | Nuevo param `mediaItems`, seccion IMAGENES DISPONIBLES en prompt |

---

## [0.12.0] - 2026-03-18

### Agent Media - Imagenes via WhatsApp con RAG Semantico

Los agentes IA ahora pueden enviar imagenes relevantes durante conversaciones de WhatsApp. Las imagenes se buscan semanticamente por descripcion (pgvector) y se envian como mensajes separados despues del texto.

**Nuevos archivos:**

| Archivo | Funcion |
|---------|---------|
| `scripts/setup-agent-media.sql` | Tabla `agent_media` + 6 RPCs + RLS + indices |
| `src/lib/types/agent-media.ts` | Tipos `AgentMediaEntry`, `MediaSearchResult`, constantes |
| `src/lib/actions/agent-media.ts` | Server actions: add, list, update, delete media |
| `src/lib/utils/image-compression.ts` | Compresion client-side Canvas API (max 1080px, JPEG 85%) |
| `src/components/knowledge/MultimediaModal.tsx` | Modal UI: upload, preview, edit inline, delete |
| `src/lib/ai/search-media.ts` | Busqueda semantica + feature flag cache (5 min TTL) |

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/whatsapp/send.ts` | Nueva `sendImageToWhatsApp()` (WhatsApp Cloud API `type: image`) |
| `src/lib/ai/build-system-prompt.ts` | Seccion `IMAGENES DISPONIBLES` con markers `[MEDIA-X]` |
| `src/lib/ai/process-ai-response.ts` | Media search (step 2b), parseo markers (step 5), envio imagenes (step 8) |
| `src/app/[locale]/(dashboard)/settings/SettingsPageClient.tsx` | Card Multimedia en Knowledge tab + modal |
| `src/messages/es.json` + `en.json` | Claves i18n multimedia |

**Arquitectura:**

- Feature flag: `projectHasMedia()` - cero overhead para proyectos sin media
- Fallback: texto siempre se envia primero, fallo de imagen no afecta al lead
- Comportamiento de imagenes (proactividad, limites, repeticiones) controlado via Global Rules / Specific Rules, no hardcodeado
- Solo sintaxis tecnica de markers `[MEDIA-X]` hardcodeada en prompt (no instrucciones de comportamiento)
- Seccion `IMAGENES DISPONIBLES` posicionada ANTES del KB texto en el prompt (evita que GPT use URLs del KB como imagenes)
- Threshold semantico: 0.30 (ajustado tras analisis de scores reales: imagenes relevantes ~0.33-0.34)
- Imagenes se envian sin caption (titulo) en WhatsApp - el texto de GPT ya provee contexto
- Compresion client-side: max 1080px lado mas largo, JPEG 85%, rechaza < 200x200
- Descripciones deben ser semanticas (para QUE sirve la imagen, CUANDO es relevante), no instrucciones para GPT

**Lecciones de prompt engineering:**

- Descripciones de media: optimizar para RAG semantico, no instrucciones de comportamiento
- Titulos: visibles en UI + system prompt, usados por GPT para identificar la imagen
- Reglas de comportamiento (cuando enviar, limites, proactividad): van en Global/Specific Rules
- Meta Ads: mensaje pre-llenado con contexto especifico mejora el match semantico del RAG

### Login Fixes

- **ERR_TOO_MANY_REDIRECTS (`middleware.ts`):** Cookies de sesion Supabase se seteaban en un response separado pero el middleware retornaba `intlResponse`, perdiendo los tokens y causando redirect loop infinito. Fix: cookies se propagan a `intlResponse` y a todos los redirects.
- **Loading overlay post-logout (`login/page.tsx`):** `showLoading(persist=true)` guardaba estado en localStorage, pero al remontar LoginPage el overlay no se limpiaba. Fix: `hideLoading()` explicito en mount de login page.

---

## [0.11.1] - 2026-03-18

### Corregido

- **ReEngagement business hours extendido:** Horario comercial para envio de re-engagement cambiado de 9 AM - 8 PM a 9 AM - 10 PM, permitiendo seguimiento en horarios nocturnos mas comunes en Latam.

### Mejorado

- **AI response instructions mejoradas (`build-system-prompt.ts`):** Reemplazada instruccion generica "respond naturally" con reglas explicitas: revisar historial de conversacion, nunca repetir info ya dada, nunca re-presentarse, avanzar conversacion al siguiente paso logico, y ofrecer asesor humano cuando falta info especifica. Reduce respuestas repetitivas y mejora la experiencia del lead.

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
6. Horario comercial (9 AM - 10 PM timezone del proyecto)

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
