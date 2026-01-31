# KAIRO - Sistema de Gestión de Leads con IA

> **Kairos** (griego): El momento oportuno, el instante exacto donde actuar cambia el resultado.

---

## Identidad del Equipo

| Rol | Nombre | Descripción |
|-----|--------|-------------|
| **Usuario** | **Leo** | Fundador y líder del proyecto KAIRO |
| **Asistente IA** | **Adan** | Project Leader técnico (Claude), orquestador de sub-agentes |

> **IMPORTANTE**: Esta información debe persistir entre sesiones y compactaciones de contexto. Adan siempre debe dirigirse al usuario como "Leo".

## Quick Context

KAIRO es un SaaS B2B que automatiza y gestiona leads atendidos por sub-agentes de IA (ventas, atención, calificación). Parte del ecosistema "Lead & Click" (nombre temporal).

**Estado actual:** v0.7.5 - Backend 100%, Frontend 90% - Auth real, CRUD leads (R/U), WhatsApp webhook + multimedia, paginación server-side, React Query caching, Phase 3 Performance completada, **RAG Fases 1-4 COMPLETADAS ✅**, **n8n en Railway (producción)**, **Bot responde con nombre de KAIRO + personalidad RAG**, **Solo 1 agente activo por proyecto**, **Historial de conversaciones IA ✅**
**Target:** Perú → Latam → USA
**Repo:** https://github.com/kairo-agent/kairo
**Producción:** https://app.kairoagent.com/
**n8n:** n8n-production-5d42.up.railway.app

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
| `/[locale]/profile` | `src/app/[locale]/(dashboard)/profile/page.tsx` | ✅ Completado |
| `/[locale]/select-workspace` | `src/app/[locale]/select-workspace/page.tsx` | ✅ Completado |
| `/[locale]/conversations` | - | Pendiente |
| `/[locale]/agents` | - | Pendiente |
| `/[locale]/reports` | - | Pendiente |
| `/[locale]/settings` | - | Pendiente |

### Páginas de Administración (Solo Super Admin)
| Ruta | Archivo | Estado |
|------|---------|--------|
| `/[locale]/admin` | `src/app/[locale]/(admin)/admin/page.tsx` | ✅ Completado |
| `/[locale]/admin/organizations` | Integrado en admin/page.tsx (tabs) | ✅ |
| `/[locale]/admin/projects` | Integrado en admin/page.tsx (tabs) | ✅ |
| `/[locale]/admin/users` | Integrado en admin/page.tsx (tabs) | ✅ |

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
| [/docs/RAG-AGENTS.md](docs/RAG-AGENTS.md) | Sistema RAG para agentes IA |
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
│   │   │   ├── PhoneInput.tsx   # ⚠️ OBLIGATORIO para teléfonos (i18n)
│   │   │   ├── Modal.tsx        # Modal + AlertModal
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── LoadingOverlay.tsx
│   │   │   ├── Pagination.tsx
│   │   │   ├── DateRangePicker.tsx # Selector de rango de fechas
│   │   │   └── index.ts         # Re-exports
│   │   ├── layout/              # Estructura
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── WorkspaceSelector.tsx
│   │   │   └── index.ts
│   │   ├── admin/               # Componentes de administración
│   │   │   ├── AdminSidebar.tsx # Sidebar específico para admin
│   │   │   ├── OrganizationModal.tsx
│   │   │   ├── ProjectModal.tsx
│   │   │   ├── ProjectSettingsModal.tsx # Config de secretos WhatsApp/n8n
│   │   │   ├── UserModal.tsx
│   │   │   └── DeleteConfirmModal.tsx
│   │   ├── icons/               # Iconos personalizados
│   │   │   └── ChannelIcons.tsx # Iconos de canales (WhatsApp, etc.)
│   │   └── features/            # Componentes de dominio
│   │       ├── LeadCard.tsx
│   │       ├── LeadTable.tsx
│   │       ├── LeadFilters.tsx  # Filtros colapsables con badge flotante
│   │       ├── LeadDetailPanel.tsx # Panel lateral de detalle de lead
│   │       ├── LeadEditModal.tsx # Modal para editar lead
│   │       ├── LeadChat.tsx     # Chat WhatsApp con status indicators
│   │       └── ChatInput.tsx    # Input de chat con emojis y adjuntos
│   │
│   ├── contexts/
│   │   ├── ThemeContext.tsx     # Light/Dark theme
│   │   ├── ModalContext.tsx     # Sistema de modales
│   │   ├── WorkspaceContext.tsx # Org/Project seleccionado
│   │   └── LoadingContext.tsx   # Estado de carga global
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
│   │   ├── utils.ts             # Helpers (cn, formatDate, formatCurrency, etc.)
│   │   ├── rbac.ts              # Role-Based Access Control helpers
│   │   ├── crypto/              # Funciones de encriptación
│   │   │   └── secrets.ts       # AES-256-GCM para secrets
│   │   ├── supabase/            # Configuración Supabase + Prisma
│   │   │   ├── client.ts        # Cliente browser
│   │   │   └── server.ts        # Cliente server + Prisma singleton
│   │   ├── openai/              # Integraciones OpenAI
│   │   │   └── embeddings.ts    # Generación de embeddings (RAG)
│   │   ├── utils/               # Utilidades adicionales
│   │   │   └── chunking.ts      # Chunking de texto para RAG
│   │   ├── auth-helpers.ts      # verifySuperAdmin, getCurrentUser
│   │   ├── rate-limit.ts        # Rate limiting (memoria/Redis)
│   │   └── actions/             # Server Actions
│   │       ├── admin.ts         # CRUD Organizations, Projects, Users
│   │       ├── agents.ts        # CRUD AIAgent por proyecto
│   │       ├── auth.ts          # signIn, signOut, getCurrentUser, getSession
│   │       ├── knowledge.ts     # CRUD Agent Knowledge (RAG)
│   │       ├── leads.ts         # CRUD Leads
│   │       ├── media.ts         # Upload/delete media a Supabase Storage
│   │       ├── messages.ts      # Chat, handoff, markAsRead, mediaUrl
│   │       ├── profile.ts       # getProfile, updateProfile, changePassword
│   │       ├── secrets.ts       # CRUD Project Secrets (encriptados)
│   │       └── workspace.ts     # getOrganizations, getProjects (selector)
│   │
│   ├── app/api/
│   │   ├── auth/verify-admin/   # Verificar si usuario es super_admin
│   │   ├── admin/stats/         # Estadísticas del panel admin
│   │   ├── ai/respond/          # ⭐ NUEVO: Guardar respuesta IA + enviar a WhatsApp (usado por n8n)
│   │   ├── webhooks/
│   │   │   ├── whatsapp/        # Recibir mensajes de WhatsApp Cloud API
│   │   │   └── n8n/             # Webhook para eventos de conversación
│   │   ├── whatsapp/
│   │   │   ├── send/            # Enviar mensajes a WhatsApp (proxy, NO guarda en BD)
│   │   │   └── mark-read/       # Marcar mensajes como leídos (read receipts)
│   │   ├── messages/confirm/    # Callback de n8n para confirmar envío (legacy)
│   │   ├── rag/search/          # Búsqueda semántica RAG para n8n
│   │   └── cron/cleanup-media/  # Limpieza automática de archivos >24h
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
│   ├── RAG-AGENTS.md            # Sistema RAG para agentes IA
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
13. **Orquestación con Sub-agentes**: Adan (Claude) como Project Leader, usar plugins eficientemente, validar al 100% con Playwright antes de confirmar
14. **⚠️ PhoneInput OBLIGATORIO**: Para campos de teléfono usar SIEMPRE `PhoneInput` de `@/components/ui/PhoneInput` (formato E.164, i18n automático, validación con libphonenumber-js)

---

## Estado del MVP (Actualizado Enero 2026)

### ✅ Completado
- [x] Sistema de documentación (CLAUDE.md + /docs)
- [x] Proyecto Next.js 15 + TypeScript + Tailwind
- [x] Sistema de themes (light/dark con toggle)
- [x] Componentes UI base (Button, Input, Modal, Card, Badge, PhoneInput, Pagination)
- [x] **Autenticación real con Supabase Auth** - Login/logout/sesión funcional
- [x] **Middleware de seguridad** - Verificación de sesión, roles, protección OWASP
- [x] Dashboard layout (Sidebar + Header responsive)
- [x] Vista de leads en grid (LeadCard) y tabla (LeadTable)
- [x] **Paginación server-side** - 25 leads/página con metadata completa
- [x] **Filtros server-side** - Status, temperature, channel, búsqueda full-text, rango de fechas
- [x] Toggle vista grid/tabla persistido
- [x] **Internacionalización (i18n)** - Español/Inglés con next-intl
- [x] **PhoneInput con i18n** - Selector de país, banderas, nombres en es/en, formato E.164
- [x] **Panel de detalle de lead** - LeadDetailPanel con historial y notas
- [x] **Backend con Supabase + Prisma** - Modelos multi-tenant completos
- [x] **Panel de Administración** - CRUD completo para Orgs, Projects, Users
- [x] **Arquitectura multi-tenant** - Organization → Project → User con RBAC
- [x] **Página de Perfil** - Editar perfil, cambiar contraseña, ver membresías
- [x] **Validación de contraseña avanzada** - Requisitos en tiempo real, barra de fortaleza
- [x] **CRUD Leads (Read/Update)** - Conectado a BD Prisma
- [x] **Sistema de Notas** - Crear/listar notas por lead con auditoría
- [x] **Historial de Actividad** - Registro completo de cambios por lead
- [x] **Workspace Selector** - Cambio dinámico de Org/Project
- [x] **Sub-Agentes IA en BD** - Modelo AIAgent con asignación a leads
- [x] **API Routes** - /api/auth/verify-admin, /api/admin/stats, /api/webhooks/n8n
- [x] **Integración n8n** - Webhook para eventos de conversación
- [x] **WhatsApp Cloud API** - Webhook directo para recibir mensajes, crear leads automáticamente
- [x] **Botón Refresh Leads** - Actualización manual de grilla (ahorro de requests vs polling)
- [x] **Project Secrets (AES-256-GCM)** - Almacenamiento seguro de tokens WhatsApp/API keys
- [x] **ProjectSettingsModal** - UI para configurar secretos por proyecto en Admin
- [x] **Gestión de Agentes IA** - CRUD completo en ProjectSettingsModal (crear, editar, eliminar, toggle status)
- [x] **Server Actions Agents** - `src/lib/actions/agents.ts` con validación de permisos
- [x] **Conversaciones/Chat** - Backend y frontend completos con Realtime
- [x] **Endpoint /api/whatsapp/send** - Proxy directo a WhatsApp Cloud API para n8n
- [x] **Trigger a n8n** - Webhook dispara n8n cuando `handoffMode === 'ai'`
- [x] **API /api/messages/confirm** - Callback de n8n para confirmar envío
- [x] **Seguridad API /api/whatsapp/send** - Auth Supabase + verificación de membresía
- [x] **Seguridad API /api/messages/confirm** - Shared secret via header X-N8N-Secret
- [x] **Seguridad Webhook WhatsApp** - Verificación HMAC-SHA256 (X-Hub-Signature-256)
- [x] **Index.ts completos** - Exports centralizados en layout/, admin/, features/
- [x] **Deploy en Vercel** - Producción en https://app.kairoagent.com/
- [x] **Envío de imágenes/videos WhatsApp** - Upload directo a Supabase Storage (hasta 16MB) + envío via n8n
- [x] **Media Cleanup Cron** - Eliminación automática de archivos >24h (Vercel Cron)
- [x] **Performance Phase 1** - Request-scoped caching con React cache() para auth (~60-70% menos queries)
- [x] **Performance Phase 2** - Cursor-based pagination + React Query useInfiniteQuery (~80% menos payload)
- [x] **Performance Phase 3** - Consolidación auth-helpers + fire-and-forget markMessagesAsRead (~200-300ms menos latencia)
- [x] **RAG Fase 1** - pgvector + tabla agent_knowledge + funciones RPC (insert/search)
- [x] **RAG Fase 2** - Server Actions knowledge.ts + embeddings OpenAI + chunking
- [x] **RAG Fase 3** - UI en ProjectSettingsModal (tab Conocimiento) con i18n
- [x] **RAG Fix** - search_agent_knowledge corregida (parámetro TEXT consistente con insert_agent_knowledge)
- [x] **n8n en Producción (Railway)** - Deploy de n8n + PostgreSQL con template oficial
- [x] **Supabase Realtime Fix** - RLS policies SELECT para broadcasts en tabla messages
- [x] **Webhook WhatsApp → n8n mejorado** - Envía `agentId`, `agentName`, `companyName` para RAG
- [x] **Auto-asignación de agente** - Leads nuevos reciben primer agente activo del proyecto
- [x] **Restricción 1 agente activo** - Solo un agente puede estar activo por proyecto (radio button)
- [x] **UI Gestión de Agentes mejorada** - Selector de iconos (emojis), toggle rojo/verde, spinner de carga
- [x] **RAG Fase 4 COMPLETADA** - Flujo end-to-end funcional: WhatsApp → KAIRO → n8n → RAG → OpenAI → WhatsApp
- [x] **Bot con identidad dinámica** - Responde usando nombre del agente configurado en KAIRO (no hardcodeado)
- [x] **Auto-asignación de agentes a leads legacy** - Leads existentes sin agente reciben agente activo
- [x] **Endpoint /api/ai/respond** - n8n guarda mensaje IA en BD + envía a WhatsApp en un solo paso
- [x] **Historial de conversaciones IA** - Mensajes del bot se guardan correctamente con `sender: 'ai'`

### 🔄 Parcial
- [ ] **Dashboard Home** - UI placeholder, stats no conectados a BD

### ❌ Pendiente
- [ ] **Crear Lead** - No hay server action ni UI
- [ ] **Archivar Lead** - Usar status `archived` en lugar de eliminar (ver nota abajo)
- [ ] **Página de Reportes** - No existe ruta /reports
- [ ] **Página de Settings** - No existe ruta /settings
- [ ] **Página de Agentes** - No existe ruta /agents (solo asignación en cards)
- [ ] Moneda dinámica según configuración de organización

---

## Arquitectura Multi-Tenant

```
┌─────────────────────────────────────────────────────────────┐
│                        SYSTEM                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Users (systemRole: SUPER_ADMIN | USER)                  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                     ORGANIZATION                             │
│  - defaultTimezone (IANA string)                            │
│  - defaultLocale (es-PE, en-US, etc.)                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ OrganizationMember (isOwner: boolean)                   │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                       PROJECT                                │
│  - plan: FREE | STARTER | PROFESSIONAL | ENTERPRISE         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ProjectMember (role: ADMIN | MANAGER | AGENT | VIEWER)  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                        LEADS                                 │
│  - Pertenecen a un Project                                  │
│  - Asignados a un Agent (AIAgent)                           │
└─────────────────────────────────────────────────────────────┘
```

### Roles y Permisos

| Rol | Alcance | Capacidades |
|-----|---------|-------------|
| `SUPER_ADMIN` | Sistema | Todo: CRUD orgs, projects, users, leads |
| `USER` | Sistema | Acceso según membresías |
| `Owner` | Organización | Admin de org + todos sus projects |
| `ADMIN` | Proyecto | CRUD leads, asignar agentes, config |
| `MANAGER` | Proyecto | Gestión de leads, reportes |
| `AGENT` | Proyecto | Ver/editar leads asignados |
| `VIEWER` | Proyecto | Solo lectura |

---

## Notas para Contexto Futuro

- El ecosistema "Lead & Click" es nombre temporal
- Supabase se usa como DB con Prisma ORM (Server Actions)
- **Auth con Supabase Auth ya implementada** - Login/logout funcional, middleware verifica sesión
- Timezone/Locale se configuran a nivel de organización (12 zonas IANA curadas para Latam/USA)
- Los sub-agentes IA son: Luna (ventas), Atlas (soporte), Nova (calificación), Orion (citas)
- **Teléfonos en formato E.164** - Todos los leads tienen prefijo +51 (Perú)
- **n8n Webhooks** - Integración lista en project.n8nWebhookUrl para eventos de chat
- **WhatsApp Webhook** - `/api/webhooks/whatsapp` recibe mensajes y crea leads automáticamente
- **Performance** - Ver [PERFORMANCE.md](docs/PERFORMANCE.md) para detalles de optimizaciones (Phases 1-3 completadas)
- **UX Improvements** - Loading overlays en login/logout, scroll blocking en paneles, animación wave mejorada
- **Realtime deshabilitado en modo IA** - Por diseño, en `LeadChat.tsx:305`. En modo Human hay sincronización real-time, en modo IA el usuario debe hacer refresh manual

---

## Decisiones de Negocio

### ⚠️ NO Eliminar Leads (Decisión Enero 2026)

**Decisión:** No implementar funcionalidad de eliminación de leads.

**Razones comerciales:**
1. **Remarketing futuro** - Lead "frío" hoy puede convertirse en cliente en 6 meses
2. **Análisis de datos** - Histórico completo para métricas de conversión, CAC, tiempo de cierre
3. **Auditoría** - Trazabilidad de todas las interacciones para compliance
4. **Machine Learning** - Más datos = mejores predicciones de scoring a futuro

**Alternativa implementar:**
- Usar estado `archived` (ya existe en enum `LeadStatus`)
- Lead archivado desaparece de vista activa pero se conserva en BD
- Puede recuperarse si es necesario
- Cuenta para reportes históricos

**TODO pendiente:**
- [ ] UI para cambiar lead a status `archived` desde LeadDetailPanel
- [ ] Filtro para mostrar/ocultar leads archivados
- [ ] Acción batch para archivar múltiples leads

---

### Arquitectura Híbrida con n8n (Decisión Enero 2026)

**Decisión:** Usar n8n para la capa de IA y orquestación de agentes, manteniendo KAIRO para webhooks, almacenamiento y UI.

**Análisis realizado:**
- Sin n8n: 7-12 días de desarrollo, prompts hardcodeados, cada cambio requiere deploy
- Con n8n: 5-8 días de desarrollo, prompts editables sin deploy, multi-canal fácil

**Arquitectura definida:**

```
┌─────────────────────────────────────────────────────────────┐
│                    KAIRO (Next.js)                          │
│                                                             │
│  ✓ Webhooks de entrada (WhatsApp, FB, Instagram)           │
│  ✓ Almacenamiento de mensajes/leads (Prisma + Supabase)    │
│  ✓ Dashboard y UI de chat                                   │
│  ✓ CRUD de leads y configuración                           │
│  ✓ Envío de mensajes a WhatsApp (API)                      │
│                                                             │
│  → Trigger a n8n cuando modo BOT activo                    │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      n8n Workflows                          │
│                                                             │
│  → Lógica de agentes IA (prompts de Luna, Atlas, Nova...)  │
│  → Orquestación entre agentes (escalado, routing)          │
│  → Nodos nativos: OpenAI, Claude, Memory, Tools            │
│  → Prompts editables sin deploy                            │
│  → Notificaciones (email, Slack)                           │
│  → Integraciones futuras (CRM, calendarios)                │
│                                                             │
│  ← Responde via API de KAIRO (/api/ai/respond)             │
│    (guarda en BD + envía a WhatsApp en un solo paso)       │
└─────────────────────────────────────────────────────────────┘
```

**Soporte multi-canal en n8n:**

| Canal | Soporte n8n | Método |
|-------|-------------|--------|
| WhatsApp | ✅ HTTP Request | Meta Cloud API |
| Facebook Messenger | ✅ Nodo nativo | Plug-and-play |
| Instagram DM | ⚠️ HTTP Request | Meta Graph API |

**Ventajas clave:**
1. **Prompts editables** - Ajustar agentes IA sin deploy
2. **Multi-canal** - Un workflow sirve para todos los canales
3. **Observabilidad** - Ver cada ejecución paso a paso
4. **Demo-friendly** - Flujo visual para mostrar a clientes
5. **Costo** - ~$20/mes n8n Cloud vs horas de desarrollo

**TODO implementar:**
- [x] Endpoint `/api/whatsapp/send` para que n8n envíe mensajes ✅
- [x] Trigger a n8n en webhook cuando `handoffMode === 'ai'` ✅
- [x] Callback `/api/messages/confirm` para confirmar envío desde n8n ✅
- [x] Setup n8n en Railway (producción) ✅
- [x] Workflow "KAIRO - Basic Response" funcional ✅
- [x] Endpoint `/api/ai/respond` para guardar + enviar en un paso ✅
- [x] Workflow con RAG + OpenAI + identidad dinámica del agente ✅

---

## n8n en Railway (Producción)

### Información del Deploy

- **Plataforma:** Railway (https://railway.app/)
- **Template:** n8n + PostgreSQL (template oficial)
- **URL:** n8n-production-5d42.up.railway.app
- **Base de datos:** PostgreSQL 16 (Railway internal service)

### Variables de Entorno (Railway)

```bash
# PostgreSQL (auto-configuradas por Railway)
POSTGRES_DB=railway
POSTGRES_HOST=postgres.railway.internal
POSTGRES_PASSWORD=<generado_por_railway>
POSTGRES_PORT=5432
POSTGRES_USER=postgres
DB_TYPE=postgresdb

# n8n Configuration
N8N_HOST=n8n-production-5d42.up.railway.app
N8N_PORT=5678
N8N_PROTOCOL=https
NODE_ENV=production
WEBHOOK_URL=https://n8n-production-5d42.up.railway.app/
```

### Sincronización con KAIRO

**En Vercel (KAIRO):**
```bash
N8N_CALLBACK_SECRET=<shared_secret>
```

**En Railway (n8n workflow):**
- Nodo "Confirm to KAIRO": Header `X-N8N-Secret: <shared_secret>`

**En KAIRO Admin UI:**
- ProjectSettingsModal → Tab Webhooks → n8nWebhookUrl
- Formato: `https://n8n-production-5d42.up.railway.app/webhook/<webhook_id>`

### Workflows Actuales

| Workflow | Descripción | Estado |
|----------|-------------|--------|
| KAIRO - Basic Response | Respuesta automática simple a mensajes WhatsApp | ✅ Activo |
| KAIRO - AI Agent Handler | Orquestación de agentes con RAG | ⏳ Pendiente |

### Acceso a n8n

- **URL Admin:** https://n8n-production-5d42.up.railway.app/
- **Credenciales:** Configuradas en Railway (no en repo)

### Backup y Mantenimiento

- **Workflows exportados:** Guardar localmente como `.json` antes de cambios críticos
- **Base de datos:** Railway hace backups automáticos (retención según plan)
- **Monitoreo:** Railway Dashboard muestra logs en tiempo real

---

## Panel de Administración Quick Reference

```typescript
// Acceso: Solo usuarios con systemRole === 'super_admin'
// Ruta: /[locale]/admin

// Server Actions disponibles (src/lib/actions/admin.ts)
import {
  // Organizations
  createOrganization,   // { name, slug, description?, logoUrl?, defaultTimezone?, defaultLocale? }
  updateOrganization,   // (id, { name?, slug?, description?, logoUrl?, isActive?, defaultTimezone?, defaultLocale? })
  deleteOrganization,   // (id)

  // Projects
  createProject,        // { organizationId, name, slug, description?, logoUrl? }
  updateProject,        // (id, { name?, slug?, description?, logoUrl?, plan?, isActive? })
  deleteProject,        // (id)

  // Users
  createUser,           // { email, firstName, lastName, systemRole, generatePassword?, password?, organizationId?, isOrgOwner?, projectId?, projectRole? }
  updateUser,           // (id, { firstName?, lastName?, systemRole?, isActive?, avatarUrl? })
  deleteUser,           // (id)

  // Memberships
  joinOrganization,     // (orgId) - unirse como miembro
  joinProject,          // (projectId) - unirse con rol VIEWER

  // Data fetching
  getAdminOverviewData, // (filters) - returns stats + entities
} from '@/lib/actions/admin';
```

### Componentes de Admin
- `OrganizationModal`: Crear/Editar orgs con timezone/locale
- `ProjectModal`: Crear/Editar projects con plan
- `ProjectSettingsModal`: Config de secretos WhatsApp/n8n + CRUD Agentes IA
- `UserModal`: Crear/Editar users con password generation
- `DeleteConfirmModal`: Confirmación de eliminación reutilizable
- `AdminSidebar`: Sidebar específico para panel admin

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

---

## Project Secrets (Encriptación AES-256-GCM)

Sistema de almacenamiento seguro para tokens y API keys por proyecto.

### Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    SECRETS STORAGE                           │
├─────────────────────────────────────────────────────────────┤
│  ProjectSecret (prisma/schema.prisma)                       │
│  - projectId: String                                         │
│  - key: "whatsapp_access_token" | "openai_api_key" | etc.   │
│  - encryptedValue: String (AES-256-GCM encrypted)           │
│  - iv: String (Initialization Vector)                       │
│  - authTag: String (Authentication tag)                     │
│  - keyVersion: Int (for key rotation)                       │
├─────────────────────────────────────────────────────────────┤
│  SecretAccessLog (audit trail)                              │
│  - action: "read" | "write" | "delete"                      │
│  - userId, ipAddress, userAgent, timestamp                  │
└─────────────────────────────────────────────────────────────┘
```

### Uso

```typescript
// Guardar secretos (solo admin del proyecto)
import { setProjectSecrets } from '@/lib/actions/secrets';

await setProjectSecrets(projectId, {
  whatsapp_access_token: 'EAAGm...',
  whatsapp_phone_number_id: '123456789',
  whatsapp_business_account_id: '987654321',
});

// Leer secreto (solo server-side, uso interno)
import { getProjectSecret } from '@/lib/actions/secrets';
const token = await getProjectSecret(projectId, 'whatsapp_access_token');

// Verificar qué secretos están configurados
import { getProjectSecretsStatus } from '@/lib/actions/secrets';
const { configured } = await getProjectSecretsStatus(projectId);
// { whatsapp_access_token: true, openai_api_key: false, ... }
```

### Seguridad

- **Encriptación**: AES-256-GCM (confidencialidad + integridad)
- **IV único**: Cada encriptación genera un IV aleatorio de 128 bits
- **Auth tag**: Detecta cualquier manipulación de datos
- **Key en env**: `SECRETS_ENCRYPTION_KEY` (64 hex chars = 32 bytes)
- **Audit log**: Cada acceso queda registrado con IP, user agent, timestamp

### Configuración

Variable de entorno requerida:
```bash
# Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SECRETS_ENCRYPTION_KEY=<64_caracteres_hexadecimales>
```

### UI Admin

En el Panel de Administración → tab Proyectos → botón "Configurar" (icono de bot):
- **WhatsApp**: Access Token, Phone Number ID, Business Account ID
- **Agentes IA**: CRUD completo de sub-agentes por proyecto
- **Webhooks**: n8n webhook URL

---

## WhatsApp Cloud API Integration

### Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                 WHATSAPP MESSAGE FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   WhatsApp User                                              │
│       │                                                      │
│       ▼                                                      │
│   Meta Cloud API                                             │
│       │                                                      │
│       ▼                                                      │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  /api/webhooks/whatsapp                              │   │
│   │  ├── GET: Verificación de Meta                       │   │
│   │  └── POST: Recibir mensajes                          │   │
│   └─────────────────────────────────────────────────────┘   │
│       │                                                      │
│       ▼                                                      │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│   │ Find Project│────▶│ Find/Create │────▶│ Store       │   │
│   │ by PhoneID  │     │ Lead        │     │ Message     │   │
│   └─────────────┘     └─────────────┘     └─────────────┘   │
│       │                                                      │
│       ▼                                                      │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  sendReadReceipt() → WhatsApp Cloud API              │   │
│   │  Lead ve ✓✓ azul (mensaje "leído" por bot)          │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Read Receipt Automático

Cuando el webhook recibe un mensaje de un lead, KAIRO envía automáticamente un read receipt a WhatsApp. Esto hace que el lead vea ✓✓ azul en sus mensajes enviados.

```typescript
// Función en /api/webhooks/whatsapp/route.ts
async function sendReadReceipt(projectId: string, messageId: string) {
  // POST https://graph.facebook.com/v21.0/{phoneNumberId}/messages
  // { messaging_product: 'whatsapp', status: 'read', message_id: messageId }
}
```

- Se ejecuta en background (fire-and-forget) para no bloquear el response
- Usa las mismas credenciales del proyecto (access_token, phone_number_id)
- Errores se loguean pero no afectan el flujo principal

### Endpoint

```typescript
// GET - Verificación de webhook (Meta)
GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...

// POST - Recibir mensajes
POST /api/webhooks/whatsapp
Content-Type: application/json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "metadata": { "phone_number_id": "123..." },
        "messages": [{ "from": "51999888777", "text": {...} }]
      }
    }]
  }]
}
```

### Variables de Entorno

```bash
# Token de verificación (cualquier string, debe coincidir con Meta)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=kairo_wh_v3r1fy_2026

# App Secret de Meta (para verificación HMAC de webhooks)
# Lo encuentras en: Meta Developer Console → Tu App → Settings → Basic → App Secret
WHATSAPP_APP_SECRET=<tu_app_secret_de_meta>

# Secret compartido para callbacks de n8n
N8N_CALLBACK_SECRET=<tu_secret_para_n8n>

# Vercel Cron Jobs (media cleanup)
CRON_SECRET=<tu_secret_para_cron>

# Solo desarrollo (NO usar en producción):
BYPASS_AUTH_DEV=true           # Bypass auth en /api/whatsapp/send
WEBHOOK_BYPASS_SIGNATURE=true  # Bypass verificación HMAC en webhook
```

### Desarrollo Local con ngrok

```bash
# Terminal 1: KAIRO
npm run dev

# Terminal 2: ngrok
ngrok http 3000

# Configurar en Meta:
# URL: https://xxx.ngrok-free.dev/api/webhooks/whatsapp
# Token: kairo_wh_v3r1fy_2026
```

### Tipos de Mensaje Soportados

| Tipo | Campo | Soportado |
|------|-------|-----------|
| Texto | `text.body` | ✅ |
| Imagen | `image.id` + `caption` | ✅ |
| Audio | `audio.id` | ✅ |
| Video | `video.id` + `caption` | ✅ |
| Documento | `document.id` + `filename` | ✅ |
| Ubicación | `location.latitude/longitude` | ⏳ |
| Contactos | `contacts[].name` | ⏳ |

### Flujo de Lead Nuevo

1. Mensaje entrante de número desconocido
2. Sistema busca proyecto por `phone_number_id` (desencriptado)
3. Busca lead existente por `phone` en ese proyecto
4. Si no existe → Crea lead con datos del contacto (nombre de WhatsApp)
5. Crea/actualiza conversación
6. Almacena mensaje con metadata
7. UI muestra lead al hacer clic en botón refresh

---

## Seguridad de APIs (Actualizado Enero 2026)

### Resumen de Protecciones

| Endpoint | Protección | Variable de Entorno | Guarda BD |
|----------|------------|---------------------|-----------|
| `/api/ai/respond` | Shared Secret Header | `N8N_CALLBACK_SECRET` | ✅ Sí |
| `/api/whatsapp/send` | Supabase Auth + Project Membership | `BYPASS_AUTH_DEV` (dev only) | ❌ No |
| `/api/messages/confirm` | Shared Secret Header | `N8N_CALLBACK_SECRET` | ✅ Actualiza |
| `/api/webhooks/whatsapp` | HMAC-SHA256 Signature | `WHATSAPP_APP_SECRET` | ✅ Sí |
| `/api/rag/search` | Shared Secret Header | `N8N_CALLBACK_SECRET` | ❌ No |

### V0: `/api/ai/respond` - Guardar y Enviar Respuesta IA ⭐ NUEVO

**Propósito:** n8n llama este endpoint para guardar la respuesta del bot en BD Y enviar a WhatsApp en un solo paso atómico.

**Por qué existe:** Resuelve el problema de historial perdido cuando n8n usaba `/api/whatsapp/send` que solo enviaba sin guardar.

**Protección implementada:**
- Header `X-N8N-Secret` con shared secret
- Validación de lead y proyecto
- En desarrollo: bypass automático si `NODE_ENV === 'development'`

```typescript
// Request
POST /api/ai/respond
Headers: { "X-N8N-Secret": "<N8N_CALLBACK_SECRET>" }
Body: {
  "conversationId": "conv_123",
  "leadId": "lead_456",
  "projectId": "proj_789",
  "message": "¡Hola! Soy Luna, ¿en qué puedo ayudarte?",
  "agentId": "agent_luna",    // opcional
  "agentName": "Luna"         // opcional, se guarda en metadata
}

// Response
{
  "success": true,
  "messageId": "msg_xyz",         // ID en KAIRO
  "whatsappMsgId": "wamid_abc",   // ID en Meta
  "whatsappSent": true,
  "duration": 450                  // ms
}
```

**Flujo interno:**
1. Guarda mensaje con `sender: 'ai'` y metadata (agentId, agentName, source: 'n8n_ai')
2. Obtiene credenciales WhatsApp del proyecto (desencriptadas)
3. Envía a WhatsApp Cloud API v21.0
4. Actualiza mensaje con `whatsappMsgId` y `isDelivered: true`

**Archivo:** `src/app/api/ai/respond/route.ts`

### V1: `/api/whatsapp/send` - Autenticación de Usuario

**Propósito:** Proxy para enviar mensajes a WhatsApp Cloud API (usado por n8n y UI).

**Protección implementada:**
- Verificación de sesión Supabase Auth
- Verificación de membresía en el proyecto
- Solo usuarios autenticados con acceso al proyecto pueden enviar mensajes

```typescript
// Bypass para desarrollo local (NO usar en producción)
BYPASS_AUTH_DEV=true
```

**Archivo:** `src/app/api/whatsapp/send/route.ts`

### V2: `/api/messages/confirm` - Callback de n8n

**Propósito:** Callback que n8n usa para confirmar que envió un mensaje.

**Protección implementada:**
- Header `X-N8N-Secret` con shared secret
- Valida que el request viene de n8n autorizado

```typescript
// Configurar el mismo secret en n8n y KAIRO
N8N_CALLBACK_SECRET=k4ir0-prod-secret-change-me

// En n8n, agregar header:
// X-N8N-Secret: k4ir0-prod-secret-change-me
```

**Archivo:** `src/app/api/messages/confirm/route.ts`

### V3: `/api/webhooks/whatsapp` - Webhook de Meta

**Propósito:** Recibir mensajes entrantes de WhatsApp.

**Protección implementada:**
- Verificación HMAC-SHA256 del header `X-Hub-Signature-256`
- Usa el App Secret de Meta (no el Access Token)
- Previene inyección de mensajes falsos

```typescript
// App Secret de Meta Developer Console
// Settings → Basic → App Secret (Show)
WHATSAPP_APP_SECRET=36120c60ba5bbc2a4c9156daa7620b98

// Bypass para desarrollo con ngrok (NO usar en producción)
WEBHOOK_BYPASS_SIGNATURE=true
```

**Archivo:** `src/app/api/webhooks/whatsapp/route.ts`

### V4: `/api/rag/search` - Búsqueda Semántica para n8n

**Propósito:** Endpoint para que n8n realice búsquedas RAG en la base de conocimiento.

**Protección implementada:**
- Header `X-N8N-Secret` con shared secret (mismo que `/api/messages/confirm`)
- Validación de agente y proyecto activos
- Límites en query (max 8000 caracteres) y resultados (max 20)

```typescript
// Configurar el mismo secret en n8n y KAIRO
N8N_CALLBACK_SECRET=k4ir0-prod-secret-change-me

// En n8n, usar header:
// X-N8N-Secret: k4ir0-prod-secret-change-me

// Request body:
{
  "agentId": "agent_123",
  "projectId": "project_456",
  "query": "¿Cuáles son los horarios?",
  "limit": 5,         // opcional (1-20, default: 5)
  "threshold": 0.7    // opcional (0-1, default: 0.7)
}

// Response:
{
  "success": true,
  "results": [
    {
      "id": "uuid",
      "content": "Texto relevante...",
      "title": "Título del documento",
      "source": "manual",
      "similarity": 0.892
    }
  ],
  "metadata": {
    "agentId": "...",
    "agentName": "Luna",
    "projectId": "...",
    "projectName": "TechCorp SAC",
    "resultsCount": 3,
    "timing": { "embedding": 150, "search": 45, "total": 210 }
  }
}
```

**Archivo:** `src/app/api/rag/search/route.ts`

**Decisión de arquitectura:** n8n accede al RAG vía endpoint KAIRO (Opción B) en lugar de conectar directamente a Supabase (Opción A). Razones:
- **Seguridad**: n8n solo tiene shared secret, no credenciales de base de datos
- **Aislamiento multi-tenant**: Validación de permisos centralizada en KAIRO
- **Superficie de ataque reducida**: Un solo punto de acceso con logging completo

### Configuración para Producción

```bash
# .env.production (valores de ejemplo - cambiar)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=kairo_wh_v3r1fy_2026
WHATSAPP_APP_SECRET=<app_secret_real_de_meta>
N8N_CALLBACK_SECRET=<secret_fuerte_generado>

# NO incluir en producción:
# BYPASS_AUTH_DEV=true
# WEBHOOK_BYPASS_SIGNATURE=true
```

### Desarrollo Local con ngrok

Para testing local, las protecciones pueden bypassearse:

```bash
# .env.local
BYPASS_AUTH_DEV=true           # Permite enviar sin auth
WEBHOOK_BYPASS_SIGNATURE=true  # Permite webhooks sin firma válida
```

⚠️ **NUNCA** usar estos flags en producción

---

## Media Upload (Imágenes y Videos WhatsApp)

### Arquitectura

Upload directo desde navegador a Supabase Storage, bypassing Vercel's 4.5MB Server Action limit.

```
┌─────────────────────────────────────────────────────────────┐
│                  MEDIA UPLOAD FLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Usuario selecciona imagen/video en ChatInput               │
│       │                                                      │
│       ▼                                                      │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Solo imágenes: browser-image-compression           │   │
│   │  - Si imagen > 1MB → comprimir a máx 1MB            │   │
│   │  - maxWidthOrHeight: 1920px                          │   │
│   │  (Videos no se comprimen - hasta 16MB)               │   │
│   └─────────────────────────────────────────────────────┘   │
│       │                                                      │
│       ▼                                                      │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  useMediaUpload() → Upload DIRECTO a Supabase       │   │
│   │  - Bypass Vercel 4.5MB limit (navegador → Supabase) │   │
│   │  - RLS policies verifican ProjectMember access      │   │
│   │  - Bucket: "media" (público)                         │   │
│   │  - Path: {projectId}/{year}/{month}/{uuid}.{ext}    │   │
│   │  - Imágenes: max 3MB (jpeg, png, webp)               │   │
│   │  - Videos: max 16MB (mp4, webm)                      │   │
│   └─────────────────────────────────────────────────────┘   │
│       │                                                      │
│       ▼                                                      │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  sendMessage() con mediaUrl y messageType           │   │
│   │  - content: "[Imagen/Video: nombre.ext]"            │   │
│   │  - mediaUrl: URL pública de Supabase                │   │
│   │  - messageType: "image" | "video" | "document"       │   │
│   └─────────────────────────────────────────────────────┘   │
│       │                                                      │
│       ▼                                                      │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  n8n "Send to WhatsApp"                              │   │
│   │  - Detecta messageType y envía formato correcto     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `src/hooks/useMediaUpload.ts` | Hook para upload directo navegador→Supabase |
| `src/lib/actions/media.ts` | Validación de tipos y tamaños (backup/referencia) |
| `src/components/features/LeadChat.tsx` | Compresión imágenes + upload directo |
| `src/components/features/ChatInput.tsx` | UI de selección de archivos + indicador enviando |
| `src/lib/actions/messages.ts` | `sendMessage()` con mediaUrl y messageType |
| `src/app/api/cron/cleanup-media/route.ts` | Cron job para limpiar archivos >24h |
| `scripts/secure-storage-rls.sql` | Políticas RLS seguras para storage |

### Supabase Storage Setup

**Bucket:** `media`
- Public: ✅
- File size limit: **16MB** (para videos WhatsApp)
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/webm`

**Políticas RLS Seguras (ejecutar `scripts/secure-storage-rls.sql`):**

```sql
-- Función que verifica acceso al proyecto via ProjectMember
CREATE OR REPLACE FUNCTION storage.user_has_project_access(file_path TEXT)
RETURNS BOOLEAN AS $$
  -- Extrae projectId del path y verifica membresía
  -- Ver scripts/secure-storage-rls.sql para implementación completa
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Solo miembros del proyecto pueden subir
CREATE POLICY "Project members can upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'media' AND storage.user_has_project_access(name));

-- Lectura pública (URLs son públicas para WhatsApp)
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT TO anon, authenticated USING (bucket_id = 'media');

-- Solo miembros del proyecto pueden eliminar
CREATE POLICY "Project members can delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'media' AND storage.user_has_project_access(name));
```

### Media Cleanup (Retención 24h)

Para mantener el storage limpio, un cron job elimina archivos de más de 24 horas:

- **Endpoint:** `/api/cron/cleanup-media`
- **Schedule:** `0 3 * * *` (3am UTC diariamente)
- **Autenticación:** Header `Authorization: Bearer {CRON_SECRET}`

**Variable de entorno requerida:**
```bash
CRON_SECRET=<tu_secret_para_cron>
```

### Flujo n8n para Media

El nodo "Send to WhatsApp" detecta el tipo de mensaje:

```javascript
// Si messageType === 'image'
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "{{to}}",
  "type": "image",
  "image": { "link": "{{mediaUrl}}", "caption": "{{message}}" }
}

// Si messageType === 'video'
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "{{to}}",
  "type": "video",
  "video": { "link": "{{mediaUrl}}", "caption": "{{message}}" }
}

// Si messageType === 'text' (default)
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "{{to}}",
  "type": "text",
  "text": { "body": "{{message}}" }
}
```

Los nodos "Prepare Human Response" y "Prepare AI Response" pasan `messageType` y `mediaUrl` al nodo de envío

---

## Supabase Realtime + RLS (Actualizado Enero 2026)

### Problema Resuelto

**Síntoma:** Mensajes de chat no actualizaban en tiempo real aunque Realtime estaba suscrito.

**Causa raíz:** RLS habilitado en tabla `messages` pero sin políticas SELECT. Supabase Realtime respeta RLS, por lo tanto sin política SELECT no hay broadcasts.

**Solución:** Políticas RLS completas con función helper de verificación de acceso.

### Script de RLS

Archivo: `scripts/rls-messages-realtime.sql`

**Función helper:**
```sql
CREATE OR REPLACE FUNCTION public.user_has_conversation_access(conv_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admins tienen acceso a todo
  IF EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()::TEXT AND "systemRole" = 'super_admin'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Verificar membresía en proyecto vía conversación → lead → project
  RETURN EXISTS (
    SELECT 1
    FROM conversations c
    JOIN leads l ON c."leadId" = l.id
    JOIN project_members pm ON l."projectId" = pm."projectId"
    WHERE c.id = conv_id AND pm."userId" = auth.uid()::TEXT
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Políticas:**
- `SELECT`: CRÍTICA para Realtime - permite leer mensajes de conversaciones con acceso
- `INSERT`: Permite crear mensajes solo en conversaciones propias
- `UPDATE`: Permite actualizar estado de mensajes (delivered, read)

### Verificación

```sql
-- Ver políticas instaladas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'messages';
```

### Importante

- **Sin política SELECT, Realtime NO funciona** aunque RLS esté habilitado
- La función usa `SECURITY DEFINER` para acceso consistente a las tablas
- Super admins bypasean la verificación de membresía
- Las políticas verifican acceso a través de la cadena: message → conversation → lead → project → project_member
