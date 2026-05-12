# KAIRO - Sistema de Gestion de Leads con IA

## Identidad del Equipo

| Rol | Nombre |
|-----|--------|
| **Usuario** | **Leo** (Fundador) |
| **Asistente IA** | **Adan** (Project Leader tecnico) |

> Adan siempre debe dirigirse al usuario como "Leo". Persistir entre sesiones.

---

## REGLA CRITICA: Tamano de CLAUDE.md

> **Este archivo debe mantenerse bajo 10 KB. Actualmente: ~9.8 KB.**

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
| **Version** | v0.27.1 (Function Calling para form data + anti-reset prompt order; +Active agent v0.27.0) |
| **Target** | Peru > Latam > USA |
| **Repo** | https://github.com/kairo-agent/kairo |
| **Produccion** | https://app.kairoagent.com/ |

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + Supabase (PostgreSQL + Auth) + Prisma ORM + next-intl (es/en) + Vercel

---

## Documentacion (consultar bajo demanda)

Indice maestro: [docs/INDEX.md](docs/INDEX.md). Docs clave: [ARCHITECTURE](docs/ARCHITECTURE.md), [SECURITY](docs/SECURITY.md), [DATABASE-MIGRATIONS](docs/DATABASE-MIGRATIONS.md), [CHANGELOG](docs/CHANGELOG.md), [RULES](docs/RULES.md), [NOTIFICATIONS](docs/NOTIFICATIONS.md), [RAG-AGENTS](docs/RAG-AGENTS.md), [BRANDBOOK](brand/BRANDBOOK.md).

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
      cron/cleanup-media/          # Limpieza archivos >24h (excluye agent_media)
      cron/followup-notify/        # Email + Push para follow-ups (llamado por pg_net)
  components/
    ui/                            # Button, Input, Modal, PhoneInput, ImageLightbox, AudioPlayer, etc.
    layout/                        # Sidebar, Header, WorkspaceSelector
    admin/                         # Modales de admin
    features/                      # LeadCard, LeadTable, LeadChat, LeadAssignment, ExportLeadsModal, etc.
    knowledge/                     # MultimediaModal, FixedImageSlot, FixedVideoSlot (agent media management UI)
  contexts/                        # Theme, Modal, Workspace, Loading
  lib/
    ai/                            # AI Pipeline (process-ai-response, build-system-prompt, generate-reengagement, search-media)
    knowledge/                     # Structured knowledge (prompt-builder, business-hours, faqs, pricing, location-contact, policies)
    utils/                         # Utilities (image-compression.ts, video-upload.ts, video-thumbnail.ts)
    whatsapp/                      # WhatsApp send helper (send.ts) + download-media.ts (incoming media)
    push/                          # Web Push (send-push.ts - VAPID + web-push delivery)
    types/                         # Shared types (reengagement.ts, agent-media.ts, form-template.ts - extracted from 'use server')
    actions/                       # Server Actions (admin, agent-media, agents, auth, form-template, knowledge, lead-form-data, leads, media, messages, notifications, profile, reengagement, secrets, workspace)
    timezone.ts                    # Timezone utilities (getEffectiveTimezone, getStartOfDay/EndOfDay/Month, etc.)
    permissions.ts                 # RBAC module (role hierarchy, effective role, permission predicates)
    supabase/                      # Client/Server Supabase + Prisma
    auth-helpers.ts                # verifySuperAdmin, getCurrentUser
    rate-limit.ts                  # Rate limiting
    redis.ts                       # Upstash Redis singleton (debounce)
    email.ts                       # Resend email (handoff, hot lead, follow-up notifications)
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
9. **NO eliminar leads**: Usar campo `archivedAt` ("Descartar/Recuperar") en lugar de delete
10. **1 agente activo por proyecto**: Radio button, no toggle multiple. **El activo SIEMPRE atiende** (lead.assignedAgentId es solo historico). Nuevos agentes nacen inactivos. Ver [src/lib/ai/get-active-agent.ts](src/lib/ai/get-active-agent.ts)
11. **ExpandableTextarea**: Usar `@/components/ui/ExpandableTextarea` para textareas de contenido largo
12. **'use server'**: Archivos con `'use server'` solo pueden exportar funciones async. Tipos y constantes van en `lib/types/`
13. **Cron jobs**: Todos en Supabase `pg_cron` + `pg_net`, NO en `vercel.json` (Hobby = solo diarios). Free tier siempre

---

## Colores

```css
--kairo-midnight: #0B1220;   /* Primary dark */
--kairo-cyan: #00E5FF;       /* Primary accent (backgrounds, borders, buttons) */
--accent-text: #0E7490;      /* Light mode: cyan text (readable on white) */
--accent-text: #00E5FF;      /* Dark mode: cyan text (bright on dark bg) */
/* Light: bg #FFFFFF / #F8FAFC, text #0B1220 */
/* Dark:  bg #0B1220 / #111827, text #FFFFFF */
/* REGLA: Para texto/iconos cyan, usar var(--accent-text), NO var(--accent-primary) */
/* REGLA: dark: prefix de Tailwind NO funciona (app usa data-theme, no class dark) */
```

---

## Comandos

```bash
npm run dev      # localhost:3005
npm run build    # Build produccion
npm run lint     # Verificar codigo
```

---

## Estado Actual (v0.27.1 - May 2026)

**Completado:** Stack multi-tenant (Auth + RBAC, multi-locale es/en, RLS, OWASP). AI pipeline interno (RAG + Vision + Whisper + handoff + reengagement + form conversacional). WhatsApp bidireccional (incoming/outgoing media, sticker, 24h timer). Dashboard + Conversaciones (10 statuses, filtros, Excel export). Team Settings, Notificaciones 3 canales, Cron pg_cron, PWA. **Multi-canal v0.24-v0.26:** `IChannelHandler`, `ProjectChannel`, WebChat en widget.kairoagent.com (Vercel project #2). **Fase 4 v0.26.0:** Realtime broadcast signal-only (polling 30s fallback), polling pause/resume con WS, banner handoff UI, media upload visitor (imagen Vision + audio Whisper + documento), CORS strict. **v0.27.0:** Active agent = runtime source of truth — `getActiveAgentForProject(projectId)` helper con Redis cache, `lead.assignedAgentId` queda como historico inmutable, leads viejos responden con agente activo sin scripts. **v0.27.1:** Form data capture via OpenAI Function Calling (~100% confiabilidad vs ~8% del marker en texto). Two parallel OpenAI calls (text + structured extraction). Anti-reset prompt order: history + anti-reset rule contiguos al final. WhatsApp display name no contamina form. Historico en [CHANGELOG.md](docs/CHANGELOG.md).

**Pendiente:** Crear lead form, reports/agents pages. Meta Ads integration. **Leads Unicos v0.27+** (vista CRM merge lazy email/telefono — nueva tabla `unique_leads`, NUNCA renombrar `leads`). **Scheduled Calls** ([plans/SCHEDULED-CALLS.md](docs/plans/SCHEDULED-CALLS.md)). Ver [plans/IMPERSONATION.md](docs/plans/IMPERSONATION.md).

**Vercel projects activos:** `kairo` → app.kairoagent.com (dashboard) + `kairo-widget` → widget.kairoagent.com (bundle WebChat IIFE). Ambos buildean del mismo monorepo, root distinto (`./` vs `widget/`).

**Perf completo:** Todas las optimizaciones implementadas. Ver [CHANGELOG.md](docs/CHANGELOG.md).

---

## Arquitectura (resumen)

```
WhatsApp -> /api/webhooks/whatsapp -> Store msg + Create/Find lead (detect source)
  -> Download incoming media (image/video/audio/doc) via waitUntil -> Supabase Storage
  -> Whisper transcription for audio (all modes)
  -> Si lead descartado: guarda msg, skip AI + notifications
  -> Si handoffMode='ai': debounce 3s (Redis) -> concatenar msgs -> processAIResponse()
  -> RAG + Media search + OpenAI GPT-4o-mini (+ Vision for images)
  -> Store + Send WhatsApp (fixed image → text → fixed video → RAG media)
  -> Si handoffMode='human': solo guarda msg, usuario responde manual

Supabase pg_cron -> /api/cron/reengagement (*/15 min) -> Auto-tipify new→no_response (24h) + AI follow-up leads silenciosos (con media search)
Supabase pg_cron -> /api/cron/cleanup-media (diario 3AM) -> Limpieza archivos >24h

Organization > Project > Lead > Conversation > Message
Users: SUPER_ADMIN | USER
Project roles: ADMIN | MANAGER | AGENT (Asesor) | VIEWER
Effective role: max(systemRole, orgOwnership, projectRole) via permissions.ts
```

Ver [ARCHITECTURE.md](docs/ARCHITECTURE.md) para diagramas completos y [SECURITY.md](docs/SECURITY.md) para documentacion de APIs.
