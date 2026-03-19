-- ============================================
-- KAIRO Agent Media Setup - Complete Script
-- Run this in Supabase SQL Editor
-- ============================================
--
-- [CRITICAL WARNING] ADVERTENCIA CRITICA [CRITICAL WARNING]
--
-- Esta tabla NO esta en prisma/schema.prisma porque usa pgvector (VECTOR type).
--
-- NUNCA ejecutar "prisma db push" - ELIMINARA esta tabla y todos los datos.
--
-- Si la tabla fue eliminada accidentalmente:
-- 1. Ejecutar este script completo en Supabase SQL Editor
-- 2. Los datos de media de clientes SE PERDIERON permanentemente
-- 3. Clientes deberan re-subir su media
--
-- Ver docs/DATABASE-MIGRATIONS.md para procedimientos correctos.
--
-- ============================================
-- Uses snake_case for agent_media table (not managed by Prisma)
-- but references Prisma tables with camelCase columns ("projectId", "userId")
-- ============================================

-- Step 1: Ensure pgvector extension exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create the agent_media table
CREATE TABLE IF NOT EXISTS agent_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships (multi-tenant isolation)
  project_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,

  -- Content
  title VARCHAR(200) NOT NULL,          -- Short title (e.g., "Departamento 2 dormitorios")
  description TEXT NOT NULL,            -- Detailed description for semantic search/RAG
  media_url TEXT NOT NULL,              -- Supabase Storage public URL
  storage_path TEXT NOT NULL,           -- Storage path for deletion (e.g., projectId/2026/03/uuid.jpg)
  media_type VARCHAR(20) DEFAULT 'image', -- 'image' now, 'video' later

  -- Vector
  embedding VECTOR(1536),              -- Embedding of description (OpenAI text-embedding-3-small)

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT                       -- User who uploaded (cuid)
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_media_agent_project ON agent_media(agent_id, project_id);
CREATE INDEX IF NOT EXISTS idx_media_embedding ON agent_media
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Step 4: Enable RLS
ALTER TABLE agent_media ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RPC functions

-- Function to insert agent media with pgvector embedding
CREATE OR REPLACE FUNCTION insert_agent_media(
  p_project_id TEXT,
  p_agent_id TEXT,
  p_title TEXT,
  p_description TEXT,
  p_media_url TEXT,
  p_storage_path TEXT,
  p_media_type TEXT,
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
  INSERT INTO agent_media (
    project_id, agent_id, title, description, media_url, storage_path,
    media_type, embedding, created_by, created_at, updated_at
  ) VALUES (
    p_project_id, p_agent_id, p_title, p_description, p_media_url, p_storage_path,
    COALESCE(p_media_type, 'image'), p_embedding::vector(1536),
    p_created_by, NOW(), NOW()
  )
  RETURNING agent_media.id INTO new_id;
  RETURN QUERY SELECT new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_agent_media TO authenticated;

-- Function to list agent media
CREATE OR REPLACE FUNCTION list_agent_media(
  p_agent_id TEXT,
  p_project_id TEXT
)
RETURNS TABLE (
  id UUID, title VARCHAR(200), description TEXT, media_url TEXT,
  storage_path TEXT, media_type VARCHAR(20), created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT am.id, am.title, am.description, am.media_url, am.storage_path,
         am.media_type, am.created_at, am.updated_at
  FROM agent_media am
  WHERE am.agent_id = p_agent_id AND am.project_id = p_project_id
  ORDER BY am.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_agent_media TO authenticated;

-- Function to search agent media (semantic search)
CREATE OR REPLACE FUNCTION search_agent_media(
  p_agent_id TEXT,
  p_project_id TEXT,
  p_query_embedding TEXT,
  p_match_count INT DEFAULT 3,
  p_match_threshold FLOAT DEFAULT 0.40
)
RETURNS TABLE (id UUID, title VARCHAR(200), description TEXT, media_url TEXT, similarity FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT am.id, am.title, am.description, am.media_url,
         (1 - (am.embedding <=> p_query_embedding::vector(1536)))::FLOAT AS similarity
  FROM agent_media am
  WHERE am.agent_id = p_agent_id
    AND am.project_id = p_project_id
    AND (1 - (am.embedding <=> p_query_embedding::vector(1536))) > p_match_threshold
  ORDER BY am.embedding <=> p_query_embedding::vector(1536)
  LIMIT p_match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION search_agent_media TO authenticated, anon;

-- Function to delete agent media
CREATE OR REPLACE FUNCTION delete_agent_media(
  p_id UUID,
  p_project_id TEXT
)
RETURNS TABLE (deleted_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM agent_media
  WHERE id = p_id AND project_id = p_project_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_agent_media TO authenticated;

-- Function to count agent media (for feature flag)
CREATE OR REPLACE FUNCTION count_agent_media(
  p_agent_id TEXT,
  p_project_id TEXT
)
RETURNS TABLE (count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT COUNT(*)::BIGINT
  FROM agent_media am
  WHERE am.agent_id = p_agent_id AND am.project_id = p_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION count_agent_media TO authenticated;

-- Step 6: Create RLS Policies
-- IMPORTANT: Prisma uses camelCase columns ("projectId", "userId", "systemRole")

DROP POLICY IF EXISTS "Users can read media from their projects" ON agent_media;
CREATE POLICY "Users can read media from their projects"
  ON agent_media FOR SELECT TO authenticated
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

DROP POLICY IF EXISTS "Users can delete media from their projects" ON agent_media;
CREATE POLICY "Users can delete media from their projects"
  ON agent_media FOR DELETE TO authenticated
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
-- SELECT * FROM information_schema.tables WHERE table_name = 'agent_media';
-- SELECT proname FROM pg_proc WHERE proname LIKE '%agent_media%';
