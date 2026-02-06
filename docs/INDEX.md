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
| [SECURITY.md](SECURITY.md) | OWASP audit, todos los endpoints API (protecciones, rate limits, env vars), fail-closed patterns, timing attacks |
| [SECURITY-AUDIO-PROCESSING.md](SECURITY-AUDIO-PROCESSING.md) | Analisis de seguridad para procesamiento de audio Whisper |

### Integraciones
| Documento | Contenido clave |
|-----------|----------------|
| [N8N-SETUP.md](N8N-SETUP.md) | Railway deploy, workflows, WhatsApp Cloud API integration, webhook flow, message types, ngrok dev setup |
| [RAG-AGENTS.md](RAG-AGENTS.md) | pgvector, embeddings OpenAI, search functions, knowledge management |
| [MEDIA-UPLOAD.md](MEDIA-UPLOAD.md) | Supabase Storage, RLS policies, image compression, cleanup cron, n8n media sending |

### Frontend y UI
| Documento | Contenido clave |
|-----------|----------------|
| [COMPONENTS.md](COMPONENTS.md) | Catalogo de componentes UI (Button, Modal, PhoneInput, etc.) |
| [I18N.md](I18N.md) | next-intl config, useTranslations, namespaces, Link de @/i18n/routing |
| [RULES.md](RULES.md) | 14 reglas obligatorias (Playwright validation, i18n Link, PhoneInput, etc.) |

### Features Pendientes
| Documento | Contenido clave |
|-----------|----------------|
| [FOLLOW-UP-SCHEDULING.md](FOLLOW-UP-SCHEDULING.md) | Alternativas para "Programar seguimiento": visual, notificaciones, AI automatico |

### Performance y Operaciones
| Documento | Contenido clave |
|-----------|----------------|
| [PERFORMANCE.md](PERFORMANCE.md) | Phases 1-3 completadas, React cache(), cursor pagination, React Query |
| [CHANGELOG.md](CHANGELOG.md) | Historial completo, estado MVP, business decisions, v0.7.12 plan |

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
| Cómo funciona el RAG | [RAG-AGENTS.md](RAG-AGENTS.md) |
| Roles y permisos | [ARCHITECTURE.md](ARCHITECTURE.md) seccion "Multi-tenant" |
| Estado actual del MVP | [CHANGELOG.md](CHANGELOG.md) version mas reciente |
| Reglas de desarrollo | [RULES.md](RULES.md) |
| Colores y brand | [/brand/BRANDBOOK.md](/brand/BRANDBOOK.md) |
| Migraciones de BD | [DATABASE-MIGRATIONS.md](DATABASE-MIGRATIONS.md) |
| Subir archivos multimedia | [MEDIA-UPLOAD.md](MEDIA-UPLOAD.md) |
