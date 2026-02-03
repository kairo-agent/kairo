# RAG para Agentes IA - Plan de Implementación

> **Estado:** ✅ COMPLETADO - Fases 1-4 funcionales en producción + Lead Temperature Scoring + Memoria de Conversación
> **Fecha de planificación:** 2026-01-25
> **Última actualización:** 2026-02-02
> **Logro:** Flujo RAG completo operativo + Calificación HOT/WARM/COLD + Historial de 8 mensajes para contexto

---

## Resumen Ejecutivo

Implementar un sistema RAG (Retrieval Augmented Generation) que permita a cada agente IA de KAIRO responder basándose **exclusivamente** en su base de conocimiento propia, sin acceso al conocimiento de otros agentes.

### Objetivos

1. **Aislamiento total**: Agente A solo accede a RAG A, nunca a RAG B
2. **Multi-tenant**: Conocimiento aislado por proyecto Y por agente
3. **Respuestas precisas**: El agente NO inventa, solo usa información del RAG
4. **Escalable**: Soportar miles de documentos por agente

---

## Arquitectura

### Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUJO RAG EN KAIRO                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. MENSAJE ENTRANTE                                                    │
│   ┌─────────────┐                                                        │
│   │  WhatsApp   │──────▶ Webhook KAIRO ──────▶ Guardar mensaje          │
│   │  Lead dice: │        /api/webhooks/       en BD + trigger           │
│   │  "¿Precio?" │        whatsapp             a n8n                     │
│   └─────────────┘                                                        │
│                                                                          │
│   2. n8n PROCESA (cuando handoffMode = 'ai')                            │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                                                                  │   │
│   │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │   │
│   │   │ Recibir      │───▶│ Generar      │───▶│ Buscar en    │      │   │
│   │   │ mensaje +    │    │ embedding    │    │ pgvector     │      │   │
│   │   │ agent_id     │    │ (OpenAI)     │    │ (Supabase)   │      │   │
│   │   └──────────────┘    └──────────────┘    └──────┬───────┘      │   │
│   │                                                   │              │   │
│   │                                                   ▼              │   │
│   │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │   │
│   │   │ Enviar a     │◀───│ Generar      │◀───│ Top 3-5      │      │   │
│   │   │ WhatsApp     │    │ respuesta    │    │ documentos   │      │   │
│   │   │ via KAIRO    │    │ (Claude/GPT) │    │ relevantes   │      │   │
│   │   └──────────────┘    └──────────────┘    └──────────────┘      │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   3. RESPUESTA                                                           │
│   ┌─────────────┐                                                        │
│   │  WhatsApp   │◀────── API KAIRO ◀────── n8n envía respuesta          │
│   │  Lead ve:   │        /api/whatsapp/                                  │
│   │  "El precio │        send                                            │
│   │   es $99.." │                                                        │
│   └─────────────┘                                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Componentes

| Componente | Tecnología | Propósito |
|------------|------------|-----------|
| Vector Store | Supabase pgvector | Almacenar embeddings del conocimiento |
| Embeddings | OpenAI text-embedding-3-small | Convertir texto a vectores |
| LLM | Claude / GPT-4 | Generar respuestas basadas en contexto |
| Orquestación | n8n | Coordinar el flujo RAG |
| API | KAIRO Next.js | Webhooks, envío WhatsApp, UI admin |

---

## Modelo de Datos

### Tabla: agent_knowledge

> **Nota:** Usamos camelCase con comillas dobles para compatibilidad con Prisma ORM.
> Las columnas `project_id`, `agent_id` se escriben como `"projectId"`, `"agentId"`.

```sql
-- Habilitar extensión pgvector (una sola vez)
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla principal de conocimiento (columnas camelCase para Prisma)
CREATE TABLE agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- === RELACIONES (aislamiento multi-tenant) ===
  "projectId" TEXT NOT NULL,       -- ID del proyecto (cuid)
  "agentId" TEXT NOT NULL,         -- ID del agente (cuid)

  -- === CONTENIDO ===
  title VARCHAR(255),              -- Título del documento (opcional)
  content TEXT NOT NULL,           -- Texto del documento (chunk)
  source VARCHAR(100),             -- Origen: 'manual', 'pdf', 'website', 'csv'
  "sourceUrl" TEXT,                -- URL o path del archivo original

  -- === METADATA ===
  metadata JSONB DEFAULT '{}',     -- Info adicional (página, sección, etc.)
  "chunkIndex" INT DEFAULT 0,      -- Índice si el doc fue dividido en chunks

  -- === VECTOR ===
  embedding VECTOR(1536),          -- Embedding (1536 = OpenAI text-embedding-3-small)

  -- === AUDITORÍA ===
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "createdBy" TEXT,                -- Usuario que subió el conocimiento (cuid)

  -- === CONSTRAINTS ===
  CONSTRAINT fk_project FOREIGN KEY ("projectId") REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_agent FOREIGN KEY ("agentId") REFERENCES ai_agents(id) ON DELETE CASCADE
);

-- === ÍNDICES ===

-- Índice para filtrado relacional (CRÍTICO para aislamiento)
CREATE INDEX idx_knowledge_agent ON agent_knowledge("agentId");
CREATE INDEX idx_knowledge_project ON agent_knowledge("projectId");
CREATE INDEX idx_knowledge_agent_project ON agent_knowledge("agentId", "projectId");

-- Índice vectorial para búsqueda semántica
-- ivfflat: Bueno para datasets < 1M vectores, balance velocidad/precisión
CREATE INDEX idx_knowledge_embedding ON agent_knowledge
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Índice para búsqueda por source (útil para admin)
CREATE INDEX idx_knowledge_source ON agent_knowledge(source);
```

### Modelo Prisma (Alternativo)

```prisma
// prisma/schema.prisma

model AgentKnowledge {
  id          String   @id @default(uuid())

  // Relaciones
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  agentId     String
  agent       AIAgent  @relation(fields: [agentId], references: [id], onDelete: Cascade)

  // Contenido
  title       String?
  content     String
  source      String?  // 'manual', 'pdf', 'website', 'csv'
  sourceUrl   String?

  // Metadata
  metadata    Json     @default("{}")
  chunkIndex  Int      @default(0)

  // Vector - Nota: Prisma no soporta VECTOR nativo, usar raw SQL o extensión
  // embedding Vector(1536) -- Se maneja via SQL directo

  // Auditoría
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String?
  createdBy   User?    @relation(fields: [createdById], references: [id])

  @@index([agentId])
  @@index([projectId])
  @@index([agentId, projectId])
  @@map("agent_knowledge")
}
```

**Nota:** Prisma no soporta el tipo `VECTOR` nativamente. Las operaciones de embedding se harán con `prisma.$queryRaw` o directamente via Supabase client.

---

## Queries de Búsqueda

### Query Principal: Búsqueda Semántica con Aislamiento

```sql
-- Función para buscar conocimiento relevante (columnas camelCase)
CREATE OR REPLACE FUNCTION search_agent_knowledge(
  p_agent_id TEXT,               -- TEXT porque usamos cuid()
  p_project_id TEXT,             -- TEXT porque usamos cuid()
  p_query_embedding TEXT,        -- TEXT con formato '[0.1,0.2,...]', casteado internamente a vector
  p_match_count INT DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  title TEXT,
  source TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ak.id,
    ak.content,
    ak.title,
    ak.source,
    (1 - (ak.embedding <=> p_query_embedding::vector(1536)))::FLOAT AS similarity
  FROM agent_knowledge ak
  WHERE ak."agentId" = p_agent_id           -- AISLAMIENTO: Solo este agente
    AND ak."projectId" = p_project_id       -- AISLAMIENTO: Solo este proyecto
    AND (1 - (ak.embedding <=> p_query_embedding::vector(1536))) > p_match_threshold
  ORDER BY ak.embedding <=> p_query_embedding::vector(1536)
  LIMIT p_match_count;
END;
$$;
```

### Uso desde n8n (HTTP Request a KAIRO)

**Opción recomendada: Endpoint KAIRO `/api/rag/search`** (Arquitectura Opción B)

```javascript
// En nodo HTTP Request de n8n
// POST https://app.kairoagent.com/api/rag/search
// Headers: X-N8N-Secret: <shared_secret>

{
  "agentId": "{{$json.agentId}}",
  "projectId": "{{$json.projectId}}",
  "query": "{{$json.message}}",  // Pregunta del usuario
  "limit": 5,                     // Opcional (default: 5, max: 20)
  "threshold": 0.7                // Opcional (default: 0.7, range: 0-1)
}

// Response:
{
  "success": true,
  "results": [
    {
      "id": "uuid",
      "content": "Texto del documento...",
      "title": "Título del documento",
      "source": "manual",
      "similarity": 0.892
    }
  ],
  "metadata": {
    "agentId": "...",
    "agentName": "Luna",
    "projectId": "...",
    "projectName": "TechCorp SAC",
    "queryLength": 45,
    "resultsCount": 3,
    "threshold": 0.7,
    "timing": {
      "embedding": 150,
      "search": 45,
      "total": 210
    }
  }
}
```

**Alternativa: Supabase RPC directo** (Opción A - menos segura)

```javascript
// POST https://<project>.supabase.co/rest/v1/rpc/search_agent_knowledge

{
  "p_agent_id": "{{$json.agent_id}}",
  "p_project_id": "{{$json.project_id}}",
  "p_query_embedding": {{$json.query_embedding}},
  "p_match_count": 5,
  "p_match_threshold": 0.7
}
```

**Decisión de arquitectura:** Usar Opción B (vía KAIRO) por seguridad - n8n solo tiene shared secret, no credenciales de Supabase.

---

## Flujo n8n Detallado

### Workflow: "KAIRO - AI Agent RAG Handler"

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TRIGGER: Webhook de KAIRO                                              │
│  POST /webhook/kairo-ai-handler                                         │
│  Body: { leadId, agentId, projectId, message, conversationId }          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  NODO 1: Generar Embedding del Mensaje                                  │
│  Tipo: OpenAI Node                                                      │
│  Modelo: text-embedding-3-small                                         │
│  Input: {{ $json.message }}                                             │
│  Output: embedding[] (1536 dimensiones)                                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  NODO 2: Buscar en RAG (Supabase)                                       │
│  Tipo: HTTP Request                                                     │
│  URL: https://<project>.supabase.co/rest/v1/rpc/search_agent_knowledge  │
│  Headers: apikey, Authorization Bearer                                  │
│  Body: {                                                                │
│    p_agent_id: "{{ $json.agentId }}",                                   │
│    p_project_id: "{{ $json.projectId }}",                               │
│    p_query_embedding: {{ $node["OpenAI"].json.embedding }},             │
│    p_match_count: 5                                                     │
│  }                                                                      │
│  Output: [{ content, title, similarity }, ...]                          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  NODO 3: Preparar Contexto                                              │
│  Tipo: Code Node                                                        │
│  ```javascript                                                          │
│  const results = $input.all();                                          │
│  const context = results                                                │
│    .map(r => `[${r.json.title || 'Info'}]: ${r.json.content}`)          │
│    .join('\n\n---\n\n');                                                │
│                                                                         │
│  return [{                                                              │
│    json: {                                                              │
│      context,                                                           │
│      hasContext: results.length > 0,                                    │
│      message: $('Trigger').item.json.message                            │
│    }                                                                    │
│  }];                                                                    │
│  ```                                                                    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  NODO 4: IF - ¿Hay contexto relevante?                                  │
│  Condición: {{ $json.hasContext }} === true                             │
│                                                                         │
│  TRUE  ──────────────────────────────────────────▶ NODO 5 (Responder)   │
│  FALSE ──────────────────────────────────────────▶ NODO 6 (Fallback)    │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│  NODO 5: Generar Respuesta IA     │ │  NODO 6: Respuesta Fallback       │
│  Tipo: OpenAI/Anthropic Node      │ │  Tipo: Set Node                   │
│                                   │ │                                   │
│  System Prompt:                   │ │  response: "Lo siento, no tengo   │
│  """                              │ │  información sobre eso. ¿Puedo    │
│  Eres {agentName}, asistente de   │ │  ayudarte con algo más?"          │
│  {companyName}.                   │ │                                   │
│                                   │ │  Alternativa: Escalar a humano    │
│  REGLAS ESTRICTAS:                │ │  (cambiar handoffMode a 'human')  │
│  1. SOLO responde con información │ └───────────────────────────────────┘
│     del CONTEXTO proporcionado    │
│  2. Si la pregunta no está en el  │
│     contexto, di que no tienes    │
│     esa información               │
│  3. NUNCA inventes datos          │
│  4. Sé amable y profesional       │
│  5. Respuestas concisas (<200     │
│     palabras)                     │
│  """                              │
│                                   │
│  User Prompt:                     │
│  """                              │
│  CONTEXTO:                        │
│  {{ $json.context }}              │
│                                   │
│  PREGUNTA DEL CLIENTE:            │
│  {{ $json.message }}              │
│  """                              │
└────────────────────┬──────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  NODO 7: Enviar Respuesta via KAIRO                                     │
│  Tipo: HTTP Request                                                     │
│  URL: https://app.kairoagent.com/api/whatsapp/send                      │
│  Method: POST                                                           │
│  Headers: Authorization Bearer (Supabase token)                         │
│  Body: {                                                                │
│    projectId: "{{ $json.projectId }}",                                  │
│    leadId: "{{ $json.leadId }}",                                        │
│    message: "{{ $json.response }}",                                     │
│    agentId: "{{ $json.agentId }}"                                       │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Métodos de Alimentación del RAG

### Decisión de Alcance (2026-01-29)

| Fase | Método | Estado |
|------|--------|--------|
| **MVP** | Texto manual (editor) | Implementar ahora |
| **Futura** | Archivos (PDF, TXT, DOCX) | Implementar después |

### Flujo de Alimentación

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  FLUJO DE ALIMENTACIÓN RAG                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. ENTRADA (MVP: Solo texto manual)                                     │
│     └─ Admin pega texto en formulario                                    │
│     └─ Selecciona agente destino (Luna, Atlas, etc.)                    │
│     └─ Opcionalmente agrega título                                       │
│                                                                          │
│  2. CHUNKING (si es necesario)                                           │
│     └─ Si texto > 1000 tokens → dividir en fragmentos                   │
│     └─ Mantener overlap de ~100 tokens entre chunks                     │
│     └─ Guardar chunk_index para reconstrucción                          │
│                                                                          │
│  3. EMBEDDING                                                            │
│     └─ Enviar cada chunk a OpenAI API                                   │
│     └─ Modelo: text-embedding-3-small                                   │
│     └─ Resultado: vector de 1536 dimensiones                            │
│                                                                          │
│  4. GUARDAR EN BD                                                        │
│     INSERT INTO agent_knowledge (                                        │
│       agent_id,      -- Agente específico (Luna, Atlas...)              │
│       project_id,    -- Aislamiento multi-tenant                        │
│       content,       -- Texto original del chunk                        │
│       embedding,     -- Vector [1536 dims]                              │
│       source,        -- 'manual' (MVP) | 'pdf' | 'url' (futuro)        │
│       title,         -- Título descriptivo (opcional)                   │
│       chunk_index    -- Índice si fue dividido                          │
│     )                                                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fase Futura: Soporte de Archivos

Cuando se implemente el soporte de archivos:

| Tipo | Librería | Notas |
|------|----------|-------|
| PDF | `pdf-parse` | Extrae texto plano |
| TXT | Nativo | Lectura directa |
| DOCX | `mammoth` | Convierte a texto |
| CSV | `papaparse` | Cada fila = 1 documento |

---

## Implementación por Fases

### Fase 1: Infraestructura Base (BD + pgvector) ✅ COMPLETADA
**Duración estimada:** 2-3 horas

- [x] Habilitar extensión pgvector en Supabase
- [x] Crear tabla `agent_knowledge` con SQL (columnas camelCase para Prisma)
- [x] Crear función `search_agent_knowledge` (RPC para búsqueda semántica)
- [x] Crear función `insert_agent_knowledge` (RPC para inserción con vector)
- [x] Crear índices (relacional + vectorial ivfflat)
- [x] Habilitar RLS en tabla `agent_knowledge`
- [x] Políticas RLS: select/delete para miembros del proyecto

**Archivos SQL creados:**
- `scripts/create-insert-knowledge-function.sql` - Función de inserción + políticas RLS

### Fase 2: API de Gestión de Conocimiento ✅ COMPLETADA
**Duración estimada:** 3-4 horas

- [x] Server Action: `addAgentKnowledge(input)` - Chunking + embedding + inserción
- [x] Server Action: `deleteAgentKnowledge(id, projectId)` - Elimina chunks relacionados
- [x] Server Action: `listAgentKnowledge(agentId, projectId)` - Agrupa por título
- [x] Server Action: `searchAgentKnowledge(input)` - Búsqueda semántica con threshold
- [x] Server Action: `getAgentKnowledgeStats(agentId, projectId)` - Estadísticas
- [x] Integración con OpenAI para generar embeddings (`text-embedding-3-small`)
- [x] Lógica de chunking para textos largos (~1000 chars, 200 overlap)
- [x] Validación de permisos (verifyProjectAccess + super_admin)

**Archivos creados:**
- `src/lib/actions/knowledge.ts` - Server Actions completas
- `src/lib/openai/embeddings.ts` - Helper para OpenAI embeddings
- `src/lib/utils/chunking.ts` - Utilidad de chunking semántico

### Fase 3: UI Admin para RAG (Solo Texto Manual) ✅ COMPLETADA
**Duración estimada:** 4-5 horas

- [x] Tab "Conocimiento" en ProjectSettingsModal (por agente)
- [x] Selector de agente para filtrar conocimiento
- [x] Formulario para agregar conocimiento:
  - [x] Campo título (opcional)
  - [x] Textarea para contenido (texto plano)
  - [x] Botón "Agregar Conocimiento" con loading state
- [x] Lista de documentos existentes con:
  - [x] Título y preview del contenido (primeros 150 chars)
  - [x] Badge de fuente (manual)
  - [x] Fecha de creación formateada
  - [x] Botón eliminar con confirmación modal
- [x] Estado vacío con mensaje descriptivo
- [x] Traducciones es/en completas

**Archivos modificados:**
- `src/components/admin/ProjectSettingsModal.tsx` - Nueva tab Conocimiento
- `src/messages/es.json` - Traducciones knowledgeSettings
- `src/messages/en.json` - Traducciones knowledgeSettings

### Fase 4: Workflow n8n ✅ COMPLETADA
**Duración real:** ~4 horas (incluye debugging y ajustes)

- [x] Endpoint `/api/rag/search` creado en KAIRO ✅
  - Autenticación: Header `X-N8N-Secret` (shared secret)
  - Request body: `{ agentId, projectId, query, limit?, threshold? }`
  - Response: `{ success, results[], metadata }`
  - Features: Validación de agente/proyecto, generación de embeddings, búsqueda semántica
  - Logging detallado con timings (embedding, search, total)
  - Health check endpoint (GET) con documentación
- [x] Workflow n8n configurado en Railway ✅
  - URL: `n8n-production-5d42.up.railway.app`
  - Nodo "RAG Search" llama a `/api/rag/search` con header `X-N8N-Secret`
  - Parseo correcto de respuesta `results[]`
- [x] Nodo OpenAI configurado con System Prompt dinámico ✅
  - Usa `body.agentName` del webhook para identificarse (nombre de KAIRO settings)
  - Usa `body.companyName` para contexto de empresa
  - RAG context inyectado condicionalmente si hay resultados
  - Expresión correcta: `$('Message a model').item.json.output[0].content[0].text`
- [x] Flujo end-to-end verificado con Playwright MCP ✅
  - WhatsApp → KAIRO webhook → n8n → RAG Search → OpenAI → WhatsApp
  - Bot responde como "Leo" (nombre del agente en KAIRO)
  - Personalidad del RAG aplicada en respuestas

### Fase 5: Testing y Refinamiento
**Duración estimada:** 2-3 horas

- [ ] Probar aislamiento entre agentes (A no ve B)
- [ ] Probar aislamiento entre proyectos
- [ ] Ajustar threshold de similitud (default 0.7)
- [ ] Ajustar cantidad de documentos retornados (3 vs 5)
- [ ] Refinar prompt del LLM para mejores respuestas
- [ ] Documentar configuración final

### Fase 6: Soporte de Archivos (FUTURA)
**Duración estimada:** 4-6 horas
**Estado:** Pendiente - Se implementará después del MVP

- [ ] Upload de archivos a Supabase Storage
- [ ] Extracción de texto de PDF (`pdf-parse`)
- [ ] Extracción de texto de DOCX (`mammoth`)
- [ ] Procesamiento de CSV (una fila = un documento)
- [ ] UI de upload con drag & drop
- [ ] Progress bar para archivos grandes
- [ ] Límites de tamaño (ej: max 10MB por archivo)

---

## Configuración Final n8n (Producción)

### System Prompt del Nodo OpenAI

```
Eres {{ $('Webhook').item.json.body.agentName }}, asistente de {{ $('Webhook').item.json.body.companyName }}.

{{ $('RAG Search').item.json.results && $('RAG Search').item.json.results.length > 0 ? 'Tu personalidad y conocimiento:\n' + $('RAG Search').item.json.results.map(r => r.content).join('\n\n') : '' }}

Responde de manera natural y breve al usuario "{{ $('Webhook').item.json.body.leadName }}". Si no tienes informacion especifica, responde de forma amigable usando tu nombre.
```

### Expresión para Obtener Respuesta de OpenAI

```javascript
// Nodo "Prepare AI Response" - Campo message
{{ $('Message a model').item.json.output[0].content[0].text }}
```

**Importante:** La estructura de respuesta de OpenAI es:
- `output[0].content[0].text` (NO `.json.text` que retorna undefined)

### Flujo de Datos en n8n

```
Webhook (body)
    ├── agentId
    ├── agentName      ← Usado en System Prompt
    ├── companyName    ← Usado en System Prompt
    ├── leadName       ← Usado en System Prompt
    ├── message        ← Query del usuario
    └── projectId
         │
         ▼
RAG Search (HTTP Request a /api/rag/search)
    └── results[]      ← Inyectado condicionalmente en System Prompt
         │
         ▼
Message a model (OpenAI)
    └── output[0].content[0].text  ← Respuesta generada
         │
         ▼
Prepare AI Response
    └── message: {{ respuesta de OpenAI }}
         │
         ▼
Send to WhatsApp (HTTP Request a /api/whatsapp/send)
```

---

## Consideraciones de Seguridad

### Aislamiento Multi-Tenant

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CAPAS DE AISLAMIENTO                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CAPA 1: project_id                                                      │
│  └── Empresa A no puede ver conocimiento de Empresa B                    │
│                                                                          │
│  CAPA 2: agent_id                                                        │
│  └── Dentro del mismo proyecto, Agente Luna no ve RAG de Agente Atlas   │
│                                                                          │
│  CAPA 3: Permisos de usuario                                            │
│  └── Solo ADMIN/MANAGER pueden agregar/eliminar conocimiento            │
│                                                                          │
│  CAPA 4: RLS (Row Level Security) - Opcional                            │
│  └── Policies en Supabase para doble verificación                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Validaciones Obligatorias

1. **En queries de búsqueda:**
   - `agent_id` SIEMPRE requerido
   - `project_id` SIEMPRE requerido
   - Nunca usar `SELECT * FROM agent_knowledge` sin filtros

2. **En operaciones de escritura:**
   - Verificar que usuario es ADMIN/MANAGER del proyecto
   - Verificar que el agente pertenece al proyecto

3. **En n8n:**
   - Validar que `agentId` y `projectId` vienen del trigger
   - Nunca hardcodear IDs

---

## Estimación de Costos

### Supabase (Plan Free)

| Recurso | Límite Free | Uso estimado RAG |
|---------|-------------|------------------|
| DB Storage | 500 MB | ~80,000 docs embedidos |
| API Requests | Ilimitados | OK |
| Realtime | 200 concurrent | OK |

**Nota:** Un embedding de 1536 dims ocupa ~6KB. Con 500MB puedes almacenar aproximadamente 80,000 documentos.

### OpenAI Embeddings

| Modelo | Costo | Tokens típicos |
|--------|-------|----------------|
| text-embedding-3-small | $0.00002/1K tokens | ~500 tokens/doc |
| text-embedding-3-large | $0.00013/1K tokens | ~500 tokens/doc |

**Estimación:** 1,000 documentos = ~$0.01 (embedding inicial) + ~$0.01/día (queries)

### LLM para Respuestas

| Modelo | Costo aprox. |
|--------|--------------|
| GPT-4o-mini | $0.00015/1K input, $0.0006/1K output |
| Claude 3 Haiku | $0.00025/1K input, $0.00125/1K output |
| Claude 3.5 Sonnet | $0.003/1K input, $0.015/1K output |

**Recomendación MVP:** GPT-4o-mini o Claude Haiku para balance costo/calidad.

---

## Checklist Pre-Implementación

- [x] Cuenta de OpenAI con API key (se configura por proyecto en Project Secrets)
- [x] n8n en Railway configurado → `n8n-production-5d42.up.railway.app`
- [x] Supabase con pgvector habilitado
- [x] Documentos de prueba para RAG inicial (se agregan desde UI)
- [x] Definir agente de prueba (cualquier agente del proyecto)
- [x] Webhook WhatsApp envía `agentId`, `agentName`, `companyName` a n8n
- [x] Restricción: Solo 1 agente activo por proyecto

---

## Lead Temperature Scoring (v0.7.9)

### Concepto

El sistema permite que los agentes IA califiquen automáticamente a los leads como HOT/WARM/COLD durante las conversaciones. Los criterios de calificación son **configurables por agente** a través del campo `systemInstructions`.

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    LEAD TEMPERATURE SCORING FLOW                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. CONFIGURACIÓN (Admin KAIRO)                                          │
│     └─ Admin define criterios en `systemInstructions` del agente         │
│     └─ Ejemplo: "HOT = Pide precio, WARM = Pregunta info, COLD = Solo    │
│        saluda"                                                           │
│     └─ Agrega formato: "Al final incluir [TEMPERATURA: HOT|WARM|COLD]"  │
│                                                                          │
│  2. WEBHOOK (KAIRO → n8n)                                                │
│     └─ Incluye `systemInstructions` en el payload                        │
│     └─ n8n pasa las instrucciones al LLM                                │
│                                                                          │
│  3. GENERACIÓN (OpenAI)                                                  │
│     └─ AI evalúa según criterios del cliente                            │
│     └─ Genera respuesta + marcador de temperatura                        │
│     └─ Ejemplo: "¡Hola! Claro que sí... [TEMPERATURA: HOT]"             │
│                                                                          │
│  4. EXTRACCIÓN (n8n - Prepare AI Response)                               │
│     └─ Regex extrae temperatura: /\[TEMPERATURA:\s*(HOT|WARM|COLD)\]/i  │
│     └─ Limpia marcador antes de enviar al usuario                       │
│     └─ Campo `suggestedTemperature` se pasa a KAIRO                     │
│                                                                          │
│  5. ACTUALIZACIÓN (KAIRO - /api/ai/respond)                             │
│     └─ Recibe `suggestedTemperature` en el body                         │
│     └─ Actualiza `lead.temperature` en BD                               │
│     └─ Lead queda clasificado automáticamente                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### System Prompt n8n (Actualizado)

```
Eres {{ $('Webhook').item.json.body.agentName }}, y trabajas en {{ $('Webhook').item.json.body.companyName }}.

{{ $('Webhook').item.json.body.systemInstructions ? $('Webhook').item.json.body.systemInstructions : '' }}

{{ $('RAG Search').item.json.results && $('RAG Search').item.json.results.length > 0 ? 'TU CONOCIMIENTO:\n' + $('RAG Search').item.json.results.map(r => r.content).join('\n\n') : '' }}

Responde de manera natural y breve al usuario "{{ $('Webhook').item.json.body.leadName }}".
```

### Nodo "Prepare AI Response" (Campos Clave)

```javascript
// Campo: suggestedTemperature
{{ $('Message a model').item.json.output[0].content[0].text.match(/\[TEMPERATURA:\s*(HOT|WARM|COLD)\]/i)?.[1]?.toLowerCase() || null }}

// Campo: message (limpia el marcador)
{{ $('Message a model').item.json.output[0].content[0].text.replace(/\[TEMPERATURA:\s*(HOT|WARM|COLD)\]/gi, '').trim() }}
```

### Ejemplo de systemInstructions (Cliente Configura en KAIRO)

```
PERSONALIDAD
Eres Leonidas, experto en ventas con estilo directo pero amigable.

CRITERIOS DE CALIFICACIÓN
- HOT: Pide precios, pregunta por métodos de pago, quiere agendar cita
- WARM: Pregunta detalles del servicio, muestra interés genuino
- COLD: Solo saluda, respuestas cortas, no hace preguntas

FORMATO DE RESPUESTA
Al finalizar tu respuesta, incluir en una línea aparte:
[TEMPERATURA: HOT|WARM|COLD]
```

### Beneficios Multi-Tenant

- Cada cliente de KAIRO define sus propios criterios de HOT/WARM/COLD
- Los criterios reflejan la naturaleza específica de cada negocio
- No hay criterios hardcodeados en n8n - todo viene de KAIRO
- Los admins pueden ajustar criterios sin intervención técnica

---

## Memoria de Conversación (v0.7.9)

### Concepto

El sistema envía los últimos 8 mensajes de la conversación como contexto a OpenAI, permitiendo que el bot mantenga coherencia y recuerde lo que se habló anteriormente.

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONVERSATION MEMORY FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. MENSAJE ENTRANTE (WhatsApp → KAIRO)                                 │
│     └─ Se guarda en BD el mensaje del lead                              │
│                                                                          │
│  2. OBTENER HISTORIAL (KAIRO Webhook)                                   │
│     └─ Query: últimos 9 mensajes (ordenados por createdAt DESC)         │
│     └─ Excluye el mensaje actual (slice(1))                             │
│     └─ Invierte orden (más antiguo primero)                             │
│     └─ Formatea para OpenAI: { role: 'user'|'assistant', content }      │
│                                                                          │
│  3. PAYLOAD A n8n                                                        │
│     └─ conversationHistory: Array de hasta 8 mensajes                   │
│     └─ historyCount: número de mensajes en historial                    │
│                                                                          │
│  4. n8n SYSTEM PROMPT                                                    │
│     └─ Incluye historial como "HISTORIAL DE CONVERSACIÓN:"              │
│     └─ Formato: "Lead: mensaje" / "Tú: respuesta"                       │
│                                                                          │
│  5. OpenAI RESPONDE                                                      │
│     └─ Tiene contexto de los últimos 8 intercambios                     │
│     └─ Puede referenciar temas ya discutidos                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Código en Webhook (route.ts)

```typescript
// Obtener historial de conversación (últimos 8 mensajes)
let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

if (lead.conversation?.id) {
  const recentMessages = await prisma.message.findMany({
    where: { conversationId: lead.conversation.id },
    orderBy: { createdAt: 'desc' },
    take: 9, // Tomamos 9 para excluir el mensaje actual
    select: { content: true, sender: true, createdAt: true },
  });

  conversationHistory = recentMessages
    .slice(1) // Excluir mensaje actual
    .reverse() // Orden cronológico
    .map((msg) => ({
      role: msg.sender === 'lead' ? 'user' : 'assistant',
      content: msg.content,
    }));
}
```

### System Prompt n8n (Sección Historial)

```
{{ $('Webhook').item.json.body.conversationHistory &&
   $('Webhook').item.json.body.conversationHistory.length > 0
   ? 'HISTORIAL DE CONVERSACIÓN:\n' +
     $('Webhook').item.json.body.conversationHistory
       .map(m => (m.role === 'user' ? 'Lead: ' : 'Tú: ') + m.content)
       .join('\n') + '\n'
   : '' }}
```

### Fecha y Hora Actual

El bot también recibe la fecha y hora actual (timezone Lima):

```typescript
currentDate: new Date().toLocaleDateString('es-PE', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  timeZone: 'America/Lima',
}),
currentTime: new Date().toLocaleTimeString('es-PE', {
  hour: '2-digit', minute: '2-digit',
  timeZone: 'America/Lima',
}),
```

System Prompt usa: `Fecha actual: {{ body.currentDate }}, hora: {{ body.currentTime }}`

### Límite de 8 Mensajes

- **¿Por qué 8?** Balance entre contexto suficiente y costo de tokens
- **Incluye:** Mensajes del lead + respuestas del bot
- **No incluye:** Mensajes de sistema, notas internas, etc.
- **Escalable:** Puede ajustarse el límite según necesidad (variable `take: 9`)

---

## Referencias

- [Supabase pgvector Docs](https://supabase.com/docs/guides/database/extensions/pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [n8n AI Agents](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/)
- [RAG Best Practices](https://www.anthropic.com/research/rag-best-practices)

---

## Historial de Cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-01-25 | Documento inicial creado | Adan (Claude) |
| 2026-01-29 | Definido alcance MVP: solo texto manual. Archivos en fase futura | Leo + Adan |
| 2026-01-29 | **Fase 1 completada**: pgvector, tablas, funciones RPC, RLS | Adan (Claude) |
| 2026-01-29 | **Fase 2 completada**: Server Actions, embeddings, chunking | Adan (Claude) |
| 2026-01-29 | **Fase 3 completada**: UI en ProjectSettingsModal, traducciones i18n | Adan (Claude) |
| 2026-01-29 | Pausa antes de Fase 4 - Pendiente: configurar n8n en Railway | Leo + Adan |
| 2026-01-29 | **Corrección `search_agent_knowledge`**: Parámetro `p_query_embedding` cambiado a TEXT (consistencia con insert_agent_knowledge) | Adan (Claude) |
| 2026-01-29 | **Webhook WhatsApp actualizado**: Envía `agentId`, `agentName`, `companyName` a n8n | Adan (Claude) |
| 2026-01-29 | **Restricción 1 agente activo**: Solo un agente puede estar activo por proyecto | Leo + Adan |
| 2026-01-29 | **Auto-asignación de agente**: Leads nuevos reciben primer agente activo del proyecto | Adan (Claude) |
| 2026-01-30 | **Fase 4 en progreso**: Endpoint `/api/rag/search` creado - Decisión Opción B (n8n vía KAIRO por seguridad) | Adan (Claude) |
| 2026-01-30 | **Fase 4 COMPLETADA**: Workflow n8n configurado, System Prompt usa `body.agentName` de KAIRO | Adan (Claude) |
| 2026-01-30 | **Flujo RAG verificado end-to-end**: Bot responde como "Leo" con personalidad del conocimiento | Leo + Adan |
| 2026-02-02 | **Lead Temperature Scoring (v0.7.9)**: IA califica leads HOT/WARM/COLD via systemInstructions configurable por agente | Leo + Adan |
| 2026-02-02 | **Memoria de Conversación**: Webhook envía últimos 8 mensajes como `conversationHistory` a n8n | Adan (Claude) |
| 2026-02-02 | **Fecha/Hora para Bot**: Webhook envía `currentDate` y `currentTime` (timezone Lima) | Adan (Claude) |
| 2026-02-02 | **Fix n8n suggestedTemperature**: Nodo "Send to WhatsApp" ahora envía temperatura a KAIRO correctamente | Adan (Claude) |
