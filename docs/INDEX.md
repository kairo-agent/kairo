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
| [FOLLOW-UP-SCHEDULING.md](FOLLOW-UP-SCHEDULING.md) | Alternativas evaluadas para seguimiento (implementado en v0.7.16) |

### Features (Planes de implementacion)
| Documento | Contenido clave |
|-----------|----------------|
| [CONVERSATIONAL-FORM.md](CONVERSATIONAL-FORM.md) | Plan completo: formulario conversacional por agente, 7 fases, schema + pipeline + UI |

### Performance y Operaciones
| Documento | Contenido clave |
|-----------|----------------|
| [PERFORMANCE.md](PERFORMANCE.md) | Phases 1-3 completadas, React cache(), cursor pagination, React Query |
| [CHANGELOG.md](CHANGELOG.md) | Ultimas 5 versiones (v0.8.0+). Versiones anteriores en [changelog/CHANGELOG-ARCHIVE.md](changelog/CHANGELOG-ARCHIVE.md) |

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
| Estado actual del MVP | [CHANGELOG.md](CHANGELOG.md) version mas reciente |
| Reglas de desarrollo | [RULES.md](RULES.md) |
| Colores y brand | [/brand/BRANDBOOK.md](/brand/BRANDBOOK.md) |
| Migraciones de BD | [DATABASE-MIGRATIONS.md](DATABASE-MIGRATIONS.md) |
| Subir archivos multimedia | [MEDIA-UPLOAD.md](MEDIA-UPLOAD.md) |
| Formulario conversacional | [CONVERSATIONAL-FORM.md](CONVERSATIONAL-FORM.md) |
