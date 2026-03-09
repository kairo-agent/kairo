# Guía de Migraciones de Base de Datos

> **CRÍTICO**: Este documento contiene reglas obligatorias para evitar pérdida de datos en producción.

---

## Tablas del Proyecto

KAIRO tiene dos tipos de tablas:

### 1. Tablas Prisma (schema.prisma)

Manejadas por Prisma ORM. Cambios se hacen editando `prisma/schema.prisma`.

| Tabla | Modelo Prisma |
|-------|---------------|
| `organizations` | Organization |
| `organization_members` | OrganizationMember |
| `projects` | Project |
| `project_members` | ProjectMember |
| `users` | User |
| `leads` | Lead |
| `ai_agents` | AIAgent |
| `notes` | Note |
| `activities` | Activity |
| `conversations` | Conversation |
| `messages` | Message |
| `project_secrets` | ProjectSecret |
| `secret_access_logs` | SecretAccessLog |

### 2. Tablas No-Prisma (SQL puro)

Creadas directamente en Supabase porque usan tipos que Prisma no soporta (ej: pgvector).

| Tabla | Propósito | Tipo especial | Script |
|-------|-----------|---------------|--------|
| `agent_knowledge` | RAG para agentes IA | `VECTOR(1536)` | `scripts/setup-rag-complete.sql` |

---

## Comandos Prisma

### [OK] PERMITIDOS

```bash
# Generar cliente Prisma después de cambios en schema
npx prisma generate

# Crear migración con SQL versionado (RECOMENDADO)
npx prisma migrate dev --name descripcion_del_cambio

# Aplicar migraciones pendientes en producción
npx prisma migrate deploy

# Ver estado de migraciones
npx prisma migrate status
```

### [FAIL] PROHIBIDO

```bash
# NUNCA USAR - Elimina tablas no-Prisma
npx prisma db push

# NUNCA USAR - Resetea toda la BD
npx prisma migrate reset
```

---

## Procedimientos

### Agregar campo a tabla Prisma existente

1. Editar `prisma/schema.prisma`
2. Ejecutar `npx prisma migrate dev --name add_campo_descripcion`
3. Revisar el SQL generado en `prisma/migrations/`
4. Commit del cambio + migración

**Ejemplo:**
```prisma
// prisma/schema.prisma
model Lead {
  // ... campos existentes
  summary         String?         @db.Text    // NUEVO
  summaryUpdatedAt DateTime?                  // NUEVO
}
```

```bash
npx prisma migrate dev --name add_lead_summary_fields
```

### Agregar índice a tabla Prisma

1. Agregar `@@index([campo])` en schema.prisma
2. Ejecutar `npx prisma migrate dev --name add_index_campo`

### Modificar tabla no-Prisma (agent_knowledge)

1. Escribir el SQL del cambio
2. Ejecutar en Supabase SQL Editor
3. Actualizar `scripts/setup-rag-complete.sql` con el cambio
4. Documentar en CHANGELOG.md

> **IMPORTANTE:** Todas las operaciones CRUD sobre `agent_knowledge` DEBEN usar RPCs SECURITY DEFINER.
> Las RLS policies referencian `pm.project_id` pero la columna real es `pm."projectId"` (camelCase de Prisma),
> lo que causa fallos silenciosos en queries directas con anon key.

**Ejemplo: Agregar columna**
```sql
-- Ejecutar en Supabase SQL Editor
ALTER TABLE agent_knowledge ADD COLUMN tags TEXT[];
```

```sql
-- Actualizar scripts/setup-rag-complete.sql
CREATE TABLE IF NOT EXISTS agent_knowledge (
  -- ... columnas existentes
  tags TEXT[],  -- NUEVO
);
```

### RPCs SECURITY DEFINER para agent_knowledge

Todas las funciones usan `SECURITY DEFINER` para bypassear RLS:

> **REGLA CRITICA:** TODAS las operaciones sobre `agent_knowledge` (INSERT, SELECT, DELETE, **SEARCH**) DEBEN usar RPCs SECURITY DEFINER. Nunca usar SECURITY INVOKER ni queries directas con anon key. Las RLS policies referencian `pm.project_id` pero la columna real es `pm."projectId"` (Prisma camelCase), causando fallos silenciosos que retornan 0 rows sin error.

| RPC | Security | Params | Retorna | Proposito |
|-----|----------|--------|---------|-----------|
| `insert_agent_knowledge` | DEFINER | 12 params (project_id, agent_id, title, content, source, source_url, metadata, chunk_index, embedding, created_by, category, structured_data) | `TABLE (id UUID)` | Insert con upsert atomico: DELETE existente por category + INSERT nuevo |
| `list_agent_knowledge` | DEFINER | agent_id, project_id | `TABLE (id, title, content, source, source_url, chunk_index, category, structured_data, created_at, updated_at)` | Listar todo el conocimiento de un agente |
| `delete_agent_knowledge` | DEFINER | knowledge_id | `INT` (count) | Eliminar entrada individual por ID |
| `delete_structured_knowledge` | DEFINER | agent_id, project_id, category | `INT` (count) | Eliminar conocimiento estructurado por categoria (protege free_text) |
| `search_agent_knowledge` | DEFINER | query_embedding, agent_id, project_id, match_threshold (default 0.35), match_count | `TABLE (id, content, title, source, similarity)` | Busqueda semantica por similitud vectorial. Threshold 0.35 (no 0.5 ni 0.7) |

**Migraciones SQL:**

| Archivo | Version | Cambio |
|---------|---------|--------|
| `20260306_add_prompt_structure/migration.sql` | v0.9.0 | `category VARCHAR(50)` + `structured_data JSONB` en agent_knowledge, indice unico |
| `20260306_update_insert_knowledge_rpc/migration.sql` | v0.9.0 | RPC actualizado con 12 params + upsert atomico |
| `20260306_update_list_knowledge_rpc/migration.sql` | v0.9.0 | RPC actualizado con category + structured_data |
| `20260306_delete_structured_knowledge_rpc/migration.sql` | v0.9.0 | Nuevo RPC delete por categoria |
| `20260309_fix_search_knowledge_rpc/migration.sql` | v0.9.1 | search_agent_knowledge: INVOKER -> DEFINER, threshold 0.7 -> 0.35, GRANT anon |

---

## Recuperación de Desastres

### Si `agent_knowledge` fue eliminada

1. Ir a Supabase Dashboard → SQL Editor
2. Ejecutar contenido de `scripts/setup-rag-complete.sql`
3. Verificar:
   ```sql
   SELECT * FROM information_schema.tables WHERE table_name = 'agent_knowledge';
   SELECT proname FROM pg_proc WHERE proname LIKE '%agent_knowledge%';
   ```
4. **Los datos previos se perdieron** - clientes deben re-subir conocimiento

### Si hay problemas con migraciones Prisma

1. Ver estado: `npx prisma migrate status`
2. Si hay migraciones fallidas, revisar `prisma/migrations/` para el SQL
3. Aplicar correcciones manualmente en Supabase si es necesario
4. Marcar migración como aplicada: `npx prisma migrate resolve --applied NOMBRE_MIGRACION`

---

## Checklist Pre-Migración

Antes de cualquier cambio de schema en producción:

- [ ] ¿El cambio afecta tablas Prisma o no-Prisma?
- [ ] ¿Se hizo backup de datos críticos?
- [ ] ¿El cambio es backwards-compatible? (no rompe código existente)
- [ ] ¿Se probó en desarrollo primero?
- [ ] ¿Se actualizó la documentación correspondiente?

---

## Referencias

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)
- Script RAG: `scripts/setup-rag-complete.sql`
