# KAIRO Widget

Bundle del widget WebChat embebible servido desde `widget.kairoagent.com`.

## Estado

**Bundle real (Fase 3.5 — v0.25.0)**: Vite + vanilla TypeScript + Shadow DOM `closed`.
`npm run build` produce `dist/kairo.js` (IIFE, CSS inline) y copia `index.html` a `dist/` para el landing del subdominio.

### Stack del bundle

- **Vite** (lib mode IIFE) — un solo `kairo.js` self-contained.
- **Vanilla TypeScript** (no React/Preact) — bundle pequeño (<50KB gzip).
- **Shadow DOM mode `closed`** — CSS y JS aislados del sitio del cliente.
- **CSS inline** vía template literal (`src/styles.ts`).
- **Multi-instancia** — soporta múltiples `<script data-key>` por página.

## Vercel project

- **Project name:** `kairo-widget`
- **Root directory:** `widget`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Framework preset:** Vite
- **Custom domain:** `widget.kairoagent.com`

Es un proyecto Vercel separado del dashboard (`kairo` → `app.kairoagent.com`) para aislar bandwidth, cache y deploy lifecycle.

## Embed

```html
<script
  src="https://widget.kairoagent.com/kairo.js"
  data-key="<publicKey>"
  defer
></script>
```

### Atributos opcionales

- `data-lang="es"` o `data-lang="en"` — fuerza idioma (default: autodetect via `navigator.language`).
- `data-preview="true"` — sandbox: no persiste localStorage, no envía al backend, simula respuestas (usado en `/settings/webchat` preview).
- `data-api="https://..."` — override del API base (solo testing local).

## Endpoints backend que consume

- `GET  https://app.kairoagent.com/api/widget/config?key=<publicKey>` — appearance + behavior.
- `POST https://app.kairoagent.com/api/webhooks/webchat` — enviar mensaje de visitante.
- `GET  https://app.kairoagent.com/api/webchat/messages?key=...&conversationId=...&since=...` — polling (cada 3s mientras la ventana está abierta).

## API global runtime

Una vez cargado, el bundle expone `window.Kairo`:

```ts
window.Kairo.reset('<publicKey>'); // limpia conversación + cierra ventana
window.Kairo.boot();                // re-escanea <script data-key> y monta widgets nuevos
```

## Persistencia (localStorage)

- `kairo_visitor_id` — UUID v4 generado la primera vez, reutilizado siempre.
- `kairo_conv_<publicKey>` — `{ conversationId, sessionId, lastMessageAt }`.
- `kairo_open_<publicKey>` — `'1'` si la ventana está abierta (restaura estado al volver al sitio).
