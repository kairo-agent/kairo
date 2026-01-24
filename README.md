# KAIRO Dashboard

Sistema de gestión de leads con integración a WhatsApp Business API y agentes de IA conversacional.

## Inicio Rápido

### Desarrollo Local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### Stack Tecnológico

- **Framework**: Next.js 15.x (App Router)
- **Lenguaje**: TypeScript 5.x
- **Styling**: Tailwind CSS 4.x
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma 5.x
- **Storage**: Supabase Storage
- **Auth**: Supabase Auth
- **Deploy**: Vercel

## Documentación

Toda la documentación del proyecto se encuentra en `/docs`:

| Documento | Descripción |
|-----------|-------------|
| [INDEX.md](/docs/INDEX.md) | Índice completo de documentación |
| [ARCHITECTURE.md](/docs/ARCHITECTURE.md) | Arquitectura del sistema y decisiones técnicas |
| [N8N-SETUP.md](/docs/N8N-SETUP.md) | Configuración de n8n para WhatsApp + IA |
| [MEDIA-UPLOAD.md](/docs/MEDIA-UPLOAD.md) | Sistema de envío de archivos multimedia a WhatsApp |
| [COMPONENTS.md](/docs/COMPONENTS.md) | Catálogo de componentes UI |
| [DATA-MODELS.md](/docs/DATA-MODELS.md) | Modelos de datos y tipos |
| [I18N.md](/docs/I18N.md) | Internacionalización y traducciones |
| [RULES.md](/docs/RULES.md) | Reglas obligatorias del proyecto |

## Características Principales

### Gestión de Leads

- Captura de leads desde múltiples canales (WhatsApp)
- Sistema de etiquetas y estados personalizables
- Historial completo de actividades
- Asignación automática a agentes de IA

### WhatsApp Business Integration

- Conversaciones bidireccionales en tiempo real
- Envío de multimedia (imágenes, videos, documentos)
- Handoff entre IA y agentes humanos
- Notificaciones de estado (enviado, entregado, leído)

### Agentes de IA

- Múltiples agentes por proyecto (ventas, soporte, calificación, agendamiento)
- Orquestación via n8n + OpenAI/Anthropic
- Modo IA / Modo Humano intercambiable
- RAG personalizado por negocio

### Sistema de Multimedia

- Upload directo desde navegador a Supabase (bypass límite 4.5MB de Vercel)
- Compresión automática de imágenes >1MB
- Soporte de documentos con nombre original
- Captions para imágenes y videos
- Seguridad via Row-Level Security (RLS)

**Tipos soportados**:
- Imágenes: JPG, PNG, WebP (máx 3MB)
- Videos: MP4 únicamente (máx 16MB)
- Documentos: PDF, Word, Excel, TXT (máx 16MB)

Ver documentación completa en [MEDIA-UPLOAD.md](/docs/MEDIA-UPLOAD.md).

## Configuración

### Variables de Entorno

Crear `.env.local` con las siguientes variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Secrets Encryption (generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SECRETS_ENCRYPTION_KEY=tu-clave-hex-64-chars

# Database
DATABASE_URL=postgresql://postgres:password@db.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:password@db.supabase.co:5432/postgres

# WhatsApp (opcional, se guarda encriptado en DB)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=tu-token-verificacion
```

### Base de Datos

```bash
# Generar cliente Prisma
npx prisma generate

# Aplicar migraciones
npx prisma migrate deploy

# Abrir Prisma Studio
npx prisma studio
```

## Desarrollo

### Comandos

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build
npm start

# Linting
npm run lint

# Formateo
npm run format
```

### Estructura del Proyecto

```
src/
├── app/                    # App Router (páginas)
│   ├── (auth)/            # Rutas de autenticación
│   └── (dashboard)/       # Rutas protegidas
├── components/
│   ├── ui/                # Componentes reutilizables
│   ├── layout/            # Header, Sidebar, etc.
│   └── features/          # Componentes de dominio
├── hooks/                 # Custom hooks
├── lib/
│   ├── actions/           # Server Actions
│   ├── crypto/            # Encriptación de secrets
│   └── supabase/          # Cliente Supabase
├── types/                 # TypeScript definitions
└── contexts/              # React Contexts
```

## Deploy en Vercel

1. Conectar repositorio en [Vercel](https://vercel.com)
2. Configurar variables de entorno
3. Deploy automático en cada push a `main`

Ver [documentación de deploy de Next.js](https://nextjs.org/docs/app/building-your-application/deploying).

## Contribución

1. Fork del repositorio
2. Crear branch de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit con mensaje descriptivo
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

Ver [RULES.md](/docs/RULES.md) para convenciones de código.

## Licencia

Propietario: KAIRO Agent © 2026

---

**Última actualización**: 2026-01-24
