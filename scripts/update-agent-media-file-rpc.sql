-- RPC: update_agent_media_file
-- Updates title, description, embedding AND media_url/storage_path when file is replaced.
-- Used by the edit flow when user changes the image/video file.
-- SECURITY DEFINER to bypass RLS (same pattern as other agent_media RPCs).
-- NOTE: Uses TEXT for id/project_id (KAIRO uses CUIDs, not UUIDs).

-- Drop old UUID version if it exists
DROP FUNCTION IF EXISTS update_agent_media_file(UUID, UUID, TEXT, TEXT, vector, TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_agent_media_file(
  p_id TEXT,
  p_project_id TEXT,
  p_title TEXT,
  p_description TEXT,
  p_embedding vector(1536),
  p_media_url TEXT,
  p_storage_path TEXT
)
RETURNS TABLE(old_storage_path TEXT) AS $$
DECLARE
  v_old_path TEXT;
BEGIN
  -- Get old storage path before updating (caller needs it to delete old file)
  SELECT storage_path INTO v_old_path
  FROM agent_media
  WHERE id = p_id AND project_id = p_project_id;

  -- Update the record
  UPDATE agent_media
  SET
    title = p_title,
    description = p_description,
    embedding = p_embedding,
    media_url = p_media_url,
    storage_path = p_storage_path,
    updated_at = NOW()
  WHERE id = p_id AND project_id = p_project_id;

  RETURN QUERY SELECT v_old_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
