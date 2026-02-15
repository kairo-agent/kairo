# KAIRO - Sistema de Envío de Archivos Multimedia a WhatsApp

> Documentación completa del sistema de upload directo de archivos multimedia desde el navegador a WhatsApp, implementado el 2026-01-24.

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Tipos de Archivos Soportados](#tipos-de-archivos-soportados)
4. [Flujo de Datos Completo](#flujo-de-datos-completo)
5. [Componentes del Sistema](#componentes-del-sistema)
6. [Limitaciones de WhatsApp](#limitaciones-de-whatsapp)
7. [Implementaciones Específicas](#implementaciones-específicas)
8. [Seguridad](#seguridad)
9. [Troubleshooting](#troubleshooting)

---

## Resumen Ejecutivo

### Problema Resuelto

El sistema permite a los usuarios enviar archivos multimedia (imágenes, videos, documentos) desde KAIRO hacia WhatsApp, solucionando tres problemas críticos:

1. **Límite de Vercel**: Bypass del límite de 4.5MB en Server Actions mediante upload directo desde navegador a Supabase
2. **Nombres de archivo**: Los documentos ahora mantienen su nombre original al llegar a WhatsApp
3. **Captions multimedia**: El texto del usuario acompaña correctamente a imágenes y videos

### Stack Tecnológico

| Capa | Tecnología | Propósito |
|------|------------|-----------|
| Upload | Browser → Supabase Storage | Bypass límite 4.5MB de Vercel |
| Storage | Supabase Storage (bucket: `media`) | Almacenamiento de archivos |
| Compresión | browser-image-compression | Optimización de imágenes >1MB |
| Orquestación | n8n (Railway) | Envío a WhatsApp Cloud API |
| API | WhatsApp Cloud API | Entrega final al usuario |

---

## Arquitectura del Sistema

### Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE MULTIMEDIA                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Usuario selecciona archivo                                  │
│     │                                                            │
│     ▼                                                            │
│  ┌─────────────────┐                                            │
│  │   ChatInput     │ accept="image/*|video/mp4|.pdf|..."        │
│  │  (Validación)   │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  2. Upload directo (Browser → Supabase)                         │
│     │                                                            │
│     ▼                                                            │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │ useMediaUpload  │────>│  Supabase RLS   │ (Verifica permisos)│
│  │     Hook        │     │    Policies     │                   │
│  └────────┬────────┘     └─────────────────┘                   │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ Supabase Storage│                                            │
│  │  bucket: media  │ Path: projectId/YYYY/MM/uuid.ext          │
│  └────────┬────────┘                                            │
│           │ Returns: Public URL                                 │
│           ▼                                                      │
│  3. Guardar mensaje en DB                                       │
│     │                                                            │
│     ▼                                                            │
│  ┌─────────────────┐                                            │
│  │   LeadChat      │ Extrae: mediaUrl, filename, caption        │
│  │  handleSend()   │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │  sendMessage()  │ Server Action → DB + n8n                   │
│  │  (Server Action)│                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  4. n8n procesa y envía                                         │
│     │                                                            │
│     ▼                                                            │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │ n8n Workflow    │────>│  Send to WA     │                   │
│  │ (Railway)       │     │   (Nodo HTTP)   │                   │
│  └─────────────────┘     └────────┬────────┘                   │
│                                    │                             │
│                                    ▼                             │
│                          ┌─────────────────┐                   │
│                          │ WhatsApp Cloud  │                   │
│                          │      API        │                   │
│                          └────────┬────────┘                   │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                   │
│                          │  Usuario Final  │                   │
│                          │   (WhatsApp)    │                   │
│                          └─────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Decisiones Arquitectónicas

#### 1. Upload Directo desde Navegador

**Problema**: Vercel limita Server Actions a 4.5MB, insuficiente para videos (máx 16MB en WhatsApp).

**Solución**: Upload directo desde navegador a Supabase Storage usando el SDK de cliente.

```typescript
// [-] Anterior (Server Action - límite 4.5MB)
const formData = new FormData();
formData.append('file', file);
await uploadAction(formData); // Falla si file > 4.5MB

// [x] Actual (Upload directo - hasta 16MB)
const supabase = createClient();
await supabase.storage.from('media').upload(path, file);
```

**Seguridad**: Las políticas RLS de Supabase verifican que el usuario tenga acceso al proyecto mediante `ProjectMember`.

#### 2. Compresión de Imágenes

**Problema**: Imágenes grandes (>3MB) tardan mucho en subir y consumen ancho de banda.

**Solución**: Compresión automática con `browser-image-compression` si la imagen excede 1MB.

```typescript
// Si la imagen > 1MB, comprimir antes de subir
if (attachment.type === 'image' && file.size > 1024 * 1024) {
  fileToUpload = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  });
}
```

**Resultado**: Reducción típica de 3MB → 800KB sin pérdida visual significativa.

#### 3. Separación de Caption y Filename

**Problema**: WhatsApp muestra "documento" sin nombre y el texto del usuario no llegaba con el archivo.

**Solución**: Pasar tanto el `filename` original como el `caption` (mensaje del usuario) a n8n.

```typescript
// LeadChat extrae ambos valores
const filename = attachment?.type === 'file' ? attachment.name : undefined;
const caption = attachment && message.trim() ? message.trim() : undefined;

// Server Action los envía a n8n
await sendMessage(leadId, content, mediaUrl, mediaType, filename, caption);
```

---

## Tipos de Archivos Soportados

### Matriz de Compatibilidad

| Tipo | MIME Types | Extensiones | Tamaño Max | WhatsApp |
|------|-----------|-------------|------------|----------|
| **Imágenes** | `image/jpeg`, `image/png`, `image/webp` | `.jpg`, `.jpeg`, `.png`, `.webp` | 3 MB | [x] Soportado |
| **Video** | `video/mp4` | `.mp4` | 16 MB | [x] Solo MP4 (H.264 + AAC) |
| **PDF** | `application/pdf` | `.pdf` | 16 MB | [x] Soportado |
| **Word** | `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.doc`, `.docx` | 16 MB | [x] Soportado |
| **Excel** | `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xls`, `.xlsx` | 16 MB | [x] Soportado |
| **Texto** | `text/plain` | `.txt` | 16 MB | [x] Soportado |

### Validación en el Cliente

```typescript
// src/hooks/useMediaUpload.ts
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4']; // Solo MP4
const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type as AllowedMimeType)) {
    return {
      valid: false,
      error: 'Tipo de archivo no permitido',
    };
  }

  const maxSize = getMaxSizeForType(file.type);
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Archivo excede ${maxSize / (1024 * 1024)}MB`,
    };
  }

  return { valid: true };
}
```

---

## Flujo de Datos Completo

### 1. Usuario Selecciona Archivo (ChatInput)

**Archivo**: `src/components/features/ChatInput.tsx`

```typescript
// Botones de selección de archivo
<input ref={imageInputRef} type="file" accept="image/*" />
<input ref={videoInputRef} type="file" accept="video/mp4" /> {/* Solo MP4 */}
<input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" />

// Handler de selección
const handleFileSelect = (
  e: React.ChangeEvent<HTMLInputElement>,
  type: 'image' | 'video' | 'file'
) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const newAttachment: ChatAttachment = {
    type,
    file,
    name: file.name,
  };

  setAttachment(newAttachment);
};
```

**Salida**: Objeto `ChatAttachment` con el archivo y metadatos.

---

### 2. Upload Directo a Supabase (useMediaUpload)

**Archivo**: `src/hooks/useMediaUpload.ts`

#### Generación de Ruta Segura

```typescript
function generateFilePath(projectId: string, mimeType: AllowedMimeType): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const extension = getExtensionFromMimeType(mimeType);
  const uniqueId = generateUUID();

  // Ejemplo: cm50s9z8j0001l70827o3h27q/2026/01/a3f7b9c1-4d2e-4f5a-8b6c-1d3e5f7a9b2c.jpg
  return `${projectId}/${year}/${month}/${uniqueId}.${extension}`;
}
```

#### Upload con RLS

```typescript
const upload = async (projectId: string, file: File) => {
  // Crear cliente Supabase (con sesión del usuario)
  const supabase = createClient();

  // Upload a bucket 'media'
  // RLS policy verifica que user.id esté en ProjectMember del projectId
  const { data, error } = await supabase.storage
    .from('media')
    .upload(filePath, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    if (error.message.includes('row-level security')) {
      return { success: false, error: 'Sin permisos para este proyecto' };
    }
    return { success: false, error: `Error al subir: ${error.message}` };
  }

  // Obtener URL pública
  const { data: publicUrlData } = supabase.storage
    .from('media')
    .getPublicUrl(data.path);

  return {
    success: true,
    url: publicUrlData.publicUrl,
    path: data.path,
  };
};
```

**Salida**: URL pública del archivo (`https://[project-ref].supabase.co/storage/v1/object/public/media/...`).

---

### 3. Envío de Mensaje (LeadChat → Server Action)

**Archivo**: `src/components/features/LeadChat.tsx`

#### Extracción de Metadatos

```typescript
const handleSendMessage = async (message: string, attachment?: ChatAttachment) => {
  let content = message.trim();
  let mediaUrl: string | undefined;
  let mediaType: 'image' | 'video' | 'document' | undefined;

  if (attachment?.file) {
    // 1. Obtener projectId del lead
    const projectResult = await getLeadProjectId(leadId);

    // 2. Comprimir imagen si es necesaria
    let fileToUpload = attachment.file;
    if (attachment.type === 'image' && file.size > 1024 * 1024) {
      fileToUpload = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
    }

    // 3. Upload directo a Supabase
    const uploadResult = await uploadMedia(projectResult.projectId, fileToUpload);
    mediaUrl = uploadResult.url;
    mediaType = attachment.type === 'image' ? 'image'
      : attachment.type === 'video' ? 'video'
      : 'document';

    // 4. Actualizar content para DB (referencia ligera)
    const mediaLabel = attachment.type === 'image' ? 'Imagen'
      : attachment.type === 'video' ? 'Video'
      : 'Archivo';
    content = content
      ? `${content}\n[${mediaLabel}: ${attachment.name}]`
      : `[${mediaLabel}: ${attachment.name}]`;
  }

  // 5. Extraer filename y caption para WhatsApp
  const filename = attachment?.type === 'file' ? attachment.name : undefined;
  const caption = attachment && message.trim() ? message.trim() : undefined;

  // 6. Enviar a Server Action
  await sendMessage(leadId, content, mediaUrl, mediaType, filename, caption);
};
```

**Salida**: Llamada a `sendMessage()` con todos los parámetros necesarios.

---

### 4. Server Action → Base de Datos + n8n

**Archivo**: `src/lib/actions/messages.ts`

#### Guardar Mensaje en DB

```typescript
export async function sendMessage(
  leadId: string,
  content: string,
  mediaUrl?: string,
  mediaType?: 'image' | 'video' | 'document',
  filename?: string,
  caption?: string
) {
  // 1. Crear mensaje en Prisma
  const message = await prisma.message.create({
    data: {
      conversationId,
      sender: MessageSender.human,
      content: content.trim(),
      sentByUserId: user.id,
    },
  });

  // 2. Preparar payload para n8n
  const n8nPayload = {
    projectId: lead.projectId,
    conversationId,
    leadId: lead.id,
    to: lead.whatsappId,
    mode: 'human',
    message: content.trim(),
    messageType: mediaUrl ? mediaType || 'image' : 'text',
    mediaUrl: mediaUrl || null,
    filename: filename || null, // [x] Nombre original del documento
    caption: caption || null,   // [x] Texto del usuario como caption
    timestamp: new Date().toISOString(),
    accessToken: accessToken || '',
    phoneNumberId: phoneNumberId || '',
    metadata: {
      agentId: user.id,
      agentName: `${user.firstName} ${user.lastName}`,
      messageDbId: message.id,
    },
  };

  // 3. Enviar a n8n
  await fetch(lead.project.n8nWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(n8nPayload),
  });

  return { success: true, message };
}
```

**Salida**: Mensaje guardado en DB + webhook enviado a n8n.

---

### 5. n8n Procesa y Envía a WhatsApp

#### Nodo: Prepare Human Response

**Descripción**: Transforma el payload de KAIRO al formato de WhatsApp Cloud API.

**Código JavaScript**:

```javascript
// Nodo n8n: Prepare Human Response
const mode = $json.mode || 'ai';
const messageType = $json.messageType || 'text';
const mediaUrl = $json.mediaUrl;
const caption = $json.caption || null;
const filename = $json.filename || null;

let responsePayload = {
  messaging_product: "whatsapp",
  to: $json.to,
};

// Construir payload según tipo de mensaje
if (messageType === 'image' && mediaUrl) {
  responsePayload.type = 'image';
  responsePayload.image = {
    link: mediaUrl,
  };
  if (caption) {
    responsePayload.image.caption = caption; // [x] Caption del usuario
  }
} else if (messageType === 'video' && mediaUrl) {
  responsePayload.type = 'video';
  responsePayload.video = {
    link: mediaUrl,
  };
  if (caption) {
    responsePayload.video.caption = caption; // [x] Caption del usuario
  }
} else if (messageType === 'document' && mediaUrl) {
  responsePayload.type = 'document';
  responsePayload.document = {
    link: mediaUrl,
  };
  if (filename) {
    responsePayload.document.filename = filename; // [x] Nombre original
  }
  if (caption) {
    responsePayload.document.caption = caption; // [x] Caption del usuario
  }
} else {
  // Mensaje de texto puro
  responsePayload.type = 'text';
  responsePayload.text = {
    body: $json.message || 'Sin mensaje',
  };
}

return {
  json: {
    payload: responsePayload,
    phoneNumberId: $json.phoneNumberId,
    accessToken: $json.accessToken,
  }
};
```

#### Nodo: Send to WhatsApp

**Descripción**: Envía a WhatsApp Cloud API usando el payload preparado.

**Configuración**:
- **Método**: POST
- **URL**: `https://graph.facebook.com/v17.0/{{$json.phoneNumberId}}/messages`
- **Headers**:
  - `Authorization`: `Bearer {{$json.accessToken}}`
  - `Content-Type`: `application/json`
- **Body**: `{{$json.payload}}`

**Ejemplo de Request (documento con caption)**:

```json
POST https://graph.facebook.com/v17.0/123456789/messages
Authorization: Bearer EAAB...
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "51987654321",
  "type": "document",
  "document": {
    "link": "https://abc.supabase.co/storage/v1/object/public/media/proj123/2026/01/uuid.pdf",
    "filename": "Contrato_2026.pdf",
    "caption": "Aquí está el contrato que pediste"
  }
}
```

**Salida**: Mensaje entregado a WhatsApp con filename y caption correctos.

---

## Componentes del Sistema

### 1. ChatInput.tsx

**Responsabilidades**:
- Mostrar botones de selección de archivo
- Validar tipo de archivo en el navegador
- Generar preview de imágenes
- Emitir evento `onSendMessage` con attachment

**Código clave**:

```typescript
// Botón de documento
<button onClick={() => fileInputRef.current?.click()}>
  <FileIcon />
</button>
<input
  ref={fileInputRef}
  type="file"
  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
  onChange={(e) => handleFileSelect(e, 'file')}
/>

// Preview de imagen
{attachment.type === 'image' && imagePreview && (
  <img src={imagePreview} alt={attachment.name} />
)}
```

---

### 2. useMediaUpload.ts

**Responsabilidades**:
- Validar archivo (tipo, tamaño)
- Generar ruta segura en Storage
- Upload directo a Supabase con RLS
- Retornar URL pública

**API del Hook**:

```typescript
const { upload, isUploading, progress, error, reset } = useMediaUpload();

// Usar
const result = await upload(projectId, file);
if (result.success) {
  console.log(result.url); // URL pública
  console.log(result.path); // Path en Storage
}
```

---

### 3. LeadChat.tsx

**Responsabilidades**:
- Orquestar el flujo de envío
- Comprimir imágenes grandes
- Extraer filename y caption
- Llamar a `sendMessage()` Server Action

**Código clave**:

```typescript
// Compresión de imagen
if (attachment.type === 'image' && file.size > 1024 * 1024) {
  fileToUpload = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  });
}

// Extracción de metadatos
const filename = attachment?.type === 'file' ? attachment.name : undefined;
const caption = attachment && message.trim() ? message.trim() : undefined;

// Envío
await sendMessage(leadId, content, mediaUrl, mediaType, filename, caption);
```

---

### 4. messages.ts (Server Actions)

**Responsabilidades**:
- Validar permisos del usuario
- Guardar mensaje en Prisma
- Preparar payload para n8n
- Enviar webhook a n8n

**Código clave**:

```typescript
// Payload a n8n
const n8nPayload = {
  messageType: mediaUrl ? mediaType || 'image' : 'text',
  mediaUrl: mediaUrl || null,
  filename: filename || null, // Para documentos
  caption: caption || null,   // Para media con texto
  // ...
};

await fetch(lead.project.n8nWebhookUrl, {
  method: 'POST',
  body: JSON.stringify(n8nPayload),
});
```

---

### 5. media.ts (Server Actions)

**Responsabilidades**:
- Proveer funciones alternativas para upload server-side
- Validación y permisos (aunque no se usa en el flujo actual)
- Funciones de eliminación de archivos

**Funciones**:
- `uploadMedia(projectId, file)` - Upload server-side (no usado actualmente)
- `deleteMedia(path)` - Eliminar archivo
- `deleteMediaBatch(paths)` - Eliminar múltiples archivos

---

## Limitaciones de WhatsApp

### 1. Tipos de Video

**Limitación**: WhatsApp Cloud API **solo acepta MP4 con H.264 + AAC**.

**Formatos NO soportados**:
- WebM
- AVI
- MOV (requiere conversión)
- MKV

**Solución en ChatInput**:

```typescript
// Solo permitir MP4
<input
  ref={videoInputRef}
  type="file"
  accept="video/mp4"  // [x] Solo MP4
  onChange={(e) => handleFileSelect(e, 'video')}
/>
```

**Recomendación**: Si el usuario intenta subir otro formato, mostrar error y sugerir conversión con herramientas online.

---

### 2. Tamaños Máximos

| Tipo | Límite WhatsApp | Límite KAIRO |
|------|-----------------|--------------|
| Imagen | 5 MB | 3 MB (optimización) |
| Video | 16 MB | 16 MB |
| Documento | 100 MB | 16 MB (práctico) |
| Audio | 16 MB | No implementado |

**Razón del límite de 3MB para imágenes**: Balance entre calidad visual y velocidad de carga.

---

### 3. Captions y Filenames

**Limitaciones**:
- **Caption**: Máximo 1024 caracteres (WhatsApp)
- **Filename**: Solo para documentos (no aplica a imágenes/videos)

**Implementación KAIRO**:

```typescript
// Caption: texto del usuario (para imagen/video/documento)
if (caption && caption.length > 1024) {
  caption = caption.substring(0, 1021) + '...';
}

// Filename: solo para documentos
const filename = attachment?.type === 'file' ? attachment.name : undefined;
```

---

## Implementaciones Específicas

### 1. Soporte de Documentos

**Fecha**: 2026-01-24

**Cambios**:

#### ChatInput.tsx
```typescript
// Botón de documento
<button onClick={() => fileInputRef.current?.click()}>
  <FileIcon />
</button>
<input
  ref={fileInputRef}
  type="file"
  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
  onChange={(e) => handleFileSelect(e, 'file')}
/>
```

#### useMediaUpload.ts
```typescript
const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];
const MAX_DOCUMENT_SIZE = 16 * 1024 * 1024; // 16MB
```

---

### 2. Filename en Documentos

**Problema**: Los documentos llegaban a WhatsApp como "documento" sin nombre.

**Solución**:

#### LeadChat.tsx
```typescript
// Extraer nombre original del archivo
const filename = attachment?.type === 'file' ? attachment.name : undefined;

// Pasar a Server Action
await sendMessage(leadId, content, mediaUrl, mediaType, filename, caption);
```

#### messages.ts
```typescript
export async function sendMessage(
  leadId: string,
  content: string,
  mediaUrl?: string,
  mediaType?: 'image' | 'video' | 'document',
  filename?: string, // [x] Nuevo parámetro
  caption?: string
) {
  const n8nPayload = {
    // ...
    filename: filename || null,
  };
}
```

#### n8n: Prepare Human Response
```javascript
if (messageType === 'document' && mediaUrl) {
  responsePayload.type = 'document';
  responsePayload.document = {
    link: mediaUrl,
  };
  if (filename) {
    responsePayload.document.filename = filename; // [x] Mapear filename
  }
}
```

**Resultado**: Documentos ahora muestran su nombre original en WhatsApp.

---

### 3. Caption para Multimedia

**Problema**: El texto del usuario no acompañaba a imágenes/videos/documentos.

**Solución**:

#### LeadChat.tsx
```typescript
// Extraer el mensaje original como caption
const caption = attachment && message.trim() ? message.trim() : undefined;

// Pasar a Server Action
await sendMessage(leadId, content, mediaUrl, mediaType, filename, caption);
```

#### messages.ts
```typescript
export async function sendMessage(
  leadId: string,
  content: string,
  mediaUrl?: string,
  mediaType?: 'image' | 'video' | 'document',
  filename?: string,
  caption?: string // [x] Nuevo parámetro
) {
  const n8nPayload = {
    // ...
    caption: caption || null,
  };
}
```

#### n8n: Prepare Human Response
```javascript
// Para imagen
if (messageType === 'image' && mediaUrl) {
  responsePayload.image = { link: mediaUrl };
  if (caption) {
    responsePayload.image.caption = caption; // [x] Caption del usuario
  }
}

// Para video
if (messageType === 'video' && mediaUrl) {
  responsePayload.video = { link: mediaUrl };
  if (caption) {
    responsePayload.video.caption = caption; // [x] Caption del usuario
  }
}

// Para documento
if (messageType === 'document' && mediaUrl) {
  responsePayload.document = { link: mediaUrl };
  if (filename) {
    responsePayload.document.filename = filename;
  }
  if (caption) {
    responsePayload.document.caption = caption; // [x] Caption del usuario
  }
}
```

**Resultado**: El texto del usuario ahora aparece junto con el archivo multimedia en WhatsApp.

---

### 4. Restricción de Video a MP4

**Fecha**: 2026-01-24

**Cambio**:

#### ChatInput.tsx
```typescript
// Antes: accept="video/*" (cualquier video)
// Después: accept="video/mp4" (solo MP4)
<input
  ref={videoInputRef}
  type="file"
  accept="video/mp4"  // [x] Solo MP4 (H.264 + AAC)
  onChange={(e) => handleFileSelect(e, 'video')}
/>
```

#### useMediaUpload.ts
```typescript
// Antes: ['video/mp4', 'video/webm']
// Después: solo MP4
const VIDEO_TYPES = ['video/mp4'] as const;
```

**Razón**: WhatsApp Cloud API rechaza WebM y otros formatos. Solo MP4 con H.264 + AAC está garantizado.

---

## Seguridad

### 1. Row-Level Security (RLS) en Supabase

**Bucket**: `media`

**Política de INSERT/UPDATE**:

```sql
-- Solo usuarios que son ProjectMember pueden subir archivos al proyecto
CREATE POLICY "Users can upload to their projects"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'media'
  AND (
    -- Extraer projectId del path (primer segmento)
    split_part(name, '/', 1) IN (
      SELECT pm."projectId"
      FROM "ProjectMember" pm
      WHERE pm."userId" = auth.uid()
    )
  )
);
```

**Política de SELECT**:

```sql
-- Los archivos son públicos una vez subidos (Storage es public)
-- Pero solo los miembros del proyecto pueden VER archivos en la UI
CREATE POLICY "Anyone can view uploaded files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'media');
```

**Notas**:
- El bucket `media` es **público** para permitir que WhatsApp descargue los archivos
- La seguridad está en el **upload**: solo miembros del proyecto pueden subir
- Los archivos tienen UUID en el nombre, haciendo difícil adivinar URLs

---

### 2. Validación en Múltiples Capas

#### Capa 1: Cliente (ChatInput)

```typescript
// HTML5 accept attribute
<input accept=".pdf,.doc,.docx" />
```

**Propósito**: UX rápida, mostrar solo archivos válidos en el picker.

#### Capa 2: Hook (useMediaUpload)

```typescript
function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Tipo no permitido' };
  }
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'Archivo muy grande' };
  }
  return { valid: true };
}
```

**Propósito**: Validación antes de upload, evitar requests inútiles.

#### Capa 3: Supabase RLS

```sql
-- Verificar permisos antes de permitir escritura
WITH CHECK (
  split_part(name, '/', 1) IN (
    SELECT "projectId" FROM "ProjectMember" WHERE "userId" = auth.uid()
  )
)
```

**Propósito**: Seguridad definitiva, prevenir bypass del cliente.

---

### 3. Path Seguro con UUID

**Formato**: `{projectId}/{year}/{month}/{uuid}.{ext}`

**Ejemplo**: `cm50s9z8j0001l70827o3h27q/2026/01/a3f7b9c1-4d2e-4f5a-8b6c-1d3e5f7a9b2c.jpg`

**Ventajas**:
- **No predecible**: UUID hace imposible adivinar URLs
- **Organizado**: Por proyecto, año y mes (fácil limpieza)
- **Sin colisiones**: UUID garantiza unicidad

---

## Troubleshooting

### Problema: "Tipo de archivo no permitido"

**Causa**: El archivo tiene un MIME type no incluido en `ALLOWED_TYPES`.

**Solución**:

1. Verificar MIME type del archivo:
   ```javascript
   console.log(file.type); // "application/octet-stream" es genérico
   ```

2. Si es un tipo válido pero no reconocido, agregarlo:
   ```typescript
   // useMediaUpload.ts
   const DOCUMENT_TYPES = [
     // ...existentes
     'application/octet-stream', // Solo si es necesario
   ];
   ```

3. Validar extensión además de MIME type:
   ```typescript
   const ext = file.name.split('.').pop()?.toLowerCase();
   if (!['pdf', 'doc', 'docx'].includes(ext)) {
     return { valid: false, error: 'Extensión no permitida' };
   }
   ```

---

### Problema: "Sin permisos para subir a este proyecto"

**Causa**: El usuario no está en `ProjectMember` del proyecto.

**Solución**:

1. Verificar membresía en base de datos:
   ```sql
   SELECT * FROM "ProjectMember"
   WHERE "userId" = '...' AND "projectId" = '...';
   ```

2. Si no existe, agregar:
   ```typescript
   await prisma.projectMember.create({
     data: {
       userId: 'user_id',
       projectId: 'project_id',
       role: 'member',
     },
   });
   ```

3. Verificar política RLS de Supabase:
   ```sql
   -- Asegurarse que auth.uid() coincide con userId en ProjectMember
   SELECT auth.uid(); -- Debe retornar el ID del usuario
   ```

---

### Problema: El documento llega a WhatsApp sin nombre

**Causa**: El parámetro `filename` no se está pasando correctamente.

**Debugging**:

1. En `LeadChat.tsx`, verificar extracción:
   ```typescript
   console.log('Filename extraído:', filename); // Debe ser "documento.pdf"
   ```

2. En `messages.ts`, verificar payload a n8n:
   ```typescript
   console.log('n8n payload:', n8nPayload);
   // Debe incluir: filename: "documento.pdf"
   ```

3. En n8n, verificar nodo "Prepare Human Response":
   ```javascript
   console.log('Filename en n8n:', $json.filename);
   ```

4. En n8n, verificar payload final a WhatsApp:
   ```javascript
   console.log('Payload WhatsApp:', responsePayload.document);
   // Debe incluir: { link: "...", filename: "documento.pdf" }
   ```

---

### Problema: El caption no aparece en WhatsApp

**Causa**: El parámetro `caption` no se está mapeando en n8n.

**Debugging**:

1. En `LeadChat.tsx`, verificar extracción:
   ```typescript
   console.log('Caption extraído:', caption); // Debe ser el mensaje del usuario
   ```

2. En `messages.ts`, verificar payload:
   ```typescript
   console.log('Caption en payload:', n8nPayload.caption);
   ```

3. En n8n, verificar nodo "Prepare Human Response":
   ```javascript
   // Asegurarse que el caption se mapea correctamente
   if (caption) {
     responsePayload.image.caption = caption; // Para imagen
     responsePayload.video.caption = caption; // Para video
     responsePayload.document.caption = caption; // Para documento
   }
   ```

4. Verificar límite de caracteres (1024 max):
   ```typescript
   if (caption.length > 1024) {
     caption = caption.substring(0, 1021) + '...';
   }
   ```

---

### Problema: Video no se envía (formato no soportado)

**Causa**: El video no es MP4 con H.264 + AAC.

**Solución**:

1. Verificar formato del archivo:
   ```bash
   ffmpeg -i video.webm
   # Output debe mostrar: Video: h264, Audio: aac
   ```

2. Si no es MP4, convertir:
   ```bash
   ffmpeg -i input.webm -c:v libx264 -c:a aac output.mp4
   ```

3. En ChatInput, restringir accept:
   ```typescript
   <input accept="video/mp4" /> {/* Solo MP4 */}
   ```

4. Mostrar mensaje de error claro al usuario:
   ```typescript
   if (file.type !== 'video/mp4') {
     alert('Solo se aceptan videos MP4. Convierte tu video en: https://cloudconvert.com/webm-to-mp4');
     return;
   }
   ```

---

### Problema: Imagen muy pesada (>3MB)

**Causa**: El límite de KAIRO es 3MB para optimización.

**Solución**:

1. Comprimir automáticamente (ya implementado):
   ```typescript
   if (file.size > 1024 * 1024) { // >1MB
     fileToUpload = await imageCompression(file, {
       maxSizeMB: 1,
       maxWidthOrHeight: 1920,
     });
   }
   ```

2. Si sigue siendo >3MB después de compresión:
   - Reducir `maxWidthOrHeight` a 1280px
   - Reducir calidad JPEG a 0.8

3. Alternativa: Subir como documento (límite 16MB):
   ```typescript
   if (file.size > 3 * 1024 * 1024) {
     alert('Imagen muy grande. Súbela como documento PDF.');
   }
   ```

---

## Resumen de Archivos Modificados

| Archivo | Cambios | Fecha |
|---------|---------|-------|
| `src/hooks/useMediaUpload.ts` | Agregar DOCUMENT_TYPES, restringir VIDEO_TYPES a MP4 | 2026-01-24 |
| `src/lib/actions/media.ts` | Agregar DOCUMENT_TYPES, validación de documentos | 2026-01-24 |
| `src/components/features/ChatInput.tsx` | Botón de documento, accept restrictivo para video | 2026-01-24 |
| `src/components/features/LeadChat.tsx` | Extraer filename y caption, pasar a sendMessage | 2026-01-24 |
| `src/lib/actions/messages.ts` | Agregar parámetros filename y caption, mapear en n8nPayload | 2026-01-24 |
| n8n: Prepare Human Response | Mapear filename y caption en payload de WhatsApp | 2026-01-24 |
| n8n: Send to WhatsApp | Actualizar para incluir caption en image/video/document | 2026-01-24 |

---

## Próximos Pasos (Roadmap)

### 1. Soporte de Audio

**Prioridad**: Media

**Descripción**: Permitir envío de mensajes de voz y archivos de audio.

**Tareas**:
- [ ] Agregar `AUDIO_TYPES` en `useMediaUpload.ts` (mp3, ogg, m4a)
- [ ] Botón de audio en `ChatInput.tsx`
- [ ] Actualizar `sendMessage()` para `mediaType: 'audio'`
- [ ] Actualizar n8n para payload de audio

**Limitaciones WhatsApp**:
- Formatos: MP3, OGG (Opus), M4A, AMR
- Tamaño máximo: 16 MB

---

### 2. Preview Multimedia Avanzado

**Prioridad**: Baja

**Descripción**: Mostrar preview de videos y documentos antes de enviar.

**Tareas**:
- [ ] Preview de video con `<video>` tag
- [ ] Preview de PDF con `react-pdf` o `pdfjs-dist`
- [ ] Modal de vista previa ampliada

---

### 3. Drag & Drop de Archivos

**Prioridad**: Media

**Descripción**: Permitir arrastrar archivos directamente al chat.

**Tareas**:
- [ ] Agregar zona de drop en `ChatInput`
- [ ] Validar archivos arrastrados
- [ ] Feedback visual durante drag

**Ejemplo**:

```typescript
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) {
    handleFileSelect(file);
  }
};

<div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
  {/* Chat input */}
</div>
```

---

### 4. Notificación de Progreso de Upload

**Prioridad**: Alta

**Descripción**: Mostrar barra de progreso durante upload de archivos grandes.

**Tareas**:
- [ ] Usar evento `onUploadProgress` de Supabase
- [ ] Progress bar en `ChatInput`
- [ ] Cancelación de upload

**Ejemplo**:

```typescript
const { data, error } = await supabase.storage
  .from('media')
  .upload(path, file, {
    onUploadProgress: (progress) => {
      const percent = (progress.loaded / progress.total) * 100;
      setProgress(percent);
    },
  });
```

---

### 5. Gestión de Cuota de Storage

**Prioridad**: Media

**Descripción**: Mostrar cuota usada por proyecto y alertar cuando se acerque al límite.

**Tareas**:
- [ ] Endpoint para calcular uso de Storage por proyecto
- [ ] UI en settings de proyecto
- [ ] Auto-limpieza de archivos antiguos (>6 meses)

**Query de ejemplo**:

```sql
SELECT
  split_part(name, '/', 1) AS project_id,
  COUNT(*) AS file_count,
  SUM(metadata->>'size')::bigint AS total_bytes
FROM storage.objects
WHERE bucket_id = 'media'
GROUP BY project_id;
```

---

## Referencias

- [WhatsApp Cloud API - Media Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages#media-messages)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [browser-image-compression](https://www.npmjs.com/package/browser-image-compression)
- [n8n Documentation](https://docs.n8n.io/)

---

**Última actualización**: 2026-01-24
**Autor**: Leo & Adan
**Versión**: 1.0.0
