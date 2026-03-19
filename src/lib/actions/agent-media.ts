'use server';

/**
 * Server Actions for Agent Media Management
 *
 * Provides CRUD operations for AI agent media (images, future: videos).
 * Media descriptions are embedded with pgvector for semantic search.
 * Files are stored in Supabase Storage.
 *
 * IMPORTANT: This file uses 'use server' - only export async functions.
 * Types are in src/lib/types/agent-media.ts (Rule 12).
 */

import { verifyAuth, verifyProjectAccess as verifyProjectAccessAuth } from '@/lib/actions/auth';
import { generateEmbedding, formatEmbeddingForPg } from '@/lib/openai/embeddings';
import { createClient } from '@/lib/supabase/server';
import { uploadMedia, deleteMedia } from '@/lib/actions/media';
import { MAX_MEDIA_ITEMS, MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from '@/lib/types/agent-media';

// ============================================
// CRUD Operations
// ============================================

/**
 * Adds a new media item to an agent's media library.
 * Uploads file to Supabase Storage, generates embedding, and stores in agent_media.
 */
export async function addAgentMedia(input: {
  agentId: string;
  projectId: string;
  title: string;
  description: string;
  file: File;
}): Promise<{ success: boolean; data?: { id: string; mediaUrl: string }; error?: string }> {
  try {
    const { agentId, projectId, title, description, file } = input;

    // Auth verification
    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const hasAccess = await verifyProjectAccessAuth(user.id, user.systemRole, projectId);
    if (!hasAccess) return { success: false, error: 'Sin permisos para este proyecto' };

    // Validate inputs
    if (!title || title.length > MAX_TITLE_LENGTH) {
      return { success: false, error: `El titulo debe tener entre 1 y ${MAX_TITLE_LENGTH} caracteres` };
    }
    if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
      return { success: false, error: `La descripcion debe tener entre 1 y ${MAX_DESCRIPTION_LENGTH} caracteres` };
    }

    // Check max items limit
    const supabase = await createClient();
    const { data: countData } = await supabase.rpc('count_agent_media', {
      p_agent_id: agentId,
      p_project_id: projectId,
    });
    const currentCount = countData?.[0]?.count ?? 0;
    if (currentCount >= MAX_MEDIA_ITEMS) {
      return { success: false, error: `Maximo ${MAX_MEDIA_ITEMS} items de media permitidos` };
    }

    // Upload file to Supabase Storage
    const uploadResult = await uploadMedia(projectId, file);
    if (!uploadResult.success || !uploadResult.url || !uploadResult.path) {
      return { success: false, error: uploadResult.error || 'Error al subir archivo' };
    }

    // Generate embedding from description
    const embedding = await generateEmbedding(
      `${title}. ${description}`,
      projectId
    );
    const embeddingStr = formatEmbeddingForPg(embedding);

    // Insert into agent_media via RPC
    const { data, error } = await supabase.rpc('insert_agent_media', {
      p_project_id: projectId,
      p_agent_id: agentId,
      p_title: title,
      p_description: description,
      p_media_url: uploadResult.url,
      p_storage_path: uploadResult.path,
      p_media_type: 'image',
      p_embedding: embeddingStr,
      p_created_by: user.id,
    });

    if (error) {
      console.error('[AgentMedia] Insert RPC error:', error);
      // Try to clean up uploaded file
      await deleteMedia(uploadResult.path).catch(() => {});
      return { success: false, error: 'Error al guardar en base de datos' };
    }

    const newId = data?.[0]?.id;
    return {
      success: true,
      data: { id: newId, mediaUrl: uploadResult.url },
    };
  } catch (error) {
    console.error('[AgentMedia] addAgentMedia error:', error);
    return { success: false, error: 'Error interno al agregar media' };
  }
}

/**
 * Lists all media items for an agent
 */
export async function listAgentMedia(
  agentId: string,
  projectId: string
): Promise<{ success: boolean; data?: Array<{
  id: string;
  title: string;
  description: string;
  mediaUrl: string;
  storagePath: string;
  mediaType: string;
  createdAt: string;
  updatedAt: string;
}>; error?: string }> {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const hasAccess = await verifyProjectAccessAuth(user.id, user.systemRole, projectId);
    if (!hasAccess) return { success: false, error: 'Sin permisos para este proyecto' };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('list_agent_media', {
      p_agent_id: agentId,
      p_project_id: projectId,
    });

    if (error) {
      console.error('[AgentMedia] List RPC error:', error);
      return { success: false, error: 'Error al listar media' };
    }

    const items = (data || []).map((row: {
      id: string;
      title: string;
      description: string;
      media_url: string;
      storage_path: string;
      media_type: string;
      created_at: string;
      updated_at: string;
    }) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      mediaUrl: row.media_url,
      storagePath: row.storage_path,
      mediaType: row.media_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { success: true, data: items };
  } catch (error) {
    console.error('[AgentMedia] listAgentMedia error:', error);
    return { success: false, error: 'Error interno al listar media' };
  }
}

/**
 * Deletes a media item and its file from storage
 */
export async function deleteAgentMedia(
  id: string,
  projectId: string,
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const hasAccess = await verifyProjectAccessAuth(user.id, user.systemRole, projectId);
    if (!hasAccess) return { success: false, error: 'Sin permisos para este proyecto' };

    const supabase = await createClient();

    // Delete from database
    const { error } = await supabase.rpc('delete_agent_media', {
      p_id: id,
      p_project_id: projectId,
    });

    if (error) {
      console.error('[AgentMedia] Delete RPC error:', error);
      return { success: false, error: 'Error al eliminar de base de datos' };
    }

    // Delete from storage (best-effort, don't fail if storage cleanup fails)
    if (storagePath) {
      await deleteMedia(storagePath).catch((err) => {
        console.error('[AgentMedia] Storage cleanup failed:', err);
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[AgentMedia] deleteAgentMedia error:', error);
    return { success: false, error: 'Error interno al eliminar media' };
  }
}
