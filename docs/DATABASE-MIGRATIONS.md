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

### ✅ PERMITIDOS

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

### ⛔ PROHIBIDO

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
