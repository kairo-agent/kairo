-- Function to list agent knowledge bypassing RLS
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION list_agent_knowledge(
  p_agent_id TEXT,
  p_project_id TEXT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  source VARCHAR(100),
  source_url TEXT,
  chunk_index INT,
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
    ak.title,
    ak.content,
    ak.source,
    ak.source_url,
    ak.chunk_index,
    ak.created_at,
    ak.updated_at
  FROM agent_knowledge ak
  WHERE ak.agent_id = p_agent_id
    AND ak.project_id = p_project_id
  ORDER BY ak.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION list_agent_knowledge TO authenticated;
