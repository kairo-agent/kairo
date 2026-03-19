/**
 * KAIRO - Agent Media Semantic Search
 *
 * Searches for relevant media (images) based on conversation context
 * using pgvector semantic search on media descriptions.
 *
 * Includes a feature flag cache to avoid unnecessary embedding calls
 * for projects that have no media configured.
 */

import { generateEmbedding, formatEmbeddingForPg } from '@/lib/openai/embeddings';
import { createClient } from '@/lib/supabase/server';
import type { MediaSearchResult, FixedEventType, FixedEventMedia } from '@/lib/types/agent-media';

// ============================================
// Feature Flag Cache (5 min TTL)
// ============================================

interface CachedCount {
  count: number;
  timestamp: number;
}

const MEDIA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const mediaCountCache = new Map<string, CachedCount>();

/**
 * Checks if a project/agent has any media configured.
 * Uses in-memory cache to avoid DB calls on every message.
 */
export async function projectHasMedia(
  agentId: string,
  projectId: string
): Promise<boolean> {
  const cacheKey = `${agentId}:${projectId}`;
  const cached = mediaCountCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < MEDIA_CACHE_TTL) {
    return cached.count > 0;
  }

  // Cleanup expired entries
  if (mediaCountCache.size > 50) {
    const now = Date.now();
    for (const [k, v] of mediaCountCache.entries()) {
      if (now - v.timestamp > MEDIA_CACHE_TTL) mediaCountCache.delete(k);
    }
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('count_agent_media', {
      p_agent_id: agentId,
      p_project_id: projectId,
    });

    if (error) {
      console.error('[MediaSearch] count_agent_media RPC error:', error);
      return false;
    }

    const count = data?.[0]?.count ?? 0;
    mediaCountCache.set(cacheKey, { count, timestamp: Date.now() });
    return count > 0;
  } catch (error) {
    console.error('[MediaSearch] projectHasMedia error:', error);
    return false;
  }
}

/**
 * Invalidates the media count cache for a specific agent/project.
 * Call this after adding or deleting media.
 */
export function invalidateMediaCache(agentId: string, projectId: string): void {
  mediaCountCache.delete(`${agentId}:${projectId}`);
}

// ============================================
// Semantic Search
// ============================================

/**
 * Searches for relevant media based on a text query.
 * Returns up to 3 media items sorted by relevance (cosine similarity).
 */
export async function searchRelevantMedia(
  agentId: string,
  projectId: string,
  query: string
): Promise<MediaSearchResult[]> {
  try {
    const queryEmbedding = await generateEmbedding(query, projectId);
    const embeddingStr = formatEmbeddingForPg(queryEmbedding);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('search_agent_media', {
      p_agent_id: agentId,
      p_project_id: projectId,
      p_query_embedding: embeddingStr,
      p_match_count: 3,
      p_match_threshold: 0.30,
    });

    if (error) {
      console.error('[MediaSearch] search_agent_media RPC error:', error);
      return [];
    }

    return (data || []).map((row: {
      id: string;
      title: string;
      description: string;
      media_url: string;
      similarity: number;
    }) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      mediaUrl: row.media_url,
      similarity: row.similarity,
    }));
  } catch (error) {
    console.error('[MediaSearch] searchRelevantMedia error:', error);
    return [];
  }
}

// ============================================
// Fixed Event Media (always sent, no RAG)
// ============================================

/**
 * Gets the fixed image configured for a specific event type.
 * Returns null if no image is configured for that event.
 */
export async function getFixedMediaForEvent(
  agentId: string,
  projectId: string,
  eventType: FixedEventType
): Promise<FixedEventMedia | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_fixed_event_media', {
      p_agent_id: agentId,
      p_project_id: projectId,
      p_event_type: eventType,
    });

    if (error) {
      console.error('[MediaSearch] get_fixed_event_media RPC error:', error);
      return null;
    }

    const row = data?.[0];
    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      mediaUrl: row.media_url,
    };
  } catch (error) {
    console.error('[MediaSearch] getFixedMediaForEvent error:', error);
    return null;
  }
}

