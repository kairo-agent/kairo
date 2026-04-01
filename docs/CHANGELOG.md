# KAIRO - Changelog

> Solo se mantienen las ultimas 5 versiones (v0.16.2+). Versiones anteriores en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

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

## [0.19.0] - 2026-03-29

### RBAC Lead Assignment System

Sistema completo de asignacion de leads basado en roles con jerarquia de permisos.

**Permissions module** (`src/lib/permissions.ts`):
- Role hierarchy: `super_admin > owner > admin > manager > agent > viewer`
- `getEffectiveRole()` resuelve maximo privilegio de systemRole + org ownership + project role
- Permission predicates: `canTakeUnassignedLead` (>= agent), `canWorkOwnLead` (>= agent), `canReassignLead` (>= manager), `canWorkOtherLead` (>= admin), `isViewerOnly`

**New hooks:** `useEffectiveRole()` + `useEffectiveRoleSafe()` (para componentes compartidos entre layouts)

**Server actions:** `assignLead()`, `getProjectTeamMembers()`, `getProjectRole()`

**Role guards en actions existentes:** `updateLead`, `updateLeadStatus`, `sendMessage`, `toggleHandoffMode` ahora verifican permisos RBAC. Auto-assign lead on Take Control cuando lead sin asignar.

**UI - LeadAssignment component:**
- Admin/Manager: dropdown selector para asignar cualquier miembro del equipo
- Agent: boton "Tomar Lead" (solo cuando sin asignar)
- Viewer: sin acciones
- Assigned user visible en lead cards (grid) y tabla

**Activity log:** "Lead asignado a: Name [role]"

### Effective role in header

Badge en dropdown del header muestra rol efectivo (Admin, Manager, Asesor, Viewer) en vez de generico "Usuario". Usa `useEffectiveRoleSafe()`.

### Owner toggle in edit user modal

Super_admin puede asignar/remover ownership de organizacion desde el modal de edicion de usuario (no solo al crear). Nueva server action: `updateOrganizationMemberOwnership()`.

### Agent role renamed to Asesor/Advisor

- ES: "Agente" → "Asesor" / EN: "Agent" → "Advisor"
- Todos los labels hardcodeados eliminados, todo via i18n
- Eliminados label/description de PROJECT_ROLE_CONFIG y SYSTEM_ROLE_CONFIG en types

### "Assigned to" filter

Nuevo filtro en "Mas filtros": dropdown con Todos, Mis leads, Sin asignar + multi-select team members con checkboxes. Server-side filtering via `buildLeadWhereClause` con parametro `assignedTo`. Agregado a `LeadFilters` type.

### Excel export restricted

Boton Excel + server action restringidos a super_admin, owner, y admin solamente.

### Project role editing in UserModal

Edicion de rol de proyecto en el modal de edicion de usuario (admin panel).

### Jitsi video call unlocked for all roles

Boton de videollamada ahora disponible para todos los roles (antes solo super_admin).

### Security fix: Cross-session workspace leakage

- Clear localStorage workspace on login (previene org/project stale de usuario anterior)
- Validacion de workspace almacenado contra memberships del usuario en app init
- Auto-select org/project cuando usuario tiene solo uno
- Validacion de projectId en `getAccessibleProjectIds()` para non-super_admin

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

> Versiones v0.16.1 y anteriores archivadas en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

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
