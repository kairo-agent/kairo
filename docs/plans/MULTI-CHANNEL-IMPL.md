# Plan Multi-Canal: Implementacion Tecnica por Fase

> **Doc complementario de:** [MULTI-CHANNEL-WEBCHAT.md](MULTI-CHANNEL-WEBCHAT.md) (decisiones y arquitectura)
> **Ultima revision:** 2026-05-06

---

## Fase 0: Pre-requisitos

- **Vercel Hobby:** permite multiples projects con custom domains. Verificar antes de fase 3.
- **Layout repo:** repo unico (`kairo-dashboard`) con carpeta `widget/` paralela a `src/`. Su propio `package.json` y bundler (vite). Vercel project #2 apunta a root directory `widget/`. NO Turborepo formal en v1; tipos compartidos via re-export en `widget/src/shared/`.

---

## Fase 1: Refactor de Abstraccion de Canal (zero-downtime)

> **Objetivo:** preparar el pipeline para multi-canal sin afectar produccion.
> **Sin features visibles para el usuario.** Tiempo estimado: 1-2 semanas.

### 1.1 Schema: agregar `Lead.externalId` (additive only)

**Metodo:** `prisma migrate dev` (NUNCA db push - regla critica KAIRO).

```prisma
model Lead {
  // ... campos existentes ...
  whatsappId      String?  // DEPRECATED: mantener durante migracion
  externalId      String?  // NUEVO: identificador agnostico al canal
  // ...
  @@index([whatsappId])  // se elimina en v0.26+
  @@index([projectId, channel, externalId])  // NUEVO indice compuesto
}
```

**Riesgo:** ninguno (solo agrega columna nullable).

### 1.2 Schema: nueva tabla `project_channels`

```prisma
model ProjectChannel {
  id            String      @id @default(cuid())
  projectId     String
  channel       LeadChannel
  provisioned   Boolean     @default(true)   // super_admin control (decision #15)
  enabled       Boolean     @default(true)   // owner control (siempre true en WhatsApp)
  publicKey     String?     @unique          // solo webchat (data-key del embed)
  config        Json        @default("{}")   // shape varia por canal
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  project       Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, channel])
  @@index([projectId])
  @@index([publicKey])
  @@map("project_channels")
}
```

**Backfill via migration SQL:**
```sql
INSERT INTO project_channels (id, project_id, channel, provisioned, enabled, config, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  id, 'whatsapp', true, true,
  jsonb_build_object('phoneNumberDisplay', whatsapp_phone_number),
  NOW(), NOW()
FROM projects
WHERE NOT EXISTS (
  SELECT 1 FROM project_channels pc WHERE pc.project_id = projects.id AND pc.channel = 'whatsapp'
);
```

**RLS policy** (memoria `SUPABASE-RLS-AUTO`):
```sql
ALTER TABLE project_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_channels_select" ON project_channels FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id::text = auth.uid()::text));
```

### 1.3 Crear interface `IChannelHandler`

`src/lib/channels/IChannelHandler.ts` con:
- `ChannelMessageInbound` (externalUserId, type, text, mediaPayload, metadata)
- `ChannelMessageOutbound` (text, mediaUrl, mediaType, caption)
- `IChannelHandler` interface: `channel`, `receive()`, `send()`, opcional `downloadMedia()`, `validateWebhookSignature()`

### 1.4 Refactor WhatsApp a `WhatsAppChannelHandler`

**Mover sin cambiar comportamiento:**
- `src/lib/whatsapp/send.ts` -> `src/lib/channels/whatsapp/send.ts`
- `src/lib/whatsapp/download-media.ts` -> `src/lib/channels/whatsapp/download-media.ts`
- Logica de `src/app/api/webhooks/whatsapp/route.ts` -> `src/lib/channels/whatsapp/receive.ts`
- Endpoint webhook se vuelve un thin wrapper

**Validacion de canal habilitado:** antes de procesar, verificar `ProjectChannel.provisioned AND enabled = true`. Si no, devolver 403 y log.

### 1.5 Dual-write `whatsappId` y `externalId`

En `WhatsAppChannelHandler.receive()`, al hacer `prisma.lead.upsert`:
- `create`: setea `whatsappId = waId` Y `externalId = waId` (dual-write)
- `update`: backfill `externalId = existingLead.externalId ?? waId`

### 1.6 Backfill SQL (uno-shot, fuera de Prisma)

```sql
UPDATE leads SET external_id = whatsapp_id WHERE external_id IS NULL AND whatsapp_id IS NOT NULL;
```

### 1.7 Switch reads a `externalId`

Migrar las 8 referencias a `whatsappId` en el codigo:
- `src/app/api/webhooks/whatsapp/route.ts`
- `src/lib/ai/process-ai-response.ts` (parametro `whatsappId` -> `externalUserId`)
- `src/app/api/cron/reengagement/route.ts`
- `src/hooks/useRealtimeMessages.ts`
- `src/lib/actions/messages.ts`
- `src/app/api/webhooks/n8n/route.ts`
- `src/app/api/ai/respond/route.ts`
- `src/app/api/whatsapp/mark-read/route.ts`

Mantener `whatsappId` indexado y dual-written hasta que en una version posterior (v0.26+) se elimine el campo.

### 1.8 Helper `getChannelHandler(channel, projectId)`

`src/lib/channels/registry.ts` retorna el handler si `ProjectChannel.provisioned && enabled = true`, sino `null`. Lazy import por canal para evitar bundle bloat.

### 1.9 Validacion fase 1

- E&Z recibe mensajes WhatsApp sin diferencia notable.
- Lead nuevo se crea con `externalId` populado.
- Lead existente se actualiza con `externalId` cuando llega un mensaje.
- Toggle de `ProjectChannel.provisioned = false` en proyecto de prueba bloquea ingestion (verificar 403).

**Deploy:** una PR por subseccion (1.1, 1.2 juntas; 1.3-1.4 juntas; 1.5-1.6 juntas; 1.7 sola; 1.8 sola). NUNCA todo de golpe.

---

## Fase 2: ProjectSettingsModal Extension + Settings Reorg

> **Objetivo:** UI super_admin para activar canales + reorganizar Settings del owner.
> Tiempo estimado: ~1.5 semanas (extraccion de tabs es mas invasiva que mover archivos).

### 2.1 Extender `ProjectSettingsModal` (super_admin)

`src/components/admin/ProjectSettingsModal.tsx` ya existe con tabs General + Secretos. Agregar nuevo tab **"Canales"**:

- Lista de canales: WhatsApp, WebChat
- Por cada canal, 3 acciones (decision #16):
  - **Activar** -> crea/actualiza fila `ProjectChannel` con `provisioned=true, enabled=true`
    - WhatsApp: muestra inputs de credenciales (token, phone_number_id, app_secret) -> guarda en `ProjectSecret`
    - WebChat: auto-genera `publicKey` (cuid corto), muestra embed `<script>`
  - **Desactivar** -> `provisioned=false` (conserva config para reactivar)
  - **Eliminar / Resetear** -> `DELETE FROM project_channels WHERE projectId AND channel`. Confirmacion doble. Leads/Conversations NO se tocan (decision #23).
- Server actions nuevas: `provisionProjectChannel`, `unprovisionProjectChannel`, `deleteProjectChannel` en `src/lib/actions/admin.ts` o nuevo `src/lib/actions/project-channels.ts`.

**NO crear nueva ruta** `/admin/organizations/[id]/page.tsx` (decision #22, no existe en el codigo actual).

### 2.2 Reorg Settings — extraccion de tabs

**Estado actual:** `SettingsPageClient.tsx` tiene 4 tabs (`instructions`, `knowledge`, `reengagement`, `form`) en una sola pagina.

**Estado final:**
```
src/app/[locale]/(dashboard)/settings/
  page.tsx                       AI Settings (3 tabs: instructions, knowledge, form)
  SettingsPageClient.tsx         (instructions + knowledge + form, SIN reengagement)
  whatsapp/
    page.tsx                     (NUEVO)
    WhatsAppSettingsClient.tsx   (reengagement + display number)
  webchat/
    page.tsx                     (NUEVO)
    WebChatSettingsClient.tsx    (toggle + apariencia + textos + starter + behavior + domains + embed + preview)
  team/
    page.tsx                     (existente, sin cambios)
```

**Trabajo concreto:**
- Extraer tab `reengagement` de `SettingsPageClient` a `WhatsAppSettingsClient`
- Crear `WebChatSettingsClient` desde cero (basado en componentes adaptados de ChatFlow360)
- Actualizar `Sidebar.tsx` con condicional: mostrar subitem solo si `ProjectChannel.provisioned=true`

### 2.3 Permisos por rol

| Rol | Provisionar canal | Configurar credenciales | Configurar apariencia | Toggle "Mostrar/Ocultar" | Ver embed code |
|-----|-------------------|-------------------------|----------------------|--------------------------|----------------|
| super_admin | Si | Si | Si | Si | Si |
| ADMIN | No | No | Si | Si | Si |
| MANAGER | No | No | Lectura | Lectura | Si |
| AGENT/VIEWER | No | No | No | No | No |

### 2.4 Drop column `Project.whatsappPhoneNumber`

Tras confirmar que `ProjectChannel.config.phoneNumberDisplay` es la unica fuente, en migracion separada:
```sql
ALTER TABLE projects DROP COLUMN whatsapp_phone_number;
```

### 2.5 Validacion fase 2

- Crear Org nueva como super_admin con solo WhatsApp -> proyecto recibe leads, sidebar muestra subitem WhatsApp.
- Crear Org nueva como super_admin con solo WebChat -> ProjectChannel existe, publicKey generado, sidebar muestra subitem Web.
- Toggle owner "Mostrar/Ocultar" en webchat -> widget desaparece en sitio cliente, subitem permanece visible.
- super_admin "Desactivar" canal -> subitem desaparece para owner.
- super_admin "Eliminar/Resetear" canal -> subitem desaparece, fila ProjectChannel borrada, leads existentes preservados.
- Reorganizar settings preservando todos los settings existentes (no perdida de datos).

---

## Fase 3: Widget MVP Funcional (polling primero)

> **Objetivo:** widget embebible end-to-end con transporte simple.
> Tiempo estimado: 2 semanas.

### 3.1 Layout `widget/` en el repo

```
widget/
  package.json
  tsconfig.json
  vite.config.ts          (build IIFE -> dist/kairo.js)
  src/
    index.ts              (entry, attach Shadow DOM)
    config.ts             (fetch /api/widget/config)
    transport/{polling,realtime}.ts
    ui/{Bubble,Window,Messages,Composer,Teaser}.tsx
    storage.ts            (localStorage)
    types.ts              (re-export shared types)
  vercel.json
  index.html              (landing minimal con info + link al dashboard)
```

**Vercel project #2:** Root `widget/`, build `npm run build`, output `dist/`, custom domain `widget.kairoagent.com`.

### 3.2 Endpoints publicos (en dashboard, project #1)

`src/app/api/widget/config/route.ts` (GET):
- Recibe `?key=<publicKey>`.
- Valida `publicKey` -> `ProjectChannel`.
- Si `provisioned=false OR enabled=false` -> retorna `{ enabled: false }` (widget no se monta).
- Si todo OK -> retorna `widgetAppearance` resuelto con defaults + `behavior` + `realtimeJWT` (efimero, scoped).
- Cache: `s-maxage=60`. Verifica `Origin` contra `allowedOrigins` (CORS).

`src/app/api/webhooks/webchat/route.ts` (POST):
- Recibe `{ publicKey, visitorId, sessionId, message: { type, text|mediaUrl } }`.
- Valida `provisioned AND enabled = true`. Si no, devuelve 403.
- Valida `Origin` contra `ProjectChannel.config.behavior.allowedOrigins`.
- Rate limit: 30 req/min por IP, 60 req/min por visitorId.
- Llama `WebChatChannelHandler.receive(projectId, payload)`.

`src/app/api/webchat/messages/route.ts` (GET): polling endpoint para fase 3. Cache: `no-store`.

### 3.3 `WebChatChannelHandler`

`src/lib/channels/webchat/`:
- `receive.ts`: crea/busca Lead por `externalId = visitorId`, `firstName = "Visitante"`, `channel = 'webchat'`. Crea/busca Conversation. Inserta Message. **Reusa pipeline AI 100%** llamando `processAIResponse()`.
- `send.ts`: persiste Message en BD. Realtime emite (fase 4); en fase 3 polling.
- `signed-upload.ts`: emite signed URL para `webchat-uploads/{projectId}/{year}/{month}/`.

### 3.4 Pipeline AI: ajustes minimos

`src/lib/ai/process-ai-response.ts`:
- Cambiar parametro `whatsappId` a `externalUserId` (rename, agnostico).
- Logica de descarga de media: branch por `lead.channel`.
- Resto: SIN cambios. RAG, form, Vision, Whisper, GPT-4o-mini funcionan identicos.

### 3.5 Widget bundle (Shadow DOM)

`widget/src/index.ts` (IIFE): lee `data-key` del `<script>`, crea host `<div id="kairo-widget-{publicKey}">`, attach Shadow DOM mode `closed`, monta app React/Preact dentro.

**Caracteristicas:**
- Multiples widgets por pagina: cada instancia genera su `host.id` con publicKey.
- Persistencia localStorage: `kairo_visitor_id`, `kairo_conv_<publicKey>`, etc.
- Session timeout: 2 horas inactividad cierra conversacion.
- UTM tracking: lee `window.location.search` + `document.referrer` en primer mensaje.
- Modo `data-preview="true"` para preview desde dashboard (no persiste).

### 3.6 Pagina `/settings/webchat/`

Componentes:
- `ChannelEnabledToggle.tsx` (switch "Mostrar/Ocultar")
- `AppearanceForm.tsx` (colores, logo, bubble) con HexColorField + Save explicito
- `TextsForm.tsx` (welcome, header, teaser, transcript) bilingue es/en
- `StarterQuestionsEditor.tsx` (max 5)
- `BehaviorForm.tsx` (auto-open delay, sonido)
- `DomainsForm.tsx` (allowedOrigins)
- `EmbedCodeCard.tsx` con `<script src="https://widget.kairoagent.com/kairo.js" data-key="..." defer></script>`
- `WidgetPreview.tsx` (preview en vivo, usa el bundle con `data-preview="true"`)

**Defaults brand KAIRO:** header midnight `#0B1220`, bubble cyan `#00E5FF`, visitor bubble cyan-on-midnight, AI bubble light gray `#F1F5F9`. Textos vacios -> fallback a i18n built-in del bundle.

### 3.7 Renombrar pagina "Leads" -> "Conversaciones"

`src/app/[locale]/(dashboard)/leads/` -> `conversations/`:
- Rename de ruta + redirect 301 desde `/leads`.
- Strings es/en: "Leads" -> "Conversaciones" / "Conversations".
- Sidebar item con nuevo nombre y nuevo icono (mensaje en vez de persona).
- LeadCard renombrado a `ConversationCard`.
- Filtro de canal nuevo: `WhatsApp | WebChat | (futuros)`.
- ChannelIcon visible en cada conversacion.

**`Lead` model NO se renombra** (sigue siendo la persona/registro). Solo cambia la pagina y label.

### 3.8 Validacion fase 3

- Embed `<script>` en sitio de prueba (Webflow, WordPress, HTML estatico).
- Visitor abre widget, escribe -> aparece como Lead nuevo en dashboard con `channel='webchat'`.
- Polling: widget recibe respuesta del AI en <5 segundos.
- LLM captura email via form conversacional -> guardado en `lead_form_data`.
- UTM: visitor desde `?utm_source=google` -> `Lead.source = 'google_ads'`.
- Multiples widgets en misma pagina con publicKeys distintos -> conversaciones aisladas.
- Toggle "Mostrar/Ocultar" del owner OFF -> widget no se monta (`/api/widget/config` devuelve `enabled: false`).
- WhatsApp sigue funcionando sin diferencia (E&Z no afectada).

---

## Fase 4: Realtime + Paridad de Features

> **Objetivo:** push real bidireccional + handoff humano + media + Vision/Whisper.
> Tiempo estimado: 1-2 semanas.

### 4.1 Supabase Realtime con JWT efimero

**Endpoint** `POST /api/widget/realtime-token`: recibe `{ publicKey, sessionId, conversationId }`, genera JWT con claims `{ projectId, channel: 'webchat', conversationId, exp: now + 1h }`.

**RLS policy nueva** en `messages`: select permitido si `auth.jwt() ->> 'channel' = 'webchat' AND conversation_id = (jwt ->> 'conversationId')::uuid`.

### 4.2 Widget: WebSocket directo a Supabase Realtime

Patron de ChatFlow360 (sin SDK): WebSocket a `wss://<project>.supabase.co/realtime/v1/websocket?apikey=<jwt>`, Phoenix Channels protocol, heartbeat 30s, subscribe a `realtime:messages:conversation_id=<x>`. Polling como fallback automatico.

### 4.3 Handoff humano en webchat

- Asesor toma control desde dashboard -> `Lead.handoffMode = 'human'` -> UI del widget muestra "Un asesor se unio al chat".
- Mensajes salientes del asesor llegan via Realtime al widget en tiempo real.
- Indicador "asesor escribiendo": Realtime broadcast (no persiste en BD).

### 4.4 Media en webchat

**Visitor sube archivo:**
1. Widget pide signed URL: `POST /api/widget/upload-token` con tipo y tamano.
2. Widget sube directo a Supabase Storage `webchat-uploads/{projectId}/{year}/{month}/{visitorId}-{uuid}.ext`.
3. Widget envia mensaje con `mediaUrl` resultante.
4. Backend: lee Storage, ejecuta Vision/Whisper segun tipo, guarda transcripcion.

**Limites:** Imagen 10 MB, Video 25 MB, Audio 10 MB, Documento 10 MB. Tipos validados server-side.

### 4.5 Cleanup de media (cron existente)

`src/app/api/cron/cleanup-media/route.ts`: agregar bucket `webchat-uploads/` al cleanup despues de 5 dias. Agent media permanente protegida.

### 4.6 Side effects al desactivar/ocultar webchat

| Accion | publicKey | Bundle JS | Widget se monta | Sidebar owner | Conversaciones BD |
|--------|-----------|-----------|-----------------|---------------|-------------------|
| owner `enabled=false` | persiste | sigue cargando | NO (`config` retorna `enabled:false`) | subitem visible | intactas, sesiones activas completan hasta timeout 2h |
| super_admin `provisioned=false` | persiste | sigue cargando | NO | subitem desaparece | intactas |
| super_admin "Eliminar/Resetear" | borrado | sigue cargando | NO (`config` retorna 404) | subitem desaparece | intactas. Reactivar genera nueva key, cliente re-embebe |

Webhook `/api/webhooks/webchat` retorna 403 si `provisioned=false OR enabled=false`.

### 4.7 Validacion fase 4

- Visitor escribe -> aparece en dashboard EN <500ms (Realtime).
- Asesor responde desde dashboard -> aparece en widget EN <500ms.
- Visitor sube imagen -> AI analiza con Vision -> responde contextualmente.
- Visitor envia audio -> Whisper transcribe -> AI responde al texto.
- Realtime cae (simulacion: bloquear WS) -> widget cae a polling sin perder mensajes.

---

## Fase 5: Pagina "Leads" Unificada (post-v1)

> **Objetivo:** vista CRM con merge lazy de leads por email/telefono.
> **NO incluida en v1.** Reservada para v0.26+.

- Schema: cambio de `Lead 1-1 Conversation` a `Lead 1-N Conversation`.
- Merge lazy: cuando LLM captura email, buscar Lead existente con ese email en mismo proyecto -> fusionar conversaciones.
- Pagina `/leads/` (nueva): vista por persona, agrega conversaciones de todos los canales.
- Pagina `/conversations/` (existente fase 3) sigue siendo la vista operativa diaria del asesor.
