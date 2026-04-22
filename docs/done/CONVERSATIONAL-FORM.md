# Formulario Conversacional - Plan de Implementacion

> **Status:** Implementado (2026-04-01)
> **Version:** v0.22.0
> **Fecha de planificacion:** 2026-03-23

**Notas de implementacion:**
- RLS requirio `auth.uid()::text` cast (Supabase espera text, no uuid por defecto)
- Varios fixes i18n post-deploy: key `enabledHelp` → `enabledDesc`, ~15 keys faltantes, `LEAD_FIELD_MAPPINGS` labelKeys sin prefijo `settings.` (bug de doble-scope)
- Toggle race condition resuelta con `loadingForm` state para prevenir async overwrite
- Ver **[Hallazgos post-implementacion](#hallazgos-post-implementacion)** al final para mejoras no contempladas en el plan original (pre-fill desde Lead profile + confirmacion de nombres de WhatsApp).

---

## Concepto

El usuario (dueno del negocio) configura campos que el agente IA debe recopilar del lead durante la conversacion de WhatsApp. El agente pregunta de forma **natural** (no como formulario), trackea que datos ya tiene, y auto-llena campos del lead.

### Flujo ejemplo

```
Lead: "Hola, vi su publicidad"
Agente: "Hola! Bienvenido. Me podrias contar tu nombre y que servicio te interesa?"
        [interno: faltan nombre, servicio, presupuesto]

Lead: "Soy Carlos, quiero saber sobre limpieza"
Agente: "Un gusto Carlos! Tenemos varios planes..."
        "Tienes un presupuesto estimado?"
        [interno: nombre=Carlos, servicio=limpieza, falta presupuesto]

Lead: "Trabajan fines de semana?"
Agente: "Si, sabados de 8am a 2pm..."
        "Por cierto Carlos, para armarte la mejor propuesta, manejas un rango de presupuesto?"
        [interno: reintenta presupuesto naturalmente]

Lead: "Unos 500 soles"
        [interno: nombre=Carlos, servicio=limpieza, presupuesto=500 -> auto-fill lead]
```

**Principio clave:** Responder primero la pregunta del lead, luego introducir la pregunta pendiente. Nunca ignorar al lead para preguntar datos.

---

## Arquitectura

```
                    +-------------------+
                    |  Settings UI      |
                    |  (Tab 4: Form)    |
                    +---------+---------+
                              | save
                              v
                    +-------------------+
                    | agent.formConfig  |  <- JSONB en AIAgent
                    | (por agente)      |
                    +---------+---------+
                              | inject
                              v
+-----------+    +------------------------------+    +---------------+
| Lead msg  |--->| buildSystemPrompt()          |--->| GPT-4o-mini   |
|           |    | + "DATOS A RECOPILAR"         |    |               |
+-----------+    | ok Nombre: Carlos             |    | Responde +    |
                 | xx Presupuesto: pendiente     |    | [FORM-DATA:   |
                 +------------------------------+    |  budget=500]  |
                                                     +-------+-------+
                                                             | extract
                                                             v
                                                     +---------------+
                                                     |lead_form_data |
                                                     |+ lead fields  |
                                                     +---------------+
```

### Lo que NO cambia

- Flujo de mensajes (webhook -> debounce -> AI -> WhatsApp)
- Como se guardan mensajes en BD
- Summary automatico
- Instrucciones, reglas, KB existentes
- Scoring de temperatura / handoff / reengagement

---

## Decisiones de diseno

| Decision | Eleccion | Razon |
|----------|----------|-------|
| Scope | **Por agente** (no por proyecto) | Cada agente tiene proposito diferente; consistente con instrucciones/reengagement |
| Storage config | **JSONB en AIAgent** (`formConfig`) | Es 1:1 con agente, mismo patron que `reEngagementConfig` |
| Storage datos | **Tabla `lead_form_data`** | 1:1 por lead x agente, queries independientes |
| Extraccion datos | **Marcador `[FORM-DATA:]`** en respuesta GPT | Mismo patron que `[TEMPERATURA:]` y `[HANDOFF]`, probado y confiable |
| Ubicacion UI | **Tab 4 en Settings: "Formulario"** | No es instruccion, ni knowledge, ni reengagement — merece tab propio |
| Max campos | **8** | Evitar interrogatorio; suficiente para datos clave |
| Trigger mode | **immediate** o **on_interest** (WARM+) | Flexibilidad: no espantar leads frios |

---

## FASE 1: Database Schema

**Archivos:** `prisma/schema.prisma` + SQL en Supabase
**Complejidad:** Baja

### 1.1 Modificar modelo AIAgent

Agregar campo `formConfig` (JSONB) junto a `reEngagementConfig`:

```prisma
model AIAgent {
  // ... campos existentes ...
  reEngagementConfig Json?
  formConfig         Json?     // <-- NUEVO: configuracion del formulario conversacional
  // ... resto ...
}
```

### 1.2 Crear modelo LeadFormData

```prisma
model LeadFormData {
  id             String    @id @default(cuid())
  leadId         String
  agentId        String
  fieldData      Json      @default("{}")   // { "nombre": "Carlos", "presupuesto": "500" }
  completedAt    DateTime?                   // set cuando todos los required estan completos
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  lead           Lead      @relation(fields: [leadId], references: [id], onDelete: Cascade)
  agent          AIAgent   @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@unique([leadId, agentId])
  @@map("lead_form_data")
}
```

### 1.3 Agregar relacion en Lead

```prisma
model Lead {
  // ... campos existentes ...
  formData       LeadFormData[]
}
```

### 1.4 Agregar relacion en AIAgent

```prisma
model AIAgent {
  // ... campos existentes ...
  formData       LeadFormData[]
}
```

### 1.5 Migrar

```bash
npx prisma migrate dev --name add-conversational-form
```

### 1.6 RLS en Supabase SQL Editor

```sql
-- Verificar RLS habilitado (deberia ser automatico por trigger)
ALTER TABLE "lead_form_data" ENABLE ROW LEVEL SECURITY;

-- Politica basada en project membership (patron identico a leads)
CREATE POLICY "lead_form_data_project_member" ON "lead_form_data"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "leads" l
      JOIN "project_members" pm ON pm."projectId" = l."projectId"
      WHERE l.id = "lead_form_data"."leadId"
      AND pm."userId" = auth.uid()
    )
  );
```

---

## FASE 2: Types y Constants

**Archivo nuevo:** `src/lib/types/form-template.ts`
**Patron a seguir:** `src/lib/types/reengagement.ts`

```typescript
// Tipos del formulario conversacional

export type FormFieldType = 'text' | 'email' | 'number' | 'phone' | 'options';
export type FormTriggerMode = 'immediate' | 'on_interest';

export interface FormField {
  key: string;          // slug unico (ej: "nombre", "presupuesto")
  label: string;        // label visible (ej: "Nombre completo")
  type: FormFieldType;
  required: boolean;
  options?: string[];   // solo si type === 'options'
  leadFieldMapping?: string | null;  // ej: 'firstName', 'email', 'estimatedValue'
  order: number;
}

export interface FormConfig {
  isActive: boolean;
  triggerMode: FormTriggerMode;
  maxFields: number;
  fields: FormField[];
}

export const MAX_FORM_FIELDS = 8;

export const DEFAULT_FORM_CONFIG: FormConfig = {
  isActive: false,
  triggerMode: 'immediate',
  maxFields: MAX_FORM_FIELDS,
  fields: [],
};

// Campos del lead que pueden mapearse automaticamente
export const LEAD_FIELD_MAPPINGS = [
  { value: 'firstName', labelKey: 'settings.form.mapping.firstName' },
  { value: 'lastName', labelKey: 'settings.form.mapping.lastName' },
  { value: 'email', labelKey: 'settings.form.mapping.email' },
  { value: 'phone', labelKey: 'settings.form.mapping.phone' },
  { value: 'businessName', labelKey: 'settings.form.mapping.businessName' },
  { value: 'position', labelKey: 'settings.form.mapping.position' },
  { value: 'estimatedValue', labelKey: 'settings.form.mapping.estimatedValue' },
] as const;

// Genera un key slug a partir del label
export function generateFieldKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30);
}
```

---

## FASE 3: Server Actions

### 3.1 `src/lib/actions/form-template.ts`

**Patron:** identico a `reengagement.ts`

```typescript
'use server'

// Zod schemas para validacion
// getFormConfig(agentId: string): Promise<FormConfig>
//   - Fetch agent.formConfig
//   - Merge con DEFAULT_FORM_CONFIG si null
//   - Verificar auth + project membership
//
// saveFormConfig(agentId: string, config: FormConfig): Promise<void>
//   - Validar con Zod
//   - Verificar auth + project membership + role ADMIN/MANAGER
//   - prisma.aIAgent.update({ where: { id: agentId }, data: { formConfig: config } })
```

### 3.2 `src/lib/actions/lead-form-data.ts`

```typescript
'use server'

// getLeadFormData(leadId: string, agentId: string): Promise<Record<string, string>>
//   - findUnique por [leadId, agentId]
//   - Retorna fieldData o {} si no existe
//
// bulkUpdateLeadFormFields(leadId: string, agentId: string, fields: Record<string, string>, formConfig: FormConfig): Promise<void>
//   - Upsert lead_form_data con merge de fieldData existente + nuevos campos
//   - Para cada campo con leadFieldMapping, actualizar el Lead
//   - Verificar si todos los required estan completos -> set completedAt
//   - NO necesita auth check (llamado internamente desde AI pipeline)
```

---

## FASE 4: AI Pipeline Integration

**Archivos a modificar:** `build-system-prompt.ts`, `process-ai-response.ts`
**Complejidad:** Alta (corazon de la feature)

### 4.1 build-system-prompt.ts

Agregar a `SystemPromptParams`:
```typescript
formFields?: {
  pending: Array<{ key: string; label: string; type: string; required: boolean; options?: string[] }>;
  collected: Record<string, string>;
};
```

Nueva seccion en el prompt (despues de CONTEXTO PREVIO, antes de HISTORIAL):

```
=== DATOS A RECOPILAR (FORMULARIO) ===
Datos ya obtenidos:
- Nombre: Carlos
- Servicio: Limpieza

Datos pendientes (REQUERIDOS):
- Presupuesto (numero)

Datos pendientes (opcionales):
- Email (email)

INSTRUCCIONES DE RECOPILACION:
1. Recopila los datos faltantes de forma NATURAL durante la conversacion
2. Pregunta MAXIMO 1-2 datos por mensaje
3. SIEMPRE responde primero la pregunta del lead, luego introduce tu pregunta
4. Si el lead no quiere responder algo, no insistas — continua la conversacion
5. Cuando detectes un dato en la respuesta del lead, incluyelo en el marcador

MARCADOR OBLIGATORIO (al final de tu respuesta):
[FORM-DATA: key1=valor1 | key2=valor2]
Solo incluye datos que el lead haya proporcionado en ESTE mensaje.
Si no hay datos nuevos, NO incluyas el marcador.
```

### 4.2 process-ai-response.ts

Cambios en orden:

a) Expandir `AIProcessParams` con `formConfig?: FormConfig | null`

b) Despues de RAG search (Step 2), agregar Step 2b:
```typescript
// Si form activo y trigger aplica (immediate o WARM+), cargar form data
let formFields = undefined;
if (formConfig?.isActive) {
  const shouldInject = formConfig.triggerMode === 'immediate'
    || ['HOT', 'WARM'].includes(currentTemperature);
  if (shouldInject) {
    const collected = await getLeadFormData(leadId, agentId);
    const pending = formConfig.fields.filter(f => !collected[f.key]);
    formFields = { pending, collected };
  }
}
```

c) Pasar `formFields` a `buildSystemPrompt()`

d) Despues de extraer `[TEMPERATURA:]` (Step 5), extraer `[FORM-DATA:]`:
```typescript
const formDataMatch = rawResponse.match(/\[FORM-DATA:\s*(.+?)\]/i);
if (formDataMatch) {
  const pairs = formDataMatch[1].split('|').map(p => p.trim());
  const extracted: Record<string, string> = {};
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key && valueParts.length) {
      extracted[key.trim()] = valueParts.join('=').trim();
    }
  }
  // Fire-and-forget update
  bulkUpdateLeadFormFields(leadId, agentId, extracted, formConfig).catch(console.error);
}
```

e) Limpiar marcador antes de enviar:
```typescript
cleanMessage = cleanMessage.replace(/\[FORM-DATA:[^\]]*\]/gi, '').trim();
```

### Graceful degradation

- Si GPT no genera el marcador -> no pasa nada, solo no se recopilan datos
- Si GPT genera datos incorrectos -> se sobrescriben en siguiente interaccion
- Si formConfig es null/undefined -> se salta todo (0 impacto)

---

## FASE 5: Frontend - Settings UI

**Archivos a modificar:** `SettingsPageClient.tsx`, `es.json`, `en.json`
**Complejidad:** Media-Alta

### 5.1 i18n keys (~25 keys nuevas)

```json
{
  "settings": {
    "tabs": {
      "form": "Formulario"
    },
    "form": {
      "title": "Formulario Conversacional",
      "description": "Define los datos que el agente debe recopilar del lead durante la conversacion.",
      "enabled": "Formulario activo",
      "enabledDesc": "El agente recopilara estos datos durante la conversacion.",
      "triggerMode": "Momento de activacion",
      "triggerImmediate": "Desde el inicio",
      "triggerImmediateDesc": "Empieza a recopilar datos desde el primer mensaje.",
      "triggerOnInterest": "Cuando muestre interes",
      "triggerOnInterestDesc": "Solo recopila datos cuando el lead es WARM o HOT.",
      "fields": "Campos a recopilar",
      "fieldCount": "{count} / {max} campos",
      "addField": "Agregar campo",
      "fieldLabel": "Nombre del campo",
      "fieldType": "Tipo",
      "fieldRequired": "Requerido",
      "fieldOptions": "Opciones (separadas por coma)",
      "fieldMapping": "Auto-llenar campo del lead",
      "fieldMappingNone": "Ninguno",
      "noFields": "No hay campos configurados.",
      "maxFieldsReached": "Maximo de {max} campos alcanzado.",
      "mapping": {
        "firstName": "Nombre",
        "lastName": "Apellido",
        "email": "Email",
        "phone": "Telefono",
        "businessName": "Nombre del negocio",
        "position": "Cargo",
        "estimatedValue": "Valor estimado"
      },
      "types": {
        "text": "Texto",
        "email": "Email",
        "number": "Numero",
        "phone": "Telefono",
        "options": "Opciones"
      }
    }
  }
}
```

### 5.2 SettingsPageClient.tsx

a) Expandir `SettingsTab` type: agregar `'form'`
b) Agregar estados: `formConfig`, `originalFormConfig`, `loadingForm`, `savingForm`
c) Agregar `loadForm()` callback (patron identico a `loadReEngagement`)
d) Agregar al `useEffect` de carga inicial y cambio de agente
e) Agregar `handleSaveForm()` handler
f) Agregar `hasUnsavedForm` computed
g) Agregar 4to tab button con icono (ClipboardListIcon o similar)
h) Renderizar `FormTemplateTab` cuando `activeTab === 'form'`

### 5.3 FormTemplateTab (componente)

Estructura UI:
1. **Header** — titulo + descripcion
2. **Toggle isActive** — copiar patron de ReEngagement
3. **Selector triggerMode** — radio buttons (immediate / on_interest)
4. **Counter** — "X / 8 campos"
5. **Lista de campos con DnD** — reusar `@dnd-kit` ya importado
   - Cada fila: drag handle | label | type badge | required star | mapping badge | edit/delete
6. **Form inline "Agregar campo"** — aparece al click:
   - Input label
   - Select type
   - Toggle required
   - Input options (solo si type=options)
   - Select leadFieldMapping
   - Botones agregar/cancelar
7. **Boton Save** con indicador de unsaved changes

---

## FASE 6: Webhook Integration

**Archivo:** `src/app/api/webhooks/whatsapp/route.ts`
**Complejidad:** Baja

En los selects de agente, agregar `formConfig: true`:
```typescript
select: { id: true, name: true, systemInstructions: true, promptStructure: true, formConfig: true }
```

En construccion de params para `processAIResponse()`:
```typescript
formConfig: lead.assignedAgent?.formConfig as FormConfig | null,
```

---

## FASE 7: Testing

| Test | Verificar |
|------|-----------|
| Settings UI | Crear form 3-4 campos, save/load, drag-and-drop, toggle, trigger mode |
| Prompt injection | System prompt incluye seccion "DATOS A RECOPILAR" con campos correctos |
| Data extraction | Lead dice "me llamo Juan" -> GPT genera `[FORM-DATA: nombre=Juan]` -> se guarda |
| Lead mapping | Campo mapeado a `firstName` -> lead.firstName se actualiza |
| Trigger on_interest | Lead COLD -> formulario no se inyecta; lead WARM -> si se inyecta |
| Form desactivado | isActive=false -> no se inyecta nada (0 impacto) |
| Max campos | No permite agregar mas de 8 |
| Sin formulario | Agente sin formConfig -> pipeline funciona igual que antes |

---

## Riesgos y mitigaciones

| Riesgo | Mitigacion |
|--------|------------|
| GPT no genera marcador FORM-DATA consistentemente | Instrucciones claras en prompt; si falla, no rompe nada (graceful degradation) |
| GPT extrae datos incorrectos | Se sobrescriben en siguiente interaccion; el usuario puede corregir en UI del lead |
| SettingsPageClient.tsx ya tiene ~2380 lineas | Si FormTemplateTab > 200 lineas, extraer a componente separado |
| Pipeline latency | Solo 1 query Prisma extra (~5ms), impacto minimo |
| RLS en lead_form_data | Seguir patron de las 16 tablas existentes con RLS |

---

## Resumen de archivos

| Accion | Archivo |
|--------|---------|
| Crear | `src/lib/types/form-template.ts` |
| Crear | `src/lib/actions/form-template.ts` |
| Crear | `src/lib/actions/lead-form-data.ts` |
| Modificar | `prisma/schema.prisma` |
| Modificar | `src/lib/ai/build-system-prompt.ts` |
| Modificar | `src/lib/ai/process-ai-response.ts` |
| Modificar | `src/app/api/webhooks/whatsapp/route.ts` |
| Modificar | `src/app/[locale]/(dashboard)/settings/SettingsPageClient.tsx` |
| Modificar | `src/messages/es.json` |
| Modificar | `src/messages/en.json` |
| SQL | RLS policy para `lead_form_data` en Supabase |

---

## Hallazgos post-implementacion

Durante implementacion y testing se agregaron mejoras no contempladas en el plan original.

### 1. Pre-fill desde Lead profile (no solo lead_form_data)

**Ubicacion:** [process-ai-response.ts:215-270](../src/lib/ai/process-ai-response.ts#L215-L270) (Step 2c)

El plan original asumia que el `collected` del formulario venia unicamente de `lead_form_data` (datos que el AI ya extrajo en conversaciones previas). En la implementacion real, ademas se pre-rellenan campos con `leadFieldMapping` desde los datos existentes del Lead (`firstName`, `lastName`, `email`, `phone`, `businessName`, `position`, `estimatedValue`).

**Por que:** Si el formulario pide "email" y el lead ya tiene email registrado (por ejemplo desde un form externo previo), no tiene sentido que el agente vuelva a preguntar. Se pre-llena y se considera "ya recopilado".

```typescript
const [formCollected, leadRecord] = await Promise.all([
  getLeadFormData(leadId, params.agentId),
  prisma.lead.findUnique({
    where: { id: leadId },
    select: { firstName: true, lastName: true, email: true, phone: true, businessName: true, position: true, estimatedValue: true },
  }),
]);
const collected = { ...formCollected };
for (const field of params.formConfig.fields) {
  if (collected[field.key]) continue;                 // AI ya lo recopilo
  if (!field.leadFieldMapping) continue;              // campo sin mapping
  const leadVal = leadRecord?.[field.leadFieldMapping];
  if (leadVal) collected[field.key] = String(leadVal);
}
```

### 2. `unconfirmedKeys`: confirmacion de nombres del perfil de WhatsApp

**Ubicacion:** [process-ai-response.ts:241-265](../src/lib/ai/process-ai-response.ts#L241-L265) + [build-system-prompt.ts:128-133](../src/lib/ai/build-system-prompt.ts#L128-L133)

**Problema detectado:** WhatsApp permite al usuario poner **cualquier texto** en su nombre de perfil (nombre de negocio, telefono, apodo, emojis). Si pre-llenamos `firstName` desde ese campo sin confirmar, el agente tratara al lead con un nombre posiblemente incorrecto.

**Solucion:** Cuando un campo mapeado a `firstName` o `lastName` se pre-rellena desde el perfil de WhatsApp, se agrega su `key` a un `Set<string>` llamado `unconfirmedKeys`. El system prompt recibe este set y modifica la lista de "datos ya obtenidos":

```
Datos ya obtenidos:
- nombre: Juan Perez (del perfil de WhatsApp - confirma con el lead si es su nombre real)
- email: juan@example.com
```

El agente asi sabe que debe confirmar ese valor en la conversacion antes de darlo por bueno. Para otros campos (`email`, `phone`, `businessName`, etc.) NO se flagea: son datos mas confiables.

### 3. Validacion `isValidPersonName` para descartar valores invalidos

**Ubicacion:** [process-ai-response.ts:256](../src/lib/ai/process-ai-response.ts#L256)

Antes de pre-llenar un campo `firstName`/`lastName` desde el perfil de WhatsApp, se valida con `isValidPersonName(strVal)`. Si falla (pure digits, solo simbolos, etc.) se **omite** el pre-fill por completo — el formulario sigue pidiendo ese campo normalmente.

Esto evita casos como `firstName = "+51999888777"` o `firstName = "🔥🔥🔥"`.

### 4. Temperatura en lowercase, no uppercase

**Ubicacion:** [process-ai-response.ts:227](../src/lib/ai/process-ai-response.ts#L227)

El plan FASE 4.2 asumia `['HOT', 'WARM']` para el check de `triggerMode === 'on_interest'`. La implementacion real usa lowercase porque el campo `Lead.temperature` en BD se guarda en minusculas:

```typescript
shouldInject = ['hot', 'warm'].includes(currentTemp || '');
```

### 5. `on_interest` consulta temperatura actual desde BD

**Ubicacion:** [process-ai-response.ts:221-228](../src/lib/ai/process-ai-response.ts#L221-L228)

El plan original sugeria usar la temperatura del contexto del pipeline. La implementacion hace un `prisma.lead.findUnique` adicional para leer la temperatura **persistida** — asi se respeta la ultima clasificacion guardada, no la que el pipeline podria estar calculando en el mismo turno.

```typescript
if (!shouldInject) {
  const currentLead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { temperature: true },
  });
  shouldInject = ['hot', 'warm'].includes(currentLead?.temperature || '');
}
```

**Costo:** 1 query Prisma extra (~5ms) solo cuando `triggerMode === 'on_interest'`.
