# KAIRO - Changelog

## [0.7.16] - 2026-02-06

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

#### Detalles de Implementacion

**P2-1 - verifyAuth() + verifyProjectAccess():**
- `verifyAuth()`: Retorna solo `{id, systemRole, firstName, lastName}` - ~50-150ms mas rapido que `getCurrentUser()`
- `verifyProjectAccess()`: Indexed lookup en `project_members(projectId, userId)` - O(1) vs cargar todas las memberships
- Ambos envueltos con `cache()` de React para deduplicacion request-scoped

**P1-7 - Atomic Lua Script (Rate Limiting):**
- Script Lua ejecuta INCR + PEXPIRE + PTTL atomicamente en Redis
- Elimina race condition donde requests concurrentes podian pasar entre INCR y PEXPIRE separados
- Fallback a memoria si Redis devuelve resultado inesperado

**P1-2 - OpenAI Client Cache:**
- Cache key = SHA-256 truncado a 16 chars del API key (nunca almacena key en claro)
- TTL 5 minutos, cleanup automatico cuando cache > 20 entries
- Ahorra ~300-500ms por request de embedding (evita reconstruir cliente)

**P1-4 - Parallel DB Operations:**
- `Promise.all` para message create + lead update en path comun (lead con agente)
- Path sin agente: paraleliza message create mientras busca agente default

**P1-6 + P1-8 - Status Updates Simplificados:**
- Status updates corren fire-and-forget (no bloquean webhook response)
- Eliminado retry loop: single lookup, si no encuentra el mensaje lo ignora
- WhatsApp envia status events repetidamente (sent -> delivered -> read), el proximo evento lo captura

#### Archivos Modificados

- `src/lib/actions/auth.ts` - Nuevas funciones `verifyAuth()`, `verifyProjectAccess()`
- `src/lib/actions/leads.ts` - Migrado a `verifyAuth`, consolidado `getLeadPanelData()`
- `src/lib/actions/messages.ts` - Migrado a `verifyAuth`, parallelized queries
- `src/components/features/LeadDetailPanel.tsx` - Usa `getLeadPanelData()`
- `prisma/schema.prisma` - Indice `leads(projectId, whatsappId)`
- `src/lib/rate-limit.ts` - Atomic Lua script para Redis
- `src/lib/openai/embeddings.ts` - Client cache con SHA-256
- `src/app/api/webhooks/whatsapp/route.ts` - Promise.all + fire-and-forget

### Documentacion

- **CLAUDE.md** reducido de 62KB a 6.5KB (90% reduccion) - previene error de serializacion JSON
- **docs/INDEX.md** actualizado como hub de navegacion
- **docs/RULES.md** protocolo context-safe para Playwright MCP
- Limpieza de emojis above-BMP en CHANGELOG.md (causa raiz de error "no low surrogate in string")

### QA - COMPLETADO

| Modo | Resolucion | Estado |
|------|-----------|--------|
| Desktop | 1920x1080 | OK |
| Mobile | 390x844 | OK |
| Tablet | 768x1024 | OK |

- Login page funciona correctamente
- Leads page carga (7 leads, stats correctos)
- Lead detail panel abre con chat, notas, actividad
- Responsive en 3 breakpoints verificado
- Errores de consola: solo 404s de paginas no implementadas (forgot-password, privacy, terms)

---

## [0.7.11] - 2026-02-04

### Features
- **Audio Transcription (OpenAI Whisper)**
  - Nuevo endpoint `/api/audio/transcribe` para transcribir notas de voz de WhatsApp
  - Integración con OpenAI Whisper API ($0.006/minuto de audio)
  - Flujo: WhatsApp → KAIRO → Descargar audio → Whisper → Texto transcrito
  - Soporta formatos: OGG/Opus (notas de voz), MP3, M4A, WAV, WebM
  - Límite: 16MB por archivo (límite de WhatsApp)

### API Changes
- **Webhook WhatsApp** ahora envía `mediaId` a n8n para mensajes de audio/imagen/video
  - Campo `mediaId` en payload de triggerN8nWorkflow
  - Permite a n8n solicitar transcripción de audios

### Security
- Endpoint protegido con `X-N8N-Secret` header (mismo que otros endpoints n8n)
- Rate limit: 30 req/min por proyecto
- Validación estricta de mediaId y projectId
- Fail-closed: rechaza si N8N_CALLBACK_SECRET no está configurado en producción

### Requisitos por Proyecto
- `whatsapp_access_token` - Para descargar audio de WhatsApp
- `openai_api_key` - Para transcripción con Whisper

### Archivos
- **Nuevo:** `src/app/api/audio/transcribe/route.ts`
- **Modificado:** `src/app/api/webhooks/whatsapp/route.ts` (+ mediaId en payload)

### n8n Workflow Implementation (KAIRO - Basic Response)

**Nuevos nodos agregados:**
- `Check Message Type` - Switch node que detecta `messageType === 'audio'`
- `Transcribe Audio` - HTTP Request a `/api/audio/transcribe`
- `Prepare Transcription` - Set node que prepara el texto transcrito

**Flujo de audio:**
```
Webhook → Check Message Type (audio) → Transcribe Audio → Prepare Transcription → RAG Search → Message a model → Send to WhatsApp
```

**Flujo de texto (sin cambios):**
```
Webhook → Check Message Type (Fallback) → Switch → RAG Search → Message a model → Send to WhatsApp
```

**User Prompt condicional:**
```javascript
{{ $('Webhook').item.json.body.messageType === 'audio'
   ? $('Prepare Transcription').first().json.message
   : $('Webhook').item.json.body.message }}
```

**Versiones publicadas:**
| Versión | Descripción |
|---------|-------------|
| `10c17f00` | Conexión Prepare Transcription → RAG Search |
| `bf169f02` | User Prompt usa texto transcrito |
| `664c1037` | Fix expresión condicional para path de texto |

### Verificación
- ✅ Audio: Bot responde basado en contenido transcrito de notas de voz
- ✅ Texto: Bot responde normalmente a mensajes de texto
- ✅ RAG: Funciona en ambos paths (audio y texto)

---

## [0.7.10] - 2026-02-04

### Verificación
- **RAG System 100% Operativo** - Confirmado funcionamiento end-to-end
  - Pruebas realizadas por Leo (3-4 Feb) con preguntas sobre horarios de sueño
  - Bot responde correctamente usando conocimiento cargado en KAIRO
  - Verificación en n8n: Ejecución #89 muestra RAG Search retornando resultados con similarity 0.704

### Métricas de RAG
- Tiempo total de búsqueda RAG: ~4.3s (embedding: 2s, search: 1.5s)
- Threshold configurado: 0.5 (queries coloquiales funcionan bien)
- Últimas 4 ejecuciones: 100% exitosas

### Documentación
- `docs/RAG-DEBUG-SESSION-2026-02-03.md` actualizado con verificación completa
- Agregada sección de métricas de rendimiento y conclusión final

---

## [0.7.9] - 2026-02-02

### Features
- **Memoria de Conversación IA (8 mensajes)**
  - El webhook ahora envía los últimos 8 mensajes como `conversationHistory` a n8n
  - Formato compatible con OpenAI: `[{ role: 'user'|'assistant', content: string }]`
  - El bot mantiene contexto de la conversación para respuestas coherentes
  - n8n System Prompt incluye el historial formateado como "HISTORIAL DE CONVERSACIÓN"

- **Fecha y Hora Actual para el Bot**
  - Webhook envía `currentDate` y `currentTime` con timezone America/Lima
  - Formato fecha: "domingo, 2 de febrero de 2026"
  - Formato hora: "14:30"
  - Resuelve el problema de que OpenAI no conoce la fecha actual (knowledge cutoff)

- **Lead Summary (Fase 2.5) - Contexto histórico para conversaciones largas**
  - Webhook envía `leadSummary` a n8n para mantener consistencia en chats largos
  - Webhook envía `messageCount` y `summaryThreshold` (5) para que n8n decida cuándo generar resumen
  - `/api/ai/respond` acepta `suggestedSummary` (max 500 chars)
  - Defense in depth: KAIRO valida que hay 5+ mensajes antes de guardar el summary
  - Schema Prisma: nuevos campos `summary` (Text) y `summaryUpdatedAt` (DateTime) en Lead

- **Lead Temperature Scoring - Calificación automática de leads por IA**
  - Los agentes IA ahora califican automáticamente cada lead como HOT, WARM o COLD
  - Criterios de calificación **configurables por cliente** en KAIRO (no hardcodeados)
  - Campo `systemInstructions` del agente define los criterios de calificación específicos del negocio
  - El modelo de IA incluye marcador `[TEMPERATURA: HOT|WARM|COLD]` en su respuesta
  - n8n extrae la temperatura con regex y la envía a KAIRO via `/api/ai/respond`
  - KAIRO actualiza automáticamente el campo `temperature` del lead

- **Nuevo campo `suggestedTemperature` en `/api/ai/respond`**
  - Endpoint ahora acepta `suggestedTemperature: 'hot' | 'warm' | 'cold'` (opcional)
  - Validación estricta del valor (solo acepta los 3 valores válidos)
  - Actualización atómica: guarda mensaje + actualiza lead en una transacción

### n8n Workflow Updates
- **System Prompt simplificado** (nodo "Message a model")
  - Eliminados criterios de calificación hardcodeados
  - Ahora solo referencia `systemInstructions` de KAIRO
  - Estructura: `{agentName} + {systemInstructions} + {RAG knowledge} + {leadName}`

- **Nodo "Prepare AI Response" actualizado**
  - Nuevo campo `suggestedTemperature` con expresión de extracción:
    ```javascript
    {{ $('Message a model').item.json.output[0].content[0].text
        .match(/\[TEMPERATURA:\s*(HOT|WARM|COLD)\]/i)?.[1]?.toLowerCase() || null }}
    ```
  - Campo `message` ahora limpia el marcador de temperatura antes de enviar:
    ```javascript
    {{ $('Message a model').item.json.output[0].content[0].text
        .replace(/\[TEMPERATURA:\s*(HOT|WARM|COLD)\]/gi, '').trim() }}
    ```

### Arquitectura - Flujo de Calificación de Leads
```
┌─────────────────────────────────────────────────────────────┐
│           LEAD TEMPERATURE SCORING FLOW                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Admin en KAIRO                                          │
│     └── Configura systemInstructions del agente con:        │
│         - Personalidad del agente                           │
│         - Criterios de calificación (HOT/WARM/COLD)         │
│         - Formato de salida: [TEMPERATURA: X]               │
│                                                              │
│  2. WhatsApp → KAIRO Webhook                                │
│     └── Envía a n8n: message, systemInstructions, etc.      │
│                                                              │
│  3. n8n → OpenAI                                            │
│     └── System Prompt usa systemInstructions del admin      │
│     └── OpenAI responde con calificación al final           │
│                                                              │
│  4. n8n → Prepare AI Response                               │
│     └── Extrae suggestedTemperature con regex               │
│     └── Limpia marcador del mensaje visible                 │
│                                                              │
│  5. n8n → KAIRO /api/ai/respond                             │
│     └── Guarda mensaje en BD                                │
│     └── Actualiza lead.temperature                          │
│     └── Envía respuesta limpia a WhatsApp                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Configuración Requerida en KAIRO
Para que la calificación funcione, el admin debe incluir en `systemInstructions` del agente:

```
CRITERIOS DE CALIFICACIÓN DEL LEAD:
[Definir qué significa HOT, WARM, COLD para tu negocio]

FORMATO DE RESPUESTA:
Al FINAL de cada respuesta, en una línea separada, indica:
[TEMPERATURA: HOT] o [TEMPERATURA: WARM] o [TEMPERATURA: COLD]
```

### Documentación
- **DATABASE-MIGRATIONS.md** - Nueva guía crítica de migraciones de BD
  - Tablas Prisma vs no-Prisma (pgvector)
  - Comandos permitidos vs prohibidos (`prisma db push` NUNCA)
  - Procedimientos de recuperación de desastres
  - Checklist pre-migración
- **scripts/setup-rag-complete.sql** - Advertencias críticas agregadas al header
- **CLAUDE.md** - Regla crítica de protección de BD documentada

### Archivos Modificados
- `src/app/api/webhooks/whatsapp/route.ts` - Historial + fecha/hora + leadSummary + messageCount
- `src/app/api/ai/respond/route.ts` - Soporte para `suggestedTemperature` y `suggestedSummary`
- `prisma/schema.prisma` - Campos `summary` y `summaryUpdatedAt` en modelo Lead
- n8n workflow "KAIRO - Basic Response":
  - System Prompt con `conversationHistory`, `currentDate`, `currentTime`, `leadSummary`
  - Nodo "Prepare AI Response" extrae `suggestedTemperature`
  - Nodo "Send to WhatsApp" envía `suggestedTemperature` a KAIRO

### Validación
- ✅ System Prompt usa `systemInstructions` de KAIRO (no hardcodeado)
- ✅ Extracción de temperatura funciona con regex
- ✅ Mensaje enviado al usuario NO contiene marcador de temperatura
- ✅ Lead se actualiza automáticamente en BD
- ✅ Summary solo se guarda después de 5+ mensajes (defense in depth)

---

## [0.7.8] - 2026-01-31

### Security (LOW Risk)
- **Redis para Rate Limiting Persistente**
  - Instalado `@upstash/redis` para rate limiting en producción
  - Fallback automático a memoria en desarrollo
  - Variables de entorno: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

- **Headers OWASP Adicionales** (13 headers totales implementados):
  - `X-Permitted-Cross-Domain-Policies: none` - Previene Flash/PDF cross-domain
  - `X-Download-Options: noopen` - Previene ejecución de descargas en contexto del sitio (IE)
  - `Cross-Origin-Opener-Policy: same-origin` - Aísla contexto de navegación (Spectre)
  - `Cross-Origin-Resource-Policy: same-origin` - Protege recursos cross-origin

### Archivos Modificados
- `next.config.ts` - 4 headers OWASP adicionales
- `package.json` - Dependencia @upstash/redis agregada

### Commits
- `d42320a` - security: Add @upstash/redis and OWASP headers

### Referencias
- Ver [docs/SECURITY.md](docs/SECURITY.md) para documentación completa de seguridad

---

## [0.7.7] - 2026-01-31

### Security
- **HTTP Security Headers** - Configuración completa en `next.config.ts`:
  - Content-Security-Policy (CSP) configurado para proteger contra XSS
  - X-Frame-Options: DENY (previene clickjacking)
  - X-Content-Type-Options: nosniff (previene MIME sniffing)
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: camera, microphone, geolocation deshabilitados
  - Strict-Transport-Security (HSTS): 2 años + includeSubDomains + preload

- **Rate Limiting implementado en APIs críticas**:
  - `/api/webhooks/whatsapp`: 300 req/min por IP (alto para bursts de Meta)
  - `/api/whatsapp/send`: 100 req/min por proyecto
  - `/api/ai/respond`: 60 req/min por proyecto
  - `/api/rag/search`: 120 req/min por agente

### Archivos Modificados
- `next.config.ts` - Security headers agregados
- `src/app/api/webhooks/whatsapp/route.ts` - Rate limiting añadido
- `src/app/api/whatsapp/send/route.ts` - Rate limiting añadido
- `src/app/api/ai/respond/route.ts` - Rate limiting añadido
- `src/app/api/rag/search/route.ts` - Rate limiting añadido

### Commits
- `84c5f01` - security: Add HTTP security headers and rate limiting

---

## [0.7.6] - 2026-01-31

### Security
- **Next.js actualizado a 16.1.6** - Corrige CVEs críticos:
  - GHSA-h25m-26qc-wcjf (DoS denial-of-service)
  - GHSA-9g9p-9gw9-jx7f (Image Optimizer bypass)
  - GHSA-5f7q-jpqc-wp7h (PPR memory leak)
- **Fail-closed en validación de secrets** - APIs ahora rechazan requests si N8N_CALLBACK_SECRET no está configurado en producción
- **timingSafeEqual en comparación de secrets** - Previene timing attacks en:
  - `/api/ai/respond` (n8n → KAIRO)
  - `/api/rag/search` (n8n → KAIRO)
  - `/api/messages/confirm` (n8n → KAIRO legacy)
- **Auditoría de seguridad completada** - Verificación de OWASP Top 10, encriptación AES-256-GCM confirmada, HMAC-SHA256 en webhooks

### Validación
- ✅ Bot WhatsApp funciona correctamente post-security-fixes
- ✅ Read receipt sigue funcionando (✓✓ azul)
- ✅ Build exitoso sin errores TypeScript

---

## [0.7.5] - 2026-01-30 ✅ COMPLETADO

### Features
- **Nuevo endpoint `/api/ai/respond` - Guardar y enviar en un solo paso**
  - n8n ahora guarda la respuesta IA en BD Y envía a WhatsApp en una sola llamada
  - Resuelve el problema de historial de conversaciones no guardado en modo IA
  - Flujo atómico: Save → Send → Update con WhatsApp ID
  - Autenticación: Header `X-N8N-Secret` (shared secret)
  - Health check GET con documentación completa del endpoint

- **Historial de conversaciones IA funcionando correctamente**
  - Mensajes del bot ahora se guardan con `sender: 'ai'` (antes se perdían)
  - Metadata incluye `agentId`, `agentName`, `source: 'n8n_ai'`
  - WhatsApp message ID guardado para tracking de delivery status

### Arquitectura
- **Flujo de respuesta IA optimizado:**
  ```
  ANTES (problema - historial no se guardaba):
  n8n → /api/whatsapp/send → WhatsApp (sin guardar en BD)

  AHORA (solución):
  n8n → /api/ai/respond → BD (guarda) + WhatsApp (envía)
  ```

- **Decisión de diseño: Realtime deshabilitado en modo IA**
  - En modo `human`: Supabase Realtime sincroniza mensajes en tiempo real
  - En modo `ai`: Usuario debe hacer refresh manual para ver respuestas
  - Razón: Optimización de recursos, el bot responde instantáneamente al cliente
  - Línea de código: `LeadChat.tsx:305`

### Endpoints Actualizados

| Endpoint | Propósito | Guarda en BD | Envía a WhatsApp |
|----------|-----------|--------------|------------------|
| `/api/ai/respond` | Respuestas IA de n8n | ✅ Sí | ✅ Sí |
| `/api/whatsapp/send` | Proxy directo | ❌ No | ✅ Sí |
| `/api/messages/confirm` | Callback legacy | ✅ Actualiza | ❌ No |

### Request/Response del nuevo endpoint

**POST `/api/ai/respond`**
```json
// Request
{
  "conversationId": "conv_123",
  "leadId": "lead_456",
  "projectId": "proj_789",
  "message": "¡Hola! Soy Luna, ¿en qué puedo ayudarte?",
  "agentId": "agent_luna",
  "agentName": "Luna"
}

// Response
{
  "success": true,
  "messageId": "msg_xyz",
  "whatsappMsgId": "wamid_abc",
  "whatsappSent": true,
  "duration": 450
}
```

### Archivos Nuevos
- `src/app/api/ai/respond/route.ts` - Endpoint completo con health check

### Fixes
- **Read Receipt automático - Lead ve ✓✓ azul**
  - Cuando el webhook recibe un mensaje, KAIRO ahora envía automáticamente el read receipt a WhatsApp API
  - El lead ve doble check azul (✓✓) en sus mensajes, indicando que el bot "leyó" su mensaje
  - Implementado en `handleIncomingMessage()` como fire-and-forget (no bloquea el response)
  - Función: `sendReadReceipt(projectId, messageId)` en webhook WhatsApp

### Validación
- ✅ Mensaje enviado por WhatsApp y respuesta recibida
- ✅ Historial de conversación guardado en BD
- ✅ Bot se identifica con nombre del agente configurado
- ✅ Metadata completa en mensajes (agentId, agentName, source)
- ✅ Read receipt funciona - Lead ve ✓✓ azul inmediatamente

---

## [0.7.4] - 2026-01-30 ✅ COMPLETADO

### Features
- **RAG Fase 4 COMPLETADA - Flujo end-to-end funcional**
  - Bot responde usando nombre del agente configurado en KAIRO (no hardcodeado)
  - RAG proporciona contexto de personalidad/conocimiento a las respuestas
  - Verificado con Playwright MCP en WhatsApp Web
  - Ejemplo: Pregunta "¿Cómo te llamas?" → Respuesta "¡Hola! Soy Leo..."

- **Endpoint `/api/rag/search` para n8n**
  - Búsqueda semántica en base de conocimiento de agentes IA
  - Autenticación: Header `X-N8N-Secret` (shared secret)
  - Request body: `{ agentId, projectId, query, limit?, threshold? }`
  - Response: `{ success, results[], metadata }` con timings detallados
  - Validación de agente/proyecto activos antes de procesar
  - Límites de seguridad: query max 8000 chars, results max 20
  - Health check endpoint (GET) con documentación completa

- **Auto-asignación de agentes a leads existentes**
  - Leads sin agente asignado reciben el primer agente activo del proyecto
  - Implementado en webhook WhatsApp para leads legacy

### n8n Workflow (Railway)
- **System Prompt dinámico configurado:**
  - Usa `{{ $('Webhook').item.json.body.agentName }}` para el nombre del agente
  - Usa `{{ $('Webhook').item.json.body.companyName }}` para contexto de empresa
  - RAG context inyectado condicionalmente con resultados de búsqueda
- **Expresión correcta para respuesta OpenAI:**
  - `{{ $('Message a model').item.json.output[0].content[0].text }}`
  - (NO `.json.text` que retorna undefined)

### Arquitectura
- **Decisión: Opción B - n8n vía KAIRO en lugar de Supabase directo**
  - **Razones de seguridad:**
    - n8n solo tiene shared secret, no credenciales de Supabase
    - Aislamiento multi-tenant preservado con validación centralizada
    - Menor superficie de ataque (un solo endpoint con logging)
  - **Opción A descartada:** n8n conectando directamente a Supabase RPC

### Corregido
- **Error `(#100) The parameter text['body'] is required.`**
  - Causa: Expresión incorrecta para obtener respuesta de OpenAI
  - Fix: Cambio de `.json.text` a `.json.output[0].content[0].text`

- **Bot respondía como "asistente" en lugar del nombre configurado**
  - Causa: System Prompt no usaba `body.agentName` del webhook
  - Fix: Actualización del System Prompt para usar variables dinámicas

- **`agentId: null` en payload de n8n**
  - Causa: Leads legacy no tenían agente asignado
  - Fix: Auto-asignación en webhook para leads sin agente

### Documentación
- **docs/RAG-AGENTS.md actualizado**
  - Estado: Fases 1-4 COMPLETADAS ✅
  - Nueva sección "Configuración Final n8n (Producción)"
  - System Prompt documentado con expresiones correctas
  - Flujo de datos en n8n diagramado
  - Historial de cambios actualizado

### Archivos Nuevos
- `src/app/api/rag/search/route.ts` - Endpoint de búsqueda RAG

### Archivos Modificados
- `src/app/api/webhooks/whatsapp/route.ts` - Auto-asignación de agentes
- `docs/RAG-AGENTS.md` - Documentación completa de Fase 4
- `docs/CHANGELOG.md` - Esta entrada

### Validación
- ✅ WhatsApp Web: Mensaje enviado y respuesta recibida
- ✅ Bot se identifica como "Leo" (nombre del agente en KAIRO)
- ✅ RAG context aplicado en respuestas
- ✅ Flujo completo: WhatsApp → KAIRO → n8n → OpenAI → WhatsApp

---

## [0.7.3] - 2026-01-29

### Features
- **Webhook WhatsApp envía datos del agente a n8n**
  - Payload ahora incluye: `agentId`, `agentName`, `companyName`
  - Auto-asignación de agente a leads nuevos (primer agente activo del proyecto)
  - Preparación para RAG Fase 4 - n8n tiene toda la info para buscar conocimiento

- **Restricción: Solo 1 agente activo por proyecto**
  - Comportamiento radio button: al activar un agente, los demás se desactivan
  - Simplifica la lógica de asignación de leads y RAG
  - Implementado en `toggleAgentStatus()` en `agents.ts`

### UX/UI
- **Gestión de agentes mejorada en ProjectSettingsModal**
  - Selector de iconos (10 emojis) reemplaza selector de tipo de agente
  - Iconos disponibles: [bot] [briefcase] [headset] [chart] [calendar] [chat] [target] [star] [rocket] [user]
  - Icono por defecto: [bot] (robot)
  - Toggle de estado: verde cuando activo, rojo cuando inactivo
  - Spinner de carga durante cambio de estado

### Corregido
- **Error TypeScript en ProjectSettingsModal**
  - `agent.avatarUrl` podía ser `null` pero no se verificaba correctamente
  - Solución: Doble verificación `isEmoji && agent.avatarUrl`

### Traducciones
- Nuevas keys en `agentSettings`:
  - `activate`, `deactivate` - Labels para toggle
  - `icon`, `iconDescription` - Selector de iconos

### Archivos Modificados
- `src/app/api/webhooks/whatsapp/route.ts` - Payload con agentId para n8n
- `src/lib/actions/agents.ts` - Restricción de 1 agente activo
- `src/components/admin/ProjectSettingsModal.tsx` - UI de iconos y toggle
- `src/messages/es.json` - Traducciones agentSettings
- `src/messages/en.json` - Traducciones agentSettings

---

## [0.7.2] - 2026-01-29

### Corregido
- **Función SQL `search_agent_knowledge` corregida**
  - **Problema**: Parámetro `p_query_embedding` estaba definido como `vector` causando error de tipo
  - **Solución**: Cambiado a `TEXT` para consistencia con `insert_agent_knowledge`
  - El parámetro ahora recibe string con formato `'[0.1,0.2,...]'` y castea internamente a `vector(1536)`
  - Mantiene compatibilidad con `formatEmbeddingForPg()` usado en `knowledge.ts`
  - Script actualizado: `scripts/create-search-knowledge-function.sql`

### Mejorado
- **Limpieza de datos de prueba**
  - Eliminados leads fake de la base de datos
  - Quedan solo 3 leads de prueba representativos:
    - 1 lead de temperatura HOT (potencial alto)
    - 1 lead de temperatura WARM (potencial medio)
    - 1 lead de temperatura COLD (potencial bajo)
  - Lead principal de prueba: "Leo D Leon" (real user)

### Estado del Proyecto
- **RAG Fases 1-3**: ✅ Completamente funcionales
  - Fase 1: pgvector + tablas + funciones RPC + RLS
  - Fase 2: Server Actions + embeddings OpenAI + chunking
  - Fase 3: UI en ProjectSettingsModal + traducciones i18n
- **RAG Fase 4**: ⏳ Pendiente - Workflow n8n para usar conocimiento en respuestas

### Archivos Clave
- `scripts/create-search-knowledge-function.sql` - Función corregida con parámetro TEXT
- `docs/RAG-AGENTS.md` - Documentación actualizada con firma correcta
- Base de datos - Solo leads de prueba representativos

---

## [0.7.1] - 2026-01-29

### Features
- **Migración de n8n a Railway (producción)**
  - Deploy de n8n + PostgreSQL en Railway usando template oficial
  - URL de producción: `n8n-production-5d42.up.railway.app`
  - Variables de entorno configuradas (POSTGRES_PASSWORD, POSTGRES_USER, POSTGRES_DB)
  - Importación exitosa del workflow "KAIRO - Basic Response" desde n8n local

- **Integración KAIRO ↔ n8n Railway**
  - Actualización de N8N_CALLBACK_SECRET en Vercel para sincronizar con Railway
  - Configuración de n8nWebhookUrl via KAIRO Admin UI (ProjectSettingsModal)
  - Header X-N8N-Secret configurado en workflow de n8n
  - Flujo end-to-end validado: WhatsApp → KAIRO webhook → n8n → respuesta a WhatsApp

### Corregido
- **Bug crítico: Supabase Realtime no enviaba broadcasts**
  - **Problema**: RLS habilitado en tabla `messages` pero sin políticas SELECT
  - **Causa raíz**: Supabase Realtime respeta RLS - sin política SELECT, no hay broadcasts
  - **Solución**: Políticas RLS completas (SELECT/INSERT/UPDATE) con función helper
  - **Impacto**: Mensajes de chat ahora actualizan en tiempo real correctamente
  - Script SQL ejecutado: `scripts/rls-messages-realtime.sql`

- **Botón refresh sin feedback visual en LeadChat**
  - Agregado spinner y estado `isRefetching` del hook useInfiniteQuery
  - Botón se deshabilita mientras refresca con animación spin
  - Mejora UX al hacer clic en "Cargar mensajes anteriores"

### UX/UI
- **Tooltips modernos CSS (reemplazo de tooltips nativos del navegador)**
  - Nuevo componente `TooltipButton` con animación fade-in
  - Diseño elegante con sombra, borde y flecha indicadora
  - Soporte automático para dark/light theme via CSS variables
  - Aplicado a botones de imagen, video y documento en ChatInput

- **Color de burbuja de mensajes enviados optimizado**
  - Cambiado de `var(--accent-primary)` a `#BFF7FF` (cyan muy claro)
  - Doble check azul de WhatsApp ahora claramente visible
  - Contraste mejorado en ambos temas (light/dark)

- **Indicadores de tamaño máximo para archivos**
  - Tooltips mejorados en ChatInput: "Adjuntar imagen (máx. 3MB)", "Adjuntar video (máx. 16MB)"
  - Preview del archivo muestra tamaño actual vs máximo permitido: "1.2 MB / 3 MB máx"
  - Traducciones agregadas en es.json y en.json (namespace `leads.chat`)

### Archivos Nuevos
- `scripts/rls-messages-realtime.sql` - Políticas RLS para soporte Realtime

### Archivos Modificados
- `src/components/features/LeadChat.tsx` - Spinner en botón refresh
- `src/components/features/ChatInput.tsx` - Tooltips y preview con límites
- `src/messages/es.json` - Keys: `maxSize`, `attachImage`, `attachVideo`, `attachDocument`
- `src/messages/en.json` - Keys: `maxSize`, `attachImage`, `attachVideo`, `attachDocument`

### Técnico
- **Función SQL**: `public.user_has_conversation_access(conv_id TEXT)`
  - Verifica si usuario es super_admin O miembro del proyecto
  - Usado en políticas RLS de SELECT, INSERT, UPDATE
  - Security definer para acceso consistente

### Validación
- Pruebas end-to-end con WhatsApp Business + n8n Railway
- Conversaciones actualizan en tiempo real en UI de KAIRO
- Mensajes de respuesta automática funcionales
- Refresh de mensajes con feedback visual

---

## [0.7.0] - 2026-01-29

### Features
- **RAG (Retrieval Augmented Generation) para Agentes IA - Fases 1-3 completadas**
  - **Fase 1 - Infraestructura BD:**
    - Extensión pgvector habilitada en Supabase
    - Tabla `agent_knowledge` con vector de 1536 dimensiones
    - Funciones RPC: `insert_agent_knowledge`, `search_agent_knowledge`
    - Índices ivfflat para búsqueda semántica
    - RLS policies para aislamiento multi-tenant
  - **Fase 2 - Backend:**
    - Server Actions completas: `addAgentKnowledge`, `deleteAgentKnowledge`, `listAgentKnowledge`, `searchAgentKnowledge`, `getAgentKnowledgeStats`
    - Integración OpenAI `text-embedding-3-small` para embeddings
    - Chunking inteligente (~1000 chars con 200 overlap)
    - Validación de permisos por proyecto
  - **Fase 3 - UI Admin:**
    - Nueva tab "Conocimiento" en ProjectSettingsModal
    - Selector de agente para filtrar conocimiento
    - Formulario para agregar conocimiento (título + contenido)
    - Lista de documentos con preview y eliminación
    - Traducciones i18n completas (es/en)
  - **Fase 4 pendiente:** Workflow n8n para usar RAG en respuestas

### Archivos Nuevos
- `src/lib/openai/embeddings.ts` - Helper para generar embeddings con OpenAI
- `src/lib/utils/chunking.ts` - Utilidad para dividir textos largos
- `src/lib/actions/knowledge.ts` - Server Actions para gestión de conocimiento
- `scripts/create-insert-knowledge-function.sql` - Función SQL para insertar conocimiento + RLS
- `docs/RAG-AGENTS.md` - Documentación completa del sistema RAG

### Archivos Modificados
- `src/components/admin/ProjectSettingsModal.tsx` - Nueva tab Conocimiento
- `src/messages/es.json` - Traducciones `knowledgeSettings`
- `src/messages/en.json` - Traducciones `knowledgeSettings`

### Dependencies
- `openai` package added for embeddings generation

---

## [0.6.2] - 2026-01-24

### Performance
- **Fase 4: Composite Indexes y Partial Selects** (commit `e07259d`)
  - Índices compuestos en Prisma schema:
    - `Lead: @@index([projectId, status])` - Filtros de grilla
    - `Lead: @@index([projectId, temperature])` - Filtros por potencial
    - `Message: @@index([conversationId, createdAt])` - Paginación de mensajes
  - Tipos optimizados para reducir payload:
    - `LeadGridItem` - Solo campos necesarios para grilla (~30% menos payload)
    - `MessageForChat` - Excluye metadata innecesaria
  - Patrones de select reutilizables:
    - `messageSelectForChat` - Para UI del chat
    - `leadSelectForAccessCheck` - Mínimo para verificación de acceso
    - `leadSelectForSendMessage` - Para envío a n8n
    - `leadSelectForHandoffToggle` - Para cambio de modo
  - Seguridad: `projectId` SIEMPRE incluido en queries con verificación de acceso

### Archivos Clave
- `prisma/schema.prisma` - Índices compuestos agregados
- `src/lib/actions/leads.ts` - LeadGridItem type + select optimizado
- `src/lib/actions/messages.ts` - MessageForChat type + patrones de select
- `src/components/features/LeadChat.tsx` - Usa MessageForChat

### Seguridad
- Revisión completa por Security Auditor subagent
- Regla crítica: nunca omitir `projectId` en queries que verifican acceso
- Multi-tenant isolation mantenido con índices y selects optimizados

---

## [0.6.1] - 2026-01-24

### Performance
- **Fase 3: Consolidación de Server Actions** (commit `e882fbb`)
  - Unificación de `getCurrentUser()` en `auth-helpers.ts` (re-export desde `auth.ts`)
  - Corrección de property `userId` → `id` en `secrets.ts` y `media.ts`
  - Implementación de **fire-and-forget** para `markMessagesAsRead()` en `LeadChat.tsx`
  - Patrón: `.catch()` para logging de errores sin bloquear el render
  - Reducción de latencia percibida al abrir/recibir mensajes en chat

### UX/UI
- **Login/Logout Loading Overlay** (commits `f7da1b3`, `c2cf1b6`)
  - Reemplazado modal "Entendido" post-login por `showLoading()` con redirect inmediato
  - Agregado loading overlay al hacer click en "Cerrar sesión"
  - Hotfix: Agregado `LoadingProvider` + `LoadingOverlay` al auth layout

- **Scroll Block en LeadDetailPanel** (commit `ed00501`)
  - Bloqueo de scroll en `html` y `body` cuando el panel está abierto
  - Evita doble scroll (window + panel) en todas las plataformas

- **Animación Wave Enhanced** (commit `f907e80`)
  - Nueva animación `wave-bounce` en `globals.css` con 50% más pronunciamiento
  - `translateY(-40%)` vs el default `-25%` de Tailwind bounce
  - Aplicada al `SendingDotsIcon` en botón de envío del chat

### Archivos Clave
- `src/app/[locale]/(auth)/layout.tsx` - LoadingProvider agregado
- `src/app/[locale]/(auth)/login/page.tsx` - showLoading en lugar de showSuccess
- `src/components/layout/Header.tsx` - showLoading on logout
- `src/components/features/LeadDetailPanel.tsx` - scroll blocking cross-browser
- `src/components/features/LeadChat.tsx` - fire-and-forget markMessagesAsRead
- `src/lib/auth-helpers.ts` - re-export de getCurrentUser desde auth.ts
- `src/lib/actions/secrets.ts` - user.id en lugar de user.userId
- `src/lib/actions/media.ts` - user.id en lugar de user.userId
- `src/components/features/ChatInput.tsx` - animate-wave-bounce
- `src/app/globals.css` - keyframe wave-bounce

### Seguridad
- Revisión por Security Auditor subagent antes de Fase 3
- Validación de uso correcto de propiedades de usuario
- Mantenimiento de verificación de permisos en todas las funciones

---

## [0.6.0] - 2026-01-24

### Performance
- **Fase 1: Request-Scoped Caching** (commit `779a7b6`)
  - Funciones de autenticación envueltas con `cache()` de React
    - `getCurrentUser()` en `src/lib/actions/auth.ts`
    - `getCurrentUser()` y `verifySuperAdmin()` en `src/lib/auth-helpers.ts`
  - Reducción de ~60-70% en queries duplicadas de autenticación por request
  - Cache automático request-scoped (no persiste entre requests)

- **Fase 1: In-Memory Cache para Webhooks WhatsApp** (commit `779a7b6`)
  - Cache en memoria para mapeo `phoneNumberId → projectId`
  - TTL de 5 minutos con auto-expiración
  - Funciones: `getCachedProject()`, `setCachedProject()`, `invalidatePhoneNumberCache()`
  - Reducción de ~95% en queries de lookup después del primer mensaje
  - Archivo: `src/app/api/webhooks/whatsapp/route.ts`

- **Fase 2: Paginación Backend con Cursor** (commit `247dc7f`)
  - Implementación de cursor-based pagination en `getLeadConversation()`
  - Nuevo tipo exportado: `PaginatedConversation` con metadatos de paginación
  - Parámetros: `cursor` (ID del mensaje), `limit` (max 100, default 50)
  - Reducción de ~80% en payload inicial para conversaciones con historial largo
  - Validación de permisos mantenida en cada request paginado
  - Archivo: `src/lib/actions/messages.ts`

- **Fase 2: React Query con useInfiniteQuery** (commit `247dc7f`)
  - Integración de TanStack Query en `LeadChat.tsx`
  - `useInfiniteQuery` para paginación infinita de mensajes
  - Cache en memoria RAM (no localStorage) con TTL de 30s y gcTime de 5min
  - Integración con Supabase Realtime para mensajes nuevos
  - Botón "Cargar mensajes anteriores" con scroll inteligente
  - Sincronización de estado de mensajes (doble check azul) via cache update
  - Archivo: `src/components/features/LeadChat.tsx`

- **QueryProvider Configuration** (commit `247dc7f`)
  - Configuración global de React Query optimizada para Next.js
  - `staleTime: 30s`, `gcTime: 5min`, `retry: 1`
  - `refetchOnWindowFocus: false` para evitar requests innecesarios
  - Singleton pattern para QueryClient en browser
  - Archivo: `src/providers/QueryProvider.tsx`

### Documentación
- **PERFORMANCE.md creado**
  - Documentación completa de optimizaciones Fase 1 y Fase 2
  - Métricas de impacto: reducción de queries, payloads, tiempos de carga
  - Diagramas de flujo para cache y paginación
  - Sección de seguridad: qué NO va en localStorage
  - Roadmap de Fase 3, 4 y 5
  - Referencias a documentación oficial de React, TanStack Query, Prisma

- **CHANGELOG.md actualizado**
  - Entradas detalladas de Fase 1 y Fase 2
  - Commits de performance identificados

### Notas Técnicas
- Cache de React Query vive **solo en memoria RAM** (no persiste al cerrar tab)
- Cache de webhook vive **solo en memoria del servidor** (no persiste al reiniciar)
- `React.cache()` es **request-scoped** (se limpia entre requests)
- Validación de permisos **nunca se omite**, solo se optimiza con cache

---

## [0.5.3] - 2026-01-23

### Seguridad
- **API /api/whatsapp/send** - Autenticación reforzada
  - Verificación de sesión Supabase Auth
  - Verificación de membresía en proyecto
  - Variable `BYPASS_AUTH_DEV` para desarrollo local

- **API /api/messages/confirm** - Shared secret para callbacks n8n
  - Validación de header `X-N8N-Secret`
  - Variable `N8N_CALLBACK_SECRET` requerida
  - Previene callbacks no autorizados

- **Webhook /api/webhooks/whatsapp** - Verificación HMAC-SHA256
  - Función `verifyWebhookSignature()` con crypto nativo
  - Valida header `X-Hub-Signature-256` de Meta
  - Variable `WHATSAPP_APP_SECRET` (App Secret de Meta, no Access Token)
  - Variable `WEBHOOK_BYPASS_SIGNATURE` para desarrollo con ngrok

### Mejorado
- **Exports centralizados** - Index.ts completados
  - `src/components/layout/index.ts` - WorkspaceSelector agregado
  - `src/components/admin/index.ts` - ProjectSettingsModal agregado
  - `src/components/features/index.ts` - Archivo creado con todos los exports

### Documentación
- **CLAUDE.md actualizado**
  - Nueva sección "Seguridad de APIs" con tabla resumen
  - Documentación de variables de entorno de seguridad
  - Guía de configuración para producción vs desarrollo

### Testing
- **Flujo WhatsApp verificado end-to-end**
  - Webhook recibe mensajes via ngrok
  - Mensajes aparecen en tiempo real en chat
  - Modo Human funcional con envío de respuestas

---

## [0.5.2] - 2026-01-22

### Agregado
- **WhatsApp Read Receipts (Marcar como leído)**
  - Integración con WhatsApp Cloud API para enviar read receipts
  - Endpoint API `/api/whatsapp/mark-read` con seguridad completa:
    - Autenticación via Supabase Auth
    - Verificación de membresía en proyecto
    - Validación de ownership chain (project → lead → messages)
    - Rate limiting (100 req/min por proyecto)
    - Validación Zod con regex para WhatsApp message IDs
  - Server Action `markMessagesAsRead()` en `messages.ts`:
    - Marca mensajes como leídos en BD local
    - Envía read receipts a WhatsApp API (solo en modo Human)
    - Procesa en batches de 10 para no saturar la API
  - Integración automática en `LeadChat.tsx`:
    - Al abrir el chat marca mensajes como leídos
    - Al recibir mensaje via Realtime lo marca como leído

- **Rate Limiting Utility** (`src/lib/rate-limit.ts`)
  - Soporte dual: memoria (desarrollo) y Redis (producción)
  - Upstash Redis para entornos serverless
  - Pre-configurados: `standard`, `strict`, `lenient`, `whatsapp`
  - Limpieza automática de entradas expiradas en memoria

- **WhatsApp Status Indicators en Chat**
  - Iconos estilo WhatsApp para estado de mensajes:
    - ⏱️ Reloj (pendiente/enviando)
    - ✓ Check gris (enviado a WhatsApp)
    - ✓✓ Doble check gris (entregado)
    - ✓✓ Doble check azul (leído)
  - Actualización en tiempo real via Supabase Realtime (UPDATE events)

- **Supabase Realtime para Updates de Estado**
  - Hook `useRealtimeMessages` extendido con `onMessageUpdate` callback
  - Escucha eventos UPDATE en tabla `messages`
  - Tipo `MessageStatusUpdate` para payloads de actualización
  - Sincronización automática de `isDelivered`, `isRead`, `whatsappMsgId`

### Cambiado
- **Label de mensajes humanos en chat**
  - Ahora muestra el nombre del usuario que tomó el control (`handoffStatus.handoffUser`)
  - Fallback: 1) sentByUser (BD), 2) handoffUser (Realtime), 3) "Vendedor"
  - Fix: mensajes via Realtime ahora muestran nombre correcto del agente

### Corregido
- **ZodError handling** en endpoint mark-read
  - Corregido `error.errors` → `error.issues` (API correcta de Zod)
- **Dynamic import de @upstash/redis**
  - Casting a string para evitar error de tipos en import dinámico

### Archivos clave
- `src/app/api/whatsapp/mark-read/route.ts` - Endpoint completo (nuevo)
- `src/lib/rate-limit.ts` - Utilidad de rate limiting (nuevo)
- `src/lib/actions/messages.ts` - `markMessagesAsRead()` actualizado
- `src/hooks/useRealtimeMessages.ts` - Soporte para UPDATE events
- `src/components/features/LeadChat.tsx` - Status indicators + nombre usuario

### Decisiones de Diseño
- **Read receipts solo en modo Human**: En modo AI, n8n maneja la lectura
- **Sin polling automático**: Los receipts se envían cuando el usuario abre el chat
- **Comportamiento intencional**: Si el vendedor cierra KAIRO en modo Human, los mensajes NO se marcan como leídos hasta que vuelva a abrir el chat

### Validación
- Probado con Playwright MCP: envío de mensajes, recepción, checks azules visibles
- WhatsApp Web confirmó doble check azul en mensajes del lead

---

## [0.5.1] - 2026-01-22

### Agregado
- **Integración directa con WhatsApp Cloud API**
  - Endpoint webhook `/api/webhooks/whatsapp` para recibir mensajes
  - Verificación GET para suscripción de Meta
  - Procesamiento POST de mensajes entrantes
  - Tipos de mensaje soportados: texto, imagen, audio, video, documento
  - Identificación de proyecto por `phone_number_id` encriptado
  - Fallback a primer proyecto activo para desarrollo

- **Creación automática de leads desde WhatsApp**
  - Lead creado automáticamente al primer mensaje de un número nuevo
  - Conversación creada con el lead vinculado
  - Mensajes almacenados con metadata completa (timestamp, tipo, contenido)
  - Actualización de status de mensajes (sent, delivered, read, failed)

- **Botón de refresh manual en grilla de leads**
  - Ícono de refresh al lado del botón "Nuevo Lead"
  - Tooltip "Actualizar ingreso de leads" / "Refresh incoming leads"
  - Animación de spin mientras carga
  - Evita polling automático (ahorro de requests en free tier)

- **Documentación de webhook WhatsApp**
  - Sección completa en `docs/N8N-SETUP.md`
  - Guía de setup con ngrok para desarrollo local
  - Configuración en Meta Developer Portal
  - Flujo de mensaje entrante documentado

### Decisiones de Diseño
- **No implementar eliminación de leads** (decisión de negocio)
  - Razón: Valor comercial de datos históricos
  - Remarketing, análisis de conversión, auditoría, ML futuro
  - Alternativa recomendada: Usar status `archived` (ya existe en enum)
  - Leads archivados se ocultan de vista activa pero se conservan
  - TODO futuro: Implementar UI para archivar leads (no eliminar)

- **Arquitectura híbrida con n8n** (decisión técnica)
  - KAIRO maneja: webhooks, almacenamiento, UI, envío WhatsApp
  - n8n maneja: lógica de agentes IA, orquestación, prompts editables
  - Ventajas: prompts sin deploy, multi-canal (WA/FB/IG), observabilidad
  - Soporte canales: WhatsApp (API), Facebook Messenger (nodo nativo), Instagram (Graph API)
  - Costo estimado: ~$20/mes n8n Cloud
  - TODO: `/api/whatsapp/send`, trigger a n8n, workflow de agentes

### Traducciones
- Nueva key `leads.refreshLeads` en es.json y en.json

### Archivos clave
- `src/app/api/webhooks/whatsapp/route.ts` - Webhook completo
- `src/app/[locale]/(dashboard)/leads/LeadsPageClient.tsx` - Botón refresh
- `docs/N8N-SETUP.md` - Documentación de setup

---

## [0.5.0] - 2026-01-20

### Agregado
- **Gestión completa de Agentes IA en ProjectSettingsModal**
  - CRUD completo: Crear, Leer, Actualizar, Eliminar agentes
  - Visualización en tarjetas con iconos por tipo:
    - [briefcase] Ventas (sales) - azul
    - [headset] Soporte (support) - verde
    - [chart] Calificación (qualification) - púrpura
    - [calendar] Citas (appointment) - naranja
  - Badge de estado (Activo/Inactivo) con toggle
  - Contador de leads asignados por agente
  - Formulario de creación/edición con validación
  - Confirmación de eliminación con mensaje de dependencias
  - Bloqueo de eliminación si tiene leads asignados

- **Server Actions para AIAgent** (`src/lib/actions/agents.ts`)
  - `getProjectAgents(projectId)`: Listar agentes del proyecto
  - `getAgent(agentId)`: Obtener agente por ID
  - `createAgent(input)`: Crear nuevo agente
  - `updateAgent(agentId, input)`: Actualizar agente
  - `deleteAgent(agentId)`: Eliminar agente (con validación de leads)
  - `toggleAgentStatus(agentId)`: Activar/desactivar agente
  - Verificación de permisos (admin/manager del proyecto)
  - Validación de nombre único por proyecto

- **Sistema de Secrets encriptados para proyectos**
  - Modelo `ProjectSecret` con encriptación AES-256-GCM
  - Modelo `SecretAccessLog` para auditoría de accesos
  - Server Actions en `src/lib/actions/secrets.ts`:
    - `setProjectSecret()`: Guardar secret encriptado
    - `getProjectSecret()`: Obtener secret desencriptado (interno)
    - `getProjectSecretForUser()`: Obtener con verificación de permisos
    - `deleteProjectSecret()`: Eliminar secret
    - `getProjectSecretsStatus()`: Estado de configuración
    - `setProjectSecrets()`: Guardar múltiples secrets
  - Módulo de encriptación `src/lib/crypto/secrets.ts`
  - Variable de entorno `SECRETS_ENCRYPTION_KEY` para clave AES

- **Tab WhatsApp en ProjectSettingsModal**
  - Configuración de credenciales de WhatsApp Business API
  - Campos: Access Token, Phone Number ID, Business Account ID
  - Toggle para mostrar/ocultar tokens
  - Indicadores de estado (configurado/no configurado)
  - Guardado encriptado de credenciales

- **Tab Webhooks en ProjectSettingsModal**
  - Configuración de URL de webhook n8n
  - Guardado en campo `project.n8nWebhookUrl`

- **Traducciones para gestión de agentes**
  - Namespace `admin.agentSettings` en es.json y en.json
  - Incluye: tipos de agente, descripciones, mensajes de éxito/error
  - Soporte para mensaje de bloqueo con conteo de leads

### Cambiado
- **ProjectSettingsModal refactorizado**
  - De tabs placeholder a tabs funcionales
  - Estado separado para cada tab (agentes, whatsapp, webhooks)
  - Carga de datos al abrir modal
  - Mensajes de éxito/error por operación

- **Botón "Configurar" en tabla de proyectos**
  - Nuevo icono BotIcon (monitor con robot)
  - Abre ProjectSettingsModal con tabs funcionales

### Corregido
- **Error de build en secrets.ts**
  - `getCurrentUser()` retorna `userId`, no `id`
  - Corregido en todas las funciones del archivo

### Archivos clave
- `src/lib/actions/agents.ts` - Server Actions CRUD agentes (NUEVO)
- `src/lib/actions/secrets.ts` - Server Actions secrets (NUEVO)
- `src/lib/crypto/secrets.ts` - Módulo de encriptación (NUEVO)
- `src/components/admin/ProjectSettingsModal.tsx` - Modal refactorizado
- `src/messages/es.json` - Traducciones agentSettings
- `src/messages/en.json` - Traducciones agentSettings
- `prisma/schema.prisma` - Modelos ProjectSecret, SecretAccessLog

### Validación
- Playwright E2E: Login, abrir modal, crear agente "Stella", eliminar agente
- Build exitoso sin errores de TypeScript

---

## [0.4.7] - 2026-01-13

### Eliminado
- **Botón de adjuntar enlace en ChatInput**
  - Removido el ícono y modal para agregar enlaces URL
  - Los enlaces ahora se pegan directamente en el textarea (comportamiento estándar como WhatsApp/Telegram)
  - Simplifica la interfaz reduciendo un botón innecesario

### Cambiado
- **Tipo ChatAttachment simplificado**
  - Eliminado tipo `'link'` del union type
  - Propiedad `file` ahora es requerida (no opcional)
  - Propiedad `url` eliminada (ya no es necesaria)

---

## [0.4.6] - 2026-01-13

### Agregado
- **Chat enriquecido para modo Human Handoff**
  - Selector de emojis con librería `emoji-mart` (carga dinámica)
  - Adjuntos de archivos: imágenes, videos, documentos
  - Solo un adjunto a la vez (UX similar a WhatsApp Web)
  - Preview de adjuntos con miniatura para imágenes
  - Botón para eliminar adjunto antes de enviar

- **Componente ChatInput.tsx** (nuevo)
  - Textarea expansible (3-8 líneas) con auto-resize
  - Barra de adjuntos con iconos para cada tipo
  - Patrón `forwardRef` + `useImperativeHandle` para inserción de emojis desde padre
  - Interfaz `ChatInputRef` con método `insertEmoji(emoji: string)`

- **Integración de emoji-mart en LeadChat.tsx**
  - Import dinámico con `next/dynamic` (SSR: false)
  - Carga bajo demanda del data de emojis (@emoji-mart/data)
  - Picker con tema automático y locale español
  - Click outside para cerrar el picker

- **Traducciones del chat** (es.json y en.json)
  - `leads.chat.placeholder`: Placeholder del textarea
  - `leads.chat.attachImage/Video/File`: Tooltips de botones
  - `leads.chat.emoji`: Tooltip del botón de emojis
  - `leads.chat.removeAttachment`: Quitar adjunto

### Cambiado
- **Ruta /profile agregada a routing.ts**
  - Corrige error TypeScript en Header.tsx al navegar a perfil

### Corregido
- **Error de dependencia npm ERESOLVE**
  - emoji-mart requiere React 16-18, proyecto usa React 19
  - Solución: Instalación con `--legacy-peer-deps`

- **Error "Can't resolve 'emoji-mart'"**
  - @emoji-mart/react depende de emoji-mart como peer dependency
  - Solución: Instalar `emoji-mart` explícitamente

- **Error TypeScript en LeadDetailPanel.tsx**
  - Tipo `undefined` no asignable a `string | null`
  - Solución: Nullish coalescing (`?? null`) en campos opcionales

- **Error TypeScript en LeadEditModal.tsx**
  - Prop `style` no existe en componente Badge
  - Solución: Eliminar la prop

- **Error TypeScript con emojiData**
  - Tipo `unknown` no asignable a props de EmojiPicker
  - Solución: Usar tipo `any` con eslint-disable comment

### Dependencias
- `emoji-mart`: ^5.6.0 (peer dependency requerida)
- `@emoji-mart/react`: ^1.1.1 (componente React)
- `@emoji-mart/data`: ^1.2.1 (datos de emojis)

### Archivos clave
- `src/components/features/ChatInput.tsx` - Nuevo componente
- `src/components/features/LeadChat.tsx` - Integración de ChatInput y emoji picker
- `src/messages/es.json` - Traducciones chat (líneas en namespace leads.chat)
- `src/messages/en.json` - Traducciones chat (líneas en namespace leads.chat)
- `src/i18n/routing.ts` - Ruta /profile agregada

### Notas técnicas
- Adjuntos de archivos son placeholder visual por ahora
- TODO: Implementar upload real a Supabase Storage cuando backend esté listo
- El emoji picker usa Shadow DOM internamente (custom elements)

---

## [0.4.5] - 2026-01-12

### Agregado
- **Paginación Server-Side con Filtros Integrados** (COMPLETADO)
  - Hook `useLeadsQuery` con TanStack Query para caching y refetch
  - Server Action `getLeadsPaginated()` con filtros server-side
  - Server Action `getLeadsStatsFromDB()` con filtros aplicados
  - Componente `Pagination.tsx` integrado en la UI
  - Helper `buildLeadWhereClause()` para construir queries Prisma
  - Tipos: `PaginationParams`, `PaginationInfo`, `PaginatedResponse<T>`
  - Constantes: `DEFAULT_PAGE_SIZE = 25`, `PAGE_SIZE_OPTIONS = [10, 25, 50, 100]`

- **Formato de fecha inteligente (Threshold-based)**
  - Función `formatRelativeTime()` con lógica de threshold:
    - Mismo día: "hoy" (o "hace X min" si < 1 hora)
    - Ayer: "ayer"
    - ≤7 días: "hace X d"
    - >7 días: fecha absoluta ("7 ene. 2026")

### Archivos clave
- `src/hooks/useLeadsQuery.ts` - Hook con TanStack Query
- `src/lib/actions/leads.ts` - Server actions con paginación
- `src/components/ui/Pagination.tsx` - Componente de paginación
- `src/types/index.ts` - Tipos de paginación (líneas 337-359)
- `src/lib/utils.ts` - formatRelativeTime actualizado
- `src/app/[locale]/(dashboard)/leads/LeadsPageClient.tsx` - Integración completa

### Notas técnicas
- Los filtros se ejecutan en el servidor (no client-side)
- Stats reflejan los filtros activos
- Reset automático a página 1 cuando cambian filtros
- Debounce de 300ms en búsqueda

---

## [0.4.4] - 2026-01-12

### Cambiado
- **Simplificación de canales para MVP**
  - Solo WhatsApp activo como canal de entrada
  - Filtro de canal oculto en la UI (4 columnas en lugar de 5)
  - 89 leads existentes migrados a canal WhatsApp
  - Enum `LeadChannel` y traducciones preservadas para compatibilidad futura
  - Comentarios TODO agregados para habilitar otros canales post-MVP

### Archivos modificados
- `src/types/index.ts` - Comentarios en enum y config
- `src/data/leads.ts` - Todos los leads mock ahora usan WhatsApp
- `src/components/features/LeadFilters.tsx` - Filtro de canal comentado
- `src/app/[locale]/(dashboard)/leads/LeadsPageClient.tsx` - Canal excluido del conteo de filtros

---

## [0.4.3] - 2026-01-12

### Agregado
- **Bloqueo estricto de eliminación (integridad referencial)**
  - Organizaciones no se pueden eliminar si tienen proyectos o miembros
  - Proyectos no se pueden eliminar si tienen miembros o leads
  - Mensajes de error descriptivos con conteo de dependencias
  - Orden de eliminación requerido: Usuarios → Proyectos → Organización

### Cambiado
- **UX mejorada en DeleteConfirmModal**
  - Cuando hay error de dependencias: botones "Cancelar" + "Eliminar" se reemplazan por solo "Entendido"
  - Evita que el usuario intente eliminar repetidamente cuando está bloqueado
  - Botón "Entendido" cierra el modal (variant ghost, no rojo)

### Traducciones
- Nuevas keys en `admin.messages`:
  - `cannotDeleteOrgHasProjects`, `cannotDeleteOrgHasMembers`
  - `cannotDeleteProjectHasMembers`, `cannotDeleteProjectHasLeads`
- Nueva key `common.buttons.understood` ("Entendido" / "Got it")

### Documentación
- **Regla 13 actualizada (RULES.md)**
  - Agregada sección "⚠️ ANÁLISIS PREVIO OBLIGATORIO"
  - Adan debe analizar qué sub-agentes usar ANTES de cada tarea
  - Priorizar paralelización cuando sea posible
  - Solo asumir tareas personalmente si no hay agente adecuado

---

## [0.4.2] - 2026-01-12

### Agregado
- **Formulario de contraseña mejorado en Perfil**
  - Validación en tiempo real con indicadores visuales (✓/✗)
  - Barra de fortaleza de contraseña (Débil/Aceptable/Buena/Fuerte)
  - Colores por nivel: rojo → naranja → amarillo → verde
  - Requisitos de contraseña mostrados en panel:
    - Mínimo 8 caracteres
    - Al menos una mayúscula
    - Al menos una minúscula
    - Al menos un número
    - Al menos un carácter especial (!@#$%^&*)
  - Botón "Generar contraseña segura" que crea password de 12 caracteres
  - Botones mostrar/ocultar en los 3 campos de contraseña
  - Botón copiar contraseña generada
  - Validación de coincidencia con feedback visual
  - Botón submit deshabilitado hasta cumplir todos los requisitos

### Cambiado
- **Validación de contraseña**
  - De 6 caracteres mínimo a 8 caracteres + requisitos de seguridad
  - Mensaje de error actualizado: "La contraseña no cumple todos los requisitos"

### Traducciones
- Nuevas keys en `profile.changePassword`:
  - `generate`, `showPassword`, `hidePassword`, `copied`
  - `requirements.*` (title, minLength, uppercase, lowercase, number, special)
  - `strength.*` (label, weak, fair, good, strong)
- Nueva key `profile.messages.passwordMatch`

---

## [0.4.1] - 2026-01-12

### Agregado
- **Página de Perfil de Usuario** (`/[locale]/profile`)
  - Tab Perfil: Editar nombre, apellido, avatar URL
  - Tab Contraseña: Cambiar contraseña con validación
  - Tab Membresías: Ver organizaciones y proyectos con roles
  - Selectores de Timezone y Locale (usar default de org o personalizado)
  - Server Actions: `getProfile()`, `updateProfile()`, `changePassword()`

- **Navegación a perfil desde Header**
  - Botón "Mi perfil" en dropdown de usuario ahora navega a `/profile`

### Cambiado
- **Tabla de Usuarios en Panel Admin**
  - Columna "Memberships" separada en dos: "Organización" y "Proyectos"
  - Organizaciones muestran: `NombreOrg (Owner)` o `NombreOrg`
  - Proyectos muestran: `NombreProyecto (rol)` separados por comas
  - Si no tiene membresías muestra guión "—"

- **Modal de creación de usuarios**
  - Membresía ahora es **obligatoria** para usuarios normales (no super_admin)
  - Título dinámico: "Membresía inicial (requerida)" vs "(opcional)"
  - Opciones "Sin organización" y "Sin proyecto" solo visibles para super_admin
  - Validación en frontend antes de enviar al servidor

### Corregido
- **Bug: Proyectos no cargaban en modal de usuario**
  - Causa: `projectsList` solo se cargaba con filtro de organización activo
  - Solución: Cargar todos los proyectos siempre en `getAdminOverviewData()`
  - El modal filtra internamente por `organizationId` seleccionado

### Traducciones
- Nuevo namespace `profile` en es.json y en.json
- Nueva key `users.organization` (singular) para header de tabla

---

## [0.4.0] - 2026-01-11

### Agregado
- **Panel de Administración completo** (`/[locale]/admin`)
  - Nuevo route group `(admin)` separado del dashboard
  - Vista unificada de Organizaciones, Proyectos y Usuarios
  - Tabs para cambiar entre vistas (Organizations, Projects, Users)
  - Filtros por organización y proyecto
  - Búsqueda con debounce de 300ms
  - Estadísticas en tiempo real (cards de resumen)

- **Sistema CRUD completo para entidades administrativas**
  - `OrganizationModal.tsx`: Crear/Editar organizaciones
    - Campos: nombre, slug (auto-generado), descripción, logo URL
    - Configuración de Timezone (12 zonas IANA para Latam/USA)
    - Configuración de Locale (8 opciones: es-PE, es-MX, en-US, etc.)
    - Toggle de estado activo (solo en edición)
  - `ProjectModal.tsx`: Crear/Editar proyectos
    - Selector de organización padre
    - Campos: nombre, slug, descripción, logo URL
    - Plan (Free, Starter, Professional, Enterprise) - solo edición
    - Toggle de estado activo (solo en edición)
  - `UserModal.tsx`: Crear/Editar usuarios
    - Campos básicos: nombre, apellido, email
    - Rol de sistema (User, Super Admin)
    - Generación automática de contraseña con opción de copiar
    - Membresía inicial opcional (organización + proyecto + rol)
    - Toggle de estado activo (solo en edición)
  - `DeleteConfirmModal.tsx`: Confirmación de eliminación
    - Diseño con icono de advertencia
    - Muestra nombre del item a eliminar
    - Botón rojo de confirmación

- **Server Actions para administración** (`src/lib/actions/admin.ts`)
  - `createOrganization()` / `updateOrganization()` / `deleteOrganization()`
  - `createProject()` / `updateProject()` / `deleteProject()`
  - `createUser()` / `updateUser()` / `deleteUser()`
  - `getAdminOverviewData()`: Datos con filtros y paginación
  - `joinOrganization()` / `joinProject()`: Unirse a entidades
  - Verificación de Super Admin en todas las acciones

- **Funcionalidad "Join" para membresías**
  - Botón "Unirme" en organizaciones y proyectos donde el usuario no es miembro
  - Indicador "Miembro" cuando ya pertenece
  - Creación automática de membresía con rol por defecto

- **Traducciones del módulo admin**
  - Namespace `admin` en es.json y en.json
  - Secciones: nav, modals, overview, organizations, projects, users
  - Roles de sistema y proyecto traducidos
  - Planes traducidos

- **Componentes UI nuevos**
  - `LoadingOverlay.tsx`: Overlay de carga global
  - `Pagination.tsx`: Componente de paginación (preparado para leads)

- **Arquitectura multi-tenant implementada**
  - Jerarquía: Organization → Project → User
  - Membresías: OrganizationMember (con isOwner) y ProjectMember (con role)
  - Roles de proyecto: ADMIN, MANAGER, AGENT, VIEWER
  - Roles de sistema: USER, SUPER_ADMIN

### Cambiado
- **Prisma Schema actualizado** para soportar multi-tenancy
  - Modelo Organization con `defaultTimezone` y `defaultLocale`
  - Modelo Project con `plan` enum
  - Modelo OrganizationMember y ProjectMember
  - Modelo User con `systemRole` enum
  - Índices optimizados para queries frecuentes

- **Sidebar actualizado**
  - Nuevo item "Admin" visible solo para Super Admins
  - Icono de escudo para identificar sección administrativa

### Técnico
- Migración Prisma: `20260111185601_multi_tenant_hierarchy`
- Seeds: `prisma/seed.ts` y `prisma/seed-fake-data.ts`
- Contextos: `WorkspaceContext.tsx`, `LoadingContext.tsx`
- RBAC helper: `src/lib/rbac.ts`

---

## [0.3.4] - 2026-01-11

### Cambiado
- **Vista tabla: Labels de potencial simplificados**
  - Español: "Alto", "Medio", "Bajo" (antes "Caliente", "Tibio", "Frío")
  - Inglés: "High", "Medium", "Low"
  - Nuevas traducciones `potentialShort` en archivos i18n
  - Vista grid mantiene labels descriptivos completos

### Corregido
- **Bug: Hover no funcionaba en dark mode (vista tabla)**
  - Síntoma: Filas de leads fríos/tibios no mostraban hover en dark mode
  - Causa: CSS specificity con Tailwind v4 combinaba reglas
  - Solución: Usar `var(--bg-hover)` que resuelve diferente por tema
  - Archivo: `globals.css` - sección "Lead Table Row Styles"

### Técnico
- Refactor de CSS para lead rows siguiendo estándar de variables semánticas
- Eliminada clase Tailwind `hover:bg-[var(--bg-tertiary)]` conflictiva en `leads/page.tsx`

---

## [0.3.3] - 2026-01-06

### Cambiado
- **Terminología: "Temperatura" → "Potencial Comercial"**
  - Renombrado el campo de clasificación de leads para mayor claridad
  - Nuevas etiquetas con contexto educativo para usuarios nuevos:
    - [fire] Potencial Alto (lead caliente)
    - ⚡ Potencial Medio (lead tibio)
    - ❄️ Potencial Bajo (lead frío)
  - Los valores internos del enum (`HOT`, `WARM`, `COLD`) permanecen sin cambios
  - Traducciones actualizadas en español e inglés

- **Archivos de traducción**
  - `es.json`: `temperature` → `potential`, nuevas etiquetas descriptivas
  - `en.json`: `temperature` → `potential`, nuevas etiquetas en inglés

- **Componentes actualizados**
  - `LeadCard.tsx`: Claves de traducción actualizadas
  - `LeadFilters.tsx`: Título de sección y badges actualizados
  - `LeadDetailPanel.tsx`: Badge de potencial actualizado
  - `LeadTable.tsx`: Header de columna actualizado
  - `leads/page.tsx`: Header de tabla actualizado

---

## [0.3.2] - 2026-01-06

### Corregido
- **Bug crítico de navegación en Sidebar**
  - Síntoma: Clic en "Dashboard" llevaba a página en blanco con compilación infinita
  - Causa raíz: Uso incorrecto de `Link` de `next/link` en lugar de `@/i18n/routing`
  - El Link estándar de Next.js no añade el prefijo de locale (`/es/`, `/en/`)
  - El middleware de next-intl detectaba ruta sin locale y entraba en loop de redirección
  - Solución: Cambiar imports a `Link` y `usePathname` de `@/i18n/routing`

### Cambiado
- **Sidebar.tsx**
  - Import `Link` ahora viene de `@/i18n/routing` (no de `next/link`)
  - Import `usePathname` ahora viene de `@/i18n/routing` (no de `next/navigation`)
  - Nuevo tipo `AppPathname` para type-safety en rutas de navegación
  - Interface `NavItem.href` cambiado de `string` a `AppPathname`

- **Filtro de fecha por defecto**
  - Cambiado de "últimos 30 días" a "últimos 7 días" en página de Leads

- **Data mock de leads**
  - Fechas de `lastContactAt` ahora son relativas a la fecha actual
  - Helper function `getRelativeDate()` para cálculo dinámico
  - Distribución de leads en todas las opciones de filtro de fecha:
    - Hoy: 6 leads
    - Ayer: 4 leads
    - Últimos 7 días: 7 leads
    - Últimos 30 días: 9 leads
    - Más de 30 días: 4 leads

---

## [0.3.1] - 2026-01-06

### Agregado
- **Filtros colapsables en la página de Leads**
  - Diseño compacto: estado colapsado muestra solo barra de búsqueda
  - Estado expandido muestra todos los filtros por categoría (chips)
  - Badge flotante ("más filtros" / "menos filtros") centrado en el borde inferior del Card
  - Contador de filtros activos en el badge (color cyan)

- **Badges de filtros activos**
  - Chips removibles que muestran filtros aplicados cuando está colapsado
  - Colores semánticos por tipo de filtro:
    - Status: cyan
    - Temperature: gradiente según temperatura (blue/yellow/red)
    - Channel: purple
    - Type: orange
    - DateRange: green
  - Botón X para eliminar filtros individuales

- **Nuevos componentes en LeadFilters.tsx**
  - `ActiveFilterBadge`: Badge con color y botón de cierre
  - `FloatingFilterToggle`: Badge flotante para expandir/colapsar

- **Traducciones agregadas**
  - `leads.filters.moreFilters`: "Más filtros" / "More filters"
  - `leads.filters.lessFilters`: "Menos filtros" / "Less filters"

### Cambiado
- **LeadFilters.tsx**
  - Nuevas props: `isExpanded`, `onToggleExpanded`
  - Lógica condicional para mostrar/ocultar secciones de filtros
  - Transiciones CSS suaves para expand/collapse

- **leads/page.tsx**
  - Nuevo estado `isFiltersExpanded`
  - Cálculo de `activeFiltersCount` con useMemo
  - Card wrapper con `relative` para posicionar badge flotante

### Corregido
- Error TypeScript en comparación de dateRange (tipos sin overlap)
- Error TypeScript en Badge variant "outline" -> "default" en LeadDetailPanel

---

## [0.3.0] - 2025-01-05

### Agregado
- **Internacionalización completa (i18n) con next-intl**
  - Soporte para español (es) e inglés (en)
  - Routing basado en locale: `/es/leads`, `/en/leads`
  - Middleware de detección automática de idioma
  - Archivos de traducción: `src/messages/es.json`, `src/messages/en.json`

- **Documentación de i18n**
  - Nuevo archivo `docs/I18N.md` con guía completa
  - Patrones de código para traducciones
  - Checklist para nuevos componentes
  - Consideraciones de moneda y fechas

- **Namespaces de traducciones**
  - `common`: Botones, labels, mensajes genéricos
  - `navigation`: Items del sidebar
  - `login`: Página de autenticación
  - `leads`: Módulo completo de leads (status, temperature, channel, actions)
  - `dashboard`: Página principal

### Cambiado
- **Estructura de rutas**
  - De `/leads` a `/[locale]/leads`
  - De `/login` a `/[locale]/login`
  - Redirect automático de `/` al locale detectado

- **Componentes actualizados para i18n**
  - `Sidebar.tsx`: NavItems usan `labelKey` en lugar de `label`
  - `LeadCard.tsx`: Badges, labels y acciones traducidos
  - `LeadFilters.tsx`: Filtros y placeholders traducidos
  - `LeadTable.tsx`: Headers de columna traducidos

- **NavItem interface**
  - Cambio de `label: string` a `labelKey: string`
  - Cambio de `badge?: string` a `hasBadge?: boolean`

### Notas técnicas
- `formatCurrency()` sigue usando PEN/es-PE (pendiente para backend)
- `formatDate()` sigue usando es-PE (pendiente para locale-aware)
- Validado con Playwright MCP en ambos idiomas y mobile

---

## [0.2.0] - 2025-01-02

### Agregado
- **Login Page con animaciones de pulsos**
  - Efecto visual de "leads esperando" con pulsos animados
  - Pulsos con posiciones aleatorias que se regeneran al terminar la animación
  - Animaciones suaves sin flash inicial (opacity y scale desde 0)
  - Keyframes personalizados: `leadPulse` y `leadPulseGlow`

- **Sistema de temas mejorado**
  - Modo Light: fondo cyan sutil (20%), gradiente blanco central (85%), pulsos Kairo Midnight
  - Modo Dark: fondo midnight, gradiente cyan (10%), pulsos cyan
  - Toggle de tema funcional en login y dashboard

- **Logo real de KAIRO en Sidebar**
  - Reemplazo del logo texto "K KAIRO" por imágenes oficiales
  - `logo-main.png` para modo dark (logo blanco)
  - `logo-oscuro.png` para modo light (logo oscuro)
  - Cambio dinámico según el tema activo

### Cambiado
- **Login page background**
  - Light mode: de blanco puro a cyan tenue con centro blanco
  - Dark mode: gradiente cyan central más visible (de 5% a 10%)

- **Componente Image de Next.js**
  - Uso de prop `fill` con contenedor en lugar de width/height
  - Agregado `sizes` para evitar warnings de Next.js

### Corregido
- Flash visual antes de animación de pulsos (inicio desde scale(0) y opacity(0))
- Warning de Next.js "width or height modified by styles"
- Warning de Next.js "missing sizes prop"
- Import duplicado de useTheme en Sidebar.tsx

---

## [0.1.1] - 2025-01-01

### Agregado
- **Componentes UI base**
  - Button.tsx con variantes (primary, secondary, ghost, danger)
  - Input.tsx con soporte para iconos y estados
  - Modal.tsx + AlertModal para sistema de modales
  - Card.tsx para contenedores
  - Badge.tsx para etiquetas de estado

- **Layout del Dashboard**
  - Sidebar.tsx responsive con navegación
  - Header.tsx con toggle de tema y notificaciones
  - Sistema de rutas con route groups (auth) y (dashboard)

- **Vista de Leads**
  - LeadCard.tsx para vista de cuadrícula
  - LeadTable.tsx para vista de tabla
  - LeadFilters.tsx con filtros por estado, temperatura, canal, agente
  - Toggle vista grid/tabla persistido

- **Data Mock**
  - 25 leads peruanos realistas
  - 4 agentes IA (Luna, Atlas, Nova, Orion)
  - 3 usuarios de prueba
  - 1 empresa (TechCorp SAC)

- **Contextos React**
  - ThemeContext.tsx para manejo de temas light/dark
  - ModalContext.tsx para sistema de modales global

### Estructura
- Configuración de Tailwind CSS 4 con variables CSS
- Sistema de colores Kairo (midnight, cyan, etc.)
- Tipografía Inter desde Google Fonts

---

## [0.1.0] - 2024-12-31

### Agregado
- Inicialización del proyecto Next.js 15 con TypeScript
- Configuración de Tailwind CSS
- Sistema de documentación con índices MD
  - CLAUDE.md (índice raíz)
  - INDEX.md (índice de documentación)
  - ARCHITECTURE.md (decisiones técnicas)
  - COMPONENTS.md (catálogo UI)
  - DATA-MODELS.md (modelos de datos)
  - RULES.md (reglas del proyecto)
  - CHANGELOG.md (este archivo)

### Estructura base
- Definición de estructura de carpetas
- Modelos de datos para MVP (Lead, User, Company, AIAgent, etc.)
- Reglas de desarrollo establecidas

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
