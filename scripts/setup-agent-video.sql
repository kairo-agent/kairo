-- ============================================
-- KAIRO - Agent Video Support
-- Adds video support to the agent_media system
-- ============================================
--
-- Prerequisites: agent_media table already exists (setup-agent-media.sql + setup-fixed-event-media.sql)
--
-- Changes:
-- 1. New video-specific fixed event types: first_contact_video, reengagement_0_video, etc.
-- 2. New RPCs: list_agent_videos, count_agent_videos, search_agent_videos
-- 3. Updated unique constraint to support video event types
--
-- Run this in Supabase SQL Editor (NOT prisma migrate)
-- ============================================

-- ============================================
-- 1. RPC: List agent videos (media_type = 'video', no event_type)
-- ============================================

CREATE OR REPLACE FUNCTION list_agent_videos(
  p_agent_id TEXT,
  p_project_id TEXT
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(200),
  description TEXT,
  media_url TEXT,
  storage_path TEXT,
  media_type VARCHAR(20),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.title,
    am.description,
    am.media_url,
    am.storage_path,
    am.media_type,
    am.created_at,
    am.updated_at
  FROM agent_media am
  WHERE am.agent_id = p_agent_id
    AND am.project_id = p_project_id
    AND am.media_type = 'video'
    AND am.event_type IS NULL
  ORDER BY am.created_at DESC;
END;
$$;

-- ============================================
-- 2. RPC: Count agent videos (for limit check)
-- ============================================

CREATE OR REPLACE FUNCTION count_agent_videos(
  p_agent_id TEXT,
  p_project_id TEXT
)
RETURNS TABLE (count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT COUNT(*)::BIGINT
  FROM agent_media am
  WHERE am.agent_id = p_agent_id
    AND am.project_id = p_project_id
    AND am.media_type = 'video'
    AND am.event_type IS NULL;
END;
$$;

-- ============================================
-- 3. RPC: Search agent videos (semantic search, excludes fixed)
-- ============================================

CREATE OR REPLACE FUNCTION search_agent_videos(
  p_agent_id TEXT,
  p_project_id TEXT,
  p_query_embedding VECTOR(1536),
  p_match_count INT DEFAULT 2,
  p_match_threshold FLOAT DEFAULT 0.30
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(200),
  description TEXT,
  media_url TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.title,
    am.description,
    am.media_url,
    (1 - (am.embedding <=> p_query_embedding))::FLOAT AS similarity
  FROM agent_media am
  WHERE am.agent_id = p_agent_id
    AND am.project_id = p_project_id
    AND am.media_type = 'video'
    AND am.event_type IS NULL
    AND (1 - (am.embedding <=> p_query_embedding)) > p_match_threshold
  ORDER BY am.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- ============================================
-- 4. RPC: Get fixed event media for video
--    Reuses get_fixed_event_media since event_type column handles both
--    Video event types: first_contact_video, reengagement_0_video, etc.
-- ============================================
-- No new RPC needed - get_fixed_event_media already works with any event_type string.
-- We just use new event_type values: 'first_contact_video', 'reengagement_0_video', etc.

-- ============================================
-- 5. Verify: The unique constraint on (agent_id, event_type) WHERE event_type IS NOT NULL
--    already supports new video event types since they are different strings.
-- ============================================

-- Done! The existing insert_agent_media, update_agent_media, delete_agent_media,
-- set_event_media, clear_event_media, and get_fixed_event_media RPCs
-- all work with video media_type and video event_types without modification.
