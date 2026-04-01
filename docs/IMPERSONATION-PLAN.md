# KAIRO - Plan de Implementacion: User Impersonation

## Resumen General

| | |
|---|---|
| **Que es** | Super_admin puede ver el dashboard como si fuera otro usuario |
| **Quien puede usarlo** | Solo `systemRole === 'super_admin'` |
| **Enfoque** | Cookie-based (`kairo-impersonate`, HttpOnly) |
| **Complejidad** | Medio-Alto |
| **Archivos nuevos** | 4 |
| **Archivos modificados** | ~11 |
| **Archivos NO tocados** | 15+ server actions heredan automaticamente |

**Invariante critico:** `verifySuperAdmin()` NUNCA se ve afectada; siempre usa auth real de Supabase.

---

## Decision Arquitectonica: Por que Cookie-based

| Alternativa | Descartada porque |
|-------------|-------------------|
| URL param (`?impersonate=userId`) | Inseguro, se filtra en logs/referer, se comparte accidentalmente |
| Session storage en DB | Mas complejo, requiere tabla extra, cleanup, no funciona con `cache()` |
| Redis-based | Agrega dependencia critica; Redis es opcional en KAIRO (dev fallback) |

**Cookie HttpOnly gana porque:**
- Viaja automaticamente en cada request (server actions, middleware, RSC)
- `HttpOnly` impide acceso desde JS (mitiga XSS)
- Integracion natural con `cookies()` de Next.js
- Se lee una sola vez por request dentro de `cache()`
- No requiere schema changes para el mecanismo core

---

## Fase 1: Infraestructura (Auth Override + Cookie Management)

### 1.1 Cambios en `src/lib/actions/auth.ts`

**`getSupabaseUser()` (~linea 23):** NO se toca. Siempre retorna usuario real.

**Nueva funcion helper interna:**

```typescript
async function getImpersonatedUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get('kairo-impersonate')?.value || null;
  } catch {
    return null;
  }
}
```

**Cambio en `verifyAuth()` (~linea 173):**

```typescript
export const verifyAuth = cache(async () => {
  try {
    // 1. Siempre verificar usuario real autenticado
    const realUser = await getSupabaseUser();
    if (!realUser) return null;

    // 2. Verificar si hay impersonacion activa
    const impersonatedId = await getImpersonatedUserId();

    if (impersonatedId) {
      // 3. Verificar que el usuario real es super_admin
      const realDbUser = await prisma.user.findUnique({
        where: { id: realUser.id },
        select: { systemRole: true, isActive: true },
      });
      if (!realDbUser?.isActive || realDbUser.systemRole !== 'super_admin') {
        return null; // No es super_admin, ignorar cookie
      }

      // 4. Retornar datos del usuario impersonado
      return await prisma.user.findUnique({
        where: { id: impersonatedId },
        select: { id: true, systemRole: true, firstName: true, lastName: true },
      });
    }

    // 5. Flujo normal (sin impersonacion)
    return await prisma.user.findUnique({
      where: { id: realUser.id },
      select: { id: true, systemRole: true, firstName: true, lastName: true },
    });
  } catch (error) {
    console.error('Verify auth error:', error);
    return null;
  }
});
```

**Cambio en `getCurrentUser()` (~linea 132):** Misma logica — si hay cookie y usuario real es super_admin, retornar datos completos del impersonado (con memberships).

### 1.2 `verifySuperAdmin()` en `src/lib/auth-helpers.ts`

**No requiere cambios.** Ya usa `createServerClient()` directo para `supabase.auth.getUser()`. Nunca lee la cookie. Los archivos que la usan (`admin.ts`, `global-rules.ts`) siguen funcionando.

### 1.3 Nuevo: `src/lib/actions/impersonation.ts`

```
'use server';

// startImpersonation(targetUserId: string) -> { success, error? }
//   - Verifica super_admin via verifySuperAdmin()
//   - Verifica targetUserId existe, activo, NO es super_admin
//   - Setea cookie 'kairo-impersonate'
//   - Registra audit log
//   - Retorna { success: true, user: { id, firstName, lastName, email, systemRole } }

// stopImpersonation() -> { success }
//   - Verifica super_admin via verifySuperAdmin()
//   - Elimina cookie
//   - Registra audit log

// getImpersonationStatus() -> { isImpersonating, targetUser? }
//   - Lee cookie, retorna datos del impersonado si existe

// searchUsersForImpersonation(query: string) -> User[]
//   - Busca por nombre/email, excluye super_admins
//   - Max 20 resultados, solo super_admin puede llamar
```

### 1.4 Configuracion de la Cookie

```typescript
const IMPERSONATION_COOKIE = {
  name: 'kairo-impersonate',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 4, // 4 horas auto-expiry
};
```

### 1.5 `permissions.ts` / `getEffectiveRole()`

**No requiere cambios.** Es funcion pura. Cuando se impersona, `getCurrentUser()` retorna el impersonado con su `systemRole` (sera `user`), y el hook `useEffectiveRole()` calcula basandose en esos datos.

### 1.6 `profile.ts` - Caso especial

Usa `supabase.auth.getUser()` directo (~lineas 15, 89, 138), no `verifyAuth()`. Durante impersonacion, operaciones de perfil actuan sobre el super_admin real. **Esto es CORRECTO.** Deshabilitar boton "Mi perfil" durante impersonacion para evitar confusion.

---

## Fase 2: Banner UI de Impersonacion

### 2.1 Nuevo: `src/contexts/ImpersonationContext.tsx`

```typescript
// Provee:
// - isImpersonating: boolean
// - targetUser: { id, firstName, lastName, email, systemRole } | null
// - stopImpersonation: () => Promise<void>
// Se inicializa con getImpersonationStatus() desde server component.
```

### 2.2 Nuevo: `src/components/layout/ImpersonationBanner.tsx`

- Posicion: `fixed top-0 left-0 right-0 z-[60]` (sobre header z-20)
- Altura: `h-10` (40px)
- Fondo: `bg-amber-500` (warning, alto contraste)
- Texto: blanco, centrado
- Contenido: `"Viendo como: {Nombre} ({Rol}) - {Email}"`
- Boton "Salir" a la derecha, estilo pill
- Mobile: texto truncado, solo nombre + boton

```
[!] Viendo como: Maria Garcia (Asesor) - maria@empresa.com     [Salir]
```

Cuando banner activo: layout recibe `pt-10`, Sidebar recibe `top-10`.

### 2.3 Montaje en Layout

En `DashboardLayoutClient.tsx`:

```tsx
<ThemeProvider>
  <QueryProvider>
    <ImpersonationProvider initialStatus={impersonationStatus}>
      <WorkspaceProvider>
        <LoadingProvider>
          <ImpersonationBanner />
          <DashboardLayoutContent>...</DashboardLayoutContent>
        </LoadingProvider>
      </WorkspaceProvider>
    </ImpersonationProvider>
  </QueryProvider>
</ThemeProvider>
```

En `layout.tsx` (server component): obtener `impersonationStatus` y pasarlo como prop.

---

## Fase 3: Trigger UI (Iniciar Impersonacion)

### 3.1 Header User Dropdown

En `Header.tsx`, nuevo boton "Impersonar usuario" visible solo cuando:
- `user.systemRole === 'super_admin'`
- No hay impersonacion activa

### 3.2 Nuevo: `src/components/admin/ImpersonateUserModal.tsx`

- Input de busqueda con debounce (300ms)
- Lista de usuarios (nombre, email, rol, organizacion)
- Excluye super_admins
- Usa `searchUsersForImpersonation()` server action

### 3.3 Reset del WorkspaceContext

Despues de `startImpersonation()`: `router.refresh()` re-ejecuta layout server component. `getCurrentUser()` retorna impersonado, `getOrganizations()` filtra correctamente. localStorage se limpia via `ImpersonationProvider`.

---

## Fase 4: Proteccion de Rutas Admin

### 4.1 Middleware (`src/middleware.ts`)

```typescript
// En seccion de admin routes (~linea 95):
if (user && isAdminRoute(pathname)) {
  const impersonateCookie = request.cookies.get('kairo-impersonate');
  if (impersonateCookie?.value) {
    return redirectWithCookies(new URL(`/${locale}/leads`, request.url));
  }
  // ... check existente
}
```

### 4.2 Admin Layout (defense in depth)

```typescript
const cookieStore = await cookies();
if (cookieStore.get('kairo-impersonate')?.value) {
  redirect(`/${locale}/leads`);
}
```

---

## Fase 5: Casos Borde

| Caso | Solucion |
|------|----------|
| **Supabase Realtime** | No requiere cambios. Hooks filtran por data (projectId), no por auth userId |
| **Push Notifications** | Bloquear `subscribePush()` si cookie existe. Suprimir `PushPermissionModal` |
| **Sign Out durante impersonacion** | Cambiar logout a "Salir de impersonacion" (no cerrar sesion) |
| **Workspace Selection** | `getOrganizations()` usa `getCurrentUser()` — hereda impersonacion correctamente |
| **Lead Assignment** | `verifyAuth()` retorna impersonado. Take Control asigna al impersonado. Correcto + audit log |
| **WhatsApp Send** | Mensaje aparece como enviado por impersonado. Agregar metadata `impersonatedBy` |
| **Multiple Tabs** | Cookie es por browser; todas las tabs en modo impersonacion. Correcto |
| **Cookie Expiry** | `maxAge: 4h`. Limpieza explicita en signOut. Middleware limpia si no es super_admin |
| **Perfil** | Deshabilitar "Mi perfil" durante impersonacion |

---

## Fase 6: Audit Logging

### 6.1 Nuevo modelo Prisma

```prisma
model ImpersonationLog {
  id              String   @id @default(cuid())
  adminUserId     String
  targetUserId    String
  action          String   // "start" | "stop" | "expired"
  ipAddress       String?
  userAgent       String?  @db.VarChar(512)
  createdAt       DateTime @default(now())

  adminUser       User     @relation("AdminImpersonation", fields: [adminUserId], references: [id])
  targetUser      User     @relation("TargetImpersonation", fields: [targetUserId], references: [id])

  @@index([adminUserId, createdAt])
  @@index([targetUserId, createdAt])
  @@map("impersonation_logs")
}
```

Relaciones inversas en `User`:
```prisma
adminImpersonations  ImpersonationLog[] @relation("AdminImpersonation")
targetImpersonations ImpersonationLog[] @relation("TargetImpersonation")
```

**Migracion:** `npx prisma migrate dev --name add_impersonation_logs`

### 6.2 Metadata en Activity existente

Para acciones durante impersonacion, agregar `{ impersonatedBy: realUserId }` en el campo `metadata` (Json?) del modelo Activity. No requiere schema change.

---

## Lista de Cambios Archivo por Archivo

### Archivos Nuevos (4)

| Archivo | Proposito |
|---------|-----------|
| `src/lib/actions/impersonation.ts` | Server actions: start/stop/status/search |
| `src/contexts/ImpersonationContext.tsx` | Client context para estado |
| `src/components/layout/ImpersonationBanner.tsx` | Banner visual fixed |
| `src/components/admin/ImpersonateUserModal.tsx` | Modal seleccion de usuario |

### Archivos Modificados (~11)

| Archivo | Cambio | Por que |
|---------|--------|---------|
| `src/lib/actions/auth.ts` | Override `verifyAuth()` + `getCurrentUser()` con cookie check | Core de la feature |
| `src/middleware.ts` | Bloquear /admin durante impersonacion; limpiar cookie invalida | Seguridad |
| `src/app/[locale]/(dashboard)/layout.tsx` | Obtener `impersonationStatus`, pasar como prop | Init del banner |
| `src/app/[locale]/(dashboard)/DashboardLayoutClient.tsx` | `ImpersonationProvider`, banner, `pt-10` condicional | UI + context |
| `src/app/[locale]/(admin)/layout.tsx` | Check anti-impersonacion | Defense in depth |
| `src/components/layout/Header.tsx` | Boton "Impersonar" + cambiar logout durante impersonacion | Trigger + edge case |
| `src/components/layout/Sidebar.tsx` | Ocultar link admin; offset `top-10` con banner | UX coherente |
| `src/lib/actions/push-subscriptions.ts` | Bloquear `subscribePush()` durante impersonacion | Seguridad push |
| `prisma/schema.prisma` | Modelo `ImpersonationLog` + relaciones en User | Audit logging |
| `src/messages/es.json` | Keys de i18n | Traducciones |
| `src/messages/en.json` | Keys de i18n | Traducciones |

### Archivos NO Modificados (heredan automaticamente)

Todos los server actions que usan `verifyAuth()` o `getCurrentUser()`:
`leads.ts`, `messages.ts`, `agents.ts`, `dashboard.ts`, `notifications.ts`, `secrets.ts`, `reengagement.ts`, `workspace.ts`, `agent-media.ts`, `knowledge.ts`, `media.ts`

Archivos inmunes: `admin.ts`, `global-rules.ts` (usan `verifySuperAdmin()`), `profile.ts` (usa `supabase.auth.getUser()` directo)

---

## Keys i18n Nuevas

```json
{
  "impersonation": {
    "banner": {
      "viewingAs": "Viendo como: {name} ({role})",
      "exit": "Salir"
    },
    "modal": {
      "title": "Impersonar Usuario",
      "searchPlaceholder": "Buscar por nombre o email...",
      "noResults": "No se encontraron usuarios",
      "confirm": "Impersonar",
      "confirmMessage": "Vas a ver el dashboard como {name}. Todas tus acciones se registraran en el audit log.",
      "cancel": "Cancelar"
    },
    "trigger": { "label": "Impersonar usuario" },
    "messages": {
      "started": "Ahora estas viendo como {name}",
      "stopped": "Has salido del modo de impersonacion",
      "error": "Error al iniciar impersonacion",
      "notAvailable": "No disponible durante impersonacion",
      "adminBlocked": "No puedes acceder al panel admin durante impersonacion"
    }
  }
}
```

EN: `viewingAs` -> `"Viewing as: {name} ({role})"`, `exit` -> `"Exit"`, etc.

---

## Orden de Implementacion

```
Paso 1:  Migracion Prisma (ImpersonationLog)        [sin dependencia]
Paso 2:  Server actions (impersonation.ts)           [depende de 1]
Paso 3:  Modificar auth.ts (verifyAuth + getCurrentUser) [depende de 2]
Paso 4:  Middleware changes                          [depende de 3]
Paso 5:  ImpersonationContext + Banner               [depende de 2]
Paso 6:  Dashboard layout changes                    [depende de 5]
Paso 7:  Header.tsx + ImpersonateUserModal           [depende de 5, 6]
Paso 8:  Admin layout protection                     [depende de 3]
Paso 9:  push-subscriptions.ts guard                 [depende de 3]
Paso 10: Sidebar.tsx changes                         [depende de 5]
Paso 11: i18n keys (es.json + en.json)               [sin dependencia]
Paso 12: Testing manual completo                     [depende de todos]

Paralelizables: 1+11 | luego 2 | luego 3+5 | luego 4+6+8+9+10 | luego 7 | luego 12
```

---

## Testing Checklist

### Funcionalidad Core
- [ ] Super_admin puede iniciar impersonacion desde Header dropdown
- [ ] Modal muestra usuarios buscables (excluye super_admins)
- [ ] Banner amarillo aparece correctamente
- [ ] WorkspaceSelector muestra orgs/projects del impersonado
- [ ] Lista de leads filtra por proyectos del impersonado
- [ ] Effective role en Header muestra rol del impersonado
- [ ] "Salir" en banner termina impersonacion
- [ ] Dashboard se refresca al entrar/salir

### Seguridad
- [ ] Usuario no-super_admin NO puede setear cookie manualmente
- [ ] No se puede impersonar a otro super_admin
- [ ] Rutas /admin bloqueadas durante impersonacion
- [ ] `verifySuperAdmin()` retorna usuario REAL
- [ ] Push subscriptions NO se registran durante impersonacion
- [ ] Cookie expira a las 4 horas
- [ ] SignOut limpia cookie de impersonacion
- [ ] Audit log registra inicio/fin

### Edge Cases
- [ ] /admin manual redirige a /leads
- [ ] "Mi perfil" deshabilitado durante impersonacion
- [ ] WhatsApp send funciona (mensaje como impersonado)
- [ ] Cambiar workspace funciona
- [ ] Multiple tabs consistentes
- [ ] Impersonar usuario inactivo es rechazado

### Responsive
- [ ] Banner correcto en mobile (texto truncado)
- [ ] Layout shift (40px) funciona en mobile y desktop
- [ ] Modal de seleccion funciona en mobile

---

## Modelo de Seguridad

| Amenaza | Mitigacion |
|---------|------------|
| XSS lee cookie | `HttpOnly` impide acceso via JS |
| Usuario normal forja cookie | Server valida super_admin en cada request |
| Impersonar otro super_admin | Bloqueado en `startImpersonation()` |
| Cookie persiste indefinidamente | `maxAge: 4h` + limpieza en signOut |
| Acciones destructivas | Audit log + metadata `impersonatedBy` |
| CSRF | `sameSite: 'lax'` previene cross-site |
| Push subscription leak | Bloqueada explicitamente |
