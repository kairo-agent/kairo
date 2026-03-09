-- Fix: Change search_agent_knowledge from SECURITY INVOKER to SECURITY DEFINER
-- Root cause: RLS policies on agent_knowledge reference pm.project_id but the real
-- column is pm."projectId" (Prisma camelCase), causing silent failures.
-- All other agent_knowledge RPCs already use SECURITY DEFINER.
-- Also: lower default threshold from 0.7 to 0.35 for better recall.
-- Also: grant EXECUTE to anon (webhook context has no authenticated session).

DROP FUNCTION IF EXISTS search_agent_knowledge(text, text, text, integer, double precision);

CREATE OR REPLACE FUNCTION search_agent_knowledge(
  p_agent_id TEXT,
  p_project_id TEXT,
  p_query_embedding TEXT,
  p_match_count INT DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.35
)
RETURNS TABLE (id UUID, content TEXT, title VARCHAR(255), source VARCHAR(100), similarity FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION search_agent_knowledge TO authenticated, anon;
