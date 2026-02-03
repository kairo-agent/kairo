-- ============================================
-- KAIRO RAG Setup - Complete Script
-- Run this in Supabase SQL Editor
-- ============================================
--
-- ⛔⛔⛔ ADVERTENCIA CRÍTICA ⛔⛔⛔
--
-- Esta tabla NO está en prisma/schema.prisma porque usa pgvector (VECTOR type).
--
-- NUNCA ejecutar "prisma db push" - ELIMINARÁ esta tabla y todos los datos.
--
-- Si la tabla fue eliminada accidentalmente:
-- 1. Ejecutar este script completo en Supabase SQL Editor
-- 2. Los datos de conocimiento de clientes SE PERDIERON permanentemente
-- 3. Clientes deberán re-subir su conocimiento
--
-- Ver docs/DATABASE-MIGRATIONS.md para procedimientos correctos.
--
-- ============================================
-- IMPORTANT: Uses snake_case for agent_knowledge table (not managed by Prisma)
-- but references Prisma tables with camelCase columns ("projectId", "userId")
-- ============================================

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create the agent_knowledge table
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships (multi-tenant isolation)
  project_id TEXT NOT NULL,      -- Project ID (cuid)
  agent_id TEXT NOT NULL,        -- Agent ID (cuid)

  -- Content
  title VARCHAR(255),            -- Document title (optional)
  content TEXT NOT NULL,         -- Document text (chunk)
  source VARCHAR(100),           -- Origin: 'manual', 'pdf', 'website', 'csv'
  source_url TEXT,               -- URL or path of original file

  -- Metadata
  metadata JSONB DEFAULT '{}',   -- Additional info (page, section, etc.)
  chunk_index INT DEFAULT 0,     -- Index if doc was split into chunks

  -- Vector
  embedding VECTOR(1536),        -- Embedding (1536 = OpenAI text-embedding-3-small)

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT                -- User who uploaded the knowledge (cuid)
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_agent ON agent_knowledge(agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON agent_knowledge(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_agent_project ON agent_knowledge(agent_id, project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON agent_knowledge
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_knowledge_source ON agent_knowledge(source);

-- Step 4: Enable RLS
ALTER TABLE agent_knowledge ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RPC functions

-- Function to insert agent knowledge with pgvector embedding
CREATE OR REPLACE FUNCTION insert_agent_knowledge(
  p_project_id TEXT,
  p_agent_id TEXT,
  p_title TEXT,
  p_content TEXT,
  p_source VARCHAR(100),
  p_source_url TEXT,
  p_metadata JSONB,
  p_chunk_index INT,
  p_embedding TEXT,
  p_created_by TEXT
)
RETURNS TABLE (id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO agent_knowledge (
    project_id, agent_id, title, content, source, source_url,
    metadata, chunk_index, embedding, created_by, created_at, updated_at
  ) VALUES (
    p_project_id, p_agent_id, p_title, p_content, p_source, p_source_url,
    COALESCE(p_metadata, '{}'), p_chunk_index, p_embedding::vector(1536),
    p_created_by, NOW(), NOW()
  )
  RETURNING agent_knowledge.id INTO new_id;
  RETURN QUERY SELECT new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_agent_knowledge TO authenticated;

-- Function to list agent knowledge
CREATE OR REPLACE FUNCTION list_agent_knowledge(
  p_agent_id TEXT,
  p_project_id TEXT
)
RETURNS TABLE (
  id UUID, title VARCHAR(255), content TEXT, source VARCHAR(100),
  source_url TEXT, chunk_index INT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ak.id, ak.title, ak.content, ak.source, ak.source_url,
         ak.chunk_index, ak.created_at, ak.updated_at
  FROM agent_knowledge ak
  WHERE ak.agent_id = p_agent_id AND ak.project_id = p_project_id
  ORDER BY ak.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_agent_knowledge TO authenticated;

-- Function to search agent knowledge (semantic search)
DROP FUNCTION IF EXISTS search_agent_knowledge(text, text, vector, integer, double precision);
DROP FUNCTION IF EXISTS search_agent_knowledge(text, text, text, integer, double precision);

CREATE OR REPLACE FUNCTION search_agent_knowledge(
  p_agent_id TEXT,
  p_project_id TEXT,
  p_query_embedding TEXT,
  p_match_count INT DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (id UUID, content TEXT, title VARCHAR(255), source VARCHAR(100), similarity FLOAT)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT ak.id, ak.content, ak.title, ak.source,
         (1 - (ak.embedding <=> p_query_embedding::vector(1536)))::FLOAT AS similarity
  FROM agent_knowledge ak
  WHERE ak.agent_id = p_agent_id
    AND ak.project_id = p_project_id
    AND (1 - (ak.embedding <=> p_query_embedding::vector(1536))) > p_match_threshold
  ORDER BY ak.embedding <=> p_query_embedding::vector(1536)
  LIMIT p_match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION search_agent_knowledge TO authenticated;

-- Function to delete agent knowledge
CREATE OR REPLACE FUNCTION delete_agent_knowledge(
  p_id UUID,
  p_project_id TEXT
)
RETURNS TABLE (deleted_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_title TEXT;
  v_agent_id TEXT;
  v_count INT;
BEGIN
  SELECT title, agent_id INTO v_title, v_agent_id
  FROM agent_knowledge WHERE id = p_id AND project_id = p_project_id;

  IF v_title IS NULL AND v_agent_id IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  IF v_title IS NOT NULL THEN
    DELETE FROM agent_knowledge
    WHERE title = v_title AND agent_id = v_agent_id AND project_id = p_project_id;
  ELSE
    DELETE FROM agent_knowledge WHERE id = p_id;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_agent_knowledge TO authenticated;

-- Step 6: Create RLS Policies
-- IMPORTANT: Prisma uses camelCase columns ("projectId", "userId", "systemRole")

DROP POLICY IF EXISTS "Users can read knowledge from their projects" ON agent_knowledge;
CREATE POLICY "Users can read knowledge from their projects"
  ON agent_knowledge FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT pm."projectId"
      FROM project_members pm
      WHERE pm."userId" = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::text
      AND u."systemRole" = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Users can delete knowledge from their projects" ON agent_knowledge;
CREATE POLICY "Users can delete knowledge from their projects"
  ON agent_knowledge FOR DELETE TO authenticated
  USING (
    project_id IN (
      SELECT pm."projectId"
      FROM project_members pm
      WHERE pm."userId" = auth.uid()::text
      AND pm.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::text
      AND u."systemRole" = 'super_admin'
    )
  );

-- ============================================
-- Done! Verify with these queries:
-- ============================================
-- SELECT * FROM information_schema.tables WHERE table_name = 'agent_knowledge';
-- SELECT proname FROM pg_proc WHERE proname LIKE '%agent_knowledge%';
