-- RPC to delete structured knowledge by category (bypasses RLS)
CREATE OR REPLACE FUNCTION delete_structured_knowledge(
  p_agent_id TEXT,
  p_project_id TEXT,
  p_category VARCHAR(50)
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM agent_knowledge
  WHERE agent_id = p_agent_id
    AND project_id = p_project_id
    AND category = p_category
    AND category != 'free_text';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_structured_knowledge TO authenticated;
