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
import type { MediaSearchResult } from '@/lib/types/agent-media';

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

/**
 * Returns the cached media count, or null if not cached.
 * Used by pipeline to decide between inject-all vs semantic search.
 */
export function getCachedMediaCount(agentId: string, projectId: string): number | null {
  const cached = mediaCountCache.get(`${agentId}:${projectId}`);
  if (cached && (Date.now() - cached.timestamp) < MEDIA_CACHE_TTL) {
    return cached.count;
  }
  return null;
}

// ============================================
// Constants
// ============================================

// When an agent has <= this many images, inject ALL into the prompt
// so GPT always sees them (no semantic search needed).
// Above this threshold, use semantic search to filter relevant ones.
const INJECT_ALL_THRESHOLD = 10;

// ============================================
// Get All Media (for small catalogs)
// ============================================

/**
 * Returns all media items for an agent (no semantic filtering).
 * Used when agent has <= INJECT_ALL_THRESHOLD images.
 */
export async function getAllAgentMedia(
  agentId: string,
  projectId: string
): Promise<MediaSearchResult[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('list_agent_media', {
      p_agent_id: agentId,
      p_project_id: projectId,
    });

    if (error) {
      console.error('[MediaSearch] list_agent_media RPC error:', error);
      return [];
    }

    return (data || []).map((row: {
      id: string;
      title: string;
      description: string;
      media_url: string;
    }) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      mediaUrl: row.media_url,
      similarity: 1, // All injected, no filtering
    }));
  } catch (error) {
    console.error('[MediaSearch] getAllAgentMedia error:', error);
    return [];
  }
}

// ============================================
// Semantic Search (for large catalogs)
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
      p_match_threshold: 0.35,
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

export { INJECT_ALL_THRESHOLD };
