# KAIRO - Changelog

> Solo se mantienen las ultimas 5 versiones. Versiones anteriores en [docs/changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

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

## [0.9.0] - 2026-03-07

### Settings / Configuration Page + Structured Knowledge Base

Nueva pagina de configuracion de agentes con dos tabs: **Instructions** (prompt structure) y **Knowledge Base** (conocimiento estructurado + RAG free-text).

**Dual-Name System:**

| Nombre | Ubicacion | Proposito |
|--------|-----------|-----------|
| `ai_agents.name` | ProjectSettingsModal (admin) | Etiqueta administrativa (ej: "Agente 1") |
| `promptStructure.agentName` | Settings > Instructions | Nombre con el que el bot se presenta (default: "Kaira") |

El webhook ahora lee `promptStructure.agentName` en lugar de `agent.name` para el pipeline AI. Fallback a "Kaira" en todos los niveles.

**E2E Testing (Playwright MCP via WhatsApp):**

| Test | Resultado | Verificado |
|------|-----------|------------|
| Nombre del agente | PASS | Bot se identifica con el nombre configurado |
| Rol del agente | PASS | Responde como asistente de ventas |
| Reglas | PASS | Cumple las 5 reglas configuradas |
| Personalidad | PASS | Tono amigable con humor ligero |
| Instrucciones adicionales | PASS | Ofrece llamada 15 min, pregunta alcance |
| Horarios (KB) | PASS | Devuelve horarios exactos por dia |
| FAQs (KB) | PASS | Responde con servicios del KB |
| Precios (KB) | PASS | Montos exactos S/1,500, S/2,500, S/2,000 |
| Ubicacion/Contacto (KB) | PASS | Telefono, email, direccion reales del KB |
| Politicas (KB) | PASS | Reembolso 15 dias, proporcional despues |
| RAG texto libre (KB) | PASS | Promo marzo 30%, auditoria S/500 |

**Tab Instructions:**

| Campo | Descripcion |
|-------|-------------|
| Agent Name | Nombre del agente (max 50 chars) |
| Role | Rol/descripcion larga del agente |
| Rules | Lista dinamica de reglas (add/remove/reorder) |
| Personality | Personalidad del agente |
| Additional Instructions | Instrucciones adicionales libres |

Datos guardados en `ai_agents.promptStructure` (JSONB). El system prompt se compone dinamicamente via `composeSystemPrompt()` en `prompt-builder.ts`.

**Tab Knowledge Base - 5 secciones estructuradas:**

| Seccion | Datos | Composicion |
|---------|-------|-------------|
| Business Hours | Dias, horarios, feriados, timezone | Texto bilingue ES/EN |
| FAQs | Pares pregunta/respuesta dinamicos | Lista numerada |
| Pricing | Servicios con precio/moneda/notas | Tabla de precios + notas |
| Location & Contact | Direccion, telefono, email, web, redes sociales, sedes adicionales | Info de contacto completa |
| Policies | Politicas con titulo/contenido + presets predefinidos | Politicas enumeradas |

Cada seccion: Zod validation -> compose bilingual text -> OpenAI embedding (text-embedding-3-small) -> pgvector storage via RPC.

**Archivos nuevos:**

| Archivo | Proposito |
|---------|-----------|
| `src/app/[locale]/(dashboard)/settings/page.tsx` | Server component de la pagina |
| `src/app/[locale]/(dashboard)/settings/SettingsPageClient.tsx` | Client component principal (~700 lineas) |
| `src/lib/knowledge/prompt-builder.ts` | `PromptStructure` interface + `composeSystemPrompt()` |
| `src/lib/knowledge/business-hours.ts` | Tipos + `composeBusinessHoursText()` |
| `src/lib/knowledge/faqs.ts` | Tipos + `composeFAQsText()` |
| `src/lib/knowledge/pricing.ts` | Tipos + `composePricingText()` |
| `src/lib/knowledge/location-contact.ts` | Tipos + `composeLocationContactText()` |
| `src/lib/knowledge/policies.ts` | Tipos + `composePoliciesText()` + presets |
| `src/components/knowledge/BusinessHoursForm.tsx` | Formulario horarios + feriados |
| `src/components/knowledge/FAQsForm.tsx` | Formulario preguntas/respuestas |
| `src/components/knowledge/PricingForm.tsx` | Formulario servicios + precios |
| `src/components/knowledge/LocationContactForm.tsx` | Formulario ubicacion + contacto |
| `src/components/knowledge/PoliciesForm.tsx` | Formulario politicas + presets |

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/actions/knowledge.ts` | `upsertStructuredKnowledge()`, `getAllStructuredKnowledge()`, `getStructuredKnowledge()`, `deleteStructuredKnowledge()` - todas usan RPCs SECURITY DEFINER |
| `src/lib/actions/agents.ts` | `updateAgentPromptStructure()` server action |
| `src/components/layout/Sidebar.tsx` | Link a /settings en sidebar |
| `prisma/schema.prisma` | Campo `promptStructure Json?` en modelo AIAgent |
| `src/messages/es.json` + `en.json` | Keys i18n para settings, knowledge sections, formularios |
| `src/app/api/webhooks/whatsapp/route.ts` | Lee `promptStructure.agentName` (con fallback Kaira) en lugar de `agent.name` |
| `src/components/admin/ProjectSettingsModal.tsx` | Removida seccion de instrucciones (movida a /settings) |
| `src/contexts/LoadingContext.tsx` | Safety timeout para loading overlay (previene estados infinitos) |

**Migraciones SQL (3 nuevas):**

| Migracion | Cambio |
|-----------|--------|
| `20260306_add_prompt_structure` | `promptStructure JSONB` en `ai_agents`, `category VARCHAR(50)` + `structured_data JSONB` en `agent_knowledge`, indice unico `idx_agent_knowledge_unique_category` |
| `20260306_update_insert_knowledge_rpc` | RPC `insert_agent_knowledge` actualizado: 12 params (+ `p_category`, `p_structured_data`), upsert atomico (DELETE + INSERT dentro de SECURITY DEFINER) |
| `20260306_update_list_knowledge_rpc` | RPC `list_agent_knowledge` actualizado: retorna `category` y `structured_data`, casts `::TEXT` para VARCHAR |
| `20260306_delete_structured_knowledge_rpc` | Nuevo RPC `delete_structured_knowledge(agent_id, project_id, category)` - bypass RLS |

**Bugs corregidos (RLS):**

| Bug | Causa raiz | Fix |
|-----|-----------|-----|
| `structured_data`/`category` no persistian | `.update()` via anon client sin RLS UPDATE policy | Movido a params del RPC `insert_agent_knowledge` (SECURITY DEFINER) |
| Knowledge no cargaba tras reload | `.select()` via anon client con RLS SELECT policy rota (`project_id` vs `"projectId"`) | Cambiado a RPC `list_agent_knowledge` |
| Duplicate key constraint en upsert | `.delete()` via anon client con RLS DELETE policy rota | DELETE movido dentro del RPC (atomico) |

**Leccion clave:** Todas las operaciones sobre `agent_knowledge` (CRUD + SEARCH) DEBEN usar RPCs SECURITY DEFINER. Las RLS policies referencian `pm.project_id` pero la columna real es `pm."projectId"` (Prisma camelCase), causando fallos silenciosos. Ver v0.9.1 para el fix de search.

---

## [0.8.2] - 2026-02-20

### Per-Project WhatsApp App Secret (Multi-Tenant HMAC)

Soporte para App Secret por proyecto. Cada cliente puede tener su propia Meta Developer App con su propio App Secret para verificacion HMAC de webhooks.

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/lib/actions/secrets.ts` | Agregado `whatsapp_app_secret` a `SecretKey` type y `allKeys` array |
| `src/components/admin/ProjectSettingsModal.tsx` | Nuevo campo App Secret en tab WhatsApp (password input, reveal/copy/timer) |
| `src/messages/es.json` + `en.json` | 2 keys i18n: `enterAppSecret`, `appSecretHelp` |
| `src/app/api/webhooks/whatsapp/route.ts` | Reestructuracion HMAC: parse JSON primero, extraer `phone_number_id`, buscar App Secret per-project, verificar HMAC. Fallback a global solo si no hay per-project. HMAC failure rate limiting (10/5min/IP) |

**Backward compatibility:**

| Escenario | Comportamiento |
|-----------|---------------|
| Proyecto sin App Secret configurado | Usa global `WHATSAPP_APP_SECRET` |
| Proyecto con App Secret configurado | Usa per-project, NO fallback a global |
| Ni proyecto ni global | Rechaza silenciosamente |

**Seguridad:** Smart fallback (no global bypass si existe per-project), HMAC failure rate limiting, cache de App Secret (5min TTL, 500 LRU).

---

## [0.8.1] - 2026-02-15

### Security Audit v2 + Vercel Serverless Fix

Auditoria de seguridad completa del webhook WhatsApp y pipeline AI interno. 19 hallazgos identificados y resueltos (2 criticos, 3 altos, 5 medios, 4 bajos, 10 aprobados).

**Fix critico: Vercel serverless lifecycle**

| Archivo | Cambio |
|---------|--------|
| `package.json` | Agregado `@vercel/functions` |
| `src/app/api/webhooks/whatsapp/route.ts` | 4 fire-and-forget calls envueltos con `waitUntil()`: processAIResponse, handleStatusUpdate, notifyProjectMembers, sendReadReceipt |

**Hallazgos criticos resueltos:**

| ID | Fix | Archivo |
|----|-----|---------|
| C-1 | Deduplicacion de mensajes via `whatsappMsgId` check | `route.ts` |
| C-2 | Limite de 1MB en body del webhook + `maxDuration=25s` | `route.ts` |

**Hallazgos altos resueltos:**

| ID | Fix | Archivo |
|----|-----|---------|
| A-1 | Anti-prompt-injection: preamble con 5 reglas inmutables + delimitadores `=== ===` | `build-system-prompt.ts` |
| A-2 | Rate limit IP: requests sin IP rechazadas en produccion | `route.ts` |
| A-3 | Truncamiento: texto 4096 chars, captions 2048, filenames 255 | `route.ts`, `process-ai-response.ts` |

**Hallazgos medios resueltos:**

| ID | Fix | Archivo |
|----|-----|---------|
| M-1 | Cache `phoneNumberIdCache` con limite de 500 entradas + eviccion LRU | `route.ts` |
| M-2 | Audio: validacion 10MB max, MIME whitelist (6 tipos), hostname Facebook CDN check | `process-ai-response.ts` |
| M-3 | Rate limit por proyecto: 60 respuestas AI/min/proyecto | `route.ts` |
| M-4 | `getProjectSecret()` reforzado con documentacion de responsabilidad del caller | `secrets.ts` |
| M-5 | `logSecretAccess()` graceful fuera de request context | `secrets.ts` |

**Hallazgos bajos resueltos:**

| ID | Fix |
|----|-----|
| L-1 | IDs truncados a 8 chars en logs, nombres removidos |
| L-2 | Verify token usa `timingSafeEqual` |
| L-3 | Token fallido ya no se loguea en texto claro |
| L-4 | Fallback dev requiere `ALLOW_WEBHOOK_FALLBACK=true` explicito |

**Sanitizacion de nombres de contacto:**

`sanitizeContactName()` en `route.ts`: strip emojis (above-BMP + BMP decorativos + ZWJ), escape HTML (anti-XSS), NFC normalize, limite 100 chars, fallback a telefono si vacio.

**10 controles aprobados (sin cambios necesarios):** Verificacion HMAC-SHA256, fail-closed en produccion, cifrado AES-256-GCM, rate limiting atomico Lua/Redis, Prisma ORM, AbortController timeout 30s, degradacion graceful, respuestas genericas, audit trail de secretos, 13 security headers.

---

## [0.8.0] - 2026-02-15

### Internal AI Pipeline - n8n removal

Migra el pipeline de IA de n8n (Railway) a funciones internas en Next.js. Elimina dependencia externa, reduce latencia (~400-1200ms), mejora seguridad (3 endpoints publicos menos), simplifica arquitectura.

**Archivos creados:**

| Archivo | Proposito |
|---------|-----------|
| `src/lib/ai/process-ai-response.ts` | Pipeline core: audio transcription, RAG search, OpenAI chat, temperature extraction, summary generation, DB save, WhatsApp send |
| `src/lib/ai/build-system-prompt.ts` | Replica el system prompt que antes armaba n8n (agent identity, instructions, RAG, history, summary, date/time) |

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/app/api/webhooks/whatsapp/route.ts` | `triggerN8nWorkflow()` reemplazada por `processAIResponse()` (fire-and-forget) |

**Beneficios medidos:**
- Latencia: -400 a -1200ms (elimina 4 round-trips HTTP KAIRO<->Railway)
- Seguridad: 3 endpoints publicos que solo n8n usaba pueden ser deprecados
- Costo: -$5-10/mes (Railway eliminado)
- Infraestructura: 1 proveedor (Vercel) en vez de 2 (Vercel + Railway)

**Nota:** Los endpoints de n8n (`/api/ai/respond`, `/api/rag/search`, `/api/audio/transcribe`) se mantienen temporalmente como fallback. Se eliminaran en una version futura.

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
