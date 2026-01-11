# KAIRO - Sistema de Gestión de Leads con IA

> **Kairos** (griego): El momento oportuno, el instante exacto donde actuar cambia el resultado.

## Quick Context

KAIRO es un SaaS B2B que automatiza y gestiona leads atendidos por sub-agentes de IA (ventas, atención, calificación). Parte del ecosistema "Lead & Click" (nombre temporal).

**Estado actual:** MVP Frontend completado, iniciando Backend (Supabase + Prisma)
**Target:** Perú → Latam → USA
**Repo:** https://github.com/kairo-agent/kairo

---

## Rutas de la Aplicación

> **Nota:** Todas las rutas usan locale dinámico: `/es/...` o `/en/...`

### Páginas Públicas (Auth)
| Ruta | Archivo | Estado |
|------|---------|--------|
| `/[locale]/login` | `src/app/[locale]/(auth)/login/page.tsx` | ✅ Completado |
| `/[locale]/register` | - | Pendiente |
| `/[locale]/forgot-password` | - | Pendiente |

### Páginas Protegidas (Dashboard)
| Ruta | Archivo | Estado |
|------|---------|--------|
| `/` | Redirect a `/[locale]/leads` | ✅ |
| `/[locale]/dashboard` | `src/app/[locale]/(dashboard)/dashboard/page.tsx` | ✅ Placeholder |
| `/[locale]/leads` | `src/app/[locale]/(dashboard)/leads/page.tsx` | ✅ Completado |
| `/[locale]/conversations` | - | Pendiente |
| `/[locale]/agents` | - | Pendiente |
| `/[locale]/reports` | - | Pendiente |
| `/[locale]/settings` | - | Pendiente |

---

## Documentación del Proyecto

| Documento | Propósito |
|-----------|-----------|
| [/docs/INDEX.md](docs/INDEX.md) | Índice maestro de toda la documentación |
| [/docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Decisiones técnicas y estructura |
| [/docs/COMPONENTS.md](docs/COMPONENTS.md) | Catálogo de componentes UI |
| [/docs/DATA-MODELS.md](docs/DATA-MODELS.md) | Modelos de datos y schemas |
| [/docs/I18N.md](docs/I18N.md) | Internacionalización, traducciones, moneda |
| [/docs/RULES.md](docs/RULES.md) | Reglas obligatorias del proyecto |
| [/docs/CHANGELOG.md](docs/CHANGELOG.md) | Historial de cambios |
| [/brand/BRANDBOOK.md](brand/BRANDBOOK.md) | Identidad visual oficial |

---

## Estructura de Archivos

```
kairo-dashboard/
├── CLAUDE.md                    # Este archivo
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout con metadata
│   │   ├── globals.css          # Variables CSS y estilos globales
│   │   └── [locale]/            # Dynamic segment para i18n
│   │       ├── layout.tsx       # NextIntlClientProvider
│   │       ├── (auth)/
│   │       │   ├── layout.tsx   # Layout auth (sin sidebar)
│   │       │   └── login/
│   │       │       └── page.tsx # Página de login
│   │       └── (dashboard)/
│   │           ├── layout.tsx   # Layout dashboard (con sidebar)
│   │           ├── page.tsx     # Redirect a /leads
│   │           ├── dashboard/
│   │           │   └── page.tsx # Dashboard home
│   │           └── leads/
│   │               └── page.tsx # Vista de leads (grid/tabla)
│   │
│   ├── components/
│   │   ├── ui/                  # Componentes base
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx        # Modal + AlertModal
│   │   │   ├── Card.tsx
│   │   │   └── Badge.tsx
│   │   ├── layout/              # Estructura
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── index.ts
│   │   └── features/            # Componentes de dominio
│   │       ├── LeadCard.tsx
│   │       ├── LeadTable.tsx
│   │       ├── LeadFilters.tsx  # Filtros colapsables con badge flotante
│   │       └── LeadDetailPanel.tsx # Panel lateral de detalle de lead
│   │
│   ├── contexts/
│   │   ├── ThemeContext.tsx     # Light/Dark theme
│   │   └── ModalContext.tsx     # Sistema de modales
│   │
│   ├── i18n/                    # Configuración i18n
│   │   ├── routing.ts           # Locales y rutas
│   │   └── request.ts           # Server-side messages
│   │
│   ├── messages/                # Archivos de traducción
│   │   ├── es.json              # Español (default)
│   │   └── en.json              # English
│   │
│   ├── lib/
│   │   └── utils.ts             # Helpers (cn, formatDate, formatCurrency, etc.)
│   │
│   ├── middleware.ts            # Detección de locale
│   │
│   ├── types/
│   │   └── index.ts             # TypeScript types, enums y configs
│   │
│   └── data/                    # Data mock
│       ├── leads.ts             # 25 leads peruanos
│       ├── agents.ts            # 4 agentes IA (Luna, Atlas, Nova, Orion)
│       ├── users.ts             # 3 usuarios
│       ├── companies.ts         # 1 empresa (TechCorp SAC)
│       └── index.ts             # Re-exports
│
├── public/
│   └── images/
│       ├── logo-main.png        # Logo para light theme
│       └── logo-oscuro.png      # Logo para dark theme
│
├── docs/
│   ├── INDEX.md
│   ├── ARCHITECTURE.md
│   ├── COMPONENTS.md
│   ├── DATA-MODELS.md
│   ├── I18N.md                  # Guía de internacionalización
│   ├── RULES.md
│   └── CHANGELOG.md
│
└── brand/
    └── BRANDBOOK.md             # Identidad visual
```

---

## Stack Tecnológico

```
Frontend:     Next.js 15 (App Router) + TypeScript
Styling:      Tailwind CSS 4 + Inter font
i18n:         next-intl (es, en)
State:        React Context (ThemeContext, ModalContext)
Backend:      Supabase (PostgreSQL) + Prisma ORM
Auth:         Supabase Auth
Validation:   Playwright MCP
Deploy:       Vercel (hosting) + GitHub (repo)
```

---

## Colores Oficiales

```css
/* Primarios */
--kairo-midnight: #0B1220;
--kairo-cyan: #00E5FF;

/* Light Theme (default) */
--bg-primary: #FFFFFF;
--bg-secondary: #F8FAFC;
--text-primary: #0B1220;

/* Dark Theme */
--bg-primary: #0B1220;
--bg-secondary: #111827;
--text-primary: #FFFFFF;
```

---

## Comandos

```bash
npm run dev      # http://localhost:3000
npm run build    # Build producción
npm run lint     # Verificar código
```

---

## Reglas del Proyecto (Ver /docs/RULES.md)

1. Validar con Playwright MCP
2. Ciberseguridad prioritaria
3. Mobile-first responsive
4. UX para "usuarios idiotas"
5. Full-width (sin max-width restrictivo)
6. Código auditable
7. Variables semánticas
8. Arquitectura escalable
9. Fields inteligentes
10. Modales elegantes (no alerts)
11. Theme light por defecto
12. **⚠️ i18n CRÍTICO**: Usar `Link` de `@/i18n/routing`, NUNCA de `next/link` (causa loop infinito)

---

## Estado del MVP

### ✅ Completado
- [x] Sistema de documentación (CLAUDE.md + /docs)
- [x] Proyecto Next.js 15 + TypeScript + Tailwind
- [x] Sistema de themes (light/dark con toggle)
- [x] Componentes UI base (Button, Input, Modal, Card, Badge)
- [x] Página de login con validación
- [x] Dashboard layout (Sidebar + Header responsive)
- [x] Vista de leads en grid (LeadCard)
- [x] Vista de leads en tabla (LeadTable)
- [x] Filtros (estado, temperatura, canal, agente)
- [x] Data mock (25 leads, 4 agentes, 3 usuarios)
- [x] Toggle vista grid/tabla persistido
- [x] **Internacionalización (i18n)** - Español/Inglés con next-intl
- [x] **Filtros colapsables** - Diseño compacto con badge flotante expandible
- [x] **Panel de detalle de lead** - LeadDetailPanel con historial y notas

### En Progreso
- [ ] Backend con Supabase + Prisma (iniciando)
- [ ] Autenticación real con Supabase Auth

### Pendiente
- [ ] CRUD completo de leads
- [ ] Página de detalle de lead
- [ ] Módulo de conversaciones
- [ ] Módulo de sub-agentes IA
- [ ] Reportes y analytics
- [ ] Moneda dinámica según configuración de empresa
- [ ] Deploy en Vercel

---

## Notas para Contexto Futuro

- El ecosistema "Lead & Click" es nombre temporal
- Supabase se usará SOLO como DB (no exponer al cliente inicialmente)
- Auth preparada para Supabase Auth + RLS en el futuro
- Data fake permite validar diseño antes de backend
- Los sub-agentes IA son: Luna (ventas), Atlas (soporte), Nova (calificación), Orion (citas)

---

## i18n Quick Reference

```typescript
// En Client Components ('use client')
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations('leads');       // Namespace principal
  const tCommon = useTranslations('common'); // Compartido

  return (
    <h1>{t('title')}</h1>
    <button>{tCommon('buttons.save')}</button>
    <span>{t(`status.${lead.status}`)}</span>  // Keys dinámicas
  );
}
```

### ⚠️ CRÍTICO: Navegación con next-intl

```typescript
// ❌ MAL - Causa loop infinito de redirección
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ✅ BIEN - Maneja automáticamente el prefijo de locale
import { Link, usePathname, useRouter, redirect } from '@/i18n/routing';
```

**¿Por qué?** El `Link` de `next/link` navega a `/dashboard` sin locale. El middleware detecta que falta el locale, intenta redirigir, y se crea un loop infinito que resulta en página en blanco.

**Ver:** `docs/RULES.md` Regla #12 para detalles completos.

**Archivos clave:**
- `src/messages/es.json` - Traducciones español
- `src/messages/en.json` - Traducciones inglés
- `src/i18n/routing.ts` - Rutas y exports de navegación
- `docs/I18N.md` - Documentación completa

**Consideraciones pendientes:**
- `formatCurrency()` usa PEN/es-PE fijo → Migrar a backend cuando se implemente
- `formatDate()` usa es-PE fijo → Considerar `useFormatter()` de next-intl
