# KAIRO Widget

Bundle del widget WebChat embebible servido desde `widget.kairoagent.com`.

## Estado

**Scaffolding mínimo (Fase 3 pendiente).** El bundle real (Vite + Shadow DOM + Preact) se construye en Fase 3.5 según [docs/plans/MULTI-CHANNEL-IMPL.md](../docs/plans/MULTI-CHANNEL-IMPL.md).

Por ahora `npm run build` sólo copia `index.html` a `dist/` para que el deploy de Vercel funcione y el subdominio responda con un placeholder.

## Vercel project

- **Project name:** `kairo-widget`
- **Root directory:** `widget`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Framework preset:** Other (no Vite todavía)
- **Custom domain:** `widget.kairoagent.com`

Es un proyecto Vercel separado del dashboard (`kairo` → `app.kairoagent.com`) para aislar bandwidth, cache y deploy lifecycle.

## Próximos pasos (Fase 3.5)

1. Migrar a Vite IIFE bundle (`kairo.js`).
2. Implementar Shadow DOM (mode closed).
3. UI: Bubble + Window + Messages + Composer.
4. Transport: polling primero, Realtime en Fase 4.
5. Multi-widget por página soportado.
6. Persistencia localStorage (`kairo_visitor_id`, `kairo_conv_<publicKey>`).

## Embed esperado

```html
<script
  src="https://widget.kairoagent.com/kairo.js"
  data-key="<publicKey>"
  defer
></script>
```
