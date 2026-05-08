# Plan: Leads Únicos (vista CRM unificada)

> **Version objetivo:** v0.27+ (post Fase 4)
> **Estado:** Pendiente — diseno conceptual cerrado con Leo el 2026-05-07
> **Pre-requisito:** Fase 4 multi-canal completa (varios canales activos generando data real)

## Resumen

Crear una **NUEVA pagina** `/leads` (NO renombrar la actual `/conversations`) que muestre **personas unicas** deduplicadas por email/telefono. Una persona puede tener N conversaciones cross-canal (WhatsApp + WebChat + futuros). Vista CRM agregada.

## Nomenclatura critica

| UI label | BD table | Significado |
|----------|----------|-------------|
| "Conversaciones" (existe v0.25.0) | `leads` (existente) | Una conversacion con un visitante por un canal especifico |
| **"Leads Unicos"** (NUEVO) | **`unique_leads`** o **`personas`** (NUEVA tabla) | Persona deduplicada por email/telefono que puede tener N conversaciones cross-canal |

**NUNCA** renombrar la tabla `leads` existente — eso seria refactor masivo. La tabla `leads` permanece como esta y representa conversaciones. La nueva tabla agrega el concepto de "Persona".

Memoria de la decision: [NOMENCLATURE-LEADS-CONVERSATIONS.md](C:/Users/josel/.claude/projects/d--KAIRO-kairo-dashboard/memory/NOMENCLATURE-LEADS-CONVERSATIONS.md).

## Tareas

### Schema

- Crear tabla `unique_leads` (o `personas`) con campos:
  - `id, projectId, firstName, lastName, email (unique en projectId), phone (unique en projectId), createdAt, updatedAt`
  - `mergedFrom: Json` — array de leadIds que se fusionaron en esta persona
- Foreign key en `Lead`: `Lead.uniqueLeadId String?` (nullable hasta que se haga el merge).

### Merge lazy

- Cuando el LLM captura email o telefono via form conversacional:
  1. Buscar `unique_leads` existente con ese email/phone en mismo projectId.
  2. Si existe → `Lead.uniqueLeadId = found.id` (linkear).
  3. Si no existe → crear `unique_lead` nuevo y linkear.
- Cuando un visitor anonimo hace una segunda conversacion en otro canal pero captura mismo email, se vinculan automaticamente.

### Pagina `/leads` (NUEVA)

- Ruta nueva en `src/app/[locale]/(dashboard)/leads/page.tsx`. No reusa el redirect de v0.25 a `/conversations` — el redirect en `next.config.ts` se ELIMINA cuando se cree la pagina nueva (browsers no cachean 307, transicion segura).
- Vista por persona:
  - Avatar + nombre + email/phone primario.
  - Conversaciones agregadas (de todos los canales) con badge del canal.
  - Status agregado: el "peor" status entre todas las conversaciones.
  - Total mensajes, ultima actividad, valor estimado.
- Filtros: canal, status, temperatura, asignado, source, fecha.
- Click en persona → vista detalle con todas las conversaciones expandibles.

### Sidebar

- Item nuevo "Leads Unicos" (UsersIcon, sub-de "Conversaciones" o entry separada).

### Server actions

- `getUniqueLeads(filters)`: agrupa Leads por uniqueLeadId, retorna data agregada.
- `mergeUniqueLeads(idsToMerge)`: super_admin manual merge (fix casos donde el matching automatico fallo).

### Estimado

- Schema + migration: 0.5d
- Merge lazy en form conversacional: 1d
- Pagina /leads (UI + filtros): 2d
- Server actions agregadas: 1d
- QA: 1d
- **Total: ~5-6 dias**

## Referencias

- Decision #3 + Fase 5 del plan original: [docs/done/MULTI-CHANNEL-WEBCHAT-V0.25.md](../done/MULTI-CHANNEL-WEBCHAT-V0.25.md)
- Memory: [NOMENCLATURE-LEADS-CONVERSATIONS.md](C:/Users/josel/.claude/projects/d--KAIRO-kairo-dashboard/memory/NOMENCLATURE-LEADS-CONVERSATIONS.md)
