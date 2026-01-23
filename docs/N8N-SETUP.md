# KAIRO - Configuración de n8n para Agentes IA

> Documentación de decisiones arquitectónicas para la orquestación de sub-agentes de ventas IA via WhatsApp.

---

## Decisión de Arquitectura

### ¿Por qué n8n?

| Opción evaluada | Decisión | Razón |
|-----------------|----------|-------|
| Código directo en KAIRO | ❌ Descartado (MVP) | Más tiempo de desarrollo inicial |
| n8n Cloud | ❌ Descartado | Límite de 2,500 ejecuciones/mes, costoso para escalar |
| **n8n Self-hosted** | ✅ Elegido | Ejecuciones ilimitadas, bajo costo, UI visual |

### ¿Por qué Railway para hosting?

| Plataforma | Costo | Decisión |
|------------|-------|----------|
| Railway (Hobby) | ~$5-10/mes | ✅ Elegido |
| Render | ~$7/mes | Similar, más caro por RAM |
| Hetzner + Coolify | ~$4.50/mes | Futuro (más setup) |
| n8n Cloud | $20+/mes | Límites de ejecución |

**Railway Hobby Plan:**
- $5/mes incluye créditos de uso
- Hasta 8GB RAM por servicio
- 50 proyectos
- Sin límite de ejecuciones de flujos

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRODUCCIÓN                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   WhatsApp Cloud API                                            │
│         │                                                        │
│         ▼                                                        │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │   Railway   │────▶│    KAIRO    │────▶│  Supabase   │      │
│   │    (n8n)    │◀────│  (Vercel)   │◀────│ (PostgreSQL)│      │
│   └─────────────┘     └─────────────┘     └─────────────┘      │
│         │                                                        │
│         ▼                                                        │
│   ┌─────────────┐                                               │
│   │  OpenAI /   │                                               │
│   │  Anthropic  │ (RAG + Respuestas IA)                        │
│   └─────────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de un mensaje entrante

1. Lead envía mensaje por WhatsApp
2. WhatsApp Cloud API hace POST al webhook de n8n (Railway)
3. n8n identifica el proyecto por número de WhatsApp
4. n8n consulta KAIRO API para obtener contexto del lead
5. n8n carga RAG del proyecto (info del negocio)
6. n8n llama a IA (OpenAI/Anthropic) para generar respuesta
7. n8n envía respuesta via WhatsApp Cloud API
8. n8n guarda mensaje en KAIRO (Supabase)

---

## Desarrollo Local

### Requisitos

- Docker Desktop
- ngrok (desarrollo) o Cloudflare Tunnel (con dominio propio)

### Setup con Docker

```bash
# 1. Crear directorio para n8n
mkdir ~/n8n-local
cd ~/n8n-local

# 2. Crear docker-compose.yml
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=tu-password-seguro
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://localhost:5678/
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

```bash
# 3. Iniciar n8n
docker-compose up -d

# 4. Acceder a n8n
# http://localhost:5678
```

### Exponer n8n a Internet (Webhooks)

#### Opción A: ngrok (simple, URL cambia)

```bash
# Instalar ngrok
winget install ngrok  # Windows
brew install ngrok    # Mac

# Crear cuenta gratis en ngrok.com y autenticar
ngrok config add-authtoken tu-token

# Exponer n8n
ngrok http 5678

# Output:
# Forwarding https://abc123.ngrok.io -> http://localhost:5678
```

**Nota:** Con ngrok free, la URL cambia cada vez que reinicias. Debes actualizar el webhook en Meta Developer Portal.

#### Opción B: Cloudflare Tunnel (URL fija, requiere dominio)

Si tienes un dominio con DNS en Cloudflare (ej: `kairoagent.com`):

```bash
# Instalar cloudflared
winget install Cloudflare.cloudflared  # Windows
brew install cloudflared                # Mac

# Autenticar
cloudflared tunnel login

# Crear túnel
cloudflared tunnel create n8n-dev

# Configurar DNS (en Cloudflare dashboard)
# n8n-dev.kairoagent.com -> túnel

# Iniciar túnel
cloudflared tunnel run --url http://localhost:5678 n8n-dev
```

**Resultado:** `https://n8n-dev.kairoagent.com` apunta a tu n8n local, URL fija.

---

## Seguridad

### Desarrollo Local

| Aspecto | Estado |
|---------|--------|
| Docker aislado | ✅ n8n no accede a archivos de tu PC |
| Puerto específico | ✅ Solo 5678 expuesto |
| Autenticación | ✅ Usuario/password en n8n |
| HTTPS | ✅ ngrok/Cloudflare lo manejan |

### Buenas prácticas

1. **Apagar ngrok/túnel** cuando no estés probando
2. **No usar en redes públicas** (cafeterías, aeropuertos)
3. **Cambiar password default** de n8n
4. **No commitear** `.env` con credenciales

---

## Migración a Producción

Cuando los flujos estén listos:

1. **Exportar flujo** desde n8n local (JSON)
2. **Crear proyecto** en Railway
3. **Deploy n8n** en Railway (template disponible)
4. **Importar flujos** en n8n de Railway
5. **Actualizar webhook** en WhatsApp a URL de Railway
6. **Configurar variables** de entorno (API keys, etc.)

Railway provee URL fija tipo: `https://tu-proyecto.up.railway.app`

---

## Costos Estimados

### MVP (2-3 clientes)

| Servicio | Costo/mes |
|----------|-----------|
| Railway (n8n) | ~$5-10 |
| Supabase | Gratis (free tier) |
| Vercel (KAIRO) | Gratis (free tier) |
| WhatsApp Cloud API | ~$0.005-0.08 por conversación |
| OpenAI API | ~$5-20 (según uso) |
| **Total** | **~$10-30/mes** |

### Escala futura

Si KAIRO crece significativamente, evaluar:
- Mover lógica de n8n a código dentro de KAIRO
- Usar Hetzner + Coolify para reducir costos
- Agregador de canales (Twilio/MessageBird) para multi-canal

---

## Canales Soportados

### MVP
- ✅ WhatsApp (Cloud API)

### Futuro (post-MVP)
- ⏳ Facebook Messenger (Graph API)
- ⏳ Instagram DM (Graph API)
- ❌ TikTok (No hay API pública para DMs)

---

## Webhook Directo de WhatsApp (Desarrollo Local)

Además de la integración via n8n, KAIRO puede recibir mensajes de WhatsApp directamente para desarrollo y testing.

### Arquitectura Directa

```
┌─────────────────────────────────────────────────────────────────┐
│                    DESARROLLO LOCAL                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   WhatsApp Cloud API                                            │
│         │                                                        │
│         ▼                                                        │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │   ngrok     │────▶│    KAIRO    │────▶│  Supabase   │      │
│   │   tunnel    │     │ (localhost) │     │ (PostgreSQL)│      │
│   └─────────────┘     └─────────────┘     └─────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Setup con ngrok

#### 1. Instalar ngrok

```bash
# Windows (npm)
npm install -g ngrok

# Windows (winget)
winget install ngrok

# Mac
brew install ngrok
```

#### 2. Configurar cuenta

```bash
# Crear cuenta gratis en https://dashboard.ngrok.com/signup
# Obtener token de: https://dashboard.ngrok.com/get-started/your-authtoken

# Configurar token
ngrok config add-authtoken TU_AUTH_TOKEN
```

#### 3. Configurar KAIRO

Agregar a `.env.local`:

```bash
# WhatsApp Webhook (cualquier string, lo usarás en Meta)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=kairo_wh_v3r1fy_2026
```

#### 4. Iniciar servicios

```bash
# Terminal 1: KAIRO
npm run dev

# Terminal 2: ngrok (exponer puerto 3000)
ngrok http 3000
```

ngrok mostrará una URL pública como:
```
Forwarding    https://abc123.ngrok-free.dev -> http://localhost:3000
```

### Configurar Webhook en Meta

1. Ir a [Meta Developer Portal](https://developers.facebook.com/)
2. Seleccionar tu app de WhatsApp Business
3. WhatsApp → Configuración → Webhooks
4. Editar webhook:
   - **URL del webhook**: `https://abc123.ngrok-free.dev/api/webhooks/whatsapp`
   - **Token de verificación**: `kairo_wh_v3r1fy_2026` (mismo de `.env.local`)
5. Suscribirse a campos:
   - `messages` ✅

### Endpoints del Webhook

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| GET | `/api/webhooks/whatsapp` | Verificación de Meta |
| POST | `/api/webhooks/whatsapp` | Recibir mensajes |

### Tipos de mensajes soportados

- ✅ Texto
- ✅ Imagen (con caption)
- ✅ Audio
- ✅ Video (con caption)
- ✅ Documento (con filename)
- ⏳ Ubicación
- ⏳ Contactos
- ⏳ Botones/Interactivos

### ⚠️ Limitaciones de ngrok free

- URL cambia cada vez que reinicias ngrok
- Necesitas actualizar webhook en Meta cada vez
- **Solución futura:** Cloudflare Tunnel con dominio propio

### Flujo de mensaje entrante

1. Lead envía mensaje por WhatsApp
2. Meta hace POST a `https://tu-ngrok.ngrok-free.dev/api/webhooks/whatsapp`
3. KAIRO identifica el proyecto por `phone_number_id`
4. Si el lead no existe → Crea lead + conversación
5. Si el lead existe → Agrega mensaje a conversación
6. UI de KAIRO muestra el mensaje en tiempo real (futuro: WebSocket)

---

## Referencias

- [n8n Documentation](https://docs.n8n.io/)
- [Railway Templates](https://railway.app/templates)
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [WhatsApp Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [ngrok](https://ngrok.com/docs)
