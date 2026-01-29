-- Function to insert agent knowledge with pgvector embedding
-- Run this in Supabase SQL Editor after Phase 1 setup

CREATE OR REPLACE FUNCTION insert_agent_knowledge(
  p_project_id TEXT,
  p_agent_id TEXT,
  p_title TEXT,
  p_content TEXT,
  p_source VARCHAR(100),
  p_source_url TEXT,
  p_metadata JSONB,
  p_chunk_index INT,
  p_embedding TEXT,  -- Passed as string '[0.1,0.2,...]'
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
    p_embedding::vector(1536),  -- Cast string to vector
    p_created_by,
    NOW(),
    NOW()
  )
  RETURNING agent_knowledge.id INTO new_id;

  RETURN QUERY SELECT new_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION insert_agent_knowledge TO authenticated;

-- RLS Policy: Users can only insert knowledge for projects they have access to
-- This is enforced at the application level since the function is SECURITY DEFINER

-- Add policy for select (reading knowledge)
CREATE POLICY "Users can read knowledge from their projects"
  ON agent_knowledge
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT pm.project_id
      FROM project_members pm
      WHERE pm.user_id = auth.uid()::text
    )
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::text
      AND u."systemRole" = 'super_admin'
    )
  );

-- Add policy for delete
CREATE POLICY "Users can delete knowledge from their projects"
  ON agent_knowledge
  FOR DELETE
  TO authenticated
  USING (
    project_id IN (
      SELECT pm.project_id
      FROM project_members pm
      WHERE pm.user_id = auth.uid()::text
      AND pm.role IN ('admin', 'manager')
    )
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::text
      AND u."systemRole" = 'super_admin'
    )
  );
