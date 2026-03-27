# KAIRO - Changelog

> Solo se mantienen las ultimas 5 versiones (v0.12.0+). Versiones anteriores en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

---

## [0.18.0] - 2026-03-27

### Dashboard: 8 stat cards + close rate + conversion rate

Reestructuracion completa de stat cards: Total leads (active+archived), Leads activos, Leads ganados, Clientes, Tasa de cierre (won/active), Tasa de conversion (customer/active), En modo humano, Leads archivados. Agentes activos oculto del UI pero mantenido en API. Grid: 2 cols mobile, 4 cols desktop. Todos los stats respetan el filtro de rango de fecha (fix: human mode antes no filtraba). Renombrado chart "Estado de leads" a "Estado de leads (Tipificacion)" (es/en).

### Nuevos lead statuses: unqualified, no_response, customer

3 nuevos estados de tipificacion: "No Calificado" (gris piedra), "Sin Respuesta" (gris slate), "Cliente" (sky blue). Agregados a Prisma enum, TypeScript enum, LEAD_STATUS_CONFIG, dashboard charts, filtros, traducciones es/en, y mapStatus helper.

### Auto-tipify: new → no_response post-reengagement

Leads en status `new` que recibieron un reengagement hace >24h sin responder son automaticamente cambiados a `no_response`. Corre dentro del cron de reengagement existente (cada 15 min). Solo afecta leads en modo AI, no archivados. Non-fatal on error.

### WhatsApp 24h window countdown en chat

Timer HH:MM:SS en el boton "Tomar control" mostrando tiempo restante de la ventana 24h de WhatsApp. Cuando expira: boton deshabilitado (modo AI), chat input deshabilitado con notice "Ventana expirada" (modo humano). Timer se resetea via Realtime cuando el lead envia nuevo mensaje. Solo aplica a leads de canal WhatsApp. `getLeadHandoffStatus()` ahora retorna `channel` + `lastLeadMessageAt`.

### Per-service currency en pricing KB

Cada servicio puede tener su propia moneda (override) o heredar la global. Selector por servicio con opciones "Global" + PEN/USD/EUR/MXN. Label global renombrado a "Moneda (Global)". `composePricingText()` agrega codigo de moneda cuando difiere de la global. No requiere migracion DB (JSONB).

### UX: Dark text on accent buttons

Todos los botones con fondo cyan (`--accent-primary`) ahora usan texto oscuro (`--kairo-midnight`) para legibilidad. 9 archivos corregidos: KB forms, dashboard, settings, workspace.

### Inline edit criterios de calificacion

Criterios HOT/WARM/COLD ahora tienen iconos edit (lapiz), duplicate (copiar), delete (papelera) al hover, igual que las Reglas especificas. Edit inline con input + save/cancel.

### Fix: human chat media metadata preserved

sendMessage sobrescribia el metadata del mensaje al recibir respuesta de WhatsApp API, perdiendo los mediaAttachments (URL de imagen/video). Ahora hace merge con el metadata existente. Ademas, cleanup-media cron extendido de 24h a 5 dias para que media enviada por humanos permanezca visible en el historial.

### Fix: all dashboard stats respect date range filter

"En modo humano" ignoraba el rango de fecha seleccionado, siempre mostrando estado actual. Ahora filtra por updatedAt dentro del rango, consistente con Won, Customer y Archived.

### Source detection debug logging

Log temporal del `referral` de Meta en webhook para diagnosticar clasificacion FB vs IG ads. Hallazgo: Meta siempre envia `fb.me/` como source_url, no distingue Instagram.

### Tooling: Vercel CLI + MCP

Vercel CLI instalado y linkeado al proyecto. Token configurado. Vercel MCP (Public Beta) agregado para acceso directo a logs desde Claude Code.

---

## [0.17.0] - 2026-03-26

### Follow-up notifications: Email + Push

Los seguimientos programados (`follow_up_due`) solo generaban notificacion de campana (bell). Ahora tambien envian **email** y **push** a los miembros del proyecto que tengan estas preferencias activadas.

**Arquitectura:** El pg_cron sigue insertando bell notifications directo (para Realtime instantaneo). Adicionalmente, cuando encuentra follow-ups pendientes, llama al nuevo endpoint via `pg_net` para enviar email + push. Solo se invoca cuando hay follow-ups reales (no cada minuto), manteniendo el free tier.

**Template email:** Mismo diseno KAIRO dark (fondo #0B1220, card #111827, boton cyan #00E5FF) con mensaje "Seguimiento pendiente" + nombre del lead + proyecto. Soporta i18n (es/en).

| Archivo | Cambio |
|---------|--------|
| `src/lib/email.ts` | `sendFollowUpEmail()` + `buildFollowUpEmailHtml()` + i18n `followUpI18n` |
| `src/app/api/cron/followup-notify/route.ts` | Nuevo endpoint: recibe leads de pg_net, envia email + push |
| `scripts/pg-cron-followup-notifications.sql` | Agrega `pg_net` extension + `net.http_post()` condicional al endpoint |
| `docs/NOTIFICATIONS.md` | Tabla de canales por tipo actualizada |

**Deploy:** Despues de deploy a Vercel, ejecutar el SQL actualizado en Supabase SQL Editor. URL y CRON_SECRET hardcodeados en la funcion SECURITY DEFINER (Supabase free tier no permite ALTER DATABASE SET).

### Follow-up email: timezone + fecha programada

El email de follow-up ahora incluye la fecha/hora programada ("Programado: 26 mar. 2026, 12:15 p.m.") formateada en el timezone del usuario (preference `timezone`, default America/Lima).

| Archivo | Cambio |
|---------|--------|
| `src/lib/email.ts` | `formatFollowUpDate()` con timezone, campo `scheduledAt` en template |
| `src/app/api/cron/followup-notify/route.ts` | Pasa `scheduledAt` + `timezone` del usuario |
| `scripts/pg-cron-followup-notifications.sql` | Incluye `nextFollowUpAt` en payload pg_net |

### Videollamada Jitsi Meet (super_admin only)

Boton "Llamar" en el panel del lead ahora inicia una videollamada via Jitsi Meet (servidor publico, costo cero). Solo visible para super_admin.

**Flujo:** Click → genera sala unica → envia link al lead por WhatsApp (mismo numero del agente) → abre sala en nueva pestana para el agente.

| Archivo | Cambio |
|---------|--------|
| `src/components/features/LeadDetailPanel.tsx` | `handleStartVideoCall()`, icono VideoCallIcon, import sendMessage |

**Escalabilidad futura:** Migrar a **8x8 JaaS** (Jitsi as a Service) para embeber videollamada dentro de KAIRO con branding propio. Free tier: 10,000 min/mes. Evaluar cuando haya ingresos que justifiquen el salto.

---

## [0.16.2] - 2026-03-25

### Fix: Post-Login Redirect Missing Locale Prefix

Usuarios reportaron que despues de login eran redirigidos a `/leads` en lugar de `/es/leads`, causando pagina rota sin locale.

**Causa raiz:** `(dashboard)/page.tsx` usaba `redirect('/leads')` de `next/navigation` (sin locale). Cuando un usuario visitaba la raiz (`/`), el middleware guardaba `redirect=/` en la URL de login. Despues de autenticarse, el deep-link enviaba a `/es/` → `page.tsx` redirigía a `/leads` sin prefijo de locale.

**Fixes:**

| Archivo | Cambio |
|---------|--------|
| `src/app/[locale]/(dashboard)/page.tsx` | Usa `getLocale()` + redirect con locale explicito (`/${locale}/leads`) |
| `src/app/[locale]/(auth)/login/page.tsx` | Deep-link ignora `/` como destino (no es un destino util, cae al flujo normal) |

**Nota:** El sistema de deep-link post-login para notificaciones por email (`/es/leads?leadId=xxx`) no fue afectado — sigue funcionando correctamente.

---

## [0.16.1] - 2026-03-24

### Lead Source Auto-Detection

Deteccion automatica del origen de leads al momento de creacion. Dos mecanismos:

1. **Meta Referral (CTWA Ads):** Cuando un lead viene de un anuncio Click-to-WhatsApp en Facebook o Instagram, Meta envia un objeto `referral` en el webhook. Se parsea `source_url` para distinguir FB vs IG.
2. **Hashtags en primer mensaje:** Para plataformas sin referral nativo (TikTok, Google, organicos), se detectan hashtags en el mensaje prefijado del link wa.me.

| Hashtag | Source |
|---------|--------|
| *(CTWA Ad FB)* | `facebook_ads` (auto) |
| *(CTWA Ad IG)* | `instagram_ads` (auto) |
| `#facebookads` | `facebook_ads` |
| `#facebook` | `facebook_organic` |
| `#instagramads` | `instagram_ads` |
| `#instagram` | `instagram_organic` |
| `#tiktokads` | `tiktok_ads` |
| `#tiktok` | `tiktok_organic` |
| `#googleads` | `google_ads` |

**Enum LeadSource actualizado:** +7 valores (`facebook_ads`, `facebook_organic`, `instagram_ads`, `instagram_organic`, `tiktok_ads`, `tiktok_organic`, `google_ads`).

### Dashboard Source Chart

Horizontal bar chart "Origen de leads" al lado derecho del chart de "Estado de leads". Colores por plataforma, ordenado por cantidad, respeta filtro de fecha.

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | 7 nuevos valores en enum `LeadSource` |
| `src/types/index.ts` | Enum TypeScript sincronizado |
| `src/app/api/webhooks/whatsapp/route.ts` | `WhatsAppReferral` type + `detectLeadSource()` + source en lead creation |
| `src/lib/actions/dashboard.ts` | `sourceDistribution` query (groupBy source) |
| `src/app/[locale]/(dashboard)/dashboard/DashboardClient.tsx` | Source horizontal bar chart + colores + labels |
| `src/messages/es.json` / `en.json` | Labels i18n para 11 sources |

**Migraciones:** `20260324_add_lead_source_platforms`, `20260324_add_fb_ig_organic_sources`

---

## [0.16.0] - 2026-03-22

### Dashboard Charts & Visualizations

Dashboard completo con charts interactivos (recharts) y metricas conectadas a datos reales.

**Nuevos widgets:**

| Widget | Tipo | Descripcion |
|--------|------|-------------|
| Leads por dia | Bar chart (cyan) | Tendencia de captacion por dia, responsive |
| Temperatura de leads | Donut chart | Distribucion hot/warm/cold con colores |
| Estado de leads | Horizontal bar | 7 status con colores por etapa del pipeline |
| Tasa de conversion | Stat card (%) | Won / Total * 100 |

**Archivos nuevos/modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/actions/dashboard.ts` | `getDashboardCharts()` — queries groupBy para temperatura, status, leads/dia |
| `src/app/[locale]/(dashboard)/dashboard/DashboardClient.tsx` | Reescrito con recharts (BarChart, PieChart), 5 stat cards, mobile responsive |
| `src/app/[locale]/(dashboard)/dashboard/page.tsx` | SSR default cambiado a `last30days` |
| `src/messages/es.json` / `en.json` | Labels de charts (i18n) |
| `package.json` | `recharts` dependency |

**Layout responsive:** 5 stat cards (2 cols mobile, 5 cols desktop), bar chart + donut (1 col mobile, 3 cols desktop), status bar full width.

### Cron cleanup-media failsafe

El cron `cleanup-media` podia borrar TODOS los archivos si la query a `agent_media` fallaba (Set vacio). Ahora **aborta** si no puede cargar los paths protegidos.

**Archivo:** `src/app/api/cron/cleanup-media/route.ts`

### Image Lightbox

Click en thumbnails de imagenes abre lightbox full-screen (overlay oscuro, Esc para cerrar). Videos abren en nueva pestana (CORS Supabase free tier).

**Archivos nuevos/modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/components/ui/ImageLightbox.tsx` | Nuevo componente, capture-phase ESC listener |
| `src/components/knowledge/MultimediaModal.tsx` | Lightbox en thumbnails de imagenes, videos abren en nueva tab |
| `src/components/knowledge/FixedImageSlot.tsx` | Lightbox + timestamp |
| `src/components/knowledge/FixedVideoSlot.tsx` | Timestamp + open in new tab |

### Upload timestamps en agent media

Fecha/hora de carga visible en todos los items de media (RAG + fixed, imagenes + videos).

**SQL ejecutado:** `get_fixed_event_media` RPC actualizado para retornar `created_at` y `media_type`.

### Corregido

- **Dashboard SSR flash:** Stats de SSR (sin workspace filter) flasheaban antes de client fetch. Fix: `isLoading` inicia en `true`.
- **ESC lightbox cerraba modal padre:** Listener ahora usa capture phase (`addEventListener(..., true)`) para interceptar antes del Modal.
- **Dashboard default:** Cambiado de "Today" a "Last 30 days" para vista inicial mas util.

---

## [0.15.1] - 2026-03-21

### Cron cleanup-media protege agent_media

El cron `cleanup-media` eliminaba TODOS los archivos del bucket `media` mayores a 24h, incluyendo imagenes/videos permanentes del agente (agent_media). Esto causaba que las imagenes del agente dejaran de funcionar y los mensajes historicos mostraran thumbnails rotos.

**Fix:** Antes de eliminar, el cron consulta todos los `storage_path` de la tabla `agent_media` y los excluye de la eliminacion.

**Archivo:** `src/app/api/cron/cleanup-media/route.ts`

### Edit media con reemplazo de archivo

Al editar una imagen o video del agente, ahora se puede **reemplazar el archivo** ademas de editar titulo/descripcion. Hover sobre el thumbnail muestra overlay para cambiar. El archivo viejo se elimina automaticamente del storage.

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/actions/agent-media.ts` | `updateAgentMedia()` acepta `newFile`/`newMediaUrl`/`newStoragePath` opcionales |
| `src/components/knowledge/MultimediaModal.tsx` | EditForm con overlay de cambio, compresion de imagenes, upload client-side de videos |
| `src/app/[locale]/(dashboard)/settings/SettingsPageClient.tsx` | Callback `onEdit` pasa datos de reemplazo |

**SQL:** `scripts/update-agent-media-file-rpc.sql` — RPC `update_agent_media_file` (SECURITY DEFINER, retorna old_storage_path para cleanup)

**Nota:** Los mensajes historicos que referenciaban imagenes eliminadas por el cron antes del fix mantienen URLs muertas en su `metadata.mediaAttachments`. Esto es irrecuperable.

---

## [0.15.0] - 2026-03-20

### Agent Video Support

Soporte completo de videos en el sistema de Agent Media. Videos se suben, almacenan y envian via WhatsApp con el mismo patron de imagenes (RAG semantico + fixed event slots).

**Nuevos archivos:**

| Archivo | Funcion |
|---------|---------|
| `src/lib/utils/video-upload.ts` | Upload client-side directo a Supabase Storage (bypass Vercel 4.5MB limit) |
| `src/lib/utils/video-thumbnail.ts` | Extraccion de thumbnails via Canvas API (funciona desde File, limitado desde URL por CORS) |
| `src/components/knowledge/FixedVideoSlot.tsx` | Componente para upload/display de videos fijos por evento |

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/actions/agent-media.ts` | Nuevas: `addAgentVideoByUrl()`, `uploadFixedEventVideoByUrl()` (reciben URL post-upload) |
| `src/lib/ai/search-media.ts` | `searchRelevantVideos()` para busqueda semantica de videos |
| `src/lib/whatsapp/send.ts` | `sendVideoToWhatsApp()` (WhatsApp Cloud API `type: video`) |
| `src/lib/ai/process-ai-response.ts` | Soporte [VIDEO-X] markers, envio de videos RAG + fixed event video |
| `src/app/api/cron/reengagement/route.ts` | Soporte [VIDEO-X] markers + fixed event video en reengagement |
| `src/lib/ai/generate-reengagement.ts` | Nuevo param `videoItems`, seccion VIDEOS DISPONIBLES en prompt |
| `src/lib/ai/build-system-prompt.ts` | Seccion VIDEOS DISPONIBLES con markers [VIDEO-X] |
| `src/components/knowledge/MultimediaModal.tsx` | Tab Videos con `VideoThumbnail` subcomponent, galeria de videos |
| `src/components/features/LeadChat.tsx` | Video card (icono play #0B1220 + titulo + "Open video" link i18n) |
| `src/app/[locale]/(dashboard)/settings/SettingsPageClient.tsx` | `onAddVideo` con upload client-side, FixedVideoSlot en tabs |
| `src/messages/es.json` + `en.json` | `chat.openVideo`: "Abrir video" / "Open video" |

**Arquitectura:**

- **Client-side upload**: Videos se suben directo a Supabase Storage desde el browser, evitando el limite de 4.5MB de Vercel Hobby serverless functions
- **Orden de envio WhatsApp**: imagen fija → texto → video fijo → RAG images → RAG videos. Video va DESPUES del texto porque WhatsApp tarda mas en procesar/entregar video que texto
- **Position tagging**: `position: 'before'` (encima del texto en chat) y `position: 'after'` (debajo del texto). Imagenes fijas = before, videos fijos = after, RAG media = after
- **Chat rendering**: Videos se muestran como card clickeable (icono play + titulo + link "Abrir video"), no como `<video>` inline (bloqueado por CORS de Supabase Storage)
- **Thumbnails**: Funcionan desde File objects (upload), no desde URLs (CORS tainted canvas). Fallback a icono de camara

**Limitaciones conocidas:**

- Thumbnails de video no se muestran al recargar pagina (CORS con Supabase Storage bloquea Canvas). Se usa icono de camara como fallback
- Videos en chat no se reproducen inline (CORS). Se abren en nueva pestaña via link

### Corregido

- **Send window no persistia en ReEngagement (`src/lib/actions/reengagement.ts`):** El schema Zod del server action no incluia `sendWindowStart` ni `sendWindowEnd`, por lo que esos campos eran strippeados silenciosamente al guardar. Fix: campos agregados al schema. Ademas, los defaults del cron (`09:00-22:00`) alineados con `DEFAULT_REENGAGEMENT_CONFIG` (`17:00-23:00`).

- **Debounce 3s no funcionaba (Redis no configurado):** Upstash Redis no estaba provisionado, por lo que `src/lib/redis.ts` retornaba `null` y el webhook procesaba mensajes inmediatamente sin debounce. Fix: Leo creo base de datos Upstash Redis (free tier, region sa-east-1 Sao Paulo). Variables `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` agregadas a Vercel. Debounce confirmado funcionando: 2 mensajes rapidos producen 1 sola respuesta IA consolidada.

- **Orden de envio WhatsApp inconsistente**: Codigo enviaba imagen → video → texto, pero WhatsApp entregaba imagen → texto → video (video tarda mas en procesarse). Fix: reordenado a imagen → texto → video en `process-ai-response.ts` y `reengagement/route.ts`.

---

## [0.14.0] - 2026-03-19

### Debounce 3s en Webhook WhatsApp

Cuando un lead envia multiples mensajes rapidos, el sistema ahora espera 3 segundos y concatena todos los mensajes en una sola entrada para el AI, evitando respuestas duplicadas.

**Nuevos archivos:**

| Archivo | Funcion |
|---------|---------|
| `src/lib/redis.ts` | Singleton Redis client (Upstash) para debounce |

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/app/api/webhooks/whatsapp/route.ts` | Debounce con Redis `SET NX EX 3` + `waitUntil` + concatenacion de mensajes |

**Arquitectura:**
- Redis `SET NX EX 3`: primer mensaje gana, siguientes se ignoran (otro invocation ya espera)
- `waitUntil(sleep 3s)`: mantiene funcion viva sin bloquear respuesta HTTP
- Re-fetch mensajes de DB tras 3s, concatena consecutivos del lead
- Fallback sin Redis (dev): procesa inmediatamente como antes

### Fixed Event Images (Imagenes fijas por evento)

Nuevo sistema de imagenes que se envian SIEMPRE con eventos especificos, independiente del RAG semantico. 4 tipos: `first_contact`, `reengagement_0`, `reengagement_1`, `reengagement_2`.

**Nuevos archivos:**

| Archivo | Funcion |
|---------|---------|
| `scripts/setup-fixed-event-media.sql` | Columna `event_type`, indice unico, RPCs (`get_fixed_event_media`, `set_event_media`, `clear_event_media`) |
| `src/components/knowledge/FixedImageSlot.tsx` | Componente compacto para upload/display de imagenes fijas |

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/types/agent-media.ts` | Nuevos tipos `FixedEventType`, `FixedEventMedia` |
| `src/lib/actions/agent-media.ts` | Server actions: `getFixedEventMedia`, `uploadFixedEventMedia`, `deleteFixedEventMedia` |
| `src/lib/ai/search-media.ts` | `getFixedMediaForEvent()`, eliminado `getAllAgentMedia`/`getCachedMediaCount` |
| `src/lib/ai/process-ai-response.ts` | Envia imagen fija de primer contacto (messageCount <= 2) |
| `src/app/api/cron/reengagement/route.ts` | Envia imagen fija por intento, eliminado `getAllAgentMedia` |
| `src/app/[locale]/(dashboard)/settings/SettingsPageClient.tsx` | FixedImageSlot en Multimedia (first_contact) y ReEngagement (0/1/2) |
| `src/messages/es.json` + `en.json` | Claves i18n `fixedImage.*` |

**SQL requerido:** `scripts/setup-fixed-event-media.sql` + RPC `set_event_media` (SECURITY DEFINER)

### Horario de envio configurable para ReEngagement

Reemplaza el horario hardcodeado (9 AM - 10 PM) por selectores AM/PM configurables por agente.

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/types/reengagement.ts` | Nuevos campos `sendWindowStart`/`sendWindowEnd`, helpers `generateTimeOptions()`, `getWindowDurationHours()` |
| `src/app/api/cron/reengagement/route.ts` | `isWithinSendWindow()` reemplaza `isWithinBusinessHours()`, soporta cruce de medianoche |
| `src/app/[locale]/(dashboard)/settings/SettingsPageClient.tsx` | Selectores AM/PM (30 min), validacion ventana > delay, delay limitado a 1-5h |
| `src/messages/es.json` + `en.json` | Claves i18n `sendWindow*` |

### Mobile Lead Panel - Botones en una fila

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/components/features/LeadDetailPanel.tsx` | Botones en fila horizontal: icon-only en mobile (excepto Schedule = icon + texto corto), texto completo en sm+ |

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

> Versiones v0.11.1 y anteriores archivadas en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

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
