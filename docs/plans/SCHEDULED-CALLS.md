# Plan de Implementacion: Llamadas Agendadas (Scheduled Calls)

> **Version objetivo:** v0.24.0
> **Estado:** Planificado (no iniciado)
> **Ultima revision:** 2026-04-08

---

## Resumen Ejecutivo

Permitir que el agente IA detecte intencion de agendar llamada, ofrezca slots disponibles segun horarios configurados, y cree un evento con sala Jitsi. Notificaciones al asesor (bell + email + push) y al lead (email). Prevencion de doble-booking atomico en BD.

---

## Decisiones de Diseno (ya validadas con Leo)

| Decision | Resultado |
|----------|-----------|
| Calendario externo (Google/Outlook) | **NO.** Links "Agregar a calendario" + .ics en emails |
| Notificacion al lead | **Solo email** (WhatsApp 24h expira). Por eso email es obligatorio para agendar |
| Notificacion al asesor | Bell + Email + Push |
| Recordatorio 1h antes | Al lead por email |
| Recordatorio 15min antes | Al asesor por push + email |
| WhatsApp Templates (Meta) | **NO.** Se evita por complejidad y costo |
| Sala Jitsi pre-creada | No existe "pre-crear" en Jitsi. Se genera URL al agendar, la sala se crea cuando alguien entra. Re-entrable ilimitadamente |
| Horario de llamadas del proyecto | Separado del business hours (puede ser distinto) |
| Horario personal del asesor | En su perfil, con switch "usar del proyecto" vs "usar el mio" |
| Doble-booking | Constraint UNIQUE en BD, atomico |

---

## Fase 1: Base de Datos

### 1.1 Nueva tabla `scheduled_calls`

**Metodo:** `prisma migrate dev` (NO db push)

```prisma
model ScheduledCall {
  id              String   @id @default(cuid())
  projectId       String
  leadId          String
  assignedUserId  String
  scheduledAt     DateTime // UTC
  duration        Int      @default(30) // minutos
  jitsiUrl        String
  status          ScheduledCallStatus @default(pending)
  leadEmail       String   // email del lead al momento de agendar
  cancelledBy     String?  // userId o 'lead' o 'system'
  cancelReason    String?
  notes           String?
  reminder1hSent  Boolean  @default(false)
  reminder15mSent Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  project  Project @relation(fields: [projectId], references: [id])
  lead     Lead    @relation(fields: [leadId], references: [id])
  user     User    @relation(fields: [assignedUserId], references: [id])

  @@unique([assignedUserId, scheduledAt]) // Previene doble-booking atomico
  @@index([projectId, status])
  @@index([scheduledAt, status])
  @@index([leadId])
}

enum ScheduledCallStatus {
  pending
  completed
  cancelled
  no_show
}
```

### 1.2 Nuevo campo en Project

```prisma
// Agregar al modelo Project:
callScheduleConfig  Json?  // { enabled, schedule, duration, timezone }
```

**Estructura del JSON `callScheduleConfig`:**
```typescript
interface CallScheduleConfig {
  enabled: boolean;
  duration: number; // minutos (default 30)
  schedule: Record<DayOfWeek, {
    available: boolean;
    slots: Array<{ start: string; end: string }>; // "HH:mm" 24h, soporta multiples rangos
  }>;
  // timezone se hereda del org (ya existe en WorkspaceContext)
}

// Ejemplo:
{
  enabled: true,
  duration: 30,
  schedule: {
    monday: { available: true, slots: [{ start: "15:00", end: "17:00" }] },
    tuesday: { available: true, slots: [{ start: "15:00", end: "17:00" }] },
    wednesday: { available: false, slots: [] },
    thursday: { available: true, slots: [{ start: "15:00", end: "17:00" }] },
    friday: { available: true, slots: [{ start: "15:00", end: "17:00" }] },
    saturday: { available: false, slots: [] },
    sunday: { available: false, slots: [] }
  }
}
```

### 1.3 Nuevo campo en User.preferences

```typescript
// Agregar al JSON preferences del User:
{
  // ...existentes (theme, language, timezone, displayCurrency)
  callSchedule: {
    useOwnSchedule: boolean; // false = usar del proyecto, true = usar propio
    schedule?: Record<DayOfWeek, {
      available: boolean;
      slots: Array<{ start: string; end: string }>;
    }>;
  }
}
```

### 1.4 RLS en Supabase

```sql
-- Tabla scheduled_calls
ALTER TABLE scheduled_calls ENABLE ROW LEVEL SECURITY;

-- Policy: miembros del proyecto pueden leer
CREATE POLICY "project_members_read" ON scheduled_calls
  FOR SELECT USING (
    project_id IN (
      SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
    )
  );

-- Policy: miembros del proyecto pueden insertar (para el webhook/API)
-- + service_role para crons
```

### 1.5 Agregar NotificationType

```prisma
enum NotificationType {
  new_message
  follow_up_due
  lead_assigned
  handoff_request
  hot_lead
  call_scheduled    // NUEVO
  call_reminder     // NUEVO
}
```

### 1.6 Relaciones en modelos existentes

```prisma
// En Lead:
scheduledCalls  ScheduledCall[]

// En User:
scheduledCalls  ScheduledCall[]

// En Project:
scheduledCalls  ScheduledCall[]
```

---

## Fase 2: Configuracion del Proyecto (Settings)

### 2.1 Nuevo tab en Settings: "Llamadas" / "Calls"

**Archivo:** `src/app/[locale]/(dashboard)/settings/SettingsPageClient.tsx`

**Cambio:** Agregar 5to tab al `SettingsTab` type:
```typescript
type SettingsTab = 'instructions' | 'knowledge' | 'reengagement' | 'form' | 'calls';
```

**UI del tab "Calls":**
```
┌─ Agendamiento de Llamadas ───────────────────────────────┐
│                                                           │
│ Permitir que el agente IA agende llamadas     [toggle]    │
│ con los leads del proyecto.                               │
│                                                           │
│ Duracion por llamada: [30 min ▼]                         │
│                                                           │
│ Horario disponible para llamadas:                        │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ Lun  [x]  [15:00] - [17:00]  [+ Agregar rango]     │  │
│ │ Mar  [x]  [15:00] - [17:00]  [+ Agregar rango]     │  │
│ │ Mie  [ ]  No disponible                             │  │
│ │ Jue  [x]  [15:00] - [17:00]  [+ Agregar rango]     │  │
│ │ Vie  [x]  [15:00] - [17:00]  [+ Agregar rango]     │  │
│ │ Sab  [ ]  No disponible                             │  │
│ │ Dom  [ ]  No disponible                             │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                           │
│ [Guardar]                                                │
└───────────────────────────────────────────────────────────┘
```

**Multiples rangos por dia** (ej: Lun 10:00-12:00, 15:00-17:00) para cubrir horarios partidos.

### 2.2 Server Actions

**Archivo nuevo:** `src/lib/actions/call-schedule.ts`

```typescript
// Funciones:
export async function getProjectCallSchedule(projectId: string)
export async function updateProjectCallSchedule(projectId: string, config: CallScheduleConfig)
export async function getAvailableSlots(projectId: string, userId: string, date: Date): Promise<string[]>
export async function createScheduledCall(data: CreateScheduledCallInput): Promise<ScheduledCall>
export async function cancelScheduledCall(callId: string, cancelledBy: string, reason?: string)
export async function updateScheduledCallStatus(callId: string, status: ScheduledCallStatus)
export async function getScheduledCallsForUser(userId: string, from: Date, to: Date)
export async function getScheduledCallsForLead(leadId: string)
```

### 2.3 Logica de `getAvailableSlots` (CRITICO)

```typescript
async function getAvailableSlots(projectId: string, userId: string, targetDate: Date): Promise<string[]> {
  // 1. Obtener user preferences
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const prefs = user.preferences as UserPreferences;
  
  // 2. Determinar horario a usar
  let schedule: DaySchedule;
  if (prefs?.callSchedule?.useOwnSchedule && prefs.callSchedule.schedule) {
    schedule = prefs.callSchedule.schedule;
  } else {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const config = project.callScheduleConfig as CallScheduleConfig;
    if (!config?.enabled) return [];
    schedule = config.schedule;
  }
  
  // 3. Obtener dia de la semana de targetDate
  const dayOfWeek = getDayOfWeek(targetDate); // 'monday', 'tuesday', etc.
  const dayConfig = schedule[dayOfWeek];
  if (!dayConfig?.available) return [];
  
  // 4. Generar todos los slots posibles segun rangos del dia
  const duration = config.duration || 30;
  const allSlots: string[] = [];
  for (const range of dayConfig.slots) {
    let current = parseTime(range.start);
    const end = parseTime(range.end);
    while (current + duration <= end) {
      allSlots.push(formatTime(current)); // "15:00", "15:30", etc.
      current += duration;
    }
  }
  
  // 5. Consultar llamadas ya agendadas para ese usuario en esa fecha
  const existingCalls = await prisma.scheduledCall.findMany({
    where: {
      assignedUserId: userId,
      scheduledAt: { gte: startOfDay(targetDate), lt: endOfDay(targetDate) },
      status: { in: ['pending'] }
    }
  });
  
  // 6. Excluir slots ocupados
  const occupiedSlots = existingCalls.map(c => formatTime(c.scheduledAt));
  const availableSlots = allSlots.filter(s => !occupiedSlots.includes(s));
  
  // 7. Si targetDate es HOY, excluir slots pasados (con 1h de buffer minimo)
  const now = new Date();
  if (isSameDay(targetDate, now)) {
    const minTime = addHours(now, 1); // Minimo 1h adelante
    return availableSlots.filter(s => parseSlotToDate(targetDate, s) >= minTime);
  }
  
  return availableSlots;
}
```

---

## Fase 3: Perfil del Asesor

### 3.1 Nueva seccion en Profile

**Archivo:** `src/app/[locale]/(dashboard)/profile/page.tsx`

**Agregar seccion despues de "Notificaciones":**

```
┌─ Mi Horario de Llamadas ──────────────────────────────────┐
│                                                            │
│ ○ Usar horario de llamadas del proyecto                   │
│ ● Usar mi propio horario                                  │
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Lun  [x]  [10:00] - [12:00]  [+ Agregar rango]       │ │
│ │ Mar  [ ]  No disponible                               │ │
│ │ Mie  [x]  [10:00] - [12:00], [16:00] - [18:00]       │ │
│ │ Jue  [x]  [10:00] - [12:00]  [+ Agregar rango]       │ │
│ │ Vie  [x]  [10:00] - [12:00]  [+ Agregar rango]       │ │
│ │ Sab  [ ]  No disponible                               │ │
│ │ Dom  [ ]  No disponible                               │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ [Guardar]                                                 │
└────────────────────────────────────────────────────────────┘
```

**Nota:** El componente de horario semanal es reutilizable entre Settings y Profile. Crear `CallScheduleForm.tsx` en `src/components/features/`.

### 3.2 Server Action para perfil

**Archivo:** `src/lib/actions/profile.ts` (ya existe)

```typescript
// Agregar:
export async function updateUserCallSchedule(data: {
  useOwnSchedule: boolean;
  schedule?: Record<DayOfWeek, DaySlotConfig>;
})
```

Guarda en `user.preferences.callSchedule`.

---

## Fase 4: Marker de IA `[SCHEDULE-CALL]`

### 4.1 Nuevo marker en system prompt

**Archivo:** `src/lib/ai/build-system-prompt.ts`

**Agregar seccion SOLO si `callScheduleConfig.enabled === true`:**

```
=== AGENDAMIENTO DE LLAMADAS ===
Puedes agendar llamadas con el lead. Cuando el lead exprese intencion de agendar una llamada
(quiere hablar, agendar cita, reunion, llamada, videollamada, etc.), sigue este flujo:

PASO 1 - Email: Si el lead NO tiene email registrado, pidelo primero.
  Si ya tiene email, salta al paso 2.

PASO 2 - Ofrecer horarios: Los slots disponibles para los proximos dias son:
  {slotsDisponiblesTexto}
  Ofrece 3-5 opciones de diferentes dias. Si no hay slots disponibles, disculpate
  e indica que no hay horarios disponibles por el momento.

PASO 3 - Confirmar: Cuando el lead elija un horario, confirma con el formato:
  "Perfecto, tu llamada queda agendada para [dia] a las [hora]. Te enviaremos
   la confirmacion a [email]."

  Y agrega el marcador:
  [SCHEDULE-CALL: date=YYYY-MM-DD time=HH:mm email=lead@email.com]

IMPORTANTE:
- Solo ofrece slots que aparecen en la lista de arriba
- No inventes horarios
- Si el lead pide un horario que no esta disponible, ofrece el mas cercano
- El marcador [SCHEDULE-CALL] se procesa automaticamente, no lo menciones al lead
=== FIN AGENDAMIENTO ===
```

### 4.2 Generar slots para el prompt

**Archivo nuevo:** `src/lib/ai/schedule-slots.ts`

```typescript
export async function buildScheduleSlotsText(
  projectId: string,
  assignedUserId: string | null,
  locale: string
): Promise<string | null>
```

**Logica:**
1. Si no hay `callScheduleConfig` o no esta enabled → return null (no inyectar seccion)
2. Si no hay asesor asignado → usar horario del proyecto
3. Si hay asesor asignado → verificar si usa horario propio o del proyecto
4. Generar slots para los proximos 5 dias habiles
5. Consultar `scheduled_calls` para excluir ocupados
6. Formatear como texto legible: `"- Jueves 10 Abr: 3:00 PM, 3:30 PM, 4:00 PM"`
7. Si no hay slots en los proximos 5 dias → return texto indicando no disponibilidad

**Inyeccion en prompt:** Llamar desde `build-system-prompt.ts`, incluir antes de la seccion de marcadores.

### 4.3 Procesar marker en respuesta de IA

**Archivo:** `src/lib/ai/process-ai-response.ts`

**Agregar extraccion del nuevo marker (junto a los existentes):**

```typescript
// Extraer [SCHEDULE-CALL: date=YYYY-MM-DD time=HH:mm email=lead@email.com]
const scheduleMatch = rawResponse.match(
  /\[SCHEDULE-CALL:\s*date=(\d{4}-\d{2}-\d{2})\s+time=(\d{2}:\d{2})\s+email=([^\]]+)\]/i
);

if (scheduleMatch) {
  const [, date, time, email] = scheduleMatch;
  
  // 1. Actualizar email del lead si no tenia
  if (!lead.email && email) {
    await prisma.lead.update({ where: { id: leadId }, data: { email: email.trim() } });
  }
  
  // 2. Crear la llamada agendada
  const scheduledAt = parseDateTime(date, time, timezone); // Convertir a UTC
  const roomId = `kairo-${leadId.slice(0, 8)}-${Date.now().toString(36)}`;
  const jitsiUrl = `https://meet.jit.si/${roomId}`;
  
  try {
    const call = await prisma.scheduledCall.create({
      data: {
        projectId,
        leadId,
        assignedUserId: lead.assignedUserId || projectAdminId,
        scheduledAt,
        duration: callConfig.duration || 30,
        jitsiUrl,
        leadEmail: email.trim(),
        status: 'pending'
      }
    });
    
    // 3. Notificar asesor (bell + email + push)
    await notifyScheduledCall(call, project, lead);
    
    // 4. Enviar email de confirmacion al lead
    await sendCallConfirmationToLead(call, lead, project, locale);
    
  } catch (error) {
    // Si es error de unique constraint (doble-booking), NO crashear
    // El slot ya fue tomado - la IA ofrecio un slot que se ocupo mientras tanto
    // Log y continuar (el mensaje de confirmacion ya se envio pero la llamada no se creo)
    if (isUniqueConstraintError(error)) {
      console.warn('[ScheduleCall] Slot already taken, skipping');
      // Idealmente: enviar mensaje al lead diciendo que el horario ya no esta disponible
      // Pero como el msg de la IA ya se envio, se manejara en la siguiente interaccion
    }
  }
  
  // 5. Limpiar marker del mensaje visible
  cleanedMessage = cleanedMessage.replace(/\[SCHEDULE-CALL:[^\]]+\]/gi, '').trim();
}
```

---

## Fase 5: Emails de Llamada Agendada

### 5.1 Templates de email

**Archivo:** `src/lib/email.ts`

**Agregar 3 funciones nuevas:**

#### 5.1.1 Confirmacion al asesor
```typescript
export async function sendCallScheduledEmail(params: {
  recipientEmail: string;
  ccEmails: string[];
  leadName: string;
  projectName: string;
  scheduledAt: Date;
  duration: number;
  jitsiUrl: string;
  leadId: string;
  locale: 'es' | 'en';
  timezone: string;
})
```

**Contenido del email:**
```
Asunto: KAIRO - Llamada agendada con {leadName}

**Llamada agendada**
Lead: {leadName}
Proyecto: {projectName}
Fecha: Jueves 10 Abril 2026
Hora: 3:00 PM (America/Lima)
Duracion: 30 minutos

**Link de la llamada:**
[Unirse a la llamada] → jitsiUrl

**Agregar a tu calendario:**
[Google Calendar]  [Outlook]  [Descargar .ics]

[Ver lead en KAIRO] → link al lead
```

#### 5.1.2 Confirmacion al lead
```typescript
export async function sendCallConfirmationToLead(params: {
  recipientEmail: string;
  leadName: string;
  projectName: string;  // o businessName del KB
  scheduledAt: Date;
  duration: number;
  jitsiUrl: string;
  locale: 'es' | 'en';
  timezone: string;
})
```

**Contenido del email:**
```
Asunto: Confirmacion de llamada - {projectName}

Hola {leadName},

Tu llamada ha sido agendada:
Fecha: Jueves 10 Abril 2026
Hora: 3:00 PM
Duracion: 30 minutos

**Link de la llamada:**
[Unirse a la llamada] → jitsiUrl

**Agregar a tu calendario:**
[Google Calendar]  [Outlook]  [Descargar .ics]

¡Te esperamos!
{projectName}
```

#### 5.1.3 Recordatorio (reutilizable para 1h y 15min)
```typescript
export async function sendCallReminderEmail(params: {
  recipientEmail: string;
  recipientName: string;
  isAdvisor: boolean;  // cambia el tono del email
  scheduledAt: Date;
  jitsiUrl: string;
  minutesBefore: number; // 60 o 15
  locale: 'es' | 'en';
  timezone: string;
})
```

### 5.2 Generacion de links de calendario

**Archivo nuevo:** `src/lib/calendar-links.ts`

```typescript
export function generateGoogleCalendarUrl(params: {
  title: string;
  startDate: Date;
  endDate: Date;
  description: string;
  location?: string; // jitsiUrl
}): string {
  // https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...&location=...
}

export function generateOutlookCalendarUrl(params: {
  title: string;
  startDate: Date;
  endDate: Date;
  description: string;
  location?: string;
}): string {
  // https://outlook.live.com/calendar/0/action/compose?subject=...&startdt=...&enddt=...&body=...&location=...
}

export function generateICSFile(params: {
  title: string;
  startDate: Date;
  endDate: Date;
  description: string;
  location?: string;
  organizerEmail?: string;
}): string {
  // Retorna string con formato iCalendar (.ics)
  // BEGIN:VCALENDAR ... END:VCALENDAR
}
```

### 5.3 Endpoint para descargar .ics

**Archivo nuevo:** `src/app/api/calls/[callId]/ics/route.ts`

```typescript
// GET /api/calls/{callId}/ics
// Retorna archivo .ics con Content-Type: text/calendar
// Autenticacion: token en query param (generado al crear la llamada)
```

---

## Fase 6: Cron de Recordatorios

### 6.1 Nuevo endpoint cron

**Archivo nuevo:** `src/app/api/cron/call-reminders/route.ts`

```typescript
// POST /api/cron/call-reminders
// Auth: Bearer CRON_SECRET
// Frecuencia: cada 5 minutos (pg_cron)
//
// Logica:
// 1. Buscar calls con scheduledAt entre ahora+55min y ahora+65min donde reminder1hSent=false
//    → Enviar email al lead + push al asesor
//    → Marcar reminder1hSent=true
//
// 2. Buscar calls con scheduledAt entre ahora+10min y ahora+20min donde reminder15mSent=false
//    → Enviar push+email al asesor
//    → Enviar email al lead
//    → Marcar reminder15mSent=true
//
// 3. Buscar calls con scheduledAt < ahora-30min y status=pending
//    → Marcar como no_show automaticamente
```

### 6.2 Setup en Supabase pg_cron

```sql
-- Ejecutar en Supabase SQL Editor:
SELECT cron.schedule(
  'call-reminders',
  '*/5 * * * *',  -- Cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://app.kairoagent.com/api/cron/call-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## Fase 7: UI de Llamadas Agendadas

### 7.1 Badge en LeadDetailPanel

**Archivo:** `src/components/features/LeadDetailPanel.tsx`

Mostrar proxima llamada agendada en el panel del lead:

```
┌─ Proxima llamada ──────────────────────┐
│ [Tel] Jue 10 Abr, 3:00 PM               │
│ [Unirse] [Cancelar]                    │
└────────────────────────────────────────┘
```

- "Unirse" abre el link Jitsi en nueva pestana
- "Cancelar" con modal de confirmacion + motivo opcional
- Solo visible si hay una `scheduled_call` con status `pending` y `scheduledAt` futuro

### 7.2 Historial de llamadas en LeadDetailPanel

**Seccion colapsable** debajo del badge de proxima llamada:

```
▶ Historial de llamadas (3)
  │ [OK] 05 Abr, 2:00 PM - Completada
  │ [X] 01 Abr, 4:00 PM - No asistio
  │ [X] 28 Mar, 10:00 AM - Cancelada
```

### 7.3 Boton "Llamar" actualizado

El boton existente "Llamar" se mantiene para llamadas inmediatas. Agregar dropdown:

```
[▼ Llamar]
  ├── Llamar ahora (comportamiento actual)
  └── Agendar llamada (abre modal de agendamiento manual)
```

**Modal de agendamiento manual** (cuando el asesor agenda directamente, no la IA):
```
┌─ Agendar llamada con {leadName} ──────────────────┐
│                                                     │
│ Fecha: [selector de fecha]                      │
│ Hora:  [selector de slots disponibles]             │
│ Notas: [textarea opcional]                         │
│                                                     │
│ [!] Se enviara confirmacion a {leadEmail}           │
│    Si no tiene email: [input para email]           │
│                                                     │
│ [Cancelar]  [Agendar llamada]                      │
└─────────────────────────────────────────────────────┘
```

---

## Fase 8: Traducciones (i18n)

### 8.1 Nuevas keys en es.json y en.json

```json
{
  "calls": {
    "title": "Llamadas",
    "schedule": "Agendar llamada",
    "callNow": "Llamar ahora",
    "scheduledCall": "Llamada agendada",
    "nextCall": "Proxima llamada",
    "join": "Unirse",
    "cancel": "Cancelar llamada",
    "cancelReason": "Motivo de cancelacion",
    "history": "Historial de llamadas",
    "noHistory": "Sin llamadas registradas",
    "status": {
      "pending": "Pendiente",
      "completed": "Completada",
      "cancelled": "Cancelada",
      "no_show": "No asistio"
    },
    "settings": {
      "title": "Agendamiento de Llamadas",
      "description": "Permitir que el agente IA agende llamadas con los leads del proyecto.",
      "enabled": "Habilitar agendamiento",
      "duration": "Duracion por llamada",
      "minutes": "minutos",
      "scheduleTitle": "Horario disponible para llamadas",
      "addRange": "Agregar rango",
      "notAvailable": "No disponible"
    },
    "profile": {
      "title": "Mi Horario de Llamadas",
      "useProject": "Usar horario de llamadas del proyecto",
      "useOwn": "Usar mi propio horario"
    },
    "notifications": {
      "scheduled": "Llamada agendada con {name}",
      "reminder1h": "Llamada en 1 hora con {name}",
      "reminder15m": "Llamada en 15 minutos con {name}",
      "noShow": "Llamada no atendida con {name}"
    },
    "modal": {
      "title": "Agendar llamada con {name}",
      "date": "Fecha",
      "time": "Hora",
      "notes": "Notas (opcional)",
      "emailRequired": "Se requiere email del lead para enviar la confirmacion",
      "emailWillBeSent": "Se enviara confirmacion a {email}",
      "noSlots": "No hay horarios disponibles para esta fecha",
      "confirm": "Agendar llamada"
    },
    "addToCalendar": {
      "google": "Google Calendar",
      "outlook": "Outlook",
      "ics": "Descargar .ics"
    }
  }
}
```

---

## Fase 9: Seguridad

### 9.1 Validaciones

| Punto | Validacion |
|-------|-----------|
| `createScheduledCall` | Verificar que userId pertenece al proyecto |
| `createScheduledCall` | Verificar que el slot no esta ocupado (constraint BD) |
| `createScheduledCall` | Verificar que la fecha es futura (minimo 1h adelante) |
| `cancelScheduledCall` | Solo el asesor asignado o admin+ puede cancelar |
| `getAvailableSlots` | Solo miembros del proyecto |
| Cron endpoint | Bearer token `CRON_SECRET` |
| .ics download | Token unico por llamada (no auth de sesion, para que funcione desde email) |
| AI marker | Validar formato de fecha/hora/email antes de procesar |
| Doble-booking | UNIQUE constraint en BD (atomico) |

### 9.2 Rate Limits

```typescript
// En createScheduledCall:
// Max 5 llamadas agendadas por lead (status pending)
// Max 20 llamadas agendadas por asesor por semana
```

---

## Orden de Implementacion

| # | Fase | Dependencias | Estimado |
|---|------|-------------|----------|
| 1 | BD: tabla + campos + RLS + enum | Ninguna | - |
| 2 | Server Actions (CRUD + getAvailableSlots) | Fase 1 | - |
| 3 | Settings tab "Llamadas" | Fase 1, 2 | - |
| 4 | Componente reutilizable CallScheduleForm | Fase 3 | - |
| 5 | Profile: seccion horario personal | Fase 2, 4 | - |
| 6 | Calendar links + .ics | Ninguna (independiente) | - |
| 7 | Email templates (3 tipos) | Fase 6 | - |
| 8 | AI: marker [SCHEDULE-CALL] + slots en prompt | Fase 2, 7 | - |
| 9 | AI: process-ai-response extraccion | Fase 8 | - |
| 10 | Cron de recordatorios | Fase 1, 7 | - |
| 11 | UI: badge + historial + dropdown llamar | Fase 2 | - |
| 12 | UI: modal agendamiento manual | Fase 2, 11 | - |
| 13 | Traducciones i18n | Todas | - |
| 14 | Testing + Playwright validation | Todas | - |

---

## Archivos a Crear

| Archivo | Proposito |
|---------|-----------|
| `prisma/migrations/YYYYMMDD_scheduled_calls/migration.sql` | Migracion BD |
| `src/lib/actions/call-schedule.ts` | Server actions CRUD + slots |
| `src/lib/calendar-links.ts` | Generacion URLs Google/Outlook + .ics |
| `src/lib/ai/schedule-slots.ts` | Construir texto de slots para prompt |
| `src/lib/types/scheduled-call.ts` | Tipos TypeScript (interfaces, configs) |
| `src/components/features/CallScheduleForm.tsx` | Form reutilizable horario semanal |
| `src/components/features/ScheduledCallBadge.tsx` | Badge proxima llamada en panel |
| `src/components/features/ScheduledCallHistory.tsx` | Historial colapsable |
| `src/components/features/ScheduleCallModal.tsx` | Modal agendamiento manual |
| `src/app/api/cron/call-reminders/route.ts` | Cron recordatorios |
| `src/app/api/calls/[callId]/ics/route.ts` | Descarga .ics |

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Nuevo modelo + enum + relaciones + campo en Project |
| `src/app/[locale]/(dashboard)/settings/SettingsPageClient.tsx` | 5to tab "Calls" |
| `src/app/[locale]/(dashboard)/profile/page.tsx` | Seccion horario personal |
| `src/lib/ai/build-system-prompt.ts` | Seccion agendamiento + slots |
| `src/lib/ai/process-ai-response.ts` | Extraer marker [SCHEDULE-CALL] |
| `src/lib/email.ts` | 3 templates nuevos |
| `src/lib/actions/notifications.ts` | Nuevos NotificationTypes |
| `src/lib/actions/profile.ts` | updateUserCallSchedule |
| `src/components/features/LeadDetailPanel.tsx` | Badge + dropdown llamar |
| `src/messages/es.json` | Keys de llamadas |
| `src/messages/en.json` | Keys de llamadas |

---

## Edge Cases y Consideraciones

1. **Lead sin asesor asignado:** Usar horario del proyecto. La llamada queda sin `assignedUserId` hasta que se asigne uno (o asignar al admin del proyecto).

2. **Asesor cambia de horario despues de agendar:** Las llamadas ya agendadas NO se cancelan. Solo afecta futuros agendamientos.

3. **Lead intenta agendar 2 llamadas:** Permitir multiples llamadas (una a la vez como pending). La IA debe verificar si ya tiene una pendiente y preguntar si quiere reagendar.

4. **Timezone:** Todo se guarda en UTC. Se muestra en timezone del org (ya existe en WorkspaceContext). Los slots se calculan en timezone del org.

5. **IA ofrece slot que se ocupa mientras conversa:** El UNIQUE constraint previene el insert. La llamada no se crea. En la siguiente interaccion, la IA tendra slots actualizados.

6. **Cancelacion por el lead:** El lead no tiene acceso a KAIRO. Opciones futuras: link de cancelacion en el email, o decirle por WhatsApp "cancela mi llamada" y la IA procesa (marcador futuro).

7. **Llamada inmediata ("Llamar ahora"):** Se mantiene el flujo actual identico. No crea registro en `scheduled_calls`.

8. **Free tier constraints:** pg_cron cada 5min es gratis en Supabase. No hay costo adicional. Jitsi meet.jit.si es gratis. Resend free tier permite los emails de notificacion.
