# KAIRO - Arquitectura del Proyecto

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| Framework | Next.js (App Router) | 15.x |
| Lenguaje | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Font | Inter | Google Fonts |
| Estado | React Context | - |
| Database | Supabase (PostgreSQL) | - |
| ORM | Prisma | 5.x |
| Auth | Supabase Auth | - |
| Storage | Supabase Storage | - |
| Image Compression | browser-image-compression | 2.x |
| Deploy | Vercel | - |
| Repo | GitHub (kairo-agent/kairo) | - |

## Estructura de Carpetas

```
src/
├── app/                      # App Router (páginas)
│   ├── (auth)/              # Grupo: rutas de autenticación
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/         # Grupo: rutas protegidas
│   │   ├── layout.tsx       # Layout con sidebar
│   │   ├── page.tsx         # Dashboard home
│   │   └── leads/
│   │       └── page.tsx
│   ├── layout.tsx           # Root layout
│   ├── globals.css          # Variables CSS, themes
│   └── page.tsx             # Redirect a login o dashboard
│
├── components/              # Componentes React
│   ├── ui/                  # Primitivos reutilizables
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   └── Card.tsx
│   ├── layout/              # Estructura de página
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── PageContainer.tsx
│   └── features/            # Componentes de dominio
│       ├── LeadCard.tsx
│       ├── LeadGrid.tsx
│       ├── LeadTable.tsx
│       └── LeadFilters.tsx
│
├── contexts/                # React Contexts
│   ├── ThemeContext.tsx
│   └── AuthContext.tsx      # Mock por ahora
│
├── hooks/                   # Custom hooks
│   ├── useTheme.ts
│   └── useModal.ts
│
├── lib/                     # Utilidades
│   ├── utils.ts             # Helpers generales
│   └── cn.ts                # Classname merger
│
├── types/                   # TypeScript definitions
│   ├── lead.ts
│   ├── user.ts
│   └── company.ts
│
└── data/                    # Data fake para MVP
    ├── leads.ts
    ├── users.ts
    └── companies.ts
```

## Decisiones Arquitectónicas

### 1. Route Groups
Usamos route groups `(auth)` y `(dashboard)` para:
- Separar layouts (auth sin sidebar, dashboard con sidebar)
- Organización lógica sin afectar URLs
- Preparar para middleware de auth futuro

### 2. Server Components por Defecto
- Páginas son Server Components
- `"use client"` solo donde es necesario (interactividad)
- Data fetching en servidor

### 3. CSS Variables para Themes
```css
:root {
  --color-primary: #0B1220;
  --color-accent: #00E5FF;
}

[data-theme="dark"] {
  --color-primary: #FFFFFF;
}
```

### 4. Component Composition
```typescript
// Componentes pequeños y componibles
<Card>
  <Card.Header>
    <Card.Title>Lead Info</Card.Title>
  </Card.Header>
  <Card.Content>...</Card.Content>
</Card>
```

## Patrones de Código

### Naming Conventions
```typescript
// Componentes: PascalCase
LeadCard.tsx
UserProfile.tsx

// Hooks: camelCase con prefix "use"
useTheme.ts
useLeadFilters.ts

// Utils: camelCase
formatDate.ts
validateEmail.ts

// Types: PascalCase con suffix descriptivo
LeadStatus (enum)
LeadData (interface)
```

### File Co-location
Archivos relacionados juntos:
```
components/features/LeadCard/
├── LeadCard.tsx
├── LeadCard.types.ts      # Si los tipos son complejos
└── index.ts               # Re-export
```

## Data Flow

```
MVP (actual):
[Data Fake] → [Context/Props] → [Component] → [UI]

Backend (en desarrollo):
[Supabase PostgreSQL] → [Prisma ORM] → [API Routes / Server Actions] → [Component] → [UI]
```

## Backend Architecture

### ¿Por qué Supabase + Prisma?

| Decisión | Razón |
|----------|-------|
| **Supabase** | PostgreSQL hosted, Auth integrado, free tier generoso |
| **Prisma** | Tipado automático, migraciones, queries type-safe |
| **API Routes** | Next.js maneja backend sin servidor separado |
| **React Query** | Cache client-side, deduplicación, sincronización |

### Estructura Backend (planeada)

```
src/
├── app/
│   └── api/                    # API Routes
│       ├── leads/
│       │   ├── route.ts        # GET /api/leads, POST /api/leads
│       │   └── [id]/
│       │       └── route.ts    # GET, PUT, DELETE /api/leads/:id
│       └── auth/
│           └── [...nextauth]/
├── lib/
│   └── prisma.ts               # Cliente Prisma singleton
└── prisma/
    └── schema.prisma           # Modelos de datos
```

### Prisma Schema (planeado)

Los modelos en `src/types/index.ts` se migrarán a `prisma/schema.prisma`:
- Lead, User, Company, AIAgent
- Relaciones y constraints
- Enums compartidos

## Internacionalización (i18n)

> Documentación completa en [I18N.md](I18N.md)

### Stack

| Librería | Propósito |
|----------|-----------|
| next-intl | Traducciones y routing por locale |

### Locales

- `es` - Español (default)
- `en` - English

### Uso Rápido

```typescript
'use client';
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations('leads');
  const tCommon = useTranslations('common');

  return (
    <h1>{t('title')}</h1>
    <button>{tCommon('buttons.save')}</button>
  );
}
```

### Consideraciones

1. **Moneda**: `formatCurrency()` usa PEN/es-PE fijo (ver I18N.md para futuro)
2. **Fechas**: `formatDate()` usa es-PE fijo
3. **Nuevos componentes**: Siempre usar `useTranslations`, nunca hardcodear texto

---

## Orquestación de Agentes IA (n8n)

> Documentación completa en [N8N-SETUP.md](N8N-SETUP.md)

### Resumen

| Componente | Tecnología | Hosting |
|------------|------------|---------|
| Orquestador | n8n (self-hosted) | Railway (~$5-10/mes) |
| Canal | WhatsApp Cloud API | Meta |
| IA | OpenAI / Anthropic | API |

### Arquitectura

```
WhatsApp → n8n (Railway) → KAIRO API → Supabase
                ↓
            IA (RAG)
```

### Desarrollo Local

- Docker + n8n local
- ngrok (URL dinámica) o Cloudflare Tunnel (URL fija con dominio)

---

## Seguridad Arquitectónica

1. **No secrets en cliente** - Todo en `.env.local`
2. **Validación server-side** - Aunque haya validación en cliente
3. **Sanitización** - Todos los inputs
4. **CSP Headers** - Configurados en `next.config.ts`

---

## Estrategia de Caching y Performance (v0.6.0)

> Documentación completa en [PERFORMANCE.md](PERFORMANCE.md)

### Capas de Cache

```
┌─────────────────────────────────────────────────────────────┐
│                    KAIRO CACHING LAYERS                      │
│                                                              │
│  1. React cache() (Server)                                   │
│     ├─ Scope: Single request                                │
│     ├─ Location: Node.js request memory                     │
│     └─ Use: Deduplicate auth queries                        │
│                                                              │
│  2. In-Memory Cache (Server)                                 │
│     ├─ Scope: Cross-request, TTL 5 min                      │
│     ├─ Location: Node.js process memory                     │
│     └─ Use: WhatsApp phoneNumberId → projectId              │
│                                                              │
│  3. React Query (Client)                                     │
│     ├─ Scope: Browser session, TTL 30s, gcTime 5min         │
│     ├─ Location: Browser RAM (NOT localStorage)             │
│     └─ Use: Chat messages, infinite pagination              │
│                                                              │
│  4. Next.js Static Cache (Server)                            │
│     ├─ Scope: Build-time + revalidation                     │
│     ├─ Location: Edge/Server filesystem                     │
│     └─ Use: Static pages, translations                      │
└─────────────────────────────────────────────────────────────┘
```

### 1. Request-Scoped Caching (React cache)

**Archivos:**
- `src/lib/actions/auth.ts` - `getCurrentUser()`
- `src/lib/auth-helpers.ts` - `getCurrentUser()`, `verifySuperAdmin()`

**Patrón:**

```typescript
import { cache } from 'react';

export const getCurrentUser = cache(async () => {
  // Esta función solo se ejecuta 1 vez por request
  // aunque se llame 10 veces en diferentes componentes
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  // ...
});
```

**Beneficio:** Reducción de ~60-70% en queries duplicadas de autenticación.

### 2. In-Memory Cache (Webhooks WhatsApp)

**Archivo:** `src/app/api/webhooks/whatsapp/route.ts`

**Implementación:**

```typescript
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const phoneNumberIdCache = new Map<string, CachedProject>();

function getCachedProject(phoneNumberId: string) {
  const cached = phoneNumberIdCache.get(phoneNumberId);
  if (!cached) return undefined;

  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    phoneNumberIdCache.delete(phoneNumberId);
    return undefined;
  }

  return cached.project;
}
```

**Beneficio:** Reducción de ~95% en queries de lookup después del primer mensaje.

### 3. React Query (Client-Side)

**Archivo:** `src/providers/QueryProvider.tsx`

**Configuración:**

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,        // 30 segundos
      gcTime: 5 * 60 * 1000,       // 5 minutos
      retry: 1,
      refetchOnWindowFocus: false,
      placeholderData: (prev) => prev,
    },
  },
});
```

**Uso - Infinite Query para Mensajes:**

```typescript
// src/components/features/LeadChat.tsx
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['conversation', leadId],
  queryFn: async ({ pageParam }) => {
    return getLeadConversation(leadId, {
      cursor: pageParam,
      limit: 50
    });
  },
  initialPageParam: undefined,
  getNextPageParam: (lastPage) => lastPage?.pagination?.nextCursor,
  staleTime: 30000,
  gcTime: 5 * 60 * 1000,
});
```

**Beneficio:**
- ~80% reducción en payload inicial para conversaciones largas
- Cache hit rate ~90% al re-abrir chats recientes

### 4. Cursor-Based Pagination (Backend)

**Archivo:** `src/lib/actions/messages.ts`

**Tipo exportado:**

```typescript
export type PaginatedConversation = {
  conversation: ConversationWithMessages | null;
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
    totalCount: number;
  };
};
```

**Firma:**

```typescript
export async function getLeadConversation(
  leadId: string,
  options?: {
    cursor?: string;  // ID del mensaje desde donde cargar
    limit?: number;   // Máximo 100, default 50
  }
): Promise<PaginatedConversation | null>
```

**Algoritmo:**

1. Obtener mensajes con `orderBy: { createdAt: 'desc' }` (más recientes primero)
2. Tomar `limit + 1` mensajes (para saber si hay más)
3. Si `length > limit`, hay más páginas
4. Invertir array para orden cronológico
5. `nextCursor` = ID del mensaje más antiguo en el batch

**Beneficio:** Conversaciones de 500 mensajes cargan 50 iniciales (12KB vs 120KB).

### Seguridad del Cache

| Dato | Cache Permitido | Ubicación |
|------|-----------------|-----------|
| Tokens de autenticacion | [-] NO | Solo server-side (Supabase) |
| Mensajes de chat | [x] SI | React Query (RAM, no localStorage) |
| Credenciales WhatsApp | [-] NO | Solo DB encriptado |
| Preferencias UI | [x] SI | localStorage (tema, vista, workspace) |
| User info (auth) | [x] SI | React cache() (request-scoped) |

**Principio:** Nunca persistir datos sensibles en localStorage. React Query usa solo RAM.

---

## Sistema de Secrets Encriptados (v0.5.0)

### Arquitectura de Encriptación

```
┌─────────────────────────────────────────────────────────────┐
│                    SECRETS FLOW                              │
│                                                             │
│  [User Input] → [Server Action] → [AES-256-GCM] → [DB]      │
│                                                             │
│  Componentes:                                               │
│  - src/lib/crypto/secrets.ts     # Módulo de encriptación   │
│  - src/lib/actions/secrets.ts    # Server Actions CRUD      │
│  - prisma/schema.prisma          # ProjectSecret model      │
└─────────────────────────────────────────────────────────────┘
```

### Algoritmo: AES-256-GCM

| Característica | Valor |
|----------------|-------|
| Algoritmo | AES-256-GCM (autenticado) |
| Clave | 32 bytes (256 bits) desde env |
| IV | 12 bytes aleatorios por secret |
| Auth Tag | 16 bytes para verificación |

### Variables de Entorno

```bash
# Generar clave: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SECRETS_ENCRYPTION_KEY=<hex_64_chars>
```

### Modelo de Datos

```prisma
model ProjectSecret {
  id             String    @id @default(cuid())
  projectId      String
  key            String    // whatsapp_access_token, openai_api_key, etc.
  encryptedValue String    // Valor encriptado (base64)
  iv             String    // Vector de inicialización (base64)
  authTag        String    // Tag de autenticación (base64)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  lastAccessedAt DateTime?

  project Project @relation(fields: [projectId], references: [id])
  @@unique([projectId, key])
}

model SecretAccessLog {
  id         String   @id @default(cuid())
  projectId  String
  secretKey  String
  userId     String?
  action     String   // read, write, delete
  ipAddress  String?
  userAgent  String?
  timestamp  DateTime @default(now())
}
```

### Tipos de Secrets Soportados

```typescript
type SecretKey =
  | 'whatsapp_access_token'
  | 'whatsapp_phone_number_id'
  | 'whatsapp_business_account_id'
  | 'openai_api_key'
  | 'anthropic_api_key';
```

---

## Gestión de Agentes IA (v0.5.0)

### Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                   AI AGENTS PER PROJECT                      │
│                                                             │
│  Project                                                     │
│    └── AIAgent[] (1 proyecto = N agentes)                   │
│          ├── Luna (sales) ─────→ Lead[]                      │
│          ├── Atlas (support) ──→ Lead[]                      │
│          ├── Nova (qualification) → Lead[]                   │
│          └── Orion (appointment) → Lead[]                    │
│                                                             │
│  Cada lead tiene exactamente 1 agente asignado              │
└─────────────────────────────────────────────────────────────┘
```

### Tipos de Agentes

| Tipo | Emoji | Descripción |
|------|-------|-------------|
| `sales` | [maletin] | Conversiones y cierre de ventas |
| `support` | [auriculares] | Atencion al cliente |
| `qualification` | [grafico] | Calificacion y scoring de leads |
| `appointment` | [calendario] | Agendamiento de citas |

### Server Actions

```typescript
// src/lib/actions/agents.ts
getProjectAgents(projectId)      // Lista agentes del proyecto
getAgent(agentId)                // Obtener por ID
createAgent(input)               // Crear nuevo
updateAgent(agentId, input)      // Actualizar
deleteAgent(agentId)             // Eliminar (validación de leads)
toggleAgentStatus(agentId)       // Activar/desactivar
```

### Permisos

- Solo usuarios con rol `admin` o `manager` en el proyecto
- Super admins tienen acceso total
- No se puede eliminar agente con leads asignados

---

## Sistema de Envío de Archivos Multimedia (v0.6.0)

> Documentación completa en [MEDIA-UPLOAD.md](MEDIA-UPLOAD.md)

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│               FLUJO DE MULTIMEDIA A WHATSAPP                     │
│                                                                  │
│  Browser → Supabase Storage → KAIRO DB → n8n → WhatsApp API     │
│                                                                  │
│  Bypass: Límite de 4.5MB de Vercel Server Actions               │
└─────────────────────────────────────────────────────────────────┘
```

### Características Principales

| Funcionalidad | Descripción |
|---------------|-------------|
| **Upload Directo** | Browser → Supabase Storage (sin pasar por Vercel) |
| **Compresión Automática** | Imágenes >1MB se comprimen a <1MB |
| **Seguridad RLS** | Solo ProjectMembers pueden subir archivos |
| **Tipos Soportados** | Imágenes, Video MP4, PDF, Word, Excel, TXT |
| **Tamaños Máximos** | Imágenes: 3MB, Videos: 16MB, Documentos: 16MB |
| **Filename Preservation** | Documentos mantienen nombre original en WhatsApp |
| **Caption Support** | Texto del usuario acompaña a multimedia |

### Componentes Principales

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| ChatInput | `src/components/features/ChatInput.tsx` | UI de selección de archivos |
| useMediaUpload | `src/hooks/useMediaUpload.ts` | Upload directo a Supabase |
| LeadChat | `src/components/features/LeadChat.tsx` | Orquestación y compresión |
| sendMessage | `src/lib/actions/messages.ts` | Server Action: DB + n8n |
| n8n Workflow | Railway | Envío a WhatsApp Cloud API |

### Tipos de Archivos

```typescript
// Imágenes (máx 3MB)
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Video (máx 16MB) - Solo MP4
const VIDEO_TYPES = ['video/mp4']; // WhatsApp solo acepta H.264 + AAC

// Documentos (máx 16MB)
const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];
```

### Rutas de Almacenamiento

**Bucket**: `media` (público)

**Path**: `{projectId}/{year}/{month}/{uuid}.{ext}`

**Ejemplo**: `cm50s9z8j0001l70827o3h27q/2026/01/a3f7b9c1-4d2e-4f5a-8b6c-1d3e5f7a9b2c.jpg`

### Seguridad

#### Row-Level Security (RLS)

```sql
-- Policy: Solo ProjectMembers pueden subir
CREATE POLICY "Users can upload to their projects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'media'
  AND split_part(name, '/', 1) IN (
    SELECT "projectId" FROM "ProjectMember"
    WHERE "userId" = auth.uid()
  )
);
```

#### Validación Multi-Capa

1. **Cliente**: HTML5 `accept` attribute
2. **Hook**: Validación de tipo y tamaño
3. **RLS**: Verificación de permisos en Supabase

### Implementaciones Específicas (2026-01-24)

#### 1. Soporte de Documentos

Agregado soporte para PDF, Word, Excel y TXT con validación específica.

**Archivos modificados**:
- `src/hooks/useMediaUpload.ts`
- `src/lib/actions/media.ts`
- `src/components/features/ChatInput.tsx`

#### 2. Filename para Documentos

Los documentos ahora mantienen su nombre original al llegar a WhatsApp.

**Flujo**:
1. `ChatInput` captura `file.name`
2. `LeadChat` extrae filename
3. `sendMessage` pasa filename a n8n
4. n8n mapea filename en payload de WhatsApp

**Archivos modificados**:
- `src/components/features/LeadChat.tsx`
- `src/lib/actions/messages.ts`
- n8n: Nodo "Prepare Human Response"

#### 3. Caption para Multimedia

El texto del usuario ahora acompaña a imágenes, videos y documentos.

**Flujo**:
1. Usuario escribe texto y adjunta archivo
2. `LeadChat` separa texto original (caption) del content de DB
3. `sendMessage` pasa caption a n8n
4. n8n incluye caption en payload de WhatsApp

**Archivos modificados**:
- `src/components/features/LeadChat.tsx`
- `src/lib/actions/messages.ts`
- n8n: Nodos "Prepare Human Response" y "Send to WhatsApp"

#### 4. Restricción de Video a MP4

WhatsApp solo acepta MP4 con H.264 + AAC. WebM y otros formatos no están soportados.

**Cambio**:
```typescript
// Antes: accept="video/*"
// Después: accept="video/mp4"
<input type="file" accept="video/mp4" />
```

### Limitaciones de WhatsApp

| Tipo | Límite WhatsApp | Límite KAIRO |
|------|-----------------|--------------|
| Imagen | 5 MB | 3 MB |
| Video | 16 MB | 16 MB (solo MP4) |
| Documento | 100 MB | 16 MB |
| Caption | 1024 caracteres | 1024 caracteres |

### Roadmap

- [ ] Soporte de audio (MP3, OGG, M4A)
- [ ] Preview avanzado de multimedia
- [ ] Drag & Drop de archivos
- [ ] Progress bar de upload
- [ ] Gestión de cuota de Storage por proyecto
