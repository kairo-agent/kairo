-- Update insert_agent_knowledge RPC to accept category and structured_data
-- This avoids the need for a separate UPDATE (which fails due to missing RLS UPDATE policy)

-- Drop old 10-param signature first
DROP FUNCTION IF EXISTS insert_agent_knowledge(TEXT, TEXT, TEXT, TEXT, VARCHAR, TEXT, JSONB, INT, TEXT, TEXT);

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
  p_created_by TEXT,
  p_category VARCHAR(50) DEFAULT 'free_text',
  p_structured_data JSONB DEFAULT NULL
)
RETURNS TABLE (id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
BEGIN
  -- For structured categories (non free_text), delete existing entry first (upsert pattern)
  IF p_category IS NOT NULL AND p_category != 'free_text' THEN
    DELETE FROM agent_knowledge
    WHERE agent_id = p_agent_id
      AND project_id = p_project_id
      AND category = p_category;
  END IF;

  INSERT INTO agent_knowledge (
    project_id,
    agent_id,
    title,
    content,
    source,
    source_url,
    metadata,
    chunk_index,
    embedding,
    created_by,
    category,
    structured_data,
    created_at,
    updated_at
  ) VALUES (
    p_project_id,
    p_agent_id,
    p_title,
    p_content,
    p_source,
    p_source_url,
    COALESCE(p_metadata, '{}'),
    p_chunk_index,
    p_embedding::vector(1536),
    p_created_by,
    COALESCE(p_category, 'free_text'),
    p_structured_data,
    NOW(),
    NOW()
  )
  RETURNING agent_knowledge.id INTO new_id;

  RETURN QUERY SELECT new_id;
END;
$$;

-- Keep existing grants
GRANT EXECUTE ON FUNCTION insert_agent_knowledge TO authenticated;
