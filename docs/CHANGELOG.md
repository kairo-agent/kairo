# KAIRO - Changelog

> Solo se mantienen las ultimas 5 versiones (v0.20.0+). Versiones anteriores en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

---

## [0.23.1] - 2026-04-20

### Filtro "Origen" en /leads (NEW)

Nuevo filtro por `LeadSource` en la pagina de leads. Dropdown dinamico que muestra **solo los orígenes con al menos 1 lead en el scope del usuario** (paridad con el chart del dashboard). Los 9 valores del enum sin uso quedan ocultos automaticamente; aparecen solos cuando llegue el primer lead con ese source.

**Server action `getAvailableSources(projectId?, organizationId?)`** en `src/lib/actions/leads.ts`: reusa `verifyAuth() + getAccessibleProjectIds() + getVisibilityContext() + buildLeadWhereClause()` para garantizar RBAC y visibility correctos. `Prisma.groupBy({ by: ['source'] })` tipado (sin SQL raw). Devuelve solo las keys del enum.

**SourceDropdown** (`src/components/features/LeadFilters.tsx`): lazy-load al abrir (mismo patron que `AssignedToDropdown`), refetch al cambiar de proyecto/org, ordenado por prioridad (Ads → Organico → Otro), spinner + empty state.

**Backend:** `buildLeadWhereClause` ahora tambien filtra por `source`, y `sourceLabels` del Excel export cubre los 13 valores del enum (antes solo 6).

**i18n:** Nueva seccion `leads.sources.*` con los 13 valores en snake_case (es/en).

**Archivos:** `src/types/index.ts` (LeadFilters.source), `src/lib/actions/leads.ts`, `src/components/features/LeadFilters.tsx`, `src/app/[locale]/(dashboard)/leads/LeadsPageClient.tsx`, `src/messages/es.json`, `src/messages/en.json`.

### Mobile UX Fixes — Dropdowns inline + max-height por breakpoint

**Dropdowns flotantes ahora inline en mobile.** Tanto `SourceDropdown` como `AssignedToDropdown` usan `static + w-full` en mobile y `absolute + min-w-[220px]` en `sm+`. En mobile los dropdowns empujan el contenido (FilterSections + cards de leads) hacia abajo en vez de taparlo — patron consistente con iOS/Android.

**Fix preexistente:** El contenedor de filtros tenia `max-h-[600px]` que en mobile (grid-cols-1 con 7 filtros apilados) cortaba ORIGEN / DESCARTADOS / ASIGNADO A. Ahora: `max-h-[2400px]` mobile / `1200px` tablet / `600px` desktop.

**Archivos:** `src/components/features/LeadFilters.tsx`

---

## [0.23.0] - 2026-04-07

### Team Settings Page (NEW)

Nueva pagina `/settings/team` con dos tabs accesible desde el sidebar. El sidebar de "Configuracion" es ahora colapsable con sub-items "AI Settings" y "Team Settings". Settings oculto para roles agent/viewer (solo Dashboard + Leads visible).

**Tab 1: Lead Visibility Control**

Controla que leads puede ver cada rol (agent/viewer). Manager+ siempre ve todos. Tres modos:

| Modo | Descripcion |
|------|-------------|
| `all_leads` | Todos los leads del proyecto (default) |
| `assigned_and_unassigned` | Solo leads asignados al usuario + sin asignar |
| `only_assigned` | Solo leads asignados al usuario |

Configuracion almacenada en `Project.leadVisibilityMode` (TEXT). Restriccion aplicada en: lista de leads, stats, charts del dashboard, `getLeadById`, `getLeadPanelData`, exportacion Excel.

Filtro "Assigned To" se adapta: oculto para `only_assigned`, sin lista de usuarios para `assigned_and_unassigned`.

**Nuevos archivos:**
- `src/lib/lead-visibility.ts` — modulo puro y reutilizable para aplicar restricciones de visibilidad
- `src/lib/actions/team-settings.ts` — server actions: `getTeamSettings()`, `saveLeadVisibilityMode()`, `saveLeadAutoAssignment()`

**Tab 2: Lead Auto-Assignment**

Distribucion porcentual de leads entrantes entre miembros del equipo. Shortcut "Equal for all" distribuye uniformemente. Validacion: debe sumar 100%. Lista de miembros con checkboxes, badges de rol e inputs de porcentaje.

Configuracion almacenada como JSON en `Project.leadAutoAssignment` (JSONB). El webhook de WhatsApp auto-asigna nuevos leads basandose en distribucion diaria balanceada.

**Nuevo archivo:** `src/lib/auto-assign.ts` — algoritmo de asignacion ponderada con balance diario.

**Migraciones DB:**
- `20260407_add_lead_visibility_mode`: `leadVisibilityMode TEXT DEFAULT 'all_leads'` en `Project`
- `20260407_add_lead_auto_assignment`: `leadAutoAssignment JSONB` en `Project`

### User Phone Field

Campo `phone` (nullable) agregado al modelo `User`. `PhoneInput` (selector de bandera por pais) ahora aparece en:
- Admin UserModal (crear/editar usuario)
- Pagina de perfil (edicion self-service)

i18n: "Celular" (es) / "Phone" (en). Migracion: `20260407_add_user_phone`: `phone TEXT` en `User`.

### User Avatar Upload

Sistema de subida de foto de perfil reemplaza el input de URL de texto.

- **Modal de crop interactivo:** `react-easy-crop` con preview circular, drag, zoom slider.
- **Compresion client-side:** 400x400 JPEG al 85% de calidad.
- **Supabase Storage:** `avatars/{userId}/{uuid}.jpg`. Auto-eliminacion del avatar anterior al subir uno nuevo.
- **"Remove photo":** Opcion para volver a las iniciales del usuario.
- **Cron protection:** El prefix `avatars/` es excluido del cron de limpieza de media.

Disponible en Admin UserModal y pagina de Perfil.

### Debounce WhatsApp: 3s → 5s

El debounce del webhook de WhatsApp se incremento de 3 a 5 segundos para reducir respuestas AI duplicadas cuando el lead envia varios mensajes seguidos.

**Archivo:** `src/app/api/webhooks/whatsapp/route.ts`

### Filtro de Usuarios Inactivos

`getProjectTeamMembers()` ahora excluye usuarios con `isActive=false`. Previene que usuarios inactivos aparezcan en dropdowns de asignacion manual y en la configuracion de auto-asignacion.

**Archivo:** `src/lib/actions/team-settings.ts`

### Handoff Personalizado con Nombre del Asesor

El AI menciona al asesor asignado por nombre durante el handoff: *"Te conecto con Karen, quien sera tu asesor comercial asignado..."*. Si no hay asesor asignado, usa el generico "asesor comercial".

**Advisor card por WhatsApp:** Despues del handoff, se envia una tarjeta con foto (si existe) y nombre del asesor: `*Name*\nAsesor Comercial`. Si no hay foto, solo texto.

- La tarjeta se guarda como mensaje en DB con `metadata.isAdvisorCard = true` y se renderiza en el chat panel.
- Nueva funcion `sendTextToWhatsApp()`: envia texto a WhatsApp sin guardar en DB (fire-and-forget).
- `build-system-prompt.ts`: `advisorName` inyectado en las instrucciones de handoff.

**Archivos:** `src/lib/ai/process-ai-response.ts`, `src/lib/ai/build-system-prompt.ts`, `src/lib/whatsapp/send.ts`

### Form Data Display en Lead Detail Panel

Nuevo componente `LeadFormDataDisplay` que muestra todos los campos del formulario conversacional con sus valores o "Pendiente".

- Badge de completitud (ej. `3/7`) con indicador verde (completo) o ambar (incompleto).
- Cross-reference con datos del lead via `leadFieldMapping`: `phone` y `firstName` se auto-llenan desde el registro del lead.
- `isValidPersonName()`: rechaza nombres invalidos (numeros de telefono, simbolos provenientes del perfil de WhatsApp).
- El AI confirma nombres de perfil de WhatsApp con el lead en vez de confiar ciegamente. Nombres no confirmados se marcan en el system prompt para verificacion.

**Archivos:** `src/components/features/LeadFormDataDisplay.tsx`, `src/lib/ai/build-system-prompt.ts`, `src/lib/actions/lead-form-data.ts`

### Resumen IA Form-Aware

Cuando el formulario conversacional esta activo, el resumen generado por IA usa formato estructurado: bullet point por cada campo del formulario + parrafo complementario corto. Sin formulario activo, el formato de resumen no cambia.

**Archivo:** `src/lib/ai/process-ai-response.ts`

### Lead Source: TikTokAds keyword detection

La deteccion de fuente de leads ahora reconoce `TikTokAds` como palabra clave (sin `#`) ademas del hashtag `#tiktokads`. Case-insensitive. Corrige 31 leads historicos de abril que llegaban como "other" a pesar de venir desde TikTok Ads.

**Archivo:** `src/app/api/webhooks/whatsapp/route.ts` (funcion `detectLeadSource`)

### RBAC Documentation

Nuevo archivo `docs/RBAC.md` con documentacion completa de roles y permisos: 3 niveles (sistema/org/proyecto), jerarquia completa, matriz de permisos por accion, calculo de effective role, flujo tecnico con archivos clave.

---

## [0.22.3] - 2026-04-07

### Date Filter Improvements

**dateField selector:** Nuevo selector que permite filtrar por "Fecha de creacion" (default) o "Ultimo contacto". UI con layout apilado: etiqueta "FECHA" + dropdown de campo.

**Preset "Este mes":** Reemplaza el anterior "Ultimos 90 dias". Usa `getStartOfMonthInTimezone()` de `src/lib/timezone.ts` para respetar el timezone de la organizacion. El filtro por defecto cambia de "Ultimos 30 dias" a "Este mes".

**Fix: rango personalizado excluia el ultimo dia.** El `endDate` ahora incluye el dia completo hasta las 23:59:59.999 en lugar de 00:00:00 del dia siguiente.

**Archivos:** `src/types/index.ts` (campo `dateField` en `LeadFilters`), `src/lib/actions/leads.ts` (logica de filtro), `src/components/features/LeadFilters.tsx` (UI selector), `LeadsPageClient.tsx`, `es.json`, `en.json`.

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

Los agentes IA ahora pueden recopilar datos estructurados de leads durante la conversacion de WhatsApp de forma natural.

**Scope:** Por agente (igual que `reEngagementConfig`). Max 8 campos. Trigger modes: `immediate` (desde el primer mensaje) o `on_interest` (solo leads WARM/HOT).

**Schema:** Campo `formConfig` (JSONB) en `AIAgent` + nueva tabla `lead_form_data`. Migracion: `prisma/migrations/20260401_add_conversational_form/`. RLS con `auth.uid()::text` cast (requerido para Supabase).

**Nuevos archivos:**
- `src/lib/types/form-template.ts` — `FormConfig`, `FormField`, `FormFieldType`, `FormTriggerMode`, `LEAD_FIELD_MAPPINGS`, `generateFieldKey`
- `src/lib/actions/form-template.ts` — `getFormConfig()`, `saveFormConfig()`
- `src/lib/actions/lead-form-data.ts` — `getLeadFormData()`, `bulkUpdateLeadFormFields()`

**Pipeline:** `build-system-prompt.ts` inyecta seccion "DATOS A RECOPILAR" con campos pendientes/recopilados. `process-ai-response.ts` extrae marcador `[FORM-DATA: key=value | key2=value2]` de la respuesta GPT, guarda en `lead_form_data`, auto-llena campos del lead, limpia marcador antes de enviar.

**UI:** 4to tab "Formulario" en Settings con toggle, radio buttons de trigger mode (descripcion dinamica), lista DnD de campos, add/edit inline, counter de campos. `loadingForm` state previene race condition con async toggle.

**Fixes post-implementacion:** i18n key mismatch (`enabledHelp` → `enabledDesc`), ~15 keys faltantes, `LEAD_FIELD_MAPPINGS` labelKeys sin prefijo `settings.` (bug de doble-scope), race condition en toggle.

---

## [0.21.0] - 2026-04-01

### Timezone-aware date handling (infraestructura critica)

Toda la app ahora respeta el `defaultTimezone` de la organizacion en vez de usar UTC para filtros, agrupaciones y display. Principio: "Store UTC, Resolve on Read".

**Nuevo archivo:** `src/lib/timezone.ts` — utilidades centralizadas con `Intl.DateTimeFormat`: `getEffectiveTimezone()`, `getStartOfDayInTimezone()`, `getEndOfDayInTimezone()`, `getStartOfMonthInTimezone()`, `getDateStringInTimezone()`, `getYesterdayInTimezone()`.

**Archivos modificados:** `src/lib/actions/dashboard.ts` (chart grouping por timezone), `src/lib/actions/leads.ts` (date range filter + Excel export), `src/lib/actions/workspace.ts` + `src/contexts/WorkspaceContext.tsx` (interface con `defaultTimezone`), `src/lib/ai/process-ai-response.ts` (reemplaza hardcoded `'America/Lima'`), `src/app/api/webhooks/whatsapp/route.ts` (pasa org timezone al pipeline), `src/lib/utils.ts` (`formatDate/Time` acepta `timezone` param, backward-compatible), `src/components/layout/NotificationDropdown.tsx`, `src/components/features/LeadChat.tsx`.

### Sticker support

Mensajes de sticker de WhatsApp ahora siguen el mismo flujo que imagenes: descarga media, Vision pipeline incluye `'sticker'` junto a `'image'`.

**Archivos:** `src/app/api/webhooks/whatsapp/route.ts` (interface + case + freshMediaId), `src/lib/ai/process-ai-response.ts` (Vision check).

### Emoji cleanup

Flags de idioma en Header (`ES`/`EN`) y globo en PhoneInput (`INT`) reemplazados con texto. Fix en pre-commit hook para ignorar archivos binarios por extension (PNG era falso positivo en Windows).

---

## [0.20.1] - 2026-03-31

### Temperature Classification Guard

Guard en el pipeline AI que impide clasificar la temperatura del lead hasta que haya enviado al menos 2 mensajes. Primer contacto siempre queda COLD, evitando falsos WARM en la primera interaccion.

**Archivo:** `src/lib/ai/process-ai-response.ts` — cuenta mensajes con `sender: 'lead'` antes de aplicar `[TEMPERATURA: X]`.

### Drag & Drop en Criterios de Calificacion de Leads

Los criterios de temperatura (HOT/WARM/COLD) en Settings > Instrucciones ahora soportan drag & drop para reordenar, igual que las reglas especificas.

**Componente:** `SortableCriteriaItem` con `@dnd-kit/sortable`. Fix de animacion: solo `translate3d` (sin scale) y sin snap-back al soltar.

### UI Fix: Contraste en tabs del Admin Panel

Tabs "Organizaciones/Proyectos/Usuarios" cambiados de `text-white` a `text-[var(--kairo-midnight)]` sobre fondo cyan para mejor contraste.

---

## [0.20.0] - 2026-03-30

### Incoming Lead Media (NEW FEATURE)

Descarga y renderizado de media entrante de leads en el chat (imagen, video, audio, documento).

**Nuevo archivo:** `src/lib/whatsapp/download-media.ts` — descarga media desde WhatsApp API → Supabase Storage via `waitUntil` (async, non-blocking). Storage path: `incoming/{projectId}/{year}/{month}/{uuid}.{ext}`. Max: 50MB (Supabase free tier).

**Chat UI:** Imagenes (clickable, lightbox), video (player nativo), audio (AudioPlayer custom), documentos (download link). Badge "Disponible hasta {date}" en media activa. "Imagen expirada" / "Audio expirado" en media vencida. Spinner mientras se descarga.

**Expiracion:** Archivos eliminados por cron existente (5 dias). `storageExpiry` en metadata del mensaje.

**CSP:** `media-src` actualizado para dominio Supabase. Bucket MIME types: agregados `audio/*`.

**Realtime:** Actualizaciones de metadata se propagan al chat sin refresh manual.

### GPT-4o-mini Vision (NEW FEATURE)

Analisis de imagenes entrantes via GPT Vision en modo AI. `detail: 'low'` para minimizar costo de tokens.

**Fallback:** Si `downloadedUrl` no esta lista post-debounce, obtiene imagen directamente de WhatsApp API como base64.

**freshMediaId pattern:** Despues del debounce 3s, busca en mensajes pendientes del lead el ultimo `mediaId` de imagen (no el del trigger de debounce, que puede estar desactualizado).

### AudioPlayer + Whisper para todos los modos

**Nuevo componente:** `src/components/ui/AudioPlayer.tsx` — reproductor custom con estilo KAIRO.

**Whisper transcription:** Ahora corre para TODOS los modos (AI + human), no solo AI. Integrado en `download-media.ts` despues del upload. Transcripcion mostrada debajo del reproductor de audio.

### PWA (Progressive Web App)

- `manifest.json` actualizado con iconos maskable (192, 512, apple-touch, badge-72)
- Meta tags iOS: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`
- Viewport con `viewport-fit: cover`
- Banner de instalacion PWA: deteccion Android/iOS, cooldown 10 dias, tema amber
- Usa `createPortal` a `document.body` + inline styles (evita conflictos CSS)

### Custom KAIRO Favicon

`favicon.svg` disenado por Leo + iconos PNG generados: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `badge-72.png`.

### Color system: --accent-text

Nueva variable CSS `--accent-text`: Light=#0E7490 (cyan-700), Dark=#00E5FF. Reemplaza `--accent-primary` y `--kairo-cyan` para TODOS los textos e iconos cyan en ~40 archivos. Nota: Tailwind `dark:` prefix NO funciona (app usa `data-theme`, no `class dark`).

### Terminologia: Archive → Discard

- ES: "Archivar/Desarchivar" → "Descartar/Recuperar"
- EN: "Archive/Unarchive" → "Discard/Recover"
- Leads descartados: webhook guarda mensajes pero omite notificaciones y respuestas AI
- Cron de reengagement ya excluia leads archivados

### Dashboard improvements

- Chart labels visibles por defecto (LabelList en los 4 charts)
- Widget calculadora de costo por lead (input S/, calculo automatico)
- Fix margen de barras en charts (top: 20px para label de barra mas alta)

### Mobile improvements

- Header: titulo oculto en mobile (previene overflow horizontal)
- Admin stats: grid 2 columnas, padding compacto
- Admin create buttons: icon-only en mobile (org/project/user)
- Admin tabs: abreviacion "Orgs." en mobile
- Settings rules: botones de accion siempre visibles en mobile (no solo hover), alineados a derecha

---

> Versiones v0.19.0 y anteriores archivadas en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

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
