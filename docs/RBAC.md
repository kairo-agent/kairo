# KAIRO - Sistema de Roles y Permisos (RBAC)

> **Mantener actualizado:** Cada cambio en permisos, roles o acceso debe reflejarse aqui.

---

## Estructura de Roles (3 niveles)

### Nivel 1: Sistema (`User.systemRole`)

| Rol | Valor DB | Descripcion |
|-----|----------|-------------|
| Super Admin | `super_admin` | Administrador de la plataforma. Acceso total a todo. |
| Usuario | `user` | Todos los demas usuarios. Sus permisos dependen de org + proyecto. |

- Definido en: `prisma/schema.prisma` enum `SystemRole`
- Solo super_admin accede a `/admin` (middleware en `src/middleware.ts`)

### Nivel 2: Organizacion (`OrganizationMember.isOwner`)

| Flag | Significado |
|------|------------|
| `isOwner: true` | Propietario de la organizacion. **Pueden ser varios.** |
| `isOwner: false` | Miembro regular de la organizacion. |

- Definido en: `prisma/schema.prisma` modelo `OrganizationMember`
- Se asigna manualmente desde el panel admin (super_admin)
- No tiene enum propio: es un booleano en la tabla `organization_members`
- Un usuario puede ser owner de multiples organizaciones

### Nivel 3: Proyecto (`ProjectMember.role`)

| Rol | Nivel jerarquico | Traduccion UI |
|-----|:-----------------:|---------------|
| `admin` | 40 | Administrador |
| `manager` | 30 | Manager |
| `agent` | 20 | Asesor |
| `viewer` | 10 | Viewer |

- Definido en: `prisma/schema.prisma` enum `ProjectRole`
- Se asigna por proyecto (un usuario puede tener roles diferentes en proyectos diferentes)

---

## Effective Role (rol resuelto)

El sistema calcula un **rol efectivo** tomando el maximo de los 3 niveles:

```
effectiveRole = max(systemRole, orgOwnership, projectRole)
```

**Jerarquia completa:** `super_admin (60) > owner (50) > admin (40) > manager (30) > agent (20) > viewer (10)`

**Implementacion:** `src/lib/permissions.ts` funcion `getEffectiveRole()`

### Ejemplos

| Usuario | systemRole | isOwner | projectRole | Effective Role |
|---------|-----------|---------|-------------|----------------|
| Leo | super_admin | si | admin | **super_admin** (60) |
| Gustavo | user | si | admin | **owner** (50) |
| Lisset | user | no | agent | **agent** (20) |
| Kevin | user | no | agent | **agent** (20) |
| Auditor externo | user | no | viewer | **viewer** (10) |

---

## Matriz de Permisos

### Acciones sobre Leads

| Accion | viewer | agent | manager | admin | owner | super_admin |
|--------|:------:|:-----:|:-------:|:-----:|:-----:|:-----------:|
| Ver leads | Si | Si | Si | Si | Si | Si |
| Trabajar su lead asignado | No | Si | Si | Si | Si | Si |
| Tomar lead sin asignar | No | Si | Si | Si | Si | Si |
| Reasignar leads a otros | No | No | Si | Si | Si | Si |
| Trabajar lead de otro usuario | No | No | No | Si | Si | Si |
| Exportar Excel | No | No | No | Si | Si | Si |
| Descartar/Recuperar leads | No | No | No | Si | Si | Si |

### Acciones sobre Proyecto

| Accion | viewer | agent | manager | admin | owner | super_admin |
|--------|:------:|:-----:|:-------:|:-----:|:-----:|:-----------:|
| Ver settings/KB | No | No | No | Si | Si | Si |
| Editar settings/KB | No | No | No | Si | Si | Si |
| Gestionar agentes IA | No | No | Si | Si | Si | Si |
| Gestionar form templates | No | No | Si | Si | Si | Si |
| Ver sidebar "Configuracion" | No | No | Si | Si | Si | Si |
| Team Settings (visibilidad + auto-asignacion) | No | No | No | Si | Si | Si |

### Acciones de Plataforma

| Accion | viewer | agent | manager | admin | owner | super_admin |
|--------|:------:|:-----:|:-------:|:-----:|:-----:|:-----------:|
| Panel Admin (/admin) | No | No | No | No | No | Si |
| Crear/editar orgs | No | No | No | No | No | Si |
| Crear/editar usuarios | No | No | No | No | No | Si |
| Crear/editar proyectos | No | No | No | No | No | Si |
| Global Rules | No | No | No | No | No | Si |
| Gestionar secrets | No | No | No | No | No | Si |

---

## Diferencias clave entre roles similares

### Owner vs Admin
- **Hoy son funcionalmente iguales** en cuanto a permisos.
- La diferencia es de **alcance**: owner es implicito por organizacion, admin es asignado por proyecto.
- Owner sirve como safety net: aunque nadie te asigne admin en un proyecto, si eres dueno de la org tienes nivel 50.

### Manager vs Admin
- Manager **NO puede** trabajar leads asignados a otros usuarios.
- Admin **SI puede** trabajar cualquier lead del proyecto.
- Manager **NO puede** acceder a Settings/KB del proyecto.

### Agent vs Manager
- Agent solo puede trabajar **sus propios leads** asignados o tomar leads sin asignar.
- Manager puede **reasignar leads** a cualquier miembro del equipo.

---

## Flujo tecnico

```
DB (User.systemRole + OrgMember.isOwner + ProjectMember.role)
  ↓
Server: getProjectRole() → { hasAccess, projectRole, isOrgOwner }
  ↓
Server: getEffectiveRole(systemRole, isOrgOwner, projectRole) → EffectiveRole
  ↓
Server Actions: permission predicates (canActOnLead, canReassignLead, etc.)
  ↓
Client: useEffectiveRole() hook → same computation from WorkspaceContext
  ↓
UI: show/hide buttons, enable/disable actions
```

### Archivos clave

| Archivo | Responsabilidad |
|---------|----------------|
| `src/lib/permissions.ts` | Jerarquia, getEffectiveRole(), predicados de permisos |
| `src/lib/actions/auth.ts` | verifyAuth(), verifyProjectAccess(), getProjectRole() |
| `src/lib/auth-helpers.ts` | verifySuperAdmin(), getCurrentUser() |
| `src/hooks/useEffectiveRole.ts` | Hook client-side para obtener effective role |
| `src/lib/rbac.ts` | Route-level access control (public/authenticated/super_admin) |
| `src/middleware.ts` | Proteccion de rutas /admin |

### Super Admin: bypass completo

- `verifyProjectAccess()` retorna `true` inmediatamente (no consulta DB).
- `getEffectiveRole()` retorna `'super_admin'` antes de evaluar org/proyecto.
- Puede auto-unirse a cualquier org como owner y cualquier proyecto como admin.
- Unico rol con acceso a `/admin`, Global Rules y gestion de usuarios.

---

## Notas

- **No existe "admin de org"**: a nivel org solo hay owner (true/false). Si se necesita un rol intermedio, habria que agregarlo.
- **Owner no se detecta por `createdBy`**: se asigna con el flag `isOwner` en `organization_members`. Multiples usuarios pueden ser owners.
- **Effective role se recalcula** en cada server action (no se confia en el cliente).

---

*Ultima actualizacion: 2026-04-07 (v0.23.0)*
