# KAIRO - Índice de Documentación

## Documentos Principales

| Documento | Descripción | Última actualización |
|-----------|-------------|---------------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, estructura y decisiones técnicas | 2026-01-24 |
| [DATABASE-MIGRATIONS.md](DATABASE-MIGRATIONS.md) | ⛔ Guía crítica de migraciones BD (Prisma vs SQL) | 2026-02-02 |
| [SECURITY.md](SECURITY.md) | Documentacion de seguridad OWASP | 2026-01-31 |
| [SECURITY-AUDIO-PROCESSING.md](SECURITY-AUDIO-PROCESSING.md) | Analisis de seguridad para procesamiento de audios | 2026-02-04 |
| [PERFORMANCE.md](PERFORMANCE.md) | Optimizaciones de rendimiento y caching | 2026-01-24 |
| [RAG-AGENTS.md](RAG-AGENTS.md) | RAG para agentes IA con pgvector | 2026-01-29 |
| [N8N-SETUP.md](N8N-SETUP.md) | Configuración n8n para agentes IA (WhatsApp) | 2026-01-19 |
| [MEDIA-UPLOAD.md](MEDIA-UPLOAD.md) | Sistema de envío de archivos multimedia a WhatsApp | 2026-01-24 |
| [COMPONENTS.md](COMPONENTS.md) | Catálogo de componentes UI | 2024-12-31 |
| [DATA-MODELS.md](DATA-MODELS.md) | Modelos de datos y tipos | 2024-12-31 |
| [I18N.md](I18N.md) | Internacionalización, traducciones, moneda | 2026-01-11 |
| [RULES.md](RULES.md) | Reglas obligatorias del proyecto | 2024-12-31 |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios | 2026-01-31 |

## Brandbook

| Documento | Descripción |
|-----------|-------------|
| [/brand/BRANDBOOK.md](/brand/BRANDBOOK.md) | Identidad visual, colores, tipografía |

## Quick Links

- **Colores:** Midnight Blue `#0B1220`, Electric Cyan `#00E5FF`
- **Font:** Inter (400, 500, 600, 700)
- **Theme default:** Light

## Navegación Rápida por Feature

### MVP - Gestión de Leads
- Login → `src/app/(auth)/login/`
- Dashboard → `src/app/(dashboard)/`
- Leads → `src/app/(dashboard)/leads/`

### Componentes Clave
- Modal → `src/components/ui/Modal.tsx`
- LeadCard → `src/components/features/LeadCard.tsx`
- ThemeProvider → `src/contexts/ThemeContext.tsx`
