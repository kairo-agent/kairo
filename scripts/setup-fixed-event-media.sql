-- ============================================
-- KAIRO - Fixed Event Media Migration
-- Run in Supabase SQL Editor
--
-- Adds event_type column to agent_media for fixed images per event:
-- 'first_contact', 'reengagement_0', 'reengagement_1', 'reengagement_2'
-- ============================================

-- 1. Add event_type column (nullable = regular RAG image)
ALTER TABLE agent_media ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) DEFAULT NULL;

-- 2. Unique constraint: only 1 image per event_type per agent
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_event_type_unique
  ON agent_media(agent_id, event_type)
  WHERE event_type IS NOT NULL;

-- 3. RPC: get fixed image for a specific event
CREATE OR REPLACE FUNCTION get_fixed_event_media(
  p_agent_id TEXT,
  p_project_id TEXT,
  p_event_type TEXT
) RETURNS TABLE (id UUID, title VARCHAR, media_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT am.id, am.title, am.media_url
  FROM agent_media am
  WHERE am.agent_id = p_agent_id
    AND am.project_id = p_project_id
    AND am.event_type = p_event_type
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION get_fixed_event_media TO authenticated;

-- 4. RPC: clear event_type from an image
CREATE OR REPLACE FUNCTION clear_event_media(
  p_agent_id TEXT,
  p_project_id TEXT,
  p_event_type TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE agent_media SET event_type = NULL
  WHERE agent_id = p_agent_id AND project_id = p_project_id AND event_type = p_event_type;
END;
$$;
GRANT EXECUTE ON FUNCTION clear_event_media TO authenticated;

-- 4b. RPC: assign event_type to a media item (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION set_event_media(
  p_agent_id TEXT,
  p_project_id TEXT,
  p_event_type TEXT,
  p_media_id UUID
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Clear any existing image with this event_type
  UPDATE agent_media SET event_type = NULL
  WHERE agent_id = p_agent_id AND project_id = p_project_id AND event_type = p_event_type;
  -- Assign event_type to the target image
  UPDATE agent_media SET event_type = p_event_type
  WHERE id = p_media_id AND agent_id = p_agent_id AND project_id = p_project_id;
END;
$$;
GRANT EXECUTE ON FUNCTION set_event_media TO authenticated;

-- 5. Update search_agent_media to EXCLUDE fixed images from RAG
CREATE OR REPLACE FUNCTION search_agent_media(
  p_agent_id TEXT, p_project_id TEXT, p_query_embedding TEXT,
  p_match_count INT DEFAULT 3, p_match_threshold FLOAT DEFAULT 0.40
) RETURNS TABLE (id UUID, title VARCHAR, description TEXT, media_url TEXT, similarity FLOAT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT am.id, am.title, am.description, am.media_url,
         (1 - (am.embedding <=> p_query_embedding::vector(1536)))::FLOAT AS similarity
  FROM agent_media am
  WHERE am.agent_id = p_agent_id
    AND am.project_id = p_project_id
    AND am.event_type IS NULL
    AND (1 - (am.embedding <=> p_query_embedding::vector(1536))) > p_match_threshold
  ORDER BY am.embedding <=> p_query_embedding::vector(1536)
  LIMIT p_match_count;
END;
$$;

-- 6. Update list_agent_media to EXCLUDE fixed images from gallery
CREATE OR REPLACE FUNCTION list_agent_media(p_agent_id TEXT, p_project_id TEXT)
RETURNS TABLE (id UUID, title VARCHAR, description TEXT, media_url TEXT, storage_path TEXT, media_type VARCHAR, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT am.id, am.title, am.description, am.media_url, am.storage_path, am.media_type, am.created_at, am.updated_at
  FROM agent_media am
  WHERE am.agent_id = p_agent_id AND am.project_id = p_project_id
    AND am.event_type IS NULL
  ORDER BY am.created_at DESC;
END;
$$;

-- Done! Fixed images are now separated from RAG images at the database level.
