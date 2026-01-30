-- Function to delete agent knowledge bypassing RLS
-- Run this in Supabase SQL Editor

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
  -- Get the entry info
  SELECT title, agent_id INTO v_title, v_agent_id
  FROM agent_knowledge
  WHERE id = p_id AND project_id = p_project_id;

  IF v_title IS NULL AND v_agent_id IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  -- If has title, delete all chunks with same title and agent
  IF v_title IS NOT NULL THEN
    DELETE FROM agent_knowledge
    WHERE title = v_title
      AND agent_id = v_agent_id
      AND project_id = p_project_id;
  ELSE
    -- Just delete this single entry
    DELETE FROM agent_knowledge WHERE id = p_id;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_agent_knowledge TO authenticated;
