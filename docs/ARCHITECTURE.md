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
| `sales` | 💼 | Conversiones y cierre de ventas |
| `support` | 🎧 | Atención al cliente |
| `qualification` | 📊 | Calificación y scoring de leads |
| `appointment` | 📅 | Agendamiento de citas |

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
