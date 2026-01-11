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

## Seguridad Arquitectónica

1. **No secrets en cliente** - Todo en `.env.local`
2. **Validación server-side** - Aunque haya validación en cliente
3. **Sanitización** - Todos los inputs
4. **CSP Headers** - Configurados en `next.config.ts`
