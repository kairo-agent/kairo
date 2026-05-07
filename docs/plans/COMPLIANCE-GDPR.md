# Plan: Compliance / GDPR / Borrado de Datos del Cliente

> **Estado:** Pendiente, sin priorizar
> **Scope:** Fuera del plan multi-canal ([MULTI-CHANNEL-WEBCHAT.md](MULTI-CHANNEL-WEBCHAT.md))
> **Ultima revision:** 2026-05-06

---

## Contexto

Identificado durante planificacion del plan multi-canal: si un cliente solicita borrado total de sus datos por confidencialidad o cumplimiento normativo (GDPR, CCPA, ley peruana 29733 de proteccion de datos personales), KAIRO debe poder responder a esa solicitud de forma auditable y completa.

Este NO es lo mismo que "Eliminar/Resetear canal" (decision #23 del plan multi-canal), que solo borra la fila `ProjectChannel` pero preserva leads/conversations historicos.

---

## Estado Actual

KAIRO ya tiene server actions de eliminacion en `src/lib/actions/admin.ts`:
- `deleteOrganization(orgId)`
- `deleteProject(projectId)`
- `deleteUser(userId)`

**Pendiente revisar:**
1. ¿Hacen cascade real en BD (borran leads, conversations, messages, agent_knowledge, project_secrets, project_channels, agent_media, lead_form_data, push_subscriptions, etc.) o solo soft delete?
2. ¿Existe audit log de quien ejecuto el borrado y cuando?
3. ¿Hay confirmacion doble en UI?
4. ¿Hay periodo de gracia (soft delete -> purga real despues de N dias)?

---

## Requisitos Funcionales (cuando se implemente)

### 1. Borrado total por proyecto
- Acceso: super_admin only
- Comportamiento:
  - Borrar en cascada todas las tablas asociadas al `projectId`:
    - `leads` (con `conversations`, `messages`, `lead_form_data`)
    - `agent_knowledge` (RAG, pgvector)
    - `agent_media`
    - `project_channels`
    - `project_secrets`
    - `project_members`
    - `push_subscriptions` asociadas
    - Storage: archivos en `incoming/{projectId}/`, `agent-media/{projectId}/`, `webchat-uploads/{projectId}/`
- Confirmacion doble: escribir el nombre del proyecto para confirmar
- Audit log: tabla `data_deletion_log` con `{ deletedAt, deletedBy, scope: 'project', targetId, targetName }`
- Periodo de gracia: 30 dias en soft-delete (campo `deletedAt`), despues purga real via cron

### 2. Borrado total por organizacion
- Igual que (1) pero para todos los proyectos de la org
- Adicional: borrar `organizations`, `organization_members`

### 3. Exportacion previa al borrado
- Antes de borrar, super_admin puede exportar todos los datos del proyecto/org a JSON/CSV (zip).
- Util para entregar al cliente como parte del cumplimiento ("aqui tienes tu copia, ahora borramos").

### 4. Borrado de un Lead individual (right to be forgotten)
- Acceso: super_admin (en v1) o ADMIN del proyecto (en v2)
- Borra: `lead`, `conversations`, `messages`, `lead_form_data`, archivos en Storage referenciados.
- Audit log con el motivo

---

## Implementacion (cuando se priorice)

### Fase A: Auditoria de cascadas existentes
- Mapear todas las foreign keys con `onDelete: Cascade` vs `onDelete: SetNull` vs `onDelete: Restrict`.
- Identificar huerfanos potenciales (Storage files sin referencia en BD).
- Documentar el mapa en `docs/DATA-LIFECYCLE.md`.

### Fase B: Schema audit_log + soft delete
- Tabla `data_deletion_log`:
  ```prisma
  model DataDeletionLog {
    id          String   @id @default(cuid())
    deletedAt   DateTime @default(now())
    deletedBy   String   // userId
    scope       String   // 'project' | 'organization' | 'lead' | 'user'
    targetId    String
    targetName  String
    reason      String?
    purgedAt    DateTime? // null = en periodo de gracia
  }
  ```
- Soft delete: agregar `deletedAt` a `Project`, `Organization`, `Lead`.
- Todas las queries existentes deben filtrar `WHERE deletedAt IS NULL`.

### Fase C: UI super_admin
- Modal "Eliminar proyecto / organizacion" con:
  - Resumen de lo que se va a borrar (counts: X leads, Y conversations, Z MB en Storage)
  - Boton "Exportar datos antes de eliminar"
  - Input "Escribe el nombre exacto para confirmar"
  - Boton "Eliminar definitivamente"
- Lista de "Eliminaciones pendientes de purga" (en periodo de gracia)
  - Boton "Restaurar" (revierte el soft delete)
  - Boton "Purgar ahora" (no esperar al cron)

### Fase D: Cron purga real
- `src/app/api/cron/purge-deleted/route.ts`:
  - Corre diario.
  - Busca `data_deletion_log` con `deletedAt < NOW() - 30 days AND purgedAt IS NULL`.
  - Hace hard delete real de las filas y archivos en Storage.
  - Marca `purgedAt = NOW()`.

### Fase E: Compliance documentacion
- Pagina publica `/legal/data-policy` con:
  - Que datos guardamos
  - Cuanto tiempo (retention policy)
  - Como solicitar borrado
- DPA (Data Processing Agreement) template para clientes B2B.

---

## Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Borrado accidental | Confirmacion doble + periodo de gracia + audit log |
| Cliente pide borrado pero queremos data agregada anonima para metricas | Antes de purgar, mover counts a tabla `aggregated_metrics` sin PII |
| Storage huerfano post-borrado | Cron de cleanup que cruza Storage con BD |
| Cumplimiento normativo distinto por pais | Documentar en `/legal/data-policy` por jurisdiccion |

---

## Cuando Priorizar

- Si KAIRO empieza a operar fuera de Peru (UE, USA, Canada) -> GDPR/CCPA obligatorio.
- Si el primer cliente enterprise solicita DPA -> Fase B + C minimo.
- Si recibimos primera solicitud de borrado real -> implementar Fase A + soluciono ad-hoc, despues Fase B+C+D para automatizar.

**No bloquea ninguna fase del plan multi-canal.** Es un plan paralelo cuando el negocio lo requiera.
