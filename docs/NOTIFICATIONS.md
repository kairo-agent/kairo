# Sistema de Notificaciones - KAIRO

> **Estado**: v0.7.16 - Implementado Feb 2026
> **Mecanismo**: Polling cada 15s (escalable a Supabase Realtime)

## Arquitectura

```
Evento (webhook/cron/action)
  -> INSERT en tabla notifications
  -> Frontend polling cada 15s detecta nuevas
  -> Bell badge + dropdown en Header
```

## Tabla: notifications

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String (cuid) | PK |
| userId | String | Destinatario (FK users) |
| organizationId | String | Tenant scoping |
| projectId | String | Project scoping |
| type | NotificationType | new_message, follow_up_due, lead_assigned |
| title | VARCHAR(255) | Titulo sanitizado |
| message | VARCHAR(1024) | Mensaje sanitizado |
| readAt | DateTime? | null = no leida |
| metadata | JSON? | { leadId, leadName, etc } |
| expiresAt | DateTime? | Auto-limpieza (30 dias default) |
| source | VARCHAR(50) | webhook, pg_cron, server_action |
| createdAt | DateTime | Timestamp |

### RLS Policies (PostgreSQL nativo)

- SELECT: `auth.uid()::text = userId` (solo propias)
- INSERT: `WITH CHECK (true)` (service role)
- UPDATE: `auth.uid()::text = userId` (solo propias)
- DELETE: `auth.uid()::text = userId` (solo propias)

## Tipos de notificacion

| Tipo | Trigger | Source |
|------|---------|--------|
| `new_message` | WhatsApp webhook recibe mensaje inbound | webhook |
| `follow_up_due` | pg_cron detecta `nextFollowUpAt <= NOW()` | pg_cron |
| `lead_assigned` | (futuro) Server action asigna lead | server_action |

## Archivos clave

| Archivo | Contenido |
|---------|-----------|
| `prisma/schema.prisma` | Modelo Notification + enum NotificationType |
| `src/lib/actions/notifications.ts` | Server actions: get, markRead, markAllRead, create, notifyProjectMembers |
| `src/hooks/useNotifications.ts` | Hook de polling (15s) con optimistic updates |
| `src/components/layout/NotificationDropdown.tsx` | UI del bell dropdown |
| `src/components/layout/Header.tsx` | Integra NotificationDropdown |
| `src/app/api/webhooks/whatsapp/route.ts` | Crea notificacion fire-and-forget en inbound |
| `scripts/pg-cron-followup-notifications.sql` | SQL para pg_cron en Supabase |

## Follow-up Scheduling

| Archivo | Contenido |
|---------|-----------|
| `src/lib/actions/leads.ts` | `scheduleFollowUp(leadId, date)` server action |
| `src/components/features/FollowUpModal.tsx` | Modal con datetime-local + quick options |
| `src/components/features/LeadCard.tsx` | Badge follow-up (rojo=vencido, naranja=proximo, gris=programado) |
| `LeadsPageClient.tsx` | Badge en tabla inline + integracion FollowUpModal |

### Badges de follow-up

| Color | Condicion |
|-------|-----------|
| Rojo (#EF4444) | `nextFollowUpAt < NOW()` (vencido) |
| Naranja (#F97316) | `nextFollowUpAt` dentro de 24h (proximo) |
| Gris (#6B7280) | `nextFollowUpAt` > 24h (programado futuro) |

## Seguridad

1. **RLS nativo en PostgreSQL** - Supabase Realtime respeta RLS
2. **Sanitizacion** - `sanitizeText()` strip HTML + trunca al crear
3. **Ownership check** - markAsRead verifica `userId === auth.uid()`
4. **Rate limit** - notifyProjectMembers limita a 10 recipients por llamada
5. **Fallback project** - Solo en development, produccion descarta mensajes sin match
6. **pg_cron SECURITY DEFINER** - Funcion con search_path explicito + idempotencia

## Escalabilidad futura

### Migrar de Polling a Supabase Realtime

Cuando KAIRO escale (plan Pro de Supabase, 500 conexiones):

```typescript
// Reemplazar polling en useNotifications.ts con:
const supabase = createClient();
const channel = supabase.channel('user-notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `userId=eq.${userId}`
  }, (payload) => {
    // Agregar al state local
    setNotifications(prev => [payload.new, ...prev]);
    setUnreadCount(prev => prev + 1);
  })
  .subscribe();
```

### Otros tipos de notificacion futuros

Solo agregar al enum `NotificationType`:
1. `lead_assigned` - Cuando un admin asigna un lead
2. `lead_status_changed` - Cambio de status automatico
3. `agent_handoff` - AI transfiere a humano
4. `system_alert` - Errores de integracion

### Push notifications (browser)

Agregar Web Push API con service worker para notificaciones cuando KAIRO no esta abierto.

### Limpieza automatica

Cron para eliminar notificaciones con `expiresAt < NOW()`:
```sql
SELECT cron.schedule('cleanup-expired-notifications', '0 3 * * *',
  $$DELETE FROM notifications WHERE "expiresAt" < NOW()$$
);
```
