# KAIRO - Sistema de Gestion de Leads con IA

## Identidad del Equipo

| Rol | Nombre |
|-----|--------|
| **Usuario** | **Leo** (Fundador) |
| **Asistente IA** | **Adan** (Project Leader tecnico) |

> Adan siempre debe dirigirse al usuario como "Leo". Persistir entre sesiones.

---

## REGLA CRITICA: Tamano de CLAUDE.md

> **Este archivo debe mantenerse bajo 10 KB. Actualmente: ~8 KB.**

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
| **Version** | v0.17.0 (Follow-up email + push notifications) |
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
    ui/                            # Button, Input, Modal, PhoneInput, ImageLightbox, etc.
    layout/                        # Sidebar, Header, WorkspaceSelector
    admin/                         # Modales de admin
    features/                      # LeadCard, LeadTable, LeadChat, ExportLeadsModal, etc.
    knowledge/                     # MultimediaModal, FixedImageSlot, FixedVideoSlot (agent media management UI)
  contexts/                        # Theme, Modal, Workspace, Loading
  lib/
    ai/                            # AI Pipeline (process-ai-response, build-system-prompt, generate-reengagement, search-media)
    knowledge/                     # Structured knowledge (prompt-builder, business-hours, faqs, pricing, location-contact, policies)
    utils/                         # Utilities (image-compression.ts, video-upload.ts, video-thumbnail.ts)
    whatsapp/                      # WhatsApp send helper (send.ts - shared by AI pipeline + cron)
    push/                          # Web Push (send-push.ts - VAPID + web-push delivery)
    types/                         # Shared types (reengagement.ts, agent-media.ts - extracted from 'use server')
    actions/                       # Server Actions (admin, agent-media, agents, auth, knowledge, leads, media, messages, notifications, profile, reengagement, secrets, workspace)
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
9. **NO eliminar leads**: Usar campo `archivedAt` (no status) en lugar de delete
10. **1 agente activo por proyecto**: Radio button, no toggle multiple
11. **ExpandableTextarea**: Usar `@/components/ui/ExpandableTextarea` para textareas de contenido largo
12. **'use server'**: Archivos con `'use server'` solo pueden exportar funciones async. Tipos y constantes van en `lib/types/`
13. **Cron jobs**: Todos en Supabase `pg_cron` + `pg_net`, NO en `vercel.json` (Hobby = solo diarios). Free tier siempre

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
npm run dev      # localhost:3005
npm run build    # Build produccion
npm run lint     # Verificar codigo
```

---

## Estado Actual (Mar 2026)

**Completado:** Auth, CRUD leads (R/U), WhatsApp webhook + multimedia + typing indicator, paginacion server-side, filtros, i18n, multi-tenant RBAC, admin panel, chat/conversaciones, AI pipeline interno (n8n removido), RAG (4 fases), OWASP audit v2 + Audit v3, lead temperature scoring, audio transcription (Whisper), media upload/cleanup, archivar/desarchivar leads, resumen IA, notificaciones (3 canales: bell + email + push), follow-up scheduling, anti-prompt-injection, per-project App Secret (HMAC), Settings con KB estructurada (5 secciones), dual-name system, Global Rules system, AI-initiated handoff ([HANDOFF] marker), KB free-text edit, deep-link post-login redirect, Web Push Notifications, Supabase Realtime (notifications + leads + chat), region co-location (gru1 + sa-east-1), auth chain optimization, RLS policies (16 tablas + agent_media), hot_lead notifications, distinct notification sounds, admin UserModal redesign, push prompt persistence, ReEngagement auto follow-up, cron jobs en Supabase pg_cron + pg_net, AI response instructions mejoradas, Agent Media (RAG semantico + fixed event images/videos, CRUD + compression + markers), chat media rendering (images + video cards), Excel export leads, ReEngagement media, debounce 3s webhook (Redis), fixed event images + videos, configurable send window, mobile lead panel buttons, Agent Video, cron cleanup-media protege agent_media, edit media con reemplazo de archivo, Dashboard charts (recharts: leads/dia, temperatura donut, status bar, conversion rate), Image lightbox + upload timestamps en agent media, cron cleanup-media failsafe, Lead source auto-detection (Meta referral + hashtags), Dashboard source chart (horizontal bar), fix login redirect locale prefix, **follow-up email + push notifications (pg_net)**.

**Pendiente:** Crear lead, paginas de reportes/agents, moneda dinamica, mostrar media entrante del lead en chat (requiere descargar de WhatsApp API → storage).

**Perf completo:** Todas las optimizaciones implementadas. Ver [CHANGELOG.md](docs/CHANGELOG.md).

---

## Arquitectura (resumen)

```
WhatsApp -> /api/webhooks/whatsapp -> Store msg + Create/Find lead (detect source: Meta referral or hashtags)
  -> Si handoffMode='ai': debounce 3s (Redis) -> concatenar mensajes -> processAIResponse()
  -> RAG search (pgvector) + Media search (pgvector) + OpenAI (GPT-4o-mini)
  -> Store + Send WhatsApp (fixed image → text → fixed video → RAG images/videos)
  -> Si handoffMode='human': solo guarda msg, usuario responde manual

Supabase pg_cron -> /api/cron/reengagement (*/15 min) -> AI follow-up leads silenciosos (con media search)
Supabase pg_cron -> /api/cron/cleanup-media (diario 3AM) -> Limpieza archivos >24h

Organization > Project > Lead > Conversation > Message
Users: SUPER_ADMIN | USER
Project roles: ADMIN | MANAGER | AGENT | VIEWER
```

Ver [ARCHITECTURE.md](docs/ARCHITECTURE.md) para diagramas completos y [SECURITY.md](docs/SECURITY.md) para documentacion de APIs.
