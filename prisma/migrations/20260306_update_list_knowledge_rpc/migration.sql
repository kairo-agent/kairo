-- Update list_agent_knowledge RPC to include category and structured_data columns
-- These columns were added in the structured knowledge migration

-- Drop old signature first
DROP FUNCTION IF EXISTS list_agent_knowledge(TEXT, TEXT);

CREATE OR REPLACE FUNCTION list_agent_knowledge(
  p_agent_id TEXT,
  p_project_id TEXT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  source TEXT,
  source_url TEXT,
  chunk_index INT,
  category TEXT,
  structured_data JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ak.id,
    ak.title::TEXT,
    ak.content,
    ak.source::TEXT,
    ak.source_url,
    ak.chunk_index,
    ak.category::TEXT,
    ak.structured_data,
    ak.created_at,
    ak.updated_at
  FROM agent_knowledge ak
  WHERE ak.agent_id = p_agent_id
    AND ak.project_id = p_project_id
  ORDER BY ak.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_agent_knowledge TO authenticated;
