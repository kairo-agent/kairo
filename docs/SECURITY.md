# KAIRO - Security Documentation

## Resumen Ejecutivo

KAIRO ha completado su primera auditoría de seguridad (Security Audit v1) siguiendo las mejores prácticas de OWASP. Este documento describe todas las protecciones implementadas, configuraciones requeridas y checklist para futuras features.

**Estado:** ✅ Security Audit v1 Completado (Enero 2026)

---

## Timeline de Seguridad

| Versión | Fecha | Mejoras Clave |
|---------|-------|---------------|
| **v0.7.8** | 2026-01-31 | Redis para rate limiting, headers OWASP adicionales (LOW) |
| **v0.7.7** | 2026-01-31 | Input validation, error handling (MEDIUM) |
| **v0.7.6** | 2026-01-31 | Next.js 16.1.6 CVE fixes, fail-closed, timingSafeEqual (HIGH) |
| **v0.7.5** | 2026-01-30 | HTTP security headers, rate limiting (MEDIUM) |

**Commits relacionados:**
- `d42320a` - @upstash/redis + OWASP headers
- `8b35702` - Input validation + error handling
- `ed2bccc` - Fail-closed + timingSafeEqual
- `84c5f01` - HTTP headers + rate limiting
- `f00a075` - Next.js 16.1.6 CVE fixes

---

## Matriz de Security Headers (13 headers implementados)

| Header | Valor | Protección | Estándar |
|--------|-------|------------|----------|
| **Content-Security-Policy** | Strict CSP (ver next.config.ts) | XSS, injection attacks | OWASP Top 10 |
| **X-Frame-Options** | DENY | Clickjacking | OWASP Top 10 |
| **X-Content-Type-Options** | nosniff | MIME sniffing | OWASP Top 10 |
| **Referrer-Policy** | strict-origin-when-cross-origin | Information disclosure | OWASP |
| **Permissions-Policy** | camera/mic/geo disabled | Unwanted feature access | OWASP |
| **Strict-Transport-Security** | max-age=63072000; includeSubDomains; preload | Man-in-the-middle (MITM) | OWASP Top 10 |
| **X-Permitted-Cross-Domain-Policies** | none | Flash/PDF cross-domain | OWASP |
| **X-Download-Options** | noopen | IE download execution | OWASP |
| **Cross-Origin-Opener-Policy** | same-origin | Spectre-like attacks | OWASP |
| **Cross-Origin-Resource-Policy** | same-origin | Cross-origin resource loading | OWASP |

**Configuración:** `next.config.ts` - Sección `securityHeaders`

---

## Rate Limiting por Endpoint

| Endpoint | Límite | Ventana | Key | Riesgo |
|----------|--------|---------|-----|--------|
| `/api/webhooks/whatsapp` | 300 req | 1 min | IP address | Alto (Meta bursts) |
| `/api/whatsapp/send` | 100 req | 1 min | projectId | Alto (WhatsApp API limit) |
| `/api/ai/respond` | 60 req | 1 min | projectId | Medio (OpenAI API cost) |
| `/api/rag/search` | 120 req | 1 min | agentId | Medio (embeddings cost) |

**Implementación:** `src/lib/rate-limit.ts`

**Desarrollo:** Usa almacenamiento en memoria (limpieza automática >1000 entries)

**Producción:** Usa Upstash Redis (requiere env vars, fallback a memoria si no configurado)

---

## Protecciones Implementadas

### 1. OWASP Top 10 Coverage

| OWASP Risk | Protección KAIRO | Implementación |
|------------|------------------|----------------|
| **A01:2021 - Broken Access Control** | RBAC + multi-tenant isolation | `src/lib/rbac.ts`, RLS policies |
| **A02:2021 - Cryptographic Failures** | AES-256-GCM secrets, HTTPS-only | `src/lib/crypto/secrets.ts` |
| **A03:2021 - Injection** | Input validation, Prisma ORM | Zod validation en APIs |
| **A04:2021 - Insecure Design** | Fail-closed patterns, rate limiting | APIs con validación estricta |
| **A05:2021 - Security Misconfiguration** | Security headers, CSP | `next.config.ts` |
| **A06:2021 - Vulnerable Components** | Next.js 16.1.6+ (CVE fixes) | Dependencias actualizadas |
| **A07:2021 - Authentication Failures** | Supabase Auth + timingSafeEqual | Secret comparison segura |
| **A08:2021 - Data Integrity Failures** | HMAC-SHA256 webhooks, HSTS | Webhook verification |
| **A09:2021 - Logging Failures** | Error handling sin exposición | Logs internos, no en response |
| **A10:2021 - SSRF** | URL validation HTTPS, CSP connect-src | Validación de mediaUrl |

### 2. Input Validation

**Endpoints con validación estricta:**

- `/api/ai/respond` - Valida conversationId (UUID), leadId (UUID), projectId (UUID), message (≤4096 chars), agentId (UUID), agentName (string, ≤255 chars)
- `/api/whatsapp/send` - Valida to (phone E.164), message (≤4096 chars), mediaUrl (HTTPS), messageType (enum)
- `/api/rag/search` - Valida agentId (UUID), projectId (UUID), query (≤8000 chars), limit (1-20), threshold (0-1)

**Validaciones comunes:**
- UUIDs con regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
- Phone numbers con regex `/^\+[1-9]\d{1,14}$/` (E.164)
- URLs con protocolo HTTPS obligatorio
- String lengths según límites de WhatsApp/OpenAI
- Empty string checks antes de procesar

### 3. Error Handling

**Patrón implementado:**
```typescript
try {
  // ... lógica de negocio
} catch (error) {
  console.error('[API] Internal error:', error);

  return NextResponse.json(
    {
      success: false,
      error: 'Internal server error' // Generic message, NO error.message
    },
    { status: 500 }
  );
}
```

**Por qué:** Previene information disclosure de stack traces, rutas de archivos, nombres de BD, etc.

### 4. Timing Attack Prevention

**APIs con timingSafeEqual:**
- `/api/ai/respond` - Header X-N8N-Secret
- `/api/rag/search` - Header X-N8N-Secret
- `/api/messages/confirm` - Header X-N8N-Secret (legacy)

**Implementación:**
```typescript
import { timingSafeEqual } from 'crypto';

const expectedSecret = process.env.N8N_CALLBACK_SECRET;
const providedSecret = req.headers.get('X-N8N-Secret');

if (!timingSafeEqual(
  Buffer.from(expectedSecret, 'utf8'),
  Buffer.from(providedSecret, 'utf8')
)) {
  return unauthorized();
}
```

### 5. Fail-Closed Patterns

**Regla:** Si una variable de entorno crítica no está configurada en producción, **rechazar el request** (no fallback inseguro).

**Implementado en:**
- `/api/ai/respond` - Falla si N8N_CALLBACK_SECRET no configurado
- `/api/rag/search` - Falla si N8N_CALLBACK_SECRET no configurado
- `/api/webhooks/whatsapp` - Falla si WHATSAPP_APP_SECRET no configurado (verificación HMAC)

**Bypass solo en desarrollo:**
```typescript
if (process.env.NODE_ENV === 'production' && !process.env.N8N_CALLBACK_SECRET) {
  return NextResponse.json(
    { success: false, error: 'Server misconfigured' },
    { status: 500 }
  );
}
```

---

## Variables de Entorno Requeridas para Seguridad

### Producción (OBLIGATORIAS)

```bash
# === Secrets Encriptados ===
SECRETS_ENCRYPTION_KEY=<64_hex_chars_32_bytes>
# Generar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# === n8n Callbacks ===
N8N_CALLBACK_SECRET=<shared_secret_con_n8n>
# Mínimo 32 caracteres, alfanumérico + símbolos

# === WhatsApp Webhook Verification ===
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<verify_token_de_meta>
WHATSAPP_APP_SECRET=<app_secret_de_meta>
# App Secret está en Meta Developer Console → Settings → Basic

# === Cron Jobs ===
CRON_SECRET=<secret_para_cron_jobs>
# Usado en /api/cron/cleanup-media

# === Rate Limiting (Opcional pero recomendado) ===
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
# Si no configurado, fallback a rate limiting en memoria
```

### Desarrollo (OPCIONALES - NO usar en producción)

```bash
# Bypass auth en /api/whatsapp/send (solo desarrollo local)
BYPASS_AUTH_DEV=true

# Bypass verificación HMAC en webhook WhatsApp (solo ngrok)
WEBHOOK_BYPASS_SIGNATURE=true
```

⚠️ **NUNCA** incluir bypass flags en producción

---

## Cómo Habilitar Redis para Rate Limiting

### Opción 1: Upstash (Recomendado para Vercel)

1. Crear cuenta en https://upstash.com/
2. Crear base de datos Redis (región más cercana a tu app)
3. Copiar REST URL y REST Token
4. Agregar a Vercel env vars:
   ```
   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_token_here
   ```
5. Redeploy en Vercel

**Costo:** Free tier: 10,000 commands/day (suficiente para MVP)

### Opción 2: Railway Redis

1. Railway Dashboard → Add Service → Redis
2. Copiar REDIS_URL de variables
3. Convertir a REST URL (Upstash tiene adaptador)
4. Configurar variables en Vercel

### Fallback Automático

Si Redis no está configurado o falla, KAIRO usa automáticamente rate limiting en memoria (suficiente para desarrollo, no recomendado para producción con múltiples instancias serverless).

---

## Checklist de Seguridad para Nuevas Features

### APIs Públicas

- [ ] Input validation con Zod o regex
- [ ] Rate limiting con `checkRateLimit()` de `src/lib/rate-limit.ts`
- [ ] Error handling genérico (no exponer `error.message`)
- [ ] Security headers aplicados (automático vía `next.config.ts`)
- [ ] Logging de errores en servidor (no en response)

### APIs Autenticadas

- [ ] Verificación de sesión Supabase Auth
- [ ] Verificación de permisos (RBAC via `src/lib/rbac.ts`)
- [ ] Validación de ownership chain (project → lead → conversation)
- [ ] Secrets con timingSafeEqual si aplica
- [ ] Fail-closed si env vars faltantes en producción

### Webhooks Externos

- [ ] Verificación HMAC-SHA256 de firma (WhatsApp, Meta, etc.)
- [ ] Validación del origen (IP whitelisting si aplica)
- [ ] Rate limiting por IP con límite alto para bursts
- [ ] Logging completo de payloads recibidos
- [ ] Manejo de duplicados (idempotencia)

### Almacenamiento de Datos Sensibles

- [ ] Encriptación AES-256-GCM para secrets (ver `src/lib/crypto/secrets.ts`)
- [ ] Audit log de accesos (`SecretAccessLog` model)
- [ ] RLS policies en Supabase para multi-tenant
- [ ] Nunca loggear secrets en plaintext
- [ ] Key rotation plan documentado

### Client-Side

- [ ] Nunca almacenar secrets en localStorage/sessionStorage
- [ ] Tokens en httpOnly cookies vía Supabase Auth
- [ ] CSP permite solo dominios whitelisteados
- [ ] Validación de inputs en frontend Y backend
- [ ] Sanitización de HTML si se renderiza user input

---

## Archivos Clave de Seguridad

| Archivo | Propósito |
|---------|-----------|
| `next.config.ts` | Security headers (13 headers) |
| `src/lib/rate-limit.ts` | Rate limiting (memoria + Redis) |
| `src/lib/crypto/secrets.ts` | Encriptación AES-256-GCM |
| `src/lib/rbac.ts` | Role-Based Access Control helpers |
| `src/lib/auth-helpers.ts` | Autenticación y verificación de permisos |
| `src/app/api/webhooks/whatsapp/route.ts` | Verificación HMAC-SHA256 |
| `scripts/secure-storage-rls.sql` | RLS policies para Supabase Storage |
| `prisma/schema.prisma` | Modelos con índices y constraints |

---

## Referencias

### OWASP Resources
- [OWASP Top 10 (2021)](https://owasp.org/Top10/)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)

### Next.js Security
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [Content Security Policy Guide](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)

### Supabase Security
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Security](https://supabase.com/docs/guides/storage/security/access-control)

### Rate Limiting
- [Upstash Redis Documentation](https://upstash.com/docs/redis)
- [Vercel Rate Limiting Guide](https://vercel.com/guides/how-to-rate-limit-requests)

---

## Historial de Auditorías

### Security Audit v1 (Enero 2026)

**Ejecutado por:** Claude Opus 4.5 (Security Auditor subagent)

**Alcance:**
- OWASP Top 10 compliance
- Input validation en APIs públicas
- Error handling
- Rate limiting
- HTTP security headers
- Timing attack prevention
- Fail-closed patterns
- Secrets management

**Hallazgos:**
- ✅ 0 vulnerabilidades CRÍTICAS
- ✅ 0 vulnerabilidades ALTAS
- ⚠️ 3 issues MEDIOS (resueltos en v0.7.7)
- ⚠️ 2 issues BAJOS (resueltos en v0.7.8)

**Estado:** ✅ COMPLETADO - Todas las recomendaciones implementadas

**Próxima auditoría:** Post-MVP (después de implementar features de monetización)

---

## Contacto

Para reportar vulnerabilidades de seguridad de forma privada, contactar a:

**Email:** joseleon86@gmail.com (Leo - Founder)

**Por favor NO crear issues públicos en GitHub para vulnerabilidades de seguridad.**

---

*Última actualización: 2026-01-31 - Security Audit v1 Completado*
