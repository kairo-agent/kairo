# KAIRO - Changelog

> Solo se mantienen las ultimas 5 versiones. Versiones anteriores en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

---

## [0.27.3] - 2026-05-13

### CharCounter universal en inputs y textareas con maxLength

**Motivacion:** Un input de titulo (maxLength=500) cortaba texto silenciosamente sin ninguna indicacion visual. El usuario perdia contenido sin darse cuenta. Auditoria completa de todos los campos con `maxLength` en la app revelo docenas de inputs/textareas sin feedback de limite.

**Nuevo componente `src/components/ui/CharCounter.tsx`:**

Componente reusable con tres umbrales de color:
- Normal (< 80% del limite): text-tertiary
- Advertencia (>= 80%): amber-500
- Critico (>= 95%): red-500

Muestra `{length} / {max}` alineado a la derecha debajo del campo. `aria-live="polite"` para accesibilidad.

**Integracion automatica en componentes UI base:**

Los dos componentes de input mas usados renderizan `CharCounter` automaticamente cuando reciben `maxLength`, sin que cada sitio de uso tenga que importarlo:

- `src/components/ui/Input.tsx` — prop `showCounter` opcional (default `true`). Se muestra debajo del input cuando `maxLength` esta seteado.
- `src/components/ui/ExpandableTextarea.tsx` — counter presente en **ambas vistas**: modo compacto y modal expandido. Misma prop `showCounter`.

**Integraciones explicitas (campos que usan `<input>` o `<textarea>` HTML directo):**

Los siguientes componentes usan raw HTML y no heredan la integracion automatica. Se agrego `<CharCounter>` explicitamente en cada uno:

| Archivo | Campos cubiertos |
|---------|-----------------|
| `src/app/[locale]/(dashboard)/settings/SettingsPageClient.tsx` | knowledge title (100), knowledge edit (100), criteria (200), edit rule (500), new rule (500), form field label (100) |
| `src/app/[locale]/(admin)/admin/global-rules/page.tsx` | add rule (500), edit rule (500) |
| `src/components/knowledge/MultimediaModal.tsx` | titulo (100) |
| `src/components/knowledge/FAQsForm.tsx` | pregunta + respuesta |
| `src/components/knowledge/PoliciesForm.tsx` | politica |
| `src/components/knowledge/PricingForm.tsx` | precio + descripcion |
| `src/components/knowledge/LocationContactForm.tsx` | 9 campos (address, city, country, contactName, email, website, maps, instagram, facebook) |
| `src/components/knowledge/BusinessHoursForm.tsx` | notas de horario |
| `src/components/settings/ReEngagementTab.tsx` | mensajes de reengagement |
| `src/components/settings/webchat/TextsForm.tsx` | titulo, subtitulo, teaser |
| `src/components/settings/webchat/StarterQuestionsEditor.tsx` | texto de preguntas sugeridas |

**Omisiones intencionales** (campos de formato corto/especifico donde el counter seria ruido visual):

- password (maxLength=128): formato opaco, el usuario no cuenta caracteres de password
- phone numbers en LocationContactForm (maxLength=30): formato visual especifico (banderas, prefijos)
- zipCode en LocationContactForm (maxLength=20): campo de formato estructurado
- date MM-DD en BusinessHoursForm (maxLength=5): longitud predecible
- hex color en HexColorField (maxLength=7): siempre exactamente 7 chars (#RRGGBB)

**Bug fixes asociados:**

- `fix(settings): remove duplicate hardcoded char counters in InstructionsTab` (`6740090`) — `InstructionsTab` tenia contadores `<p>{value.length}/N</p>` hardcoded para role, personality, additionalInstructions que ahora duplicaban el auto-counter del `ExpandableTextarea`. Se eliminaron los literales.
- `fix(settings): add CharCounter to FormTab field-label input` (`1c34eb9`) — El input "Nombre del campo" en el tab Formulario usaba `<input>` raw con `maxLength={100}` sin counter. Detectado en QA en produccion.
- `fix(settings): add maxLength to knowledge content textarea so counter renders` (`72c2c7f`) — El `ExpandableTextarea` de "Contenido" en el modal "Agregar conocimiento" no tenia prop `maxLength`, por lo que el auto-counter no se renderizaba (gateado por presencia de maxLength). Fix: agregar `maxLength={10000}` alineado con el limite de `additionalInstructions`. El servidor hace chunking de 1000 chars para embeddings y no enforce un hard limit distinto.

**Sin migracion DB. Sin cambios de API.**

**Commits**: `3e798d6` (CharCounter component + integracion automatica) → `6740090` (remove duplicate counters InstructionsTab) → `1c34eb9` (FormTab field-label) → `72c2c7f` (knowledge content maxLength).

---

## [0.27.2] - 2026-05-13

### Settings UX hardening: spinner en FormTab + guard contra race condition al cambiar agentes

Dos fixes de UX en `src/app/[locale]/(dashboard)/settings/SettingsPageClient.tsx` que cerraban brechas de consistencia visual y correctitud de datos al navegar entre agentes rapido.

**Fix 1 — Spinner en FormTab al cambiar agente (`484e71c`):**

El componente `FormTab` recibia la prop `loading` desde el padre pero no la usaba internamente. Las pestanas `InstructionsTab` y `KnowledgeTab` ya tenian un early-return que mostraba un spinner mientras cargaban los datos del nuevo agente; `FormTab` quedaba desincronizada y mostraba el schema del agente anterior durante la transicion. Fix: agregar el mismo patron `if (loading) return <Spinner>` en `FormTab` (lineas ~2424), alineando el comportamiento visual entre las tres pestanas. +13 lineas.

**Fix 2 — Race condition al cambiar agentes rapido (`f0f5f20`):**

Bug: al cambiar de agente A → B rapidamente (o A → B → A), las respuestas async de `loadInstructions`, `loadKnowledge`, `loadMedia`, `loadVideos` y `loadForm` del agente anterior podian resolver DESPUES del nuevo agente seleccionado y sobrescribir el estado en pantalla con datos stale. El resultado era que la UI mostraba los datos del agente equivocado de forma silenciosa.

Fix: nuevo `useRef<string | null>` (`currentAgentIdRef`) como fuente de verdad sincronica del agente actualmente seleccionado. Cada loader captura el `requestedAgentId` al inicio de la llamada async y, antes de cualquier `setState`, compara contra `currentAgentIdRef.current`. Si difieren, la respuesta es stale y se descarta sin actualizar estado. El ref se actualiza en dos puntos: (a) el `useEffect` del agent-change (linchpin principal), (b) la fase 2 del initial load (defensivo, por si el componente monta con agente preseleccionado). +52 / -11 lineas.

**Impacto**: eliminado el "flash" de datos del agente anterior en FormTab y la sobrescritura silenciosa de datos al navegar entre agentes bajo latencia de red normal. Sin migracion DB. Sin cambios de API.

**Commits**: `484e71c` (spinner) → `f0f5f20` (race guard).

---

## [0.27.1] - 2026-05-12

### Form Data Capture via OpenAI Function Calling + Prompt Order Fix

**Bug raiz resuelto:** form data capture rate en produccion era ~8% (29 de 364 leads en 6 semanas). El marker `[FORM-DATA: key=value]` en texto era ignorado por el LLM cuando habia carga cognitiva alta — el modelo entendia contextualmente pero omitia emitir el marker.

**Fix arquitectonico — Function Calling (OpenAI oficial):**
- `process-ai-response.ts`: nueva funcion `buildFormCaptureTools()` genera dinamicamente un schema de Function Calling desde `formConfig.fields`. Cada field se convierte en property del schema (text/email/phone → `['string', 'null']`, number → `['number', 'null']`, options → `['string', 'null']` con `enum`).
- Patron de **dos llamadas paralelas** via `Promise.all`:
  - Llamada A: texto visible al usuario (sin tools, temp=0.7, max_tokens=500).
  - Llamada B: extraccion estructurada (con `tool_choice` forzado a `capture_form_data`, temp=0, max_tokens=200).
- Forzar `tool_choice` en una sola llamada hacia que el modelo omitiera el contenido visible. Separar en dos llamadas resuelve el conflicto sin sumar latencia (Promise.all ≈ max(call1, call2)).
- Modo `strict: true` garantiza adherencia al schema. Coexiste con el parser legacy del marker `[FORM-DATA:]` como safety net.

**Anti-reset del LLM — restructuracion del system prompt:**
- Bug: el LLM hacia reset al saludo inicial cuando recibia inputs ambiguos en turnos tardios (ej. nombre suelto "marcos roca" sin verbo introductorio). La attention se distribuia hacia la primera instruccion imperativa del agente.
- Fix: en `build-system-prompt.ts`, mover el `conversation history` al ULTIMO bloque del prompt y colocar la regla anti-reset INMEDIATAMENTE despues del historial. La contiguidad cognitiva (historial + interpretacion) ancla la instruccion en el contexto reciente que el modelo acaba de leer.

**WhatsApp display name no contamina el form:**
- `process-ai-response.ts`: skip firstName/lastName cuando se hace pre-fill del form desde `Lead`. El display name de WhatsApp es no confiable (alias, apodo, telefono, business name). El agente siempre pregunta el nombre real.
- `lead-form-data.ts bulkUpdateLeadFormFields`: cuando el agente captura un nombre mapeado a `firstName`, smart-split en whitespace para popular `firstName` + `lastName` separados (ej. "Marcos Roca" → firstName=Marcos, lastName=Roca). Sobrescribe el valor del perfil WhatsApp en `Lead`.
- `build-system-prompt.ts`: el `leadName` se inyecta con disclaimer "puede no ser real". Instruye al LLM a usar el nombre que el visitante confirme conversacionalmente.

**Impacto medido:** captura de form data sube de ~8% a ~100% (en pruebas internas). Flujo conversacional sin resets. Aplicable a TODOS los agentes via el pipeline compartido `processAIResponse` (WhatsApp + WebChat).

**Commits**: `64646a8 → 0dfc130 → c54555d → cc9ab36 → c7f0c47 → fa8253d`.

**Sin migracion DB.** Logs debug temporales (`[TOOLS DEBUG]`, `[FORM-DATA DEBUG]`) en `process-ai-response.ts` quedan por ahora para monitoreo en produccion — remover en proximo release.

---

## [0.27.0] - 2026-05-11

### Active Agent = Runtime Source of Truth (multi-agent foundation)

Refactor que separa **agente activo del proyecto** (fuente de verdad runtime) de **`lead.assignedAgentId`** (registro historico). Habilita crear multiples agentes por proyecto sin scripts de reasignacion de leads existentes.

**Motivacion**: antes, al cambiar el agente activo del proyecto, los leads ya creados seguian respondiendo con el agente viejo (su `assignedAgent` quedaba pegado). El cron de reengagement ya usaba el activo, pero WhatsApp/WebChat receive seguian leyendo `lead.assignedAgent`. Esto bloqueaba pivots de campana / cambios de agente para clientes con leads existentes (E&Z: 610 leads).

**Cambio**:
- Nuevo helper `src/lib/ai/get-active-agent.ts` con `getActiveAgentForProject(projectId)` (cache Redis 5min + invalidacion explicita) y `invalidateActiveAgentCache(projectId)`.
- `whatsapp/receive.ts` + `webchat/WebChatChannelHandler.ts`: el bloque AI runtime resuelve el agente activo via helper en vez de leer `lead.assignedAgent`. `lead.assignedAgentId` se sigue grabando al crear el lead (como historico inmutable), pero NO se usa para decidir que agente responde.
- `agents.ts createAgent` ahora default `isActive: false`. Crear no activa automaticamente — el usuario activa explicitamente via `toggleAgentStatus` (que sigue desactivando los demas del proyecto).
- Invalidacion de cache en TODAS las server actions que modifican el agente: `toggleAgentStatus`, `updateAgent`, `deleteAgent`, `saveAgentPromptStructure`, `saveFormConfig`.
- `LeadDetailPanel` form data: nueva server action `getActiveAgentFormConfigForProject(projectId)`. La UI renderiza el form schema del agente ACTIVO (no del historico). `lead_form_data` rows del agente historico se preservan en BD (clave compuesta `(leadId, agentId)`).
- `cron/reengagement` ya iteraba sobre `isActive: true` agentes — sin cambios necesarios.

**Beneficio para E&Z**: al activar "Agente Eventos" (manualmente desde /admin), los 610 leads asignados historicamente a "Agente Lotes" responden automaticamente con la logica del evento. Sin scripts de UPDATE masivo.

**Sin migracion DB**: solo cambios de codigo. Schema intacto.

---

## [0.26.0] - 2026-05-08

### Fase 4 Multi-Canal: Realtime + paridad con WhatsApp (NEW)

Cierra el loop multi-canal: el widget WebChat ahora tiene latencia ~instantanea (Realtime broadcast), handoff humano funcional, soporte completo de media (imagen + audio + documento) y CORS strict por defecto. Total: 8 commits productivos en 1 sesion (`e599f7f` → `313bddd` → `<este>`).

#### Sub-fase 4.A — Realtime broadcast como senal (commit `e599f7f`)

Patron "broadcast como senal" rechaza el approach JWT+RLS original (4 issues criticos en security audit) y el broadcast simple (anon key permite spoof). Solucion: server emite broadcast SIN payload sensible, widget IGNORA payload y refetchea via endpoint autenticado. Modelo de amenaza identico al polling — solo gana latencia.

- Nueva columna `Conversation.realtimeTopicSecret` (UUID v4 unique, default `gen_random_uuid()`). Desacoplada de `Conversation.id` — leak de id NO compromete el canal.
- Helper `emitWebChatSignal(topicSecret)` via REST `/realtime/v1/api/broadcast` con SUPABASE_SERVICE_ROLE_KEY. Timeout 2.5s, sanitiza topic UUID en logs.
- Widget: `widget/src/realtime.ts` — cliente Phoenix WS vanilla (sin SDK = -15KB), heartbeat 25s, reconnect exponential bounded.
- `processAIResponse` + `WebChatChannelHandler.send` + `/webhooks/webchat` emiten signal. Widget al recibir → `pollOnce()` (que ya valida publicKey + tenant).
- Polling DEFAULT_POLL_MS sube de 3s a 30s (fallback duro).
- Validado en prod: phx_join 131ms, signal latency 276ms (visitor) / 10.9s (AI con debounce 5s + processing).

#### Sub-fase 4.B — Polling pause/resume con WS (commit `ceb6fa3`)

WS healthy → onConnect dispara catch-up poll + `stopPolling`. Reduce ~120 fetches/h innecesarios. WS cae → onDisconnect rearma polling con catch-up. `startPolling` idempotente. Validado: 0 polls en 35s con WS sano, 6 polls + 5 reintentos WS con WS bloqueado por stub.

#### Sub-fase 4.C — Handoff humano UI banner (commits `fffee0a` + `d1c0104`)

Banner sticky "Un asesor se ha unido al chat" cuando `Lead.handoffMode='human'`. AI typing skipped en human mode. `/api/webchat/messages` retorna `handoffMode` por poll.

**Bug critico encontrado y arreglado en `d1c0104`:** dashboard no usa `WebChatChannelHandler.send()`, sino `sendMessage()` server action que persiste directo. Por eso los mensajes del asesor jamas emitian broadcast en 4.A. Fix: emitter agregado en `sendMessage` y `toggleHandoffMode` actions, condicionado a `lead.channel='webchat'`. Validado: 3 broadcasts capturados en orden (take control + asesor msg + return to AI).

#### Sub-fase 4.D — Media upload visitor

Paperclip btn unico acepta imagen + audio + documento. Bucket `media` reusado con prefix `webchat/{projectId}/{YYYY}/{MM}/{conversationId}-{uuid}.{ext}`. Bucket es publico → URL fetcheable directo (sin signed URL para read).

- **4.D.1 imagen** (`9813908` + `bbd0594`): GPT-4o-mini Vision describe contenido. Validado: AI identifico "imagen relacionada con Google" sobre logo subido.
- **4.D.2 audio** (`780068c`): Whisper-1 transcribe desde URL publica. Hostname guard critico contra SSRF (URL debe matchear `NEXT_PUBLIC_SUPABASE_URL` host + prefix `/storage/v1/object/public/media/webchat/`). Validado: TTS "cuanto cuestan sus servicios de marketing digital" → AI respondio sobre precios.
- **4.D.3 documento** (`313bddd`): PDF/DOC/DOCX/XLS/XLSX/TXT/CSV. NO AI processing — entrega directa al asesor. Filename sanitizado.

Endpoint `POST /api/widget/upload-token`: signed PUT URL con TTL 5min, rate limit 5/min IP + 30/min publicKey, MIME whitelist por tipo, max 10MB. Cron `cleanup-media` extendido a `webchat/{projectId}/...` (5 dias retention).

#### Sub-fase 4.E — CORS strict + bump v0.26.0 (este commit)

`resolveCorsOrigin`: lista vacia ahora **bloquea** todos los cross-origin requests (Fase 3 era permisiva). Mismo cambio aplicado a las 4 rutas publicas. Same-origin (sin Origin header) sigue funcionando.

UI `/settings/webchat` Domains form actualizada: warning rojo cuando lista vacia advirtiendo "el widget NO funcionara en ningun sitio externo" (antes decia "permisivo" — era enganoso post-fase4).

**Migracion:** los proyectos webchat existentes con `allowedOrigins=[]` deben agregar sus dominios antes de embeber. Disruptivo (unico proyecto webchat hoy) NO esta embebido en ningun sitio externo aun, por lo que el cambio NO rompe nada en produccion real.

Bundle widget total: 37.23 KB / 11.66 KB gzip (vs 7.8 KB en v0.25.0).

---

## [0.25.0] - 2026-05-07

### Fase 3 Multi-Canal: WebChat MVP completo (NEW)

Segundo canal disponible para KAIRO: widget WebChat embebible que reusa el pipeline AI completo (RAG, Vision, form conversacional, handoff). Servido desde subdominio dedicado `widget.kairoagent.com` (Vercel project #2 separado del dashboard) con Shadow DOM aislado y polling cada 3s. Plan completo en [docs/plans/MULTI-CHANNEL-WEBCHAT.md](plans/MULTI-CHANNEL-WEBCHAT.md) e [MULTI-CHANNEL-IMPL.md](plans/MULTI-CHANNEL-IMPL.md).

#### Backend (Fase 3.2 + 3.6)

**3 endpoints publicos:**
- `GET /api/widget/config?key=<publicKey>` retorna appearance + behavior con defaults brand KAIRO. CORS validado contra `ProjectChannel.config.allowedOrigins` (vacio = permisivo en Fase 3, exact-match en Fase 4). Cache `s-maxage=60`.
- `POST /api/webhooks/webchat` recibe `{ publicKey, visitorId, sessionId, message: { type, text } }`. Rate limit 30/min IP + 60/min visitor. Persiste Lead anonimo (`firstName: 'Visitante'`) + Conversation + Message stub.
- `GET /api/webchat/messages?key=...&conversationId=...&since=...` polling endpoint. Tenant isolation por `Conversation.lead.projectId`.

**`WebChatChannelHandler`** ([`src/lib/channels/webchat/WebChatChannelHandler.ts`](../src/lib/channels/webchat/WebChatChannelHandler.ts)) implementa `IChannelHandler`:
- `receive()`: debounce Redis NX 5s + concatena mensajes pendientes + llama `processAIResponse({ externalUserId: null, leadPhone: null })` para que el bloque "Step 8 Send to WhatsApp" sea skipeado. AI message persistido por el pipeline (paso db_save) y el widget lo recibe via polling.
- `send()`: para asesor manual desde dashboard. Persiste Message con `sender='human'`. Realtime broadcast viene en Fase 4.
- Skip si `lead.handoffMode === 'human'` o `lead.archivedAt` (mismo gate que WhatsApp).

**Pipeline AI agnostico:** parametro `whatsappId` en `processAIResponse()` renombrado a `externalUserId` (Fase 3.4). En WhatsApp es el numero de telefono; en WebChat es el `visitorId` del browser; en futuros canales es ID en la plataforma origen.

#### Widget bundle (Fase 3.5)

**Tech stack:** Vite + Vanilla TypeScript (sin framework — Preact descartado por overhead vs LOC). Shadow DOM mode `closed`. CSS inline via template literal. Output `kairo.js` = **23.6 KB raw / 7.8 KB gzip**.

**UX (estilo chatflow360):**
- **Bubble launcher:** pegado al borde derecho (right:0), pulse animation suave de "rebote", border-radius asimetrico (40px solo izquierda).
- **Hover-expand:** wrapper se expande mostrando "Tienes preguntas?" + CTA "Conversemos!" (configurable via `appearance.teaserTextEs/En` y `teaserCtaEs/En`). Click en cualquier parte abre el chat.
- **Window:** side-panel **full-height** pegado al borde derecho (420px desktop, 100vw mobile), animation slide horizontal.
- **Header:** gradient midnight + avatar 42px con online dot verde + curva de overlap con messages area.
- **Multi-instancia:** soporta `<script data-key="...">` multiples por pagina; cada bubble tiene su propio host con id `kairo-widget-<key>`.
- **Persistencia localStorage:** `kairo_visitor_id` (UUID), `kairo_conv_<key>`, `kairo_open_<key>`.
- **Bilingue es/en** con autodetect via `navigator.language` o `data-lang="es"`.
- **WebAudio beep** al recibir mensaje (configurable, default ON).
- **Modo preview** (`data-preview="true"`): no red, no localStorage, simula respuestas — para usar en `/settings/webchat` preview.

**Embed:**
```html
<script src="https://widget.kairoagent.com/kairo.js" data-key="<publicKey>" defer></script>
```

#### Settings UI `/settings/webchat` (Fase 3.6)

7 cards colapsables con sticky save bar:
1. **Apariencia** — 6 hex pickers (color del boton, fondo header, texto header, burbuja visitor/IA bg+text), select posicion bottom-right/left, forma circulo/cuadrado, URL del logo.
2. **Textos** — header titulo/subtitulo + teaser bilingue es/en.
3. **Preguntas sugeridas** — max 5, par textEs/textEn por item, drag-to-reorder.
4. **Comportamiento** — autoOpenDelay (0-60s), soundEnabled toggle, sessionTimeoutHours (1-24).
5. **Dominios autorizados** — lista editable de origins con validacion URL (vacio = permisivo en Fase 3 con warning).
6. **Codigo de instalacion** — read-only embed snippet con publicKey + copy button.
7. **Preview en vivo** — mock visual estatico (TODO Fase 3.5+: cargar bundle real con `data-preview="true"`).

Server action `saveWebChatConfig(projectId, config)` en [`src/lib/actions/project-channels.ts`](../src/lib/actions/project-channels.ts) valida con zod (regex hex/URL, max-length, max 5 starter questions, autoOpen 0-60, sessionTimeout 1-24). RBAC: super_admin / owner / admin.

Tipo `WebChatConfig` en [`src/lib/types/webchat-config.ts`](../src/lib/types/webchat-config.ts) (no en archivo `'use server'`, sigue Rule 12). `mergeWebChatConfig()` para backward-compat al agregar campos futuros.

#### Rename `/leads` → `/conversations` (Fase 3.7)

Decision #3 del plan multi-canal: la pagina actual muestra una conversacion por canal (Lead 1:1 Conversation hoy). El termino "Conversaciones" refleja con precision lo que el usuario ve, especialmente con multi-canal (WhatsApp + WebChat).

**Cambios:**
- `src/app/[locale]/(dashboard)/leads/` → `conversations/` (git mv).
- Componentes internos (`LeadsPageClient.tsx`) NO se renombran — el modelo BD se llama `Lead`, mantener nombres tecnicos consistentes.
- `next.config.ts` redirects: `/leads` → `/conversations` con status 307 (temporal). Cubre ambos locales (es/en) con y sin sub-paths.
- Sidebar nav item "leads" eliminado, "conversations" (MessageIcon) es el principal.
- `src/messages/{es,en}.json`: `leads.title` "Leads" → "Conversaciones" / "Conversations".

**Internamente NO cambia:** tabla BD `leads`, modelo Prisma `Lead`, componentes con prefijo `Lead*`, server actions en `lib/actions/leads.ts`, hooks `useLeadsQuery`. Estos siguen representando "una conversacion con un visitante por un canal especifico". En v0.26+ se agregara NUEVA tabla para vista CRM "Leads Unicos" (deduplicacion por email/telefono).

#### Visual launcher fixes durante QA

- Hydration mismatch en `ThemeContext` y `WorkspaceContext` (lectura de localStorage en `useState` initializer): patron `mounted` flag con useEffect post-mount.
- `tsconfig.json` excluye `widget/` (vite.config.ts requiere deps que solo viven en `widget/node_modules`).
- `vite.config.ts` del widget: `css.postcss: {}` deshabilita PostCSS autodiscovery (que cargaba `postcss.config.mjs` del root del repo).
- Widget shape mismatch entre frentes: payload `message: { type, text }` (no string), response `{ ok, conversationId, messageId }`.
- Widget polling timestamp con clock drift cliente↔server: removido `lastMessageAt = visitorMsg.createdAt` (client-time futurista hacia que polling excluyera mensajes server-created intermedios).

#### Validacion E2E prod

- WhatsApp E&Z: pipeline AI sigue funcionando identico (validado en cada commit).
- Widget embebido en HTML local apuntando a `https://widget.kairoagent.com` + `https://app.kairoagent.com`: visitor envia → debounce 5s → Kaira (agente Disruptivo) responde via polling. Sin duplicados (dedup por `local-` ID match).
- `/es/leads` y `/en/leads` → 307 → `/conversations`.

#### Pendiente Fase 4 (1-2 semanas, futuro)

- Supabase Realtime via WebSocket directo (en lugar de polling 3s).
- Handoff humano webchat: asesor responde desde dashboard, llega <500ms al widget.
- Media upload visitor: signed URL → Supabase Storage `webchat-uploads/` → Vision/Whisper analysis.
- Allowed origins enforcement estricto (en Fase 3 es permisivo si la lista esta vacia).

---

> Versiones v0.25.0 y anteriores archivadas en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

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
