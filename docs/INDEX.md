# KAIRO - Indice de Documentacion

## Documentos por Tema

### Arquitectura y Decisiones
| Documento | Contenido clave |
|-----------|----------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Multi-tenant (Org > Project > Lead), roles RBAC, Project Secrets (AES-256-GCM), decisiones tecnicas, n8n hybrid architecture |
| [DATA-MODELS.md](DATA-MODELS.md) | Modelos Prisma, enums, tipos TypeScript |
| [DATABASE-MIGRATIONS.md](DATABASE-MIGRATIONS.md) | CRITICO: Prisma migrate vs SQL directo, proteccion agent_knowledge |

### Seguridad
| Documento | Contenido clave |
|-----------|----------------|
| [RBAC.md](RBAC.md) | Roles (super_admin/owner/admin/manager/agent/viewer), effective role, matriz de permisos, flujo tecnico |
| [SECURITY.md](SECURITY.md) | OWASP audit, todos los endpoints API (protecciones, rate limits, env vars), fail-closed patterns, timing attacks |
| [SECURITY-AUDIO-PROCESSING.md](SECURITY-AUDIO-PROCESSING.md) | Analisis de seguridad para procesamiento de audio Whisper |

### Integraciones
| Documento | Contenido clave |
|-----------|----------------|
| [N8N-SETUP.md](N8N-SETUP.md) | Railway deploy, workflows, WhatsApp Cloud API integration, webhook flow, message types, ngrok dev setup |
| [RAG-AGENTS.md](RAG-AGENTS.md) | pgvector, embeddings OpenAI, search functions, knowledge management, soporte multilingue, structured knowledge (v0.9.0) |
| [MEDIA-UPLOAD.md](MEDIA-UPLOAD.md) | Supabase Storage, RLS policies, image compression, cleanup cron, n8n media sending |

### Frontend y UI
| Documento | Contenido clave |
|-----------|----------------|
| [COMPONENTS.md](COMPONENTS.md) | Catalogo de componentes UI (Button, Modal, PhoneInput, etc.) + Knowledge Base forms (v0.9.0) |
| [I18N.md](I18N.md) | next-intl config, useTranslations, namespaces, Link de @/i18n/routing |
| [RULES.md](RULES.md) | 14 reglas obligatorias (Playwright validation, i18n Link, PhoneInput, etc.) |

### Notificaciones y Follow-ups
| Documento | Contenido clave |
|-----------|----------------|
| [NOTIFICATIONS.md](NOTIFICATIONS.md) | Sistema de notificaciones: tabla, RLS, polling, NotificationDropdown, pg_cron, follow-up badges |

### Features planificadas (`docs/plans/`)

> Planes NO implementados aun. Al implementar una feature, mover su doc a `docs/done/`.

| Documento | Contenido clave |
|-----------|----------------|
| [plans/LEADS-UNICOS.md](plans/LEADS-UNICOS.md) | **NUEVO** Vista CRM "Leads Unicos" con merge lazy por email/telefono. NUEVA tabla `unique_leads` (NO renombrar `leads`). v0.27+ |
| [plans/COMPLIANCE-GDPR.md](plans/COMPLIANCE-GDPR.md) | Plan futuro de borrado de datos del cliente (GDPR/CCPA/Ley 29733). Fuera de scope multi-canal. Sin priorizar |
| [plans/SCHEDULED-CALLS.md](plans/SCHEDULED-CALLS.md) | Plan completo: llamadas agendadas via IA, Jitsi, horarios configurables, anti-doble-booking, recordatorios |
| [plans/IMPERSONATION.md](plans/IMPERSONATION.md) | Super_admin impersonate users, cookie-based, 6 fases, testing checklist, security model |

### Features realizadas (`docs/done/`)

> Planes ya implementados + sesiones historicas. Se conservan como referencia de decisiones de diseno; la fuente de verdad operativa vive en los docs vivos + el codigo.

| Documento | Contenido clave |
|-----------|----------------|
| [done/CONVERSATIONAL-FORM.md](done/CONVERSATIONAL-FORM.md) | Formulario conversacional por agente, [FORM-DATA:] marker, 4 tabs Settings, lead_form_data table + hallazgos post-implementacion (v0.22.0) |
| [done/FOLLOW-UP-SCHEDULING.md](done/FOLLOW-UP-SCHEDULING.md) | Alternativas evaluadas para seguimiento (implementado en v0.7.16) |
| [done/RAG-DEBUG-SESSION-2026-02-03.md](done/RAG-DEBUG-SESSION-2026-02-03.md) | Sesion de debug RAG (2026-02-03), hallazgos y fixes historicos |
| [done/MULTI-CHANNEL-WEBCHAT-V0.25.md](done/MULTI-CHANNEL-WEBCHAT-V0.25.md) | Decisiones + arquitectura del multi-canal v0.24+v0.25 (23 decisiones cerradas con Leo) — fuente historica |
| [done/MULTI-CHANNEL-IMPL-V0.25.md](done/MULTI-CHANNEL-IMPL-V0.25.md) | Implementacion tecnica de Fases 0-3 del multi-canal — fuente historica |
| [done/MULTI-CHANNEL-FASE4-V0.26.md](done/MULTI-CHANNEL-FASE4-V0.26.md) | Fase 4 v0.26.0 (Realtime broadcast + handoff UI + media imagen/audio/doc + CORS strict + HTTPS-only). 10 commits. Plan ejecutado al 100% — fuente historica |
| [done/NIGHT-SESSION-2026-05-07.md](done/NIGHT-SESSION-2026-05-07.md) | Sesion nocturna 2026-05-07 con autonomia: cleanup n8n + scaffolding Fase 2 + commits ejecutados (auditable) |

### Performance y Operaciones
| Documento | Contenido clave |
|-----------|----------------|
| [PERFORMANCE.md](PERFORMANCE.md) | Phases 1-3 completadas, React cache(), cursor pagination, React Query |
| [CHANGELOG.md](CHANGELOG.md) | Ultimas 5 versiones (v0.8.0+). Versiones anteriores en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md) |
| [../scripts/README.md](../scripts/README.md) | Catalogo de scripts de mantenimiento/setup: kit KB de agentes (check/update genericos + templates), utilidades puntuales, SQL de infra (RLS, RPCs, pg_cron) |

### Brand
| Documento | Contenido clave |
|-----------|----------------|
| [/brand/BRANDBOOK.md](/brand/BRANDBOOK.md) | Colores (#0B1220, #00E5FF), tipografia Inter, identidad visual |

## Busqueda Rapida

| Necesito saber sobre... | Ir a... |
|-------------------------|---------|
| Endpoints API y seguridad | [SECURITY.md](SECURITY.md) |
| Variables de entorno | [SECURITY.md](SECURITY.md) seccion "Obligatorias" |
| WhatsApp webhook flow | [N8N-SETUP.md](N8N-SETUP.md) seccion "WhatsApp" |
| Como funciona el RAG | [RAG-AGENTS.md](RAG-AGENTS.md) |
| RAG multilingue / cross-language | [RAG-AGENTS.md](RAG-AGENTS.md) seccion "Soporte Multilingue" |
| Configuracion de agentes (Settings) | [CHANGELOG.md](CHANGELOG.md) seccion v0.9.0 |
| Global Rules (reglas para todos los agentes) | [ARCHITECTURE.md](ARCHITECTURE.md) seccion "Global Rules" + [CHANGELOG.md](CHANGELOG.md) seccion v0.9.1 |
| Knowledge Base estructurada | [RAG-AGENTS.md](RAG-AGENTS.md) + [COMPONENTS.md](COMPONENTS.md) seccion "Knowledge Base" |
| Roles y permisos | [RBAC.md](RBAC.md) |
| Lead visibility control (Team Settings) | [RBAC.md](RBAC.md) + [CHANGELOG.md](CHANGELOG.md) seccion v0.23.0 |
| Auto-asignacion de leads | [CHANGELOG.md](CHANGELOG.md) seccion v0.23.0 |
| Estado actual del MVP | [CHANGELOG.md](CHANGELOG.md) version mas reciente |
| Reglas de desarrollo | [RULES.md](RULES.md) |
| Colores y brand | [/brand/BRANDBOOK.md](/brand/BRANDBOOK.md) |
| Migraciones de BD | [DATABASE-MIGRATIONS.md](DATABASE-MIGRATIONS.md) |
| Revisar/actualizar KB de un agente | [../scripts/README.md](../scripts/README.md) seccion "Kit de Knowledge Base" |
| Subir archivos multimedia | [MEDIA-UPLOAD.md](MEDIA-UPLOAD.md) |
| Formulario conversacional | [done/CONVERSATIONAL-FORM.md](done/CONVERSATIONAL-FORM.md) |
| Avatar upload (usuarios) | [CHANGELOG.md](CHANGELOG.md) seccion v0.23.0 |
| Multi-canal + WebChat (Fase 3 historica) | [done/MULTI-CHANNEL-WEBCHAT-V0.25.md](done/MULTI-CHANNEL-WEBCHAT-V0.25.md) |
| Multi-canal Fase 4 Realtime + media (historica) | [done/MULTI-CHANNEL-FASE4-V0.26.md](done/MULTI-CHANNEL-FASE4-V0.26.md) |
| Leads Unicos vista CRM (plan) | [plans/LEADS-UNICOS.md](plans/LEADS-UNICOS.md) |
| Llamadas agendadas (plan) | [plans/SCHEDULED-CALLS.md](plans/SCHEDULED-CALLS.md) |
| Impersonation super_admin (plan) | [plans/IMPERSONATION.md](plans/IMPERSONATION.md) |
