# KAIRO - Changelog

> Solo se mantienen las ultimas 5 versiones (v0.10.0+). Versiones anteriores en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

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

## [0.11.1] - 2026-03-18

### Corregido

- **ReEngagement business hours extendido:** Horario comercial para envio de re-engagement cambiado de 9 AM - 8 PM a 9 AM - 10 PM, permitiendo seguimiento en horarios nocturnos mas comunes en Latam.

### Mejorado

- **AI response instructions mejoradas (`build-system-prompt.ts`):** Reemplazada instruccion generica "respond naturally" con reglas explicitas: revisar historial de conversacion, nunca repetir info ya dada, nunca re-presentarse, avanzar conversacion al siguiente paso logico, y ofrecer asesor humano cuando falta info especifica. Reduce respuestas repetitivas y mejora la experiencia del lead.

---

> Versiones v0.11.0 y anteriores archivadas en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

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
