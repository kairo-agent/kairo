# RAG para Agentes IA - Plan de Implementación

> **Estado:** EN PROGRESO - Fases 1-3 completadas ✅
> **Fecha de planificación:** 2026-01-25
> **Última actualización:** 2026-01-29
> **Próximo paso:** Configurar n8n en Railway, luego Fase 4

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

### Uso desde n8n (HTTP Request a Supabase)

```javascript
// En nodo HTTP Request de n8n
// POST https://<project>.supabase.co/rest/v1/rpc/search_agent_knowledge

{
  "p_agent_id": "{{$json.agent_id}}",
  "p_project_id": "{{$json.project_id}}",
  "p_query_embedding": {{$json.query_embedding}},
  "p_match_count": 5,
  "p_match_threshold": 0.7
}
```

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

### Fase 4: Workflow n8n
**Duración estimada:** 2-3 horas

- [ ] Crear workflow "KAIRO - AI Agent RAG Handler"
- [ ] Configurar nodo OpenAI para embeddings de query
- [ ] Configurar nodo HTTP para buscar en Supabase (RPC)
- [ ] Configurar nodo LLM (Claude/GPT) con prompt estricto
- [ ] Configurar nodo de respuesta via API KAIRO
- [ ] Probar flujo completo end-to-end

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
- [ ] n8n Cloud o self-hosted configurado → **PRÓXIMO PASO: Railway**
- [x] Supabase con pgvector habilitado
- [x] Documentos de prueba para RAG inicial (se agregan desde UI)
- [x] Definir agente de prueba (cualquier agente del proyecto)

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
