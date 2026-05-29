# KAIRO - Changelog

> Solo se mantienen las ultimas 5 versiones. Versiones anteriores en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

---

## [0.27.4] - 2026-05-29

### Corregido — WebChat CORS gate roto: allowedOrigins nunca se leia

**Sintoma (prod):** widget embebido en `https://leon33.com` no respondia. El log de Vercel mostraba `[Webchat webhook] origin not allowed { origin: 'https://leon33.com', allowedOrigins: [], publicKey: '...' }` **aunque el dominio estaba correctamente guardado** en la config del canal.

**Causa raiz:** desajuste entre el path de escritura y el de lectura de `allowedOrigins`.

- **Escritura** (formulario `/settings/webchat` + `saveWebChatConfig` + tipo canonico `WebChatConfig`): persiste `allowedOrigins` en la **raiz** de `config`.
- **Lectura** (`getAllowedOrigins` en `public-helpers.ts`): leia `config.behavior.allowedOrigins` (path heredado de un refactor donde el campo se movio a la raiz sin actualizar el helper).

Como `behavior.allowedOrigins` siempre era `undefined`, `getAllowedOrigins` devolvia `[]`. Combinado con el CORS strict de v0.26.0 (Sub-fase 4.E: lista vacia bloquea todo), **bloqueaba todos los requests cross-origin del widget**, en los 4 endpoints publicos (`config`, `webhooks/webchat`, `webchat/messages`, `upload-token`) por compartir el helper.

**Fix** (`src/lib/channels/webchat/public-helpers.ts`):
- `getAllowedOrigins` lee `cfg.allowedOrigins` (raiz) con fallback defensivo a `cfg.behavior?.allowedOrigins`.
- `WebChatChannelConfig`: agregado `allowedOrigins?: string[]` a nivel raiz.
- Comentario obsoleto corregido en `api/widget/config/route.ts`.

**Validacion:** confirmado en BD que `config.allowedOrigins = ["https://leon33.com"]` (raiz) y `behavior.allowedOrigins = undefined`. Unico canal webchat existente (Disruptivo) → sin migracion de datos. Aislado a webchat: WhatsApp y futuros canales usan filas/config por-canal separadas. Probado en prod tras deploy: el agente responde y el warning desaparece. Commit `13a6fe3`.

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

**Patch follow-up: ExpandableTextarea (fullscreen) en FAQs + Precios (`b1d1385`):**

Tres `<textarea>` raw del knowledge base que carecian del boton "Expandir" (modal 3xl con min-h 60vh) se migraron al componente `ExpandableTextarea` existente, alineandolos con el resto de textareas largos de la app:

- `src/components/knowledge/FAQsForm.tsx`: campo "Respuesta" (maxLength=1000, `modalTitle` dinamico tipo `"Respuesta - Pregunta 3"`)
- `src/components/knowledge/PricingForm.tsx`: campo "Descripcion del servicio" (maxLength=500)
- `src/components/knowledge/PricingForm.tsx`: campo "Notas adicionales" (maxLength=500)

Los `<CharCounter>` explicitos de esos tres campos se eliminaron porque `ExpandableTextarea` ya los renderiza automaticamente (mismo bug-pattern que se cazo en `InstructionsTab` antes).

**Sin migracion DB. Sin cambios de API.**

**Commits**: `3e798d6` (CharCounter component + integracion automatica) → `6740090` (remove duplicate counters InstructionsTab) → `1c34eb9` (FormTab field-label) → `72c2c7f` (knowledge content maxLength) → `b1d1385` (ExpandableTextarea en FAQs + Precios).

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

> Versiones v0.26.0 y anteriores archivadas en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

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
