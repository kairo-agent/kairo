# KAIRO - Changelog

## [0.6.0] - 2026-01-24

### Performance
- **Fase 1: Request-Scoped Caching** (commit `779a7b6`)
  - Funciones de autenticación envueltas con `cache()` de React
    - `getCurrentUser()` en `src/lib/actions/auth.ts`
    - `getCurrentUser()` y `verifySuperAdmin()` en `src/lib/auth-helpers.ts`
  - Reducción de ~60-70% en queries duplicadas de autenticación por request
  - Cache automático request-scoped (no persiste entre requests)

- **Fase 1: In-Memory Cache para Webhooks WhatsApp** (commit `779a7b6`)
  - Cache en memoria para mapeo `phoneNumberId → projectId`
  - TTL de 5 minutos con auto-expiración
  - Funciones: `getCachedProject()`, `setCachedProject()`, `invalidatePhoneNumberCache()`
  - Reducción de ~95% en queries de lookup después del primer mensaje
  - Archivo: `src/app/api/webhooks/whatsapp/route.ts`

- **Fase 2: Paginación Backend con Cursor** (commit `247dc7f`)
  - Implementación de cursor-based pagination en `getLeadConversation()`
  - Nuevo tipo exportado: `PaginatedConversation` con metadatos de paginación
  - Parámetros: `cursor` (ID del mensaje), `limit` (max 100, default 50)
  - Reducción de ~80% en payload inicial para conversaciones con historial largo
  - Validación de permisos mantenida en cada request paginado
  - Archivo: `src/lib/actions/messages.ts`

- **Fase 2: React Query con useInfiniteQuery** (commit `247dc7f`)
  - Integración de TanStack Query en `LeadChat.tsx`
  - `useInfiniteQuery` para paginación infinita de mensajes
  - Cache en memoria RAM (no localStorage) con TTL de 30s y gcTime de 5min
  - Integración con Supabase Realtime para mensajes nuevos
  - Botón "Cargar mensajes anteriores" con scroll inteligente
  - Sincronización de estado de mensajes (doble check azul) via cache update
  - Archivo: `src/components/features/LeadChat.tsx`

- **QueryProvider Configuration** (commit `247dc7f`)
  - Configuración global de React Query optimizada para Next.js
  - `staleTime: 30s`, `gcTime: 5min`, `retry: 1`
  - `refetchOnWindowFocus: false` para evitar requests innecesarios
  - Singleton pattern para QueryClient en browser
  - Archivo: `src/providers/QueryProvider.tsx`

### Documentación
- **PERFORMANCE.md creado**
  - Documentación completa de optimizaciones Fase 1 y Fase 2
  - Métricas de impacto: reducción de queries, payloads, tiempos de carga
  - Diagramas de flujo para cache y paginación
  - Sección de seguridad: qué NO va en localStorage
  - Roadmap de Fase 3, 4 y 5
  - Referencias a documentación oficial de React, TanStack Query, Prisma

- **CHANGELOG.md actualizado**
  - Entradas detalladas de Fase 1 y Fase 2
  - Commits de performance identificados

### Notas Técnicas
- Cache de React Query vive **solo en memoria RAM** (no persiste al cerrar tab)
- Cache de webhook vive **solo en memoria del servidor** (no persiste al reiniciar)
- `React.cache()` es **request-scoped** (se limpia entre requests)
- Validación de permisos **nunca se omite**, solo se optimiza con cache

---

## [0.5.3] - 2026-01-23

### Seguridad
- **API /api/whatsapp/send** - Autenticación reforzada
  - Verificación de sesión Supabase Auth
  - Verificación de membresía en proyecto
  - Variable `BYPASS_AUTH_DEV` para desarrollo local

- **API /api/messages/confirm** - Shared secret para callbacks n8n
  - Validación de header `X-N8N-Secret`
  - Variable `N8N_CALLBACK_SECRET` requerida
  - Previene callbacks no autorizados

- **Webhook /api/webhooks/whatsapp** - Verificación HMAC-SHA256
  - Función `verifyWebhookSignature()` con crypto nativo
  - Valida header `X-Hub-Signature-256` de Meta
  - Variable `WHATSAPP_APP_SECRET` (App Secret de Meta, no Access Token)
  - Variable `WEBHOOK_BYPASS_SIGNATURE` para desarrollo con ngrok

### Mejorado
- **Exports centralizados** - Index.ts completados
  - `src/components/layout/index.ts` - WorkspaceSelector agregado
  - `src/components/admin/index.ts` - ProjectSettingsModal agregado
  - `src/components/features/index.ts` - Archivo creado con todos los exports

### Documentación
- **CLAUDE.md actualizado**
  - Nueva sección "Seguridad de APIs" con tabla resumen
  - Documentación de variables de entorno de seguridad
  - Guía de configuración para producción vs desarrollo

### Testing
- **Flujo WhatsApp verificado end-to-end**
  - Webhook recibe mensajes via ngrok
  - Mensajes aparecen en tiempo real en chat
  - Modo Human funcional con envío de respuestas

---

## [0.5.2] - 2026-01-22

### Agregado
- **WhatsApp Read Receipts (Marcar como leído)**
  - Integración con WhatsApp Cloud API para enviar read receipts
  - Endpoint API `/api/whatsapp/mark-read` con seguridad completa:
    - Autenticación via Supabase Auth
    - Verificación de membresía en proyecto
    - Validación de ownership chain (project → lead → messages)
    - Rate limiting (100 req/min por proyecto)
    - Validación Zod con regex para WhatsApp message IDs
  - Server Action `markMessagesAsRead()` en `messages.ts`:
    - Marca mensajes como leídos en BD local
    - Envía read receipts a WhatsApp API (solo en modo Human)
    - Procesa en batches de 10 para no saturar la API
  - Integración automática en `LeadChat.tsx`:
    - Al abrir el chat marca mensajes como leídos
    - Al recibir mensaje via Realtime lo marca como leído

- **Rate Limiting Utility** (`src/lib/rate-limit.ts`)
  - Soporte dual: memoria (desarrollo) y Redis (producción)
  - Upstash Redis para entornos serverless
  - Pre-configurados: `standard`, `strict`, `lenient`, `whatsapp`
  - Limpieza automática de entradas expiradas en memoria

- **WhatsApp Status Indicators en Chat**
  - Iconos estilo WhatsApp para estado de mensajes:
    - ⏱️ Reloj (pendiente/enviando)
    - ✓ Check gris (enviado a WhatsApp)
    - ✓✓ Doble check gris (entregado)
    - ✓✓ Doble check azul (leído)
  - Actualización en tiempo real via Supabase Realtime (UPDATE events)

- **Supabase Realtime para Updates de Estado**
  - Hook `useRealtimeMessages` extendido con `onMessageUpdate` callback
  - Escucha eventos UPDATE en tabla `messages`
  - Tipo `MessageStatusUpdate` para payloads de actualización
  - Sincronización automática de `isDelivered`, `isRead`, `whatsappMsgId`

### Cambiado
- **Label de mensajes humanos en chat**
  - Ahora muestra el nombre del usuario que tomó el control (`handoffStatus.handoffUser`)
  - Fallback: 1) sentByUser (BD), 2) handoffUser (Realtime), 3) "Vendedor"
  - Fix: mensajes via Realtime ahora muestran nombre correcto del agente

### Corregido
- **ZodError handling** en endpoint mark-read
  - Corregido `error.errors` → `error.issues` (API correcta de Zod)
- **Dynamic import de @upstash/redis**
  - Casting a string para evitar error de tipos en import dinámico

### Archivos clave
- `src/app/api/whatsapp/mark-read/route.ts` - Endpoint completo (nuevo)
- `src/lib/rate-limit.ts` - Utilidad de rate limiting (nuevo)
- `src/lib/actions/messages.ts` - `markMessagesAsRead()` actualizado
- `src/hooks/useRealtimeMessages.ts` - Soporte para UPDATE events
- `src/components/features/LeadChat.tsx` - Status indicators + nombre usuario

### Decisiones de Diseño
- **Read receipts solo en modo Human**: En modo AI, n8n maneja la lectura
- **Sin polling automático**: Los receipts se envían cuando el usuario abre el chat
- **Comportamiento intencional**: Si el vendedor cierra KAIRO en modo Human, los mensajes NO se marcan como leídos hasta que vuelva a abrir el chat

### Validación
- Probado con Playwright MCP: envío de mensajes, recepción, checks azules visibles
- WhatsApp Web confirmó doble check azul en mensajes del lead

---

## [0.5.1] - 2026-01-22

### Agregado
- **Integración directa con WhatsApp Cloud API**
  - Endpoint webhook `/api/webhooks/whatsapp` para recibir mensajes
  - Verificación GET para suscripción de Meta
  - Procesamiento POST de mensajes entrantes
  - Tipos de mensaje soportados: texto, imagen, audio, video, documento
  - Identificación de proyecto por `phone_number_id` encriptado
  - Fallback a primer proyecto activo para desarrollo

- **Creación automática de leads desde WhatsApp**
  - Lead creado automáticamente al primer mensaje de un número nuevo
  - Conversación creada con el lead vinculado
  - Mensajes almacenados con metadata completa (timestamp, tipo, contenido)
  - Actualización de status de mensajes (sent, delivered, read, failed)

- **Botón de refresh manual en grilla de leads**
  - Ícono de refresh al lado del botón "Nuevo Lead"
  - Tooltip "Actualizar ingreso de leads" / "Refresh incoming leads"
  - Animación de spin mientras carga
  - Evita polling automático (ahorro de requests en free tier)

- **Documentación de webhook WhatsApp**
  - Sección completa en `docs/N8N-SETUP.md`
  - Guía de setup con ngrok para desarrollo local
  - Configuración en Meta Developer Portal
  - Flujo de mensaje entrante documentado

### Decisiones de Diseño
- **No implementar eliminación de leads** (decisión de negocio)
  - Razón: Valor comercial de datos históricos
  - Remarketing, análisis de conversión, auditoría, ML futuro
  - Alternativa recomendada: Usar status `archived` (ya existe en enum)
  - Leads archivados se ocultan de vista activa pero se conservan
  - TODO futuro: Implementar UI para archivar leads (no eliminar)

- **Arquitectura híbrida con n8n** (decisión técnica)
  - KAIRO maneja: webhooks, almacenamiento, UI, envío WhatsApp
  - n8n maneja: lógica de agentes IA, orquestación, prompts editables
  - Ventajas: prompts sin deploy, multi-canal (WA/FB/IG), observabilidad
  - Soporte canales: WhatsApp (API), Facebook Messenger (nodo nativo), Instagram (Graph API)
  - Costo estimado: ~$20/mes n8n Cloud
  - TODO: `/api/whatsapp/send`, trigger a n8n, workflow de agentes

### Traducciones
- Nueva key `leads.refreshLeads` en es.json y en.json

### Archivos clave
- `src/app/api/webhooks/whatsapp/route.ts` - Webhook completo
- `src/app/[locale]/(dashboard)/leads/LeadsPageClient.tsx` - Botón refresh
- `docs/N8N-SETUP.md` - Documentación de setup

---

## [0.5.0] - 2026-01-20

### Agregado
- **Gestión completa de Agentes IA en ProjectSettingsModal**
  - CRUD completo: Crear, Leer, Actualizar, Eliminar agentes
  - Visualización en tarjetas con iconos por tipo:
    - 💼 Ventas (sales) - azul
    - 🎧 Soporte (support) - verde
    - 📊 Calificación (qualification) - púrpura
    - 📅 Citas (appointment) - naranja
  - Badge de estado (Activo/Inactivo) con toggle
  - Contador de leads asignados por agente
  - Formulario de creación/edición con validación
  - Confirmación de eliminación con mensaje de dependencias
  - Bloqueo de eliminación si tiene leads asignados

- **Server Actions para AIAgent** (`src/lib/actions/agents.ts`)
  - `getProjectAgents(projectId)`: Listar agentes del proyecto
  - `getAgent(agentId)`: Obtener agente por ID
  - `createAgent(input)`: Crear nuevo agente
  - `updateAgent(agentId, input)`: Actualizar agente
  - `deleteAgent(agentId)`: Eliminar agente (con validación de leads)
  - `toggleAgentStatus(agentId)`: Activar/desactivar agente
  - Verificación de permisos (admin/manager del proyecto)
  - Validación de nombre único por proyecto

- **Sistema de Secrets encriptados para proyectos**
  - Modelo `ProjectSecret` con encriptación AES-256-GCM
  - Modelo `SecretAccessLog` para auditoría de accesos
  - Server Actions en `src/lib/actions/secrets.ts`:
    - `setProjectSecret()`: Guardar secret encriptado
    - `getProjectSecret()`: Obtener secret desencriptado (interno)
    - `getProjectSecretForUser()`: Obtener con verificación de permisos
    - `deleteProjectSecret()`: Eliminar secret
    - `getProjectSecretsStatus()`: Estado de configuración
    - `setProjectSecrets()`: Guardar múltiples secrets
  - Módulo de encriptación `src/lib/crypto/secrets.ts`
  - Variable de entorno `SECRETS_ENCRYPTION_KEY` para clave AES

- **Tab WhatsApp en ProjectSettingsModal**
  - Configuración de credenciales de WhatsApp Business API
  - Campos: Access Token, Phone Number ID, Business Account ID
  - Toggle para mostrar/ocultar tokens
  - Indicadores de estado (configurado/no configurado)
  - Guardado encriptado de credenciales

- **Tab Webhooks en ProjectSettingsModal**
  - Configuración de URL de webhook n8n
  - Guardado en campo `project.n8nWebhookUrl`

- **Traducciones para gestión de agentes**
  - Namespace `admin.agentSettings` en es.json y en.json
  - Incluye: tipos de agente, descripciones, mensajes de éxito/error
  - Soporte para mensaje de bloqueo con conteo de leads

### Cambiado
- **ProjectSettingsModal refactorizado**
  - De tabs placeholder a tabs funcionales
  - Estado separado para cada tab (agentes, whatsapp, webhooks)
  - Carga de datos al abrir modal
  - Mensajes de éxito/error por operación

- **Botón "Configurar" en tabla de proyectos**
  - Nuevo icono BotIcon (monitor con robot)
  - Abre ProjectSettingsModal con tabs funcionales

### Corregido
- **Error de build en secrets.ts**
  - `getCurrentUser()` retorna `userId`, no `id`
  - Corregido en todas las funciones del archivo

### Archivos clave
- `src/lib/actions/agents.ts` - Server Actions CRUD agentes (NUEVO)
- `src/lib/actions/secrets.ts` - Server Actions secrets (NUEVO)
- `src/lib/crypto/secrets.ts` - Módulo de encriptación (NUEVO)
- `src/components/admin/ProjectSettingsModal.tsx` - Modal refactorizado
- `src/messages/es.json` - Traducciones agentSettings
- `src/messages/en.json` - Traducciones agentSettings
- `prisma/schema.prisma` - Modelos ProjectSecret, SecretAccessLog

### Validación
- Playwright E2E: Login, abrir modal, crear agente "Stella", eliminar agente
- Build exitoso sin errores de TypeScript

---

## [0.4.7] - 2026-01-13

### Eliminado
- **Botón de adjuntar enlace en ChatInput**
  - Removido el ícono y modal para agregar enlaces URL
  - Los enlaces ahora se pegan directamente en el textarea (comportamiento estándar como WhatsApp/Telegram)
  - Simplifica la interfaz reduciendo un botón innecesario

### Cambiado
- **Tipo ChatAttachment simplificado**
  - Eliminado tipo `'link'` del union type
  - Propiedad `file` ahora es requerida (no opcional)
  - Propiedad `url` eliminada (ya no es necesaria)

---

## [0.4.6] - 2026-01-13

### Agregado
- **Chat enriquecido para modo Human Handoff**
  - Selector de emojis con librería `emoji-mart` (carga dinámica)
  - Adjuntos de archivos: imágenes, videos, documentos
  - Solo un adjunto a la vez (UX similar a WhatsApp Web)
  - Preview de adjuntos con miniatura para imágenes
  - Botón para eliminar adjunto antes de enviar

- **Componente ChatInput.tsx** (nuevo)
  - Textarea expansible (3-8 líneas) con auto-resize
  - Barra de adjuntos con iconos para cada tipo
  - Patrón `forwardRef` + `useImperativeHandle` para inserción de emojis desde padre
  - Interfaz `ChatInputRef` con método `insertEmoji(emoji: string)`

- **Integración de emoji-mart en LeadChat.tsx**
  - Import dinámico con `next/dynamic` (SSR: false)
  - Carga bajo demanda del data de emojis (@emoji-mart/data)
  - Picker con tema automático y locale español
  - Click outside para cerrar el picker

- **Traducciones del chat** (es.json y en.json)
  - `leads.chat.placeholder`: Placeholder del textarea
  - `leads.chat.attachImage/Video/File`: Tooltips de botones
  - `leads.chat.emoji`: Tooltip del botón de emojis
  - `leads.chat.removeAttachment`: Quitar adjunto

### Cambiado
- **Ruta /profile agregada a routing.ts**
  - Corrige error TypeScript en Header.tsx al navegar a perfil

### Corregido
- **Error de dependencia npm ERESOLVE**
  - emoji-mart requiere React 16-18, proyecto usa React 19
  - Solución: Instalación con `--legacy-peer-deps`

- **Error "Can't resolve 'emoji-mart'"**
  - @emoji-mart/react depende de emoji-mart como peer dependency
  - Solución: Instalar `emoji-mart` explícitamente

- **Error TypeScript en LeadDetailPanel.tsx**
  - Tipo `undefined` no asignable a `string | null`
  - Solución: Nullish coalescing (`?? null`) en campos opcionales

- **Error TypeScript en LeadEditModal.tsx**
  - Prop `style` no existe en componente Badge
  - Solución: Eliminar la prop

- **Error TypeScript con emojiData**
  - Tipo `unknown` no asignable a props de EmojiPicker
  - Solución: Usar tipo `any` con eslint-disable comment

### Dependencias
- `emoji-mart`: ^5.6.0 (peer dependency requerida)
- `@emoji-mart/react`: ^1.1.1 (componente React)
- `@emoji-mart/data`: ^1.2.1 (datos de emojis)

### Archivos clave
- `src/components/features/ChatInput.tsx` - Nuevo componente
- `src/components/features/LeadChat.tsx` - Integración de ChatInput y emoji picker
- `src/messages/es.json` - Traducciones chat (líneas en namespace leads.chat)
- `src/messages/en.json` - Traducciones chat (líneas en namespace leads.chat)
- `src/i18n/routing.ts` - Ruta /profile agregada

### Notas técnicas
- Adjuntos de archivos son placeholder visual por ahora
- TODO: Implementar upload real a Supabase Storage cuando backend esté listo
- El emoji picker usa Shadow DOM internamente (custom elements)

---

## [0.4.5] - 2026-01-12

### Agregado
- **Paginación Server-Side con Filtros Integrados** (COMPLETADO)
  - Hook `useLeadsQuery` con TanStack Query para caching y refetch
  - Server Action `getLeadsPaginated()` con filtros server-side
  - Server Action `getLeadsStatsFromDB()` con filtros aplicados
  - Componente `Pagination.tsx` integrado en la UI
  - Helper `buildLeadWhereClause()` para construir queries Prisma
  - Tipos: `PaginationParams`, `PaginationInfo`, `PaginatedResponse<T>`
  - Constantes: `DEFAULT_PAGE_SIZE = 25`, `PAGE_SIZE_OPTIONS = [10, 25, 50, 100]`

- **Formato de fecha inteligente (Threshold-based)**
  - Función `formatRelativeTime()` con lógica de threshold:
    - Mismo día: "hoy" (o "hace X min" si < 1 hora)
    - Ayer: "ayer"
    - ≤7 días: "hace X d"
    - >7 días: fecha absoluta ("7 ene. 2026")

### Archivos clave
- `src/hooks/useLeadsQuery.ts` - Hook con TanStack Query
- `src/lib/actions/leads.ts` - Server actions con paginación
- `src/components/ui/Pagination.tsx` - Componente de paginación
- `src/types/index.ts` - Tipos de paginación (líneas 337-359)
- `src/lib/utils.ts` - formatRelativeTime actualizado
- `src/app/[locale]/(dashboard)/leads/LeadsPageClient.tsx` - Integración completa

### Notas técnicas
- Los filtros se ejecutan en el servidor (no client-side)
- Stats reflejan los filtros activos
- Reset automático a página 1 cuando cambian filtros
- Debounce de 300ms en búsqueda

---

## [0.4.4] - 2026-01-12

### Cambiado
- **Simplificación de canales para MVP**
  - Solo WhatsApp activo como canal de entrada
  - Filtro de canal oculto en la UI (4 columnas en lugar de 5)
  - 89 leads existentes migrados a canal WhatsApp
  - Enum `LeadChannel` y traducciones preservadas para compatibilidad futura
  - Comentarios TODO agregados para habilitar otros canales post-MVP

### Archivos modificados
- `src/types/index.ts` - Comentarios en enum y config
- `src/data/leads.ts` - Todos los leads mock ahora usan WhatsApp
- `src/components/features/LeadFilters.tsx` - Filtro de canal comentado
- `src/app/[locale]/(dashboard)/leads/LeadsPageClient.tsx` - Canal excluido del conteo de filtros

---

## [0.4.3] - 2026-01-12

### Agregado
- **Bloqueo estricto de eliminación (integridad referencial)**
  - Organizaciones no se pueden eliminar si tienen proyectos o miembros
  - Proyectos no se pueden eliminar si tienen miembros o leads
  - Mensajes de error descriptivos con conteo de dependencias
  - Orden de eliminación requerido: Usuarios → Proyectos → Organización

### Cambiado
- **UX mejorada en DeleteConfirmModal**
  - Cuando hay error de dependencias: botones "Cancelar" + "Eliminar" se reemplazan por solo "Entendido"
  - Evita que el usuario intente eliminar repetidamente cuando está bloqueado
  - Botón "Entendido" cierra el modal (variant ghost, no rojo)

### Traducciones
- Nuevas keys en `admin.messages`:
  - `cannotDeleteOrgHasProjects`, `cannotDeleteOrgHasMembers`
  - `cannotDeleteProjectHasMembers`, `cannotDeleteProjectHasLeads`
- Nueva key `common.buttons.understood` ("Entendido" / "Got it")

### Documentación
- **Regla 13 actualizada (RULES.md)**
  - Agregada sección "⚠️ ANÁLISIS PREVIO OBLIGATORIO"
  - Adan debe analizar qué sub-agentes usar ANTES de cada tarea
  - Priorizar paralelización cuando sea posible
  - Solo asumir tareas personalmente si no hay agente adecuado

---

## [0.4.2] - 2026-01-12

### Agregado
- **Formulario de contraseña mejorado en Perfil**
  - Validación en tiempo real con indicadores visuales (✓/✗)
  - Barra de fortaleza de contraseña (Débil/Aceptable/Buena/Fuerte)
  - Colores por nivel: rojo → naranja → amarillo → verde
  - Requisitos de contraseña mostrados en panel:
    - Mínimo 8 caracteres
    - Al menos una mayúscula
    - Al menos una minúscula
    - Al menos un número
    - Al menos un carácter especial (!@#$%^&*)
  - Botón "Generar contraseña segura" que crea password de 12 caracteres
  - Botones mostrar/ocultar en los 3 campos de contraseña
  - Botón copiar contraseña generada
  - Validación de coincidencia con feedback visual
  - Botón submit deshabilitado hasta cumplir todos los requisitos

### Cambiado
- **Validación de contraseña**
  - De 6 caracteres mínimo a 8 caracteres + requisitos de seguridad
  - Mensaje de error actualizado: "La contraseña no cumple todos los requisitos"

### Traducciones
- Nuevas keys en `profile.changePassword`:
  - `generate`, `showPassword`, `hidePassword`, `copied`
  - `requirements.*` (title, minLength, uppercase, lowercase, number, special)
  - `strength.*` (label, weak, fair, good, strong)
- Nueva key `profile.messages.passwordMatch`

---

## [0.4.1] - 2026-01-12

### Agregado
- **Página de Perfil de Usuario** (`/[locale]/profile`)
  - Tab Perfil: Editar nombre, apellido, avatar URL
  - Tab Contraseña: Cambiar contraseña con validación
  - Tab Membresías: Ver organizaciones y proyectos con roles
  - Selectores de Timezone y Locale (usar default de org o personalizado)
  - Server Actions: `getProfile()`, `updateProfile()`, `changePassword()`

- **Navegación a perfil desde Header**
  - Botón "Mi perfil" en dropdown de usuario ahora navega a `/profile`

### Cambiado
- **Tabla de Usuarios en Panel Admin**
  - Columna "Memberships" separada en dos: "Organización" y "Proyectos"
  - Organizaciones muestran: `NombreOrg (Owner)` o `NombreOrg`
  - Proyectos muestran: `NombreProyecto (rol)` separados por comas
  - Si no tiene membresías muestra guión "—"

- **Modal de creación de usuarios**
  - Membresía ahora es **obligatoria** para usuarios normales (no super_admin)
  - Título dinámico: "Membresía inicial (requerida)" vs "(opcional)"
  - Opciones "Sin organización" y "Sin proyecto" solo visibles para super_admin
  - Validación en frontend antes de enviar al servidor

### Corregido
- **Bug: Proyectos no cargaban en modal de usuario**
  - Causa: `projectsList` solo se cargaba con filtro de organización activo
  - Solución: Cargar todos los proyectos siempre en `getAdminOverviewData()`
  - El modal filtra internamente por `organizationId` seleccionado

### Traducciones
- Nuevo namespace `profile` en es.json y en.json
- Nueva key `users.organization` (singular) para header de tabla

---

## [0.4.0] - 2026-01-11

### Agregado
- **Panel de Administración completo** (`/[locale]/admin`)
  - Nuevo route group `(admin)` separado del dashboard
  - Vista unificada de Organizaciones, Proyectos y Usuarios
  - Tabs para cambiar entre vistas (Organizations, Projects, Users)
  - Filtros por organización y proyecto
  - Búsqueda con debounce de 300ms
  - Estadísticas en tiempo real (cards de resumen)

- **Sistema CRUD completo para entidades administrativas**
  - `OrganizationModal.tsx`: Crear/Editar organizaciones
    - Campos: nombre, slug (auto-generado), descripción, logo URL
    - Configuración de Timezone (12 zonas IANA para Latam/USA)
    - Configuración de Locale (8 opciones: es-PE, es-MX, en-US, etc.)
    - Toggle de estado activo (solo en edición)
  - `ProjectModal.tsx`: Crear/Editar proyectos
    - Selector de organización padre
    - Campos: nombre, slug, descripción, logo URL
    - Plan (Free, Starter, Professional, Enterprise) - solo edición
    - Toggle de estado activo (solo en edición)
  - `UserModal.tsx`: Crear/Editar usuarios
    - Campos básicos: nombre, apellido, email
    - Rol de sistema (User, Super Admin)
    - Generación automática de contraseña con opción de copiar
    - Membresía inicial opcional (organización + proyecto + rol)
    - Toggle de estado activo (solo en edición)
  - `DeleteConfirmModal.tsx`: Confirmación de eliminación
    - Diseño con icono de advertencia
    - Muestra nombre del item a eliminar
    - Botón rojo de confirmación

- **Server Actions para administración** (`src/lib/actions/admin.ts`)
  - `createOrganization()` / `updateOrganization()` / `deleteOrganization()`
  - `createProject()` / `updateProject()` / `deleteProject()`
  - `createUser()` / `updateUser()` / `deleteUser()`
  - `getAdminOverviewData()`: Datos con filtros y paginación
  - `joinOrganization()` / `joinProject()`: Unirse a entidades
  - Verificación de Super Admin en todas las acciones

- **Funcionalidad "Join" para membresías**
  - Botón "Unirme" en organizaciones y proyectos donde el usuario no es miembro
  - Indicador "Miembro" cuando ya pertenece
  - Creación automática de membresía con rol por defecto

- **Traducciones del módulo admin**
  - Namespace `admin` en es.json y en.json
  - Secciones: nav, modals, overview, organizations, projects, users
  - Roles de sistema y proyecto traducidos
  - Planes traducidos

- **Componentes UI nuevos**
  - `LoadingOverlay.tsx`: Overlay de carga global
  - `Pagination.tsx`: Componente de paginación (preparado para leads)

- **Arquitectura multi-tenant implementada**
  - Jerarquía: Organization → Project → User
  - Membresías: OrganizationMember (con isOwner) y ProjectMember (con role)
  - Roles de proyecto: ADMIN, MANAGER, AGENT, VIEWER
  - Roles de sistema: USER, SUPER_ADMIN

### Cambiado
- **Prisma Schema actualizado** para soportar multi-tenancy
  - Modelo Organization con `defaultTimezone` y `defaultLocale`
  - Modelo Project con `plan` enum
  - Modelo OrganizationMember y ProjectMember
  - Modelo User con `systemRole` enum
  - Índices optimizados para queries frecuentes

- **Sidebar actualizado**
  - Nuevo item "Admin" visible solo para Super Admins
  - Icono de escudo para identificar sección administrativa

### Técnico
- Migración Prisma: `20260111185601_multi_tenant_hierarchy`
- Seeds: `prisma/seed.ts` y `prisma/seed-fake-data.ts`
- Contextos: `WorkspaceContext.tsx`, `LoadingContext.tsx`
- RBAC helper: `src/lib/rbac.ts`

---

## [0.3.4] - 2026-01-11

### Cambiado
- **Vista tabla: Labels de potencial simplificados**
  - Español: "Alto", "Medio", "Bajo" (antes "Caliente", "Tibio", "Frío")
  - Inglés: "High", "Medium", "Low"
  - Nuevas traducciones `potentialShort` en archivos i18n
  - Vista grid mantiene labels descriptivos completos

### Corregido
- **Bug: Hover no funcionaba en dark mode (vista tabla)**
  - Síntoma: Filas de leads fríos/tibios no mostraban hover en dark mode
  - Causa: CSS specificity con Tailwind v4 combinaba reglas
  - Solución: Usar `var(--bg-hover)` que resuelve diferente por tema
  - Archivo: `globals.css` - sección "Lead Table Row Styles"

### Técnico
- Refactor de CSS para lead rows siguiendo estándar de variables semánticas
- Eliminada clase Tailwind `hover:bg-[var(--bg-tertiary)]` conflictiva en `leads/page.tsx`

---

## [0.3.3] - 2026-01-06

### Cambiado
- **Terminología: "Temperatura" → "Potencial Comercial"**
  - Renombrado el campo de clasificación de leads para mayor claridad
  - Nuevas etiquetas con contexto educativo para usuarios nuevos:
    - 🔥 Potencial Alto (lead caliente)
    - ⚡ Potencial Medio (lead tibio)
    - ❄️ Potencial Bajo (lead frío)
  - Los valores internos del enum (`HOT`, `WARM`, `COLD`) permanecen sin cambios
  - Traducciones actualizadas en español e inglés

- **Archivos de traducción**
  - `es.json`: `temperature` → `potential`, nuevas etiquetas descriptivas
  - `en.json`: `temperature` → `potential`, nuevas etiquetas en inglés

- **Componentes actualizados**
  - `LeadCard.tsx`: Claves de traducción actualizadas
  - `LeadFilters.tsx`: Título de sección y badges actualizados
  - `LeadDetailPanel.tsx`: Badge de potencial actualizado
  - `LeadTable.tsx`: Header de columna actualizado
  - `leads/page.tsx`: Header de tabla actualizado

---

## [0.3.2] - 2026-01-06

### Corregido
- **Bug crítico de navegación en Sidebar**
  - Síntoma: Clic en "Dashboard" llevaba a página en blanco con compilación infinita
  - Causa raíz: Uso incorrecto de `Link` de `next/link` en lugar de `@/i18n/routing`
  - El Link estándar de Next.js no añade el prefijo de locale (`/es/`, `/en/`)
  - El middleware de next-intl detectaba ruta sin locale y entraba en loop de redirección
  - Solución: Cambiar imports a `Link` y `usePathname` de `@/i18n/routing`

### Cambiado
- **Sidebar.tsx**
  - Import `Link` ahora viene de `@/i18n/routing` (no de `next/link`)
  - Import `usePathname` ahora viene de `@/i18n/routing` (no de `next/navigation`)
  - Nuevo tipo `AppPathname` para type-safety en rutas de navegación
  - Interface `NavItem.href` cambiado de `string` a `AppPathname`

- **Filtro de fecha por defecto**
  - Cambiado de "últimos 30 días" a "últimos 7 días" en página de Leads

- **Data mock de leads**
  - Fechas de `lastContactAt` ahora son relativas a la fecha actual
  - Helper function `getRelativeDate()` para cálculo dinámico
  - Distribución de leads en todas las opciones de filtro de fecha:
    - Hoy: 6 leads
    - Ayer: 4 leads
    - Últimos 7 días: 7 leads
    - Últimos 30 días: 9 leads
    - Más de 30 días: 4 leads

---

## [0.3.1] - 2026-01-06

### Agregado
- **Filtros colapsables en la página de Leads**
  - Diseño compacto: estado colapsado muestra solo barra de búsqueda
  - Estado expandido muestra todos los filtros por categoría (chips)
  - Badge flotante ("más filtros" / "menos filtros") centrado en el borde inferior del Card
  - Contador de filtros activos en el badge (color cyan)

- **Badges de filtros activos**
  - Chips removibles que muestran filtros aplicados cuando está colapsado
  - Colores semánticos por tipo de filtro:
    - Status: cyan
    - Temperature: gradiente según temperatura (blue/yellow/red)
    - Channel: purple
    - Type: orange
    - DateRange: green
  - Botón X para eliminar filtros individuales

- **Nuevos componentes en LeadFilters.tsx**
  - `ActiveFilterBadge`: Badge con color y botón de cierre
  - `FloatingFilterToggle`: Badge flotante para expandir/colapsar

- **Traducciones agregadas**
  - `leads.filters.moreFilters`: "Más filtros" / "More filters"
  - `leads.filters.lessFilters`: "Menos filtros" / "Less filters"

### Cambiado
- **LeadFilters.tsx**
  - Nuevas props: `isExpanded`, `onToggleExpanded`
  - Lógica condicional para mostrar/ocultar secciones de filtros
  - Transiciones CSS suaves para expand/collapse

- **leads/page.tsx**
  - Nuevo estado `isFiltersExpanded`
  - Cálculo de `activeFiltersCount` con useMemo
  - Card wrapper con `relative` para posicionar badge flotante

### Corregido
- Error TypeScript en comparación de dateRange (tipos sin overlap)
- Error TypeScript en Badge variant "outline" -> "default" en LeadDetailPanel

---

## [0.3.0] - 2025-01-05

### Agregado
- **Internacionalización completa (i18n) con next-intl**
  - Soporte para español (es) e inglés (en)
  - Routing basado en locale: `/es/leads`, `/en/leads`
  - Middleware de detección automática de idioma
  - Archivos de traducción: `src/messages/es.json`, `src/messages/en.json`

- **Documentación de i18n**
  - Nuevo archivo `docs/I18N.md` con guía completa
  - Patrones de código para traducciones
  - Checklist para nuevos componentes
  - Consideraciones de moneda y fechas

- **Namespaces de traducciones**
  - `common`: Botones, labels, mensajes genéricos
  - `navigation`: Items del sidebar
  - `login`: Página de autenticación
  - `leads`: Módulo completo de leads (status, temperature, channel, actions)
  - `dashboard`: Página principal

### Cambiado
- **Estructura de rutas**
  - De `/leads` a `/[locale]/leads`
  - De `/login` a `/[locale]/login`
  - Redirect automático de `/` al locale detectado

- **Componentes actualizados para i18n**
  - `Sidebar.tsx`: NavItems usan `labelKey` en lugar de `label`
  - `LeadCard.tsx`: Badges, labels y acciones traducidos
  - `LeadFilters.tsx`: Filtros y placeholders traducidos
  - `LeadTable.tsx`: Headers de columna traducidos

- **NavItem interface**
  - Cambio de `label: string` a `labelKey: string`
  - Cambio de `badge?: string` a `hasBadge?: boolean`

### Notas técnicas
- `formatCurrency()` sigue usando PEN/es-PE (pendiente para backend)
- `formatDate()` sigue usando es-PE (pendiente para locale-aware)
- Validado con Playwright MCP en ambos idiomas y mobile

---

## [0.2.0] - 2025-01-02

### Agregado
- **Login Page con animaciones de pulsos**
  - Efecto visual de "leads esperando" con pulsos animados
  - Pulsos con posiciones aleatorias que se regeneran al terminar la animación
  - Animaciones suaves sin flash inicial (opacity y scale desde 0)
  - Keyframes personalizados: `leadPulse` y `leadPulseGlow`

- **Sistema de temas mejorado**
  - Modo Light: fondo cyan sutil (20%), gradiente blanco central (85%), pulsos Kairo Midnight
  - Modo Dark: fondo midnight, gradiente cyan (10%), pulsos cyan
  - Toggle de tema funcional en login y dashboard

- **Logo real de KAIRO en Sidebar**
  - Reemplazo del logo texto "K KAIRO" por imágenes oficiales
  - `logo-main.png` para modo dark (logo blanco)
  - `logo-oscuro.png` para modo light (logo oscuro)
  - Cambio dinámico según el tema activo

### Cambiado
- **Login page background**
  - Light mode: de blanco puro a cyan tenue con centro blanco
  - Dark mode: gradiente cyan central más visible (de 5% a 10%)

- **Componente Image de Next.js**
  - Uso de prop `fill` con contenedor en lugar de width/height
  - Agregado `sizes` para evitar warnings de Next.js

### Corregido
- Flash visual antes de animación de pulsos (inicio desde scale(0) y opacity(0))
- Warning de Next.js "width or height modified by styles"
- Warning de Next.js "missing sizes prop"
- Import duplicado de useTheme en Sidebar.tsx

---

## [0.1.1] - 2025-01-01

### Agregado
- **Componentes UI base**
  - Button.tsx con variantes (primary, secondary, ghost, danger)
  - Input.tsx con soporte para iconos y estados
  - Modal.tsx + AlertModal para sistema de modales
  - Card.tsx para contenedores
  - Badge.tsx para etiquetas de estado

- **Layout del Dashboard**
  - Sidebar.tsx responsive con navegación
  - Header.tsx con toggle de tema y notificaciones
  - Sistema de rutas con route groups (auth) y (dashboard)

- **Vista de Leads**
  - LeadCard.tsx para vista de cuadrícula
  - LeadTable.tsx para vista de tabla
  - LeadFilters.tsx con filtros por estado, temperatura, canal, agente
  - Toggle vista grid/tabla persistido

- **Data Mock**
  - 25 leads peruanos realistas
  - 4 agentes IA (Luna, Atlas, Nova, Orion)
  - 3 usuarios de prueba
  - 1 empresa (TechCorp SAC)

- **Contextos React**
  - ThemeContext.tsx para manejo de temas light/dark
  - ModalContext.tsx para sistema de modales global

### Estructura
- Configuración de Tailwind CSS 4 con variables CSS
- Sistema de colores Kairo (midnight, cyan, etc.)
- Tipografía Inter desde Google Fonts

---

## [0.1.0] - 2024-12-31

### Agregado
- Inicialización del proyecto Next.js 15 con TypeScript
- Configuración de Tailwind CSS
- Sistema de documentación con índices MD
  - CLAUDE.md (índice raíz)
  - INDEX.md (índice de documentación)
  - ARCHITECTURE.md (decisiones técnicas)
  - COMPONENTS.md (catálogo UI)
  - DATA-MODELS.md (modelos de datos)
  - RULES.md (reglas del proyecto)
  - CHANGELOG.md (este archivo)

### Estructura base
- Definición de estructura de carpetas
- Modelos de datos para MVP (Lead, User, Company, AIAgent, etc.)
- Reglas de desarrollo establecidas

---

## Formato de Changelog

Cada entrada sigue el formato:

```markdown
## [VERSION] - YYYY-MM-DD

### Agregado
- Nuevas features

### Cambiado
- Cambios en features existentes

### Corregido
- Bug fixes

### Eliminado
- Features removidas

### Seguridad
- Fixes de seguridad
```
