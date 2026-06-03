# scripts/ — Utilidades de mantenimiento y setup

Scripts de operación (NO forman parte del runtime de la app). Se corren a mano cuando hace falta
revisar/actualizar datos o aplicar SQL de infraestructura.

> **Requisito:** Node 20+ (el CLI de `tsx` usa sintaxis que rompe en Node <16.11). Verifica con `node --version`.
> Los `.ts` se ejecutan con `npx tsx scripts/<archivo>.ts`. Cargan `.env.local` y `.env` automáticamente.

---

## Kit de Knowledge Base (KB) de agentes

Herramientas para **revisar y actualizar la KB de cualquier organización/agente** cuando se pide.
Los de lectura son genéricos (reciben IDs por argumento); los de escritura son **templates** que se
copian y editan por job (el contenido cambia cada vez).

> **OJO — Duplicación de info:** La misma data de negocio (precios, fechas, FAQs) vive **duplicada** en
> dos lugares: la KB estructurada (`agent_knowledge`) **y** los campos del agente
> (`systemInstructions` / `promptStructure` / `reEngagementConfig`). Si actualizas una, actualiza la
> otra o el agente se contradice. Ver memoria `FEEDBACK-AGENT-INFO-DUPLICATION`.

### Lectura (genéricos, solo consultan)

| Script | Qué hace | Uso |
|--------|----------|-----|
| `check-kb.ts` | Vuelca la KB (`agent_knowledge`) de un agente: categorías, contenido, `structured_data` | `npx tsx scripts/check-kb.ts --org <orgId> [--match event]`  ·  `--agent <id> --project <id>` |
| `check-instructions.ts` | Vuelca instrucciones/prompt del agente: `description`, `systemInstructions`, `promptStructure`, `reEngagementConfig`, `formConfig` | `npx tsx scripts/check-instructions.ts --agent <agentId>` |

`check-kb --org <id>` descubre los proyectos/agentes de la org y marca el agente activo. Útil para
sacar los IDs antes de actualizar. `--match <regex>` filtra agentes por nombre (ej. `--match event`).

### Escritura (TEMPLATES — copiar y editar por job)

| Template | Qué hace | Flujo |
|----------|----------|-------|
| `update-kb.example.ts` | Reescribe KB estructurada (`pricing`/`faqs`): valida con zod → genera embedding → `insert_agent_knowledge` RPC (upsert por category) | copiar a `_tmp-update-kb.ts`, editar **ZONA DE EDICIÓN** (IDs + payload), correr, verificar con `check-kb`, borrar tmp |
| `update-instructions.example.ts` | Actualiza instrucciones por **reemplazos exactos** de texto en los 3 campos del prompt | copiar a `_tmp-update-instructions.ts`, sacar texto exacto con `check-instructions`, editar `REPLACEMENTS`, correr, borrar tmp |

Los `.example.ts` llevan como contenido de ejemplo el evento E&Z "Despertar de Conciencia" (referencia real).
Nunca se corren directo: siempre se copia a un `_tmp-*.ts` (gitignorable) y se edita.

---

## Utilidades puntuales

| Script | Qué hace |
|--------|----------|
| `reset-user-password.ts` | Resetea la contraseña de un usuario (admin auth). Editar el email/clave dentro |
| `check-marcos2.ts` | Debug de un lead específico (firstName/formData/mensajes). One-off, hardcoded lead id |
| `check-no-emoji.sh` | Verifica ausencia de emojis (regla KAIRO: usar SVG icons, no emojis) |

---

## SQL de infraestructura (correr en Supabase SQL Editor)

> **Regla crítica:** NUNCA `prisma db push` en este proyecto (borraría `agent_knowledge`/pgvector).
> Cambios no-Prisma = SQL directo. Ver [../docs/DATABASE-MIGRATIONS.md](../docs/DATABASE-MIGRATIONS.md).

| Archivo | Propósito |
|---------|-----------|
| `setup-rag-complete.sql` | Setup completo RAG/pgvector + `agent_knowledge` (recovery base) |
| `create-{insert,search,list,delete}-knowledge-function.sql` | RPCs SECURITY DEFINER de la KB |
| `enable-rls-all-tables.sql` · `rls-all-tables-policies.sql` | Habilitar RLS + políticas en todas las tablas |
| `rls-messages-realtime.sql` | RLS para mensajes vía Realtime |
| `secure-storage-rls.sql` | RLS de Supabase Storage |
| `setup-agent-media.sql` · `setup-agent-video.sql` · `setup-fixed-event-media.sql` | Setup de media de agentes (imágenes/videos) |
| `update-agent-media-file-rpc.sql` | RPC para reemplazo de archivo de media |
| `pg-cron-followup-notifications.sql` | Cron `pg_cron` + `pg_net` de notificaciones de follow-up |
