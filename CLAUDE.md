# KAIRO - Sistema de Gestion de Leads con IA

## Identidad del Equipo

| Rol | Nombre |
|-----|--------|
| **Usuario** | **Leo** (Fundador) |
| **Asistente IA** | **Adan** (Project Leader tecnico) |

> Adan siempre debe dirigirse al usuario como "Leo". Persistir entre sesiones.

---

## REGLA CRITICA: Tamano de CLAUDE.md

> **Este archivo debe mantenerse bajo 10 KB. Actualmente: ~6 KB.**

- **NUNCA agregar documentacion detallada aqui.** Usar archivos en `docs/` y referenciar con link.
- Nueva feature/API/integracion: documentar en el `docs/*.md` correspondiente, agregar 1 linea en "Estado Actual" si aplica.
- Consultar detalles bajo demanda via `docs/INDEX.md`.
- Si este archivo supera 10 KB, podar inmediatamente moviendo contenido a docs/.

---

## REGLA CRITICA: Proteccion de Base de Datos

> **NUNCA usar `prisma db push` en este proyecto.**

- `agent_knowledge` (pgvector) NO esta en schema.prisma y seria ELIMINADA
- Cambios Prisma: `prisma migrate dev`
- Cambios no-Prisma: SQL directo en Supabase SQL Editor
- Recovery: `scripts/setup-rag-complete.sql` (pero datos se pierden)
- Ver detalles: [DATABASE-MIGRATIONS.md](docs/DATABASE-MIGRATIONS.md)

---

## Quick Context

KAIRO es un SaaS B2B que automatiza leads con sub-agentes IA via WhatsApp.

| | |
|---|---|
| **Version** | v0.7.13 (audio transcription display in chat) |
| **Target** | Peru > Latam > USA |
| **Repo** | https://github.com/kairo-agent/kairo |
| **Produccion** | https://app.kairoagent.com/ |
| **n8n** | n8n-production-5d42.up.railway.app |

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + Supabase (PostgreSQL + Auth) + Prisma ORM + next-intl (es/en) + Vercel

---

## Documentacion (consultar bajo demanda)

| Documento | Que contiene |
|-----------|-------------|
| [docs/INDEX.md](docs/INDEX.md) | Indice maestro |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Estructura, multi-tenant, roles, decisiones |
| [docs/SECURITY.md](docs/SECURITY.md) | APIs, OWASP, endpoints, env vars, rate limiting |
| [docs/DATABASE-MIGRATIONS.md](docs/DATABASE-MIGRATIONS.md) | Guia critica de migraciones |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Historial de cambios y estado MVP |
| [docs/RAG-AGENTS.md](docs/RAG-AGENTS.md) | Sistema RAG pgvector |
| [docs/N8N-SETUP.md](docs/N8N-SETUP.md) | Configuracion n8n + Railway |
| [docs/MEDIA-UPLOAD.md](docs/MEDIA-UPLOAD.md) | Upload multimedia WhatsApp |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Optimizaciones (Phases 1-3) |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | Catalogo de componentes UI |
| [docs/DATA-MODELS.md](docs/DATA-MODELS.md) | Modelos de datos |
| [docs/I18N.md](docs/I18N.md) | Internacionalizacion |
| [docs/RULES.md](docs/RULES.md) | Reglas obligatorias |
| [brand/BRANDBOOK.md](brand/BRANDBOOK.md) | Identidad visual |

---

## Estructura de Archivos (resumen)

```
src/
  app/
    [locale]/(auth)/login/         # Login page
    [locale]/(dashboard)/          # Layout con sidebar
      leads/page.tsx               # Vista principal de leads
      dashboard/page.tsx           # Dashboard (placeholder)
      profile/page.tsx             # Perfil de usuario
    [locale]/(admin)/admin/        # Panel admin (super_admin only)
    [locale]/select-workspace/     # Selector org/project
    api/
      ai/respond/                  # n8n -> guardar + enviar WhatsApp
      audio/transcribe/            # Whisper transcription
      webhooks/whatsapp/           # Recibir mensajes WhatsApp
      webhooks/n8n/                # Eventos de conversacion
      whatsapp/send/               # Proxy a WhatsApp Cloud API
      whatsapp/mark-read/          # Read receipts
      rag/search/                  # Busqueda semantica para n8n
      cron/cleanup-media/          # Limpieza archivos >24h
  components/
    ui/                            # Button, Input, Modal, PhoneInput, etc.
    layout/                        # Sidebar, Header, WorkspaceSelector
    admin/                         # Modales de admin
    features/                      # LeadCard, LeadTable, LeadChat, etc.
  contexts/                        # Theme, Modal, Workspace, Loading
  lib/
    actions/                       # Server Actions (admin, agents, auth, knowledge, leads, media, messages, profile, secrets, workspace)
    supabase/                      # Client/Server Supabase + Prisma
    auth-helpers.ts                # verifySuperAdmin, getCurrentUser
    rate-limit.ts                  # Rate limiting
  messages/                        # es.json, en.json
  i18n/routing.ts                  # Locales y navegacion
```

---

## Reglas Criticas (ver docs/RULES.md para detalle)

1. Validar con Playwright MCP (3 modos: Desktop, Tablet, Mobile) - **usar protocolo context-safe** (ver [RULES.md](docs/RULES.md) seccion 1)
2. Ciberseguridad prioritaria
3. Mobile-first responsive
4. UX simple ("usuarios idiotas")
5. Full-width layout
6. Theme light por defecto
7. **i18n**: Usar `Link` de `@/i18n/routing`, NUNCA de `next/link` (causa loop infinito)
8. **PhoneInput**: SIEMPRE usar `@/components/ui/PhoneInput` para telefonos
9. **NO eliminar leads**: Usar status `archived` en lugar de delete
10. **1 agente activo por proyecto**: Radio button, no toggle multiple

---

## Colores

```css
--kairo-midnight: #0B1220;   /* Primary dark */
--kairo-cyan: #00E5FF;       /* Primary accent */
/* Light: bg #FFFFFF / #F8FAFC, text #0B1220 */
/* Dark:  bg #0B1220 / #111827, text #FFFFFF */
```

---

## Comandos

```bash
npm run dev      # localhost:3000
npm run build    # Build produccion
npm run lint     # Verificar codigo
```

---

## Estado Actual (Feb 2026)

**Completado:** Auth, CRUD leads (R/U), WhatsApp webhook + multimedia, paginacion server-side, filtros, i18n, multi-tenant RBAC, admin panel, chat/conversaciones, n8n Railway, RAG (4 fases), OWASP audit v1, lead temperature scoring, audio transcription (Whisper) + display en chat con badge, performance phases 1-3, media upload/cleanup.

**Parcial:** Dashboard home (placeholder, stats no conectados).

**Pendiente:** Crear lead, archivar lead, paginas de reportes/settings/agents, moneda dinamica.

**Pendiente perf:** P2-4, P1-1, P1-5. Ver [CHANGELOG.md](docs/CHANGELOG.md).

---

## Arquitectura (resumen)

```
WhatsApp -> /api/webhooks/whatsapp -> Store msg + Create/Find lead
  -> Si handoffMode='ai': trigger n8n workflow
  -> n8n: RAG search + OpenAI -> /api/ai/respond -> Store + Send WhatsApp

Organization > Project > Lead > Conversation > Message
Users: SUPER_ADMIN | USER
Project roles: ADMIN | MANAGER | AGENT | VIEWER
```

Ver [ARCHITECTURE.md](docs/ARCHITECTURE.md) para diagramas completos y [SECURITY.md](docs/SECURITY.md) para documentacion de APIs.
