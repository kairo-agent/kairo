# Programar Seguimiento - Analisis de Alternativas

> **Estado**: Pendiente de decision. Documentado Feb 2026 para abordar mas tarde.

## Infraestructura existente (70% lista)

| Componente | Estado | Detalle |
|-----------|--------|---------|
| Campo DB `nextFollowUpAt` | Listo | `DateTime?` en schema.prisma, indexado |
| Tipo TypeScript | Listo | `nextFollowUpAt?: Date` en `Lead` y `TransformedLead` |
| Queries | Listo | Incluido en `getLeadsPaginated()` y `getLeads()` |
| Display en panel | Listo | Se muestra en `LeadDetailPanel` si tiene valor |
| `updateLead()` | Falta | No acepta `nextFollowUpAt` como parametro |
| UI para setear fecha | Falta | Necesita DateTimePicker modal |
| Boton en UI | Parcial | Traduccion existe (`scheduleFollowUp`), boton con TODO en LeadCard/LeadDetailPanel |
| Cron/automatizacion | Falta | Sin sistema de recordatorios |

## Alternativas

### Opcion A: Recordatorio Visual (recomendada para MVP)

**Que hace:** Modal con date/time picker. Guarda en `nextFollowUpAt`. Badge visual en card/tabla (naranja=pendiente, rojo=vencido). El usuario revisa manualmente.

**Trabajo estimado:**
- Modal DateTimePicker (componente nuevo o libreria)
- Server action `scheduleFollowUp(leadId, date)`
- Badge visual en LeadCard, tabla inline, y panel detalle
- Indicador "vencido" si `nextFollowUpAt < now`

**Pro:** Rapido de implementar, sin dependencias nuevas, usa infraestructura existente.
**Contra:** Depende del usuario revisar activamente.

### Opcion B: Recordatorio + Notificacion In-App

**Que hace:** Todo de Opcion A + cron job que revisa `nextFollowUpAt` cada hora. Cuando vence, crea notificacion in-app (badge en sidebar, toast al entrar).

**Trabajo adicional sobre A:**
- Tabla `notifications` en DB
- Cron endpoint (similar a `/api/cron/cleanup-media`)
- Componente NotificationBell en sidebar
- Sistema de "marcar como leido"

**Pro:** El usuario no se olvida de los seguimientos.
**Contra:** Sistema de notificaciones completo (mas trabajo). Usuario debe estar logueado.

### Opcion C: Follow-up Automatico con IA (vision KAIRO)

**Que hace:** Todo de Opcion A + cuando llega la fecha, n8n dispara automaticamente un mensaje de seguimiento al lead via WhatsApp. El AI agent compone el mensaje basado en contexto de conversacion previa (RAG).

**Trabajo adicional sobre A:**
- Workflow n8n schedulado que consulta leads con `nextFollowUpAt <= now`
- Endpoint API que n8n llama para obtener leads pendientes de seguimiento
- Logica de composicion de mensaje contextual (RAG + historial)
- Campo adicional: tipo de seguimiento (`reminder_only` vs `auto_followup`)
- El usuario elige al programar: "Solo recordarme" vs "Enviar seguimiento automatico"

**Pro:** Diferencial de KAIRO - el AI actua en el momento correcto. Automatizacion real.
**Contra:** Mas complejo. Requiere workflow n8n nuevo + campo tipo de seguimiento. Riesgo de mensajes no deseados si no se configura bien.

## Recomendacion

**Implementar Opcion A primero**, con la arquitectura preparada para escalar a C:

1. El campo `nextFollowUpAt` ya existe y sirve para las 3 opciones
2. Opcion A se implementa rapido (modal + badge + server action)
3. Cuando los agents esten mas maduros, se agrega el workflow n8n para Opcion C
4. No hay que rehacer nada - es incremental

## Notas tecnicas para implementacion

- **DateTimePicker**: Evaluar `react-datepicker` o componente custom con inputs nativos
- **Timezone**: Usar timezone del usuario (campo `timezone` en tabla `users`, ya existe)
- **Server action**: Extender `updateLead()` o crear `scheduleFollowUp()` dedicado
- **Badge colores**: Naranja = seguimiento proximo (< 24h), Rojo = vencido, Gris = programado futuro
- **i18n keys existentes**: `scheduleFollowUp`, `nextFollowUp` ya definidas en es/en
