# Sistema de Notificaciones - KAIRO

> **Estado**: v0.17.0 - Actualizado Mar 2026
> **Canales**: Bell (in-app Realtime + polling fallback) + Email (Resend) + Web Push (VAPID)

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

| Tipo | Trigger | Source | Bell | Email | Push |
|------|---------|--------|------|-------|------|
| `new_message` | WhatsApp webhook recibe mensaje inbound (solo modo human) | webhook | Si | Si | Si |
| `follow_up_due` | pg_cron detecta `nextFollowUpAt <= NOW()` | pg_cron + pg_net | Si | Si | Si |
| `handoff_request` | AI pipeline detecta `[HANDOFF]` marker en respuesta del agente | ai_pipeline | Si | Si | Si |
| `hot_lead` | AI response con temperature=hot | ai_pipeline | Si | Si | Si |
| `lead_assigned` | (futuro) Server action asigna lead | server_action | Si | No | No |

## Archivos clave

| Archivo | Contenido |
|---------|-----------|
| `prisma/schema.prisma` | Modelo Notification + enum NotificationType |
| `src/lib/actions/notifications.ts` | Server actions: get (con enrichment de lead), markRead, markAllRead, create, notifyProjectMembers |
| `src/hooks/useNotifications.ts` | Hook de polling (15s) con optimistic updates, sonido Web Audio API, filtro por projectId |
| `src/components/layout/NotificationDropdown.tsx` | UI: nombre completo, badge temperatura, fecha follow-up, click -> deep-link a panel |
| `src/lib/actions/leads.ts` | `getLeadById()` para fetch individual (deep-link desde notificacion) |
| `src/components/layout/Header.tsx` | Integra NotificationDropdown |
| `src/app/api/webhooks/whatsapp/route.ts` | Crea notificacion fire-and-forget en inbound |
| `scripts/pg-cron-followup-notifications.sql` | SQL para pg_cron en Supabase (bell + pg_net call) |
| `src/app/api/cron/followup-notify/route.ts` | Endpoint para email + push de follow-ups (llamado por pg_net) |
| `src/lib/email.ts` | `sendFollowUpEmail()` - template email de seguimiento pendiente |

## Follow-up Scheduling

| Archivo | Contenido |
|---------|-----------|
| `src/lib/actions/leads.ts` | `scheduleFollowUp(leadId, date)` server action |
| `src/components/features/FollowUpModal.tsx` | Modal con DayPicker (react-day-picker) + hora/minuto selects + quick options |
| `src/components/features/LeadCard.tsx` | Badge follow-up (rojo=vencido, naranja=proximo, gris=programado) |
| `src/components/features/LeadDetailPanel.tsx` | Badge en header + card detallada con fecha exacta (date-fns PPPp) + boton "Reprogramar" |
| `src/hooks/useLeadsQuery.ts` | `optimisticFollowUpUpdate()` - update instantaneo del cache |
| `LeadsPageClient.tsx` | Badge en tabla inline + integracion FollowUpModal + optimistic updates |

### Badges de follow-up

| Color | Condicion |
|-------|-----------|
| Rojo (#EF4444) | `nextFollowUpAt < NOW()` (vencido) |
| Naranja (#F97316) | `nextFollowUpAt` dentro de 24h (proximo) |
| Gris (#6B7280) | `nextFollowUpAt` > 24h (programado futuro) |

## Notification Enrichment (v0.7.16+)

Notificaciones se enriquecen al **consultar** (no al crear) con datos del lead asociado via `metadata.leadId`.

```
getNotifications()
  -> Fetch notifications de DB
  -> Extraer leadIds unicos del metadata
  -> Batch-fetch leads (id, firstName, lastName, temperature, nextFollowUpAt)
  -> Merge: cada notificacion incluye campo `lead` con datos frescos
```

**Ventajas del enfoque query-time vs store-time:**
- Datos siempre frescos (si temperature cambia, la notificacion refleja el cambio)
- Notificaciones existentes se enriquecen automaticamente
- No requiere actualizar pg-cron SQL ni webhook code

## Deep-link: Click notification -> Lead Panel

```
Click en notificacion
  -> markAsRead(id) optimistic
  -> router.push('/leads?leadId=xxx')
  -> LeadsPageClient detecta searchParam
  -> Busca lead en cache actual || getLeadById(leadId)
  -> setSelectedLead + setIsPanelOpen(true)
  -> window.history.replaceState() limpia URL
```

`getLeadById()` en `leads.ts` retorna `LeadGridItem` con verificacion de acceso (verifyProjectAccess).

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

### Sonido de notificacion (Web Audio API)

Beep de 800Hz / 0.15s cuando llegan nuevas notificaciones (entre polls).

- **Singleton AudioContext**: Se crea una vez, se reutiliza. Los browsers suspenden AudioContext sin gesto del usuario.
- **Unlock**: Listeners `click`/`touchstart`/`keydown` reanudan el AudioContext suspendido.
- **No suena al cargar**: `previousUnreadCountRef` inicializado en `null`, set en primer fetch.
- **Reset por proyecto**: Ref reseteado cuando `projectId` cambia (evita falsos positivos).

### Otros tipos de notificacion futuros

Solo agregar al enum `NotificationType`:
1. `lead_assigned` - Cuando un admin asigna un lead
2. `lead_status_changed` - Cambio de status automatico
3. `system_alert` - Errores de integracion

## Web Push Notifications (v0.9.4)

3er canal de notificacion. Push del browser para cuando KAIRO no esta abierto.

### Flujo

```
notifyProjectMembers()
  -> Fetch active PushSubscriptions para recipientIds
  -> sendPush() per subscription (web-push library + VAPID)
  -> 410/404 response -> auto-delete subscription from DB
  -> Fire-and-forget (nunca bloquea)
```

### Tabla: push_subscriptions

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String (cuid) | PK |
| userId | String | FK users |
| endpoint | Text | Push service endpoint URL |
| p256dh | String | ECDH public key |
| auth | String | Auth secret |
| userAgent | VARCHAR(512) | Browser user-agent |
| active | Boolean | true=activa, false=desactivada por usuario |
| createdAt | DateTime | Timestamp |
| updatedAt | DateTime | Auto-update |

Constraint: `@@unique([userId, endpoint])` - 1 row per device/browser.

### Pre-permission modal

- Modal KAIRO aparece 3s post-login si `Notification.permission === 'default'`
- "Activar" -> `Notification.requestPermission()` -> subscribe -> save to DB
- "Ahora no" -> `localStorage` dismiss con cooldown de **3 dias** y maximo **3 intentos**
  - 1er descarte: re-pregunta en 3 dias
  - 2do descarte: re-pregunta en 3 dias
  - 3er descarte: **nunca mas** (respeta decision del usuario)
  - Datos persistidos en `localStorage` key `kairo_push_dismiss_${userId}` (JSON: `{count, dismissedAt}`)
- Si `permission === 'denied'`: no hay forma de revertir desde la app (limitacion del browser)

### Profile toggle

- ON = usuario tiene 1+ suscripciones activas
- OFF = `toggleAllPushSubscriptions(false)` desactiva TODAS las suscripciones
- ON de nuevo = reactiva las suscripciones existentes del usuario
- Si `permission === 'denied'`: toggle deshabilitado con mensaje explicativo
- Si `permission === 'unsupported'`: seccion oculta

### Service Worker (`public/sw.js`)

- Recibe push event -> muestra notificacion nativa del OS
- Click en notificacion -> deep-link a la URL del payload (ej: `/leads?leadId=xxx`)
- Busca tab KAIRO existente antes de abrir nueva ventana

### Archivos clave

| Archivo | Contenido |
|---------|-----------|
| `src/lib/push/send-push.ts` | VAPID config, `sendPush()` con TTL 24h |
| `src/lib/actions/push-subscriptions.ts` | Server actions: subscribePush, unsubscribePush, toggleAllPushSubscriptions, getPushStatus |
| `src/hooks/usePushNotifications.ts` | Hook: SW register, permission check, subscribe/unsubscribe |
| `src/components/features/PushPermissionModal.tsx` | Modal UI con bell icon |
| `public/sw.js` | Service Worker |
| `public/manifest.json` | PWA manifest |

### Env vars

| Variable | Server/Client | Proposito |
|----------|--------------|-----------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client (baked at build) | Clave publica VAPID |
| `VAPID_PRIVATE_KEY` | Server only | Clave privada VAPID |
| `VAPID_SUBJECT` | Server only | `mailto:ia@kairoagent.com` |

### Limitaciones

- **iOS Safari**: Requiere PWA (Home Screen) para Web Push. Sin PWA, no funciona.
- **Styling**: Notificaciones usan estilo nativo del OS (no personalizable con colores KAIRO).
- **`denied` state**: Si el usuario bloquea en el browser, solo puede revertir desde settings del browser.

### Formato de timestamps (v0.10.2)

Timestamps en la UI incluyen hora en formato 12h ademas de la fecha relativa.

| Contexto | Formato |
|----------|---------|
| Hoy | "Hoy 3:45 PM" |
| Ayer | "Ayer 3:45 PM" |
| Ultimos dias | "hace 2 d 3:45 PM" |
| Mas antiguo | "14 mar. 2026 3:45 PM" |

Afecta: `NotificationDropdown.tsx` (fecha de notificacion) y `LeadDetailPanel.tsx` (timestamps de actividad).
Funciones en `src/lib/utils.ts`: `formatRelativeTime()`, `formatDate()`, nueva `formatTime12h()`.

---

## Limpieza automatica

Cron para eliminar notificaciones con `expiresAt < NOW()`:
```sql
SELECT cron.schedule('cleanup-expired-notifications', '0 3 * * *',
  $$DELETE FROM notifications WHERE "expiresAt" < NOW()$$
);
```
