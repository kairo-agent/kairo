# Trabajo nocturno — sesion 2026-05-07

> Documento de trazabilidad de los cambios que avancé en local mientras Leo descansaba.
> **TODO commiteado localmente, CERO push, CERO SQL ejecutado.**
>
> Para review al despertar. Cuando estés OK con los cambios:
> 1. Ejecutar SQL preparado (sección "SQL pendiente")
> 2. Marcar migración aplicada con prisma migrate resolve
> 3. Push de los 6 commits a main
> 4. Smoke test E2E con WhatsApp

## Estado al iniciar la sesion nocturna

Fase 1 multi-canal completa (8 subfases pusheadas y validadas con E&Z).
Último commit en origin/main: `660d229` (Fase 1.8 — registry + ProjectChannel validation).

## Resumen de commits hechos en local (sin push)

```
8837540 feat: scaffold /settings/whatsapp + /settings/webchat routes (Fase 2 inicio)
e4534cc docs: drop n8n references from SECURITY.md (Fase 1.7b)
f127192 chore: schema drops n8n columns + migration ready (Fase 1.7b)
c270ee3 chore: clean n8n references from i18n strings + comments (Fase 1.7b)
9543d02 chore: remove n8n webhook UI from admin modal (Fase 1.7b cleanup)
3274df7 chore: remove 5 n8n legacy endpoints (Fase 1.7b cleanup)
[origin/main: 660d229]
```

---

## Trabajo realizado

### Fase 1.7b — Cleanup n8n legacy completo (5 commits)

**Auditoría:** 12 archivos con referencias a n8n. Verifiqué que ningún código interno
los importa o llama via fetch (solo n8n los consumía).

**Eliminado:**
- 5 endpoints HTTP legacy: `/api/webhooks/n8n`, `/api/ai/respond`,
  `/api/rag/search`, `/api/audio/transcribe`, `/api/messages/confirm`
  (~1700 líneas eliminadas total)
- Tab "Webhooks" del `ProjectSettingsModal` admin + WebhookIcon
- Parámetro `n8nWebhookUrl` de `updateProject()` server action
- Strings i18n: `settings.webhooksDescription`, `settings.webhookUrlHelp`
- Comments en `process-ai-response.ts`, `build-system-prompt.ts`,
  `actions/messages.ts` (referencias a "previously done by n8n", etc.)
- Sección N8N_CALLBACK_SECRET de `docs/SECURITY.md`
- Schema: `Project.n8nWebhookUrl` y `Project.n8nApiKey` (en schema.prisma)

**Build verification:** ok después de cada commit. 35 → 30 endpoints API.

### Fase 2 — Scaffolding inicial (1 commit)

**Nuevas rutas (placeholders informativos):**
- `/settings/whatsapp/page.tsx` — muestra estado del canal (Activo / Pausado / No habilitado)
  + lista de configs futuras. Sin switch (decision #18).
- `/settings/webchat/page.tsx` — toggle "Mostrar / Ocultar" funcional (decision #17)
  + lista de configs futuras (Fase 3).

**Nueva server action `src/lib/actions/project-channels.ts`:**
- `getProjectChannelInfo(projectId, channel)`: lectura del estado.
- `setChannelEnabled(projectId, channel, enabled)`: toggle owner/admin (cambia `enabled`).

**Tipo `ProjectChannelInfo`** en `src/lib/types/project-channel.ts` (regla KAIRO:
archivos 'use server' solo exportan async functions).

**Build verification:** ok. Las rutas accesibles via URL directa
(`https://app.kairoagent.com/es/settings/whatsapp` y `/webchat`).

---

## SQL pendiente — ejecutar en Supabase SQL Editor cuando despiertes

```sql
-- Drop columnas legacy de n8n en tabla projects.
-- Pre-requisito: el codigo ya no las referencia (verificado en commits Fase 1.7b).
-- Schema.prisma ya las removio. Esta SQL solo cierra la sincronizacion.
-- Operacion idempotente con IF EXISTS por seguridad.

ALTER TABLE "projects" DROP COLUMN IF EXISTS "n8nWebhookUrl";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "n8nApiKey";
```

**Después de ejecutar el SQL:**
```bash
npx prisma migrate resolve --applied 20260507_drop_project_n8n_columns
```

Si las columnas tenían datos, se perderán — pero verificamos que estaban null
en ambos proyectos activos (Disruptivo y E&Z) antes de iniciar la sesión.

---

## Lo que pendiente para una sesion guiada con Leo (NO toqué)

### Sidebar render condicional de canales
Mostrar `WhatsApp` y `Web` como subitems solo si `ProjectChannel.provisioned=true`.
Requiere context async fetch que mejor revisar visualmente contigo en localhost:3005.

### Mover tab `reengagement` de `SettingsPageClient.tsx` → `WhatsAppSettingsClient`
Cambio invasivo (requiere preservar logica de save + load + state). Mejor con tu
input visual + smoke test.

### ProjectSettingsModal extension (super_admin tab "Canales")
Para que tú puedas activar/desactivar/eliminar canales por proyecto. Decision #16:
3 acciones (Activar / Desactivar / Eliminar-Resetear).

### Drop column `Project.whatsappPhoneNumber`
Decision del plan original Fase 2.4. Pendiente porque aún no migramos el display
del número de teléfono a `ProjectChannel.config.phoneNumberDisplay`.

---

## QA exhaustivo necesario después del SQL

Cuando ejecutes el SQL:

1. **Verificación post-schema:**
   ```bash
   # Yo correré:
   npx prisma db pull --print  # solo print, no aplicar
   # Confirmar que n8nWebhookUrl, n8nApiKey ya no aparecen en projects.
   ```

2. **Build verification:**
   ```bash
   npm run build
   ```

3. **Smoke test E&Z WhatsApp:**
   - Tú envías mensaje WhatsApp de prueba
   - Yo verifico runtime logs + lead en BD
   - Confirmo que pipeline AI funciona idéntico

4. **Sanity check páginas nuevas:**
   - Visitar `localhost:3005/es/settings/whatsapp` (debe mostrar estado "Activo")
   - Visitar `localhost:3005/es/settings/webchat` (debe mostrar "No habilitado"
     porque ProjectChannel(webchat) no existe en E&Z aún)

---

## Cuando hagas push

Los 6 commits son seguros para push (build verificado entre cada uno):
- 5 commits de cleanup n8n: cero impacto en runtime (eliminan código sin uso)
- 1 commit de scaffolding settings: agrega 2 rutas accesibles, no afecta lo existente

Riesgo bajo. Si después del push algo se rompe, el rollback es simple:
```bash
git revert HEAD~5..HEAD  # revierte los 6 commits
git push
```
