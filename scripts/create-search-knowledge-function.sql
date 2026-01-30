-- Function to search agent knowledge using semantic similarity (pgvector)
-- Run this in Supabase SQL Editor
-- SAFE: Uses CREATE OR REPLACE - won't break existing data

DROP FUNCTION IF EXISTS search_agent_knowledge(text, text, vector, integer, double precision);

CREATE OR REPLACE FUNCTION search_agent_knowledge(
  p_agent_id TEXT,
  p_project_id TEXT,
  p_query_embedding TEXT,
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
SECURITY INVOKER
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
  WHERE ak.agent_id = p_agent_id
    AND ak.project_id = p_project_id
    AND (1 - (ak.embedding <=> p_query_embedding::vector(1536))) > p_match_threshold
  ORDER BY ak.embedding <=> p_query_embedding::vector(1536)
  LIMIT p_match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION search_agent_knowledge TO authenticated;
