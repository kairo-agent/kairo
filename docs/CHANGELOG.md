# KAIRO - Changelog

> Solo se mantienen las ultimas 5 versiones. Versiones anteriores en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

---

## [0.27.6] - 2026-05-29

### WebChat widget: la config de apariencia ahora se refleja de verdad

Tres fixes al contrato `resolveAppearance` ↔ widget (el endpoint enviaba/leia campos en lugares que no coincidian con lo que persiste el form). Todo server-side + `widget/`; **WhatsApp intacto**.

- **Logo no se renderizaba** (`2cc2d72`): el widget lee `appearance.bubbleLogoUrl` pero el form persiste `appearance.logoUrl` y el endpoint solo enviaba `logoUrl` → caia siempre al icono default. Fix: `resolveAppearance` mapea `bubbleLogoUrl = logoUrl`.
- **Textos/teaser/preguntas/position no se aplicaban** (`ee1b7a4`): `resolveAppearance` leia los textos de `cfg.appearance.*` pero el form los guarda en `cfg.texts.*` y las preguntas en `cfg.starterQuestions` (top-level) → el widget mostraba siempre los defaults. Fix: lee de las ubicaciones canonicas (fallback legacy + defaults), envia `headerSubtitleEs/En` (antes nunca se enviaba) y mapea `position` `bottom-right|bottom-left` → `right|left` (antes `bottom-left` renderizaba a la derecha). Nuevos tipos `WebChatTextsConfig` + `texts`/`starterQuestions` en `WebChatChannelConfig`.
- **"Forma del boton" (circle/square)** (`155151d`): el widget renderizaba siempre circulo (border-radius fijo 50%) ignorando `bubbleShape`. Fix: `resolveStyleVars` deriva `bubbleRadius` (square → 16px, circle → 50%) aplicado a `.k-bubble` + logo.

Patron recurrente de esta sesion (mismo que `allowedOrigins` en v0.27.4): el contrato entre el form/config canonico y lo que el widget/endpoint leen habia divergido. El preview del dashboard ya leia de las ubicaciones correctas, asi que ahora preview = produccion.

---

## [0.27.5] - 2026-05-29

### WebChat widget: persistencia de sesion + contraste automatico (YIQ)

Cuatro mejoras al widget embebible (todas en `widget/` + un par de archivos de Settings; **WhatsApp y backend intactos**).

**1. Recarga de historial tras refresh (bug).** Al recargar la pagina, el chat aparecia vacio aunque el backend mantenia la conversacion. Causa: en cold boot se restauraba `conversationId`+`lastMessageAt` pero el unico fetch era `pollMessages(since=lastMessageAt)` → 0 mensajes. Fix: flag `coldBoot` que en el primer poll usa `since=sessionStartedAt` (`null` = todo el historial) para recargar el transcript visible.

**2. Timeout de sesion configurable.** Viene de `sessionTimeoutHours` en `/settings/webchat` (default **2h**, rango 1-24). Dentro de la ventana: restaura y muestra el historial. Pasada la inactividad: arranca una sesion **visual** nueva (nuevo `sessionId`, oculta el historial previo usando el ultimo mensaje como frontera — timestamp real del server, evita clock-drift). El backend sigue siendo el mismo lead/conversacion (mapeado por `visitorId`); conversaciones separadas en el dashboard = pendiente (requiere schema). Limpiar localStorage / incognito sí genera lead+conversacion nuevos (nuevo `visitorId`).

**3. Contraste automatico YIQ en iconos y boton de enviar.** Nuevo `getContrastColor(hex)` (formula YIQ del estandar NTSC: `Y=(R*299+G*587+B*114)/1000`, umbral 128). El icono de la burbuja y el del boton de enviar eligen claro/oscuro segun la luma del fondo. Ademas el boton de enviar ahora usa `bubbleColor` por default (antes caia al cyan de KAIRO, ignorando el color de marca configurado).

**4. Header con YIQ + se quito "Texto del header".** El texto del header se perdia con fondos claros (blanco fijo). Ahora se calcula con YIQ desde `headerBgColor`. Se removio el campo "Texto del header" de Settings (era redundante y no funcionaba); `headerTextColor` queda `@deprecated` en tipo/schema para no romper configs guardadas. `WidgetPreview` sincronizado con el widget real (antes usaba `headerTextColor` hasta para el icono de la burbuja).

Commits: `222dfc7` (sesion) → `e6d6fa4` (YIQ burbuja/boton) → `2a5e01c` (YIQ header + limpieza). Bundle widget: 38.02 KB / 12.03 KB gzip.

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

> Versiones v0.27.1 y anteriores archivadas en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md).

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
