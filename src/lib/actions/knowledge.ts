'use server';

/**
 * Server Actions for Agent Knowledge (RAG) Management
 *
 * Provides CRUD operations for AI agent knowledge base.
 * Handles text chunking, embedding generation, and semantic search.
 *
 * @see docs/RAG-AGENTS.md for architecture details
 */

import { prisma } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import {
  generateEmbedding,
  generateEmbeddings,
  formatEmbeddingForPg,
} from '@/lib/openai/embeddings';
import { chunkText, prepareTextForEmbedding } from '@/lib/utils/chunking';
import { createClient } from '@/lib/supabase/server';

// ============================================
// Types
// ============================================

export interface KnowledgeEntry {
  id: string;
  title: string | null;
  content: string;
  source: string;
  sourceUrl: string | null;
  chunkIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddKnowledgeInput {
  agentId: string;
  projectId: string;
  title?: string;
  content: string;
  source?: 'manual' | 'file' | 'url' | 'api';
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchKnowledgeInput {
  agentId: string;
  projectId: string;
  query: string;
  limit?: number;
  threshold?: number;
}

export interface SearchResult {
  id: string;
  content: string;
  title: string | null;
  source: string;
  similarity: number;
}

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// Knowledge Management Actions
// ============================================

/**
 * Adds knowledge to an AI agent's knowledge base
 *
 * Process:
 * 1. Validates user has access to the project
 * 2. Chunks the content if it's too long
 * 3. Generates embeddings for each chunk
 * 4. Stores chunks with embeddings in agent_knowledge table
 *
 * @param input - Knowledge entry data
 * @returns Created entry IDs
 */
export async function addAgentKnowledge(
  input: AddKnowledgeInput
): Promise<ActionResult<{ ids: string[]; chunksCreated: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const { agentId, projectId, title, content, source = 'manual', sourceUrl, metadata = {} } = input;

    // Verify user has access to this project
    const hasAccess = await verifyProjectAccess(user.id, projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin permisos para este proyecto' };
    }

    // Verify agent belongs to this project
    const agent = await prisma.aIAgent.findFirst({
      where: { id: agentId, projectId },
    });
    if (!agent) {
      return { success: false, error: 'Agente no encontrado en este proyecto' };
    }

    // Prepare and chunk the content
    const preparedContent = prepareTextForEmbedding(content);
    const chunks = chunkText(preparedContent, {
      maxChunkSize: 1000,
      overlap: 200,
    });

    if (chunks.length === 0) {
      return { success: false, error: 'El contenido es muy corto o vacío' };
    }

    // Generate embeddings for all chunks in batch
    const embeddings = await generateEmbeddings(
      chunks.map((c) => c.text),
      projectId
    );

    // Create Supabase client for raw SQL (Prisma doesn't support pgvector)
    const supabase = await createClient();

    const createdIds: string[] = [];

    // Insert each chunk with its embedding
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const embeddingStr = formatEmbeddingForPg(embedding);

      // Use raw SQL for pgvector insertion
      const { data, error } = await supabase.rpc('insert_agent_knowledge', {
        p_project_id: projectId,
        p_agent_id: agentId,
        p_title: title || null,
        p_content: chunk.text,
        p_source: source,
        p_source_url: sourceUrl || null,
        p_metadata: metadata,
        p_chunk_index: chunk.index,
        p_embedding: embeddingStr,
        p_created_by: user.id,
      });

      if (error) {
        console.error('Failed to insert knowledge chunk:', error);
        // If first chunk fails, return the specific error
        if (i === 0) {
          return {
            success: false,
            error: `Error en Supabase: ${error.message || error.code || JSON.stringify(error)}`
          };
        }
        // Continue with other chunks if not the first one
        continue;
      }

      // RPC returns TABLE, so data is an array
      const resultId = Array.isArray(data) ? data[0]?.id : data?.id;
      if (resultId) {
        createdIds.push(resultId);
      }
    }

    if (createdIds.length === 0) {
      return { success: false, error: 'No se pudo guardar el conocimiento - revisa los logs' };
    }

    return {
      success: true,
      data: {
        ids: createdIds,
        chunksCreated: createdIds.length,
      },
    };
  } catch (error) {
    console.error('Failed to add agent knowledge:', error);
    if (error instanceof Error) {
      // Check for specific OpenAI errors
      if (error.message.includes('API key')) {
        return { success: false, error: 'API key de OpenAI inválida o no configurada' };
      }
      if (error.message.includes('insufficient_quota')) {
        return { success: false, error: 'Sin créditos en tu cuenta de OpenAI' };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Error interno desconocido' };
  }
}

/**
 * Deletes a knowledge entry
 * If the entry has multiple chunks, deletes all related chunks
 *
 * @param id - Knowledge entry ID
 * @param projectId - Project ID for access verification
 */
export async function deleteAgentKnowledge(
  id: string,
  projectId: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin permisos para este proyecto' };
    }

    const supabase = await createClient();

    // Get the entry to find its title (to delete related chunks)
    const { data: entry } = await supabase
      .from('agent_knowledge')
      .select('title, agent_id')
      .eq('id', id)
      .eq('project_id', projectId)
      .single();

    if (!entry) {
      return { success: false, error: 'Entrada no encontrada' };
    }

    // If has title, delete all chunks with same title and agent
    if (entry.title) {
      await supabase
        .from('agent_knowledge')
        .delete()
        .eq('title', entry.title)
        .eq('agent_id', entry.agent_id)
        .eq('project_id', projectId);
    } else {
      // Just delete this single entry
      await supabase.from('agent_knowledge').delete().eq('id', id);
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to delete agent knowledge:', error);
    return { success: false, error: 'Error interno al eliminar' };
  }
}

/**
 * Lists all knowledge entries for an agent
 * Groups chunks by title when possible
 *
 * @param agentId - Agent ID
 * @param projectId - Project ID
 */
export async function listAgentKnowledge(
  agentId: string,
  projectId: string
): Promise<ActionResult<KnowledgeEntry[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin permisos para este proyecto' };
    }

    const supabase = await createClient();

    // Get entries, grouped by title (chunk_index = 0 represents the "main" entry)
    const { data, error } = await supabase
      .from('agent_knowledge')
      .select('id, title, content, source, source_url, chunk_index, created_at, updated_at')
      .eq('agent_id', agentId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to list knowledge:', error);
      return { success: false, error: 'Error al obtener conocimiento' };
    }

    // Group by title and only return the first chunk as representative
    const seenTitles = new Set<string>();
    const entries: KnowledgeEntry[] = [];

    for (const row of data || []) {
      const titleKey = row.title || row.id;

      if (!seenTitles.has(titleKey)) {
        seenTitles.add(titleKey);
        entries.push({
          id: row.id,
          title: row.title,
          content: row.content,
          source: row.source,
          sourceUrl: row.source_url,
          chunkIndex: row.chunk_index,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        });
      }
    }

    return { success: true, data: entries };
  } catch (error) {
    console.error('Failed to list agent knowledge:', error);
    return { success: false, error: 'Error interno' };
  }
}

/**
 * Searches agent knowledge using semantic similarity
 *
 * @param input - Search parameters
 * @returns Matching entries sorted by similarity
 */
export async function searchAgentKnowledge(
  input: SearchKnowledgeInput
): Promise<ActionResult<SearchResult[]>> {
  try {
    const { agentId, projectId, query, limit = 5, threshold = 0.7 } = input;

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query, projectId);
    const embeddingStr = formatEmbeddingForPg(queryEmbedding);

    const supabase = await createClient();

    // Use the search function we created in Phase 1
    const { data, error } = await supabase.rpc('search_agent_knowledge', {
      p_agent_id: agentId,
      p_project_id: projectId,
      p_query_embedding: embeddingStr,
      p_match_count: limit,
      p_match_threshold: threshold,
    });

    if (error) {
      console.error('Search failed:', error);
      return { success: false, error: 'Error en la búsqueda' };
    }

    const results: SearchResult[] = (data || []).map(
      (row: { id: string; content: string; title: string | null; source: string; similarity: number }) => ({
        id: row.id,
        content: row.content,
        title: row.title,
        source: row.source,
        similarity: row.similarity,
      })
    );

    return { success: true, data: results };
  } catch (error) {
    console.error('Failed to search knowledge:', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return { success: false, error: message };
  }
}

/**
 * Gets statistics about an agent's knowledge base
 */
export async function getAgentKnowledgeStats(
  agentId: string,
  projectId: string
): Promise<ActionResult<{ totalEntries: number; totalChunks: number; sources: Record<string, number> }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin permisos' };
    }

    const supabase = await createClient();

    // Get all entries
    const { data, error } = await supabase
      .from('agent_knowledge')
      .select('title, source')
      .eq('agent_id', agentId)
      .eq('project_id', projectId);

    if (error) {
      return { success: false, error: 'Error al obtener estadísticas' };
    }

    const entries = data || [];
    const uniqueTitles = new Set(entries.map((e) => e.title || e.source));
    const sources: Record<string, number> = {};

    for (const entry of entries) {
      sources[entry.source] = (sources[entry.source] || 0) + 1;
    }

    return {
      success: true,
      data: {
        totalEntries: uniqueTitles.size,
        totalChunks: entries.length,
        sources,
      },
    };
  } catch (error) {
    console.error('Failed to get knowledge stats:', error);
    return { success: false, error: 'Error interno' };
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Verifies if user has access to a project (any role)
 */
async function verifyProjectAccess(userId: string, projectId: string): Promise<boolean> {
  // Check if super admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  });

  if (user?.systemRole === 'super_admin') {
    return true;
  }

  // Check project membership
  const membership = await prisma.projectMember.findFirst({
    where: { userId, projectId },
  });

  return !!membership;
}
