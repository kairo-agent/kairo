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
import { MAX_MEDIA_ITEMS, MAX_VIDEO_ITEMS, MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from '@/lib/types/agent-media';
import type { FixedEventType, FixedEventMedia } from '@/lib/types/agent-media';
import { invalidateMediaCache } from '@/lib/ai/search-media';

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
  mediaType: 'image' | 'video';
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
      mediaType: (row.media_type || 'image') as 'image' | 'video',
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
 * Updates a media item's title and description (re-generates embedding)
 */
export async function updateAgentMedia(input: {
  id: string;
  projectId: string;
  title: string;
  description: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { id, projectId, title, description } = input;

    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const hasAccess = await verifyProjectAccessAuth(user.id, user.systemRole, projectId);
    if (!hasAccess) return { success: false, error: 'Sin permisos para este proyecto' };

    if (!title || title.length > MAX_TITLE_LENGTH) {
      return { success: false, error: `El titulo debe tener entre 1 y ${MAX_TITLE_LENGTH} caracteres` };
    }
    if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
      return { success: false, error: `La descripcion debe tener entre 1 y ${MAX_DESCRIPTION_LENGTH} caracteres` };
    }

    // Re-generate embedding with updated text
    const embedding = await generateEmbedding(`${title}. ${description}`, projectId);
    const embeddingStr = formatEmbeddingForPg(embedding);

    const supabase = await createClient();
    const { error } = await supabase.rpc('update_agent_media', {
      p_id: id,
      p_project_id: projectId,
      p_title: title,
      p_description: description,
      p_embedding: embeddingStr,
    });

    if (error) {
      console.error('[AgentMedia] Update RPC error:', error);
      return { success: false, error: 'Error al actualizar en base de datos' };
    }

    return { success: true };
  } catch (error) {
    console.error('[AgentMedia] updateAgentMedia error:', error);
    return { success: false, error: 'Error interno al actualizar media' };
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

// ============================================
// Video CRUD Operations
// ============================================

/**
 * Adds a new video to an agent's media library.
 * No client-side compression - validates MP4 format and 16MB size limit.
 */
export async function addAgentVideo(input: {
  agentId: string;
  projectId: string;
  title: string;
  description: string;
  file: File;
}): Promise<{ success: boolean; data?: { id: string; mediaUrl: string }; error?: string }> {
  try {
    const { agentId, projectId, title, description, file } = input;

    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const hasAccess = await verifyProjectAccessAuth(user.id, user.systemRole, projectId);
    if (!hasAccess) return { success: false, error: 'Sin permisos para este proyecto' };

    if (!title || title.length > MAX_TITLE_LENGTH) {
      return { success: false, error: `El titulo debe tener entre 1 y ${MAX_TITLE_LENGTH} caracteres` };
    }
    if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
      return { success: false, error: `La descripcion debe tener entre 1 y ${MAX_DESCRIPTION_LENGTH} caracteres` };
    }

    // Validate video type
    if (file.type !== 'video/mp4') {
      return { success: false, error: 'Solo se aceptan videos en formato MP4' };
    }

    // Check max video items limit
    const supabase = await createClient();
    const { data: countData } = await supabase.rpc('count_agent_videos', {
      p_agent_id: agentId,
      p_project_id: projectId,
    });
    const currentCount = countData?.[0]?.count ?? 0;
    if (currentCount >= MAX_VIDEO_ITEMS) {
      return { success: false, error: `Maximo ${MAX_VIDEO_ITEMS} videos permitidos` };
    }

    // Upload file to Supabase Storage
    const uploadResult = await uploadMedia(projectId, file);
    if (!uploadResult.success || !uploadResult.url || !uploadResult.path) {
      return { success: false, error: uploadResult.error || 'Error al subir video' };
    }

    // Generate embedding from description
    const embedding = await generateEmbedding(`${title}. ${description}`, projectId);
    const embeddingStr = formatEmbeddingForPg(embedding);

    // Insert into agent_media via RPC (same table, media_type = 'video')
    const { data, error } = await supabase.rpc('insert_agent_media', {
      p_project_id: projectId,
      p_agent_id: agentId,
      p_title: title,
      p_description: description,
      p_media_url: uploadResult.url,
      p_storage_path: uploadResult.path,
      p_media_type: 'video',
      p_embedding: embeddingStr,
      p_created_by: user.id,
    });

    if (error) {
      console.error('[AgentMedia] Insert video RPC error:', error);
      await deleteMedia(uploadResult.path).catch(() => {});
      return { success: false, error: 'Error al guardar en base de datos' };
    }

    const newId = data?.[0]?.id;
    invalidateMediaCache(agentId, projectId);

    return {
      success: true,
      data: { id: newId, mediaUrl: uploadResult.url },
    };
  } catch (error) {
    console.error('[AgentMedia] addAgentVideo error:', error);
    return { success: false, error: 'Error interno al agregar video' };
  }
}

/**
 * Adds a video to an agent's library using a pre-uploaded URL.
 * The video file is uploaded client-side directly to Supabase Storage
 * to bypass Vercel's 4.5MB serverless function payload limit.
 */
export async function addAgentVideoByUrl(input: {
  agentId: string;
  projectId: string;
  title: string;
  description: string;
  mediaUrl: string;
  storagePath: string;
}): Promise<{ success: boolean; data?: { id: string; mediaUrl: string }; error?: string }> {
  try {
    const { agentId, projectId, title, description, mediaUrl, storagePath } = input;

    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const hasAccess = await verifyProjectAccessAuth(user.id, user.systemRole, projectId);
    if (!hasAccess) return { success: false, error: 'Sin permisos para este proyecto' };

    if (!title || title.length > MAX_TITLE_LENGTH) {
      return { success: false, error: `El titulo debe tener entre 1 y ${MAX_TITLE_LENGTH} caracteres` };
    }
    if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
      return { success: false, error: `La descripcion debe tener entre 1 y ${MAX_DESCRIPTION_LENGTH} caracteres` };
    }
    if (!mediaUrl || !storagePath) {
      return { success: false, error: 'URL y path del video son requeridos' };
    }

    // Check max video items limit
    const supabase = await createClient();
    const { data: countData } = await supabase.rpc('count_agent_videos', {
      p_agent_id: agentId,
      p_project_id: projectId,
    });
    const currentCount = countData?.[0]?.count ?? 0;
    if (currentCount >= MAX_VIDEO_ITEMS) {
      return { success: false, error: `Maximo ${MAX_VIDEO_ITEMS} videos permitidos` };
    }

    // Generate embedding from description
    const embedding = await generateEmbedding(`${title}. ${description}`, projectId);
    const embeddingStr = formatEmbeddingForPg(embedding);

    // Insert into agent_media via RPC
    const { data, error } = await supabase.rpc('insert_agent_media', {
      p_project_id: projectId,
      p_agent_id: agentId,
      p_title: title,
      p_description: description,
      p_media_url: mediaUrl,
      p_storage_path: storagePath,
      p_media_type: 'video',
      p_embedding: embeddingStr,
      p_created_by: user.id,
    });

    if (error) {
      console.error('[AgentMedia] Insert video by URL RPC error:', error);
      await deleteMedia(storagePath).catch(() => {});
      return { success: false, error: 'Error al guardar en base de datos' };
    }

    const newId = data?.[0]?.id;
    invalidateMediaCache(agentId, projectId);

    return {
      success: true,
      data: { id: newId, mediaUrl },
    };
  } catch (error) {
    console.error('[AgentMedia] addAgentVideoByUrl error:', error);
    return { success: false, error: 'Error interno al agregar video' };
  }
}

/**
 * Registers a fixed event video using a pre-uploaded URL.
 * The video file is uploaded client-side directly to Supabase Storage
 * to bypass Vercel's 4.5MB serverless function payload limit.
 */
export async function uploadFixedEventVideoByUrl(input: {
  agentId: string;
  projectId: string;
  eventType: FixedEventType;
  title: string;
  description: string;
  mediaUrl: string;
  storagePath: string;
}): Promise<{ success: boolean; data?: FixedEventMedia; error?: string }> {
  try {
    const { agentId, projectId, eventType, title, description, mediaUrl, storagePath } = input;

    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const hasAccess = await verifyProjectAccessAuth(user.id, user.systemRole, projectId);
    if (!hasAccess) return { success: false, error: 'Sin permisos para este proyecto' };

    if (!title || title.length > MAX_TITLE_LENGTH) {
      return { success: false, error: `El titulo debe tener entre 1 y ${MAX_TITLE_LENGTH} caracteres` };
    }
    if (!mediaUrl || !storagePath) {
      return { success: false, error: 'URL y path del video son requeridos' };
    }

    const supabase = await createClient();

    // Delete existing fixed media for this event (if any)
    const { data: existing } = await supabase.rpc('get_fixed_event_media', {
      p_agent_id: agentId,
      p_project_id: projectId,
      p_event_type: eventType,
    });
    if (existing?.[0]?.id) {
      await supabase.rpc('clear_event_media', {
        p_agent_id: agentId,
        p_project_id: projectId,
        p_event_type: eventType,
      });
    }

    // Generate embedding
    const descForEmbedding = description || title;
    const embedding = await generateEmbedding(`${title}. ${descForEmbedding}`, projectId);
    const embeddingStr = formatEmbeddingForPg(embedding);

    // Insert with media_type = 'video'
    const { data, error } = await supabase.rpc('insert_agent_media', {
      p_project_id: projectId,
      p_agent_id: agentId,
      p_title: title,
      p_description: descForEmbedding,
      p_media_url: mediaUrl,
      p_storage_path: storagePath,
      p_media_type: 'video',
      p_embedding: embeddingStr,
      p_created_by: user.id,
    });

    if (error) {
      console.error('[AgentMedia] Insert fixed video by URL RPC error:', error);
      await deleteMedia(storagePath).catch(() => {});
      return { success: false, error: 'Error al guardar en base de datos' };
    }

    const newId = data?.[0]?.id;

    // Set event_type on the new record
    if (newId) {
      await supabase.rpc('clear_event_media', {
        p_agent_id: agentId,
        p_project_id: projectId,
        p_event_type: eventType,
      });
      const { error: setError } = await supabase.rpc('set_event_media', {
        p_agent_id: agentId,
        p_project_id: projectId,
        p_event_type: eventType,
        p_media_id: newId,
      });

      if (setError) {
        console.error('[AgentMedia] Set event_type error:', setError);
      }
    }

    invalidateMediaCache(agentId, projectId);

    return {
      success: true,
      data: { id: newId, title, mediaUrl },
    };
  } catch (error) {
    console.error('[AgentMedia] uploadFixedEventVideoByUrl error:', error);
    return { success: false, error: 'Error interno al subir video fijo' };
  }
}

/**
 * Lists all video items for an agent (excludes fixed event videos)
 */
export async function listAgentVideos(
  agentId: string,
  projectId: string
): Promise<{ success: boolean; data?: Array<{
  id: string;
  title: string;
  description: string;
  mediaUrl: string;
  storagePath: string;
  mediaType: 'image' | 'video';
  createdAt: string;
  updatedAt: string;
}>; error?: string }> {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const hasAccess = await verifyProjectAccessAuth(user.id, user.systemRole, projectId);
    if (!hasAccess) return { success: false, error: 'Sin permisos para este proyecto' };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('list_agent_videos', {
      p_agent_id: agentId,
      p_project_id: projectId,
    });

    if (error) {
      console.error('[AgentMedia] List videos RPC error:', error);
      return { success: false, error: 'Error al listar videos' };
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
      mediaType: (row.media_type || 'video') as 'image' | 'video',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { success: true, data: items };
  } catch (error) {
    console.error('[AgentMedia] listAgentVideos error:', error);
    return { success: false, error: 'Error interno al listar videos' };
  }
}

// ============================================
// Fixed Event Media (images/videos tied to specific events)
// ============================================

/**
 * Gets the fixed image configured for a specific event type.
 */
export async function getFixedEventMedia(
  agentId: string,
  projectId: string,
  eventType: FixedEventType
): Promise<{ success: boolean; data?: FixedEventMedia | null; error?: string }> {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_fixed_event_media', {
      p_agent_id: agentId,
      p_project_id: projectId,
      p_event_type: eventType,
    });

    if (error) {
      console.error('[AgentMedia] get_fixed_event_media RPC error:', error);
      return { success: false, error: 'Error al obtener imagen fija' };
    }

    const row = data?.[0];
    if (!row) return { success: true, data: null };

    return {
      success: true,
      data: { id: row.id, title: row.title, mediaUrl: row.media_url, mediaType: row.media_type || 'image' },
    };
  } catch (error) {
    console.error('[AgentMedia] getFixedEventMedia error:', error);
    return { success: false, error: 'Error interno' };
  }
}

/**
 * Uploads a new fixed media (image or video) for a specific event type.
 * If media already exists for this event, it's replaced.
 * Video event types end with '_video' (e.g., 'first_contact_video').
 */
export async function uploadFixedEventMedia(input: {
  agentId: string;
  projectId: string;
  eventType: FixedEventType;
  title: string;
  description: string;
  file: File;
}): Promise<{ success: boolean; data?: FixedEventMedia; error?: string }> {
  try {
    const { agentId, projectId, eventType, title, description, file } = input;

    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const hasAccess = await verifyProjectAccessAuth(user.id, user.systemRole, projectId);
    if (!hasAccess) return { success: false, error: 'Sin permisos para este proyecto' };

    if (!title || title.length > MAX_TITLE_LENGTH) {
      return { success: false, error: `El titulo debe tener entre 1 y ${MAX_TITLE_LENGTH} caracteres` };
    }

    // Determine media type from event type
    const isVideoEvent = eventType.endsWith('_video');
    const mediaType = isVideoEvent ? 'video' : 'image';

    // Validate file type matches event type
    if (isVideoEvent && file.type !== 'video/mp4') {
      return { success: false, error: 'Solo se aceptan videos en formato MP4' };
    }
    if (!isVideoEvent && !file.type.startsWith('image/')) {
      return { success: false, error: 'Solo se aceptan imagenes (JPG, PNG, WebP)' };
    }

    const supabase = await createClient();

    // Delete existing fixed media for this event (if any)
    const { data: existing } = await supabase.rpc('get_fixed_event_media', {
      p_agent_id: agentId,
      p_project_id: projectId,
      p_event_type: eventType,
    });
    if (existing?.[0]?.id) {
      await supabase.rpc('clear_event_media', {
        p_agent_id: agentId,
        p_project_id: projectId,
        p_event_type: eventType,
      });
    }

    // Upload file
    const uploadResult = await uploadMedia(projectId, file);
    if (!uploadResult.success || !uploadResult.url || !uploadResult.path) {
      return { success: false, error: uploadResult.error || 'Error al subir archivo' };
    }

    // Generate embedding
    const descForEmbedding = description || title;
    const embedding = await generateEmbedding(`${title}. ${descForEmbedding}`, projectId);
    const embeddingStr = formatEmbeddingForPg(embedding);

    // Insert with event_type
    const { data, error } = await supabase.rpc('insert_agent_media', {
      p_project_id: projectId,
      p_agent_id: agentId,
      p_title: title,
      p_description: descForEmbedding,
      p_media_url: uploadResult.url,
      p_storage_path: uploadResult.path,
      p_media_type: mediaType,
      p_embedding: embeddingStr,
      p_created_by: user.id,
    });

    if (error) {
      console.error('[AgentMedia] Insert fixed media RPC error:', error);
      await deleteMedia(uploadResult.path).catch(() => {});
      return { success: false, error: 'Error al guardar en base de datos' };
    }

    const newId = data?.[0]?.id;

    // Set event_type on the new record via SECURITY DEFINER RPC (RLS-safe)
    if (newId) {
      await supabase.rpc('clear_event_media', {
        p_agent_id: agentId,
        p_project_id: projectId,
        p_event_type: eventType,
      });
      const { error: setError } = await supabase.rpc('set_event_media', {
        p_agent_id: agentId,
        p_project_id: projectId,
        p_event_type: eventType,
        p_media_id: newId,
      });

      if (setError) {
        console.error('[AgentMedia] Set event_type error:', setError);
      }
    }

    invalidateMediaCache(agentId, projectId);

    return {
      success: true,
      data: { id: newId, title, mediaUrl: uploadResult.url },
    };
  } catch (error) {
    console.error('[AgentMedia] uploadFixedEventMedia error:', error);
    return { success: false, error: 'Error interno al subir imagen fija' };
  }
}

/**
 * Removes the fixed image for a specific event type.
 * Deletes the media record and storage file.
 */
export async function deleteFixedEventMedia(
  agentId: string,
  projectId: string,
  eventType: FixedEventType
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, error: 'No autorizado' };

    const hasAccess = await verifyProjectAccessAuth(user.id, user.systemRole, projectId);
    if (!hasAccess) return { success: false, error: 'Sin permisos para este proyecto' };

    const supabase = await createClient();

    // Get the existing fixed image to find storage path
    const { data: existing } = await supabase.rpc('get_fixed_event_media', {
      p_agent_id: agentId,
      p_project_id: projectId,
      p_event_type: eventType,
    });

    if (!existing?.[0]?.id) {
      return { success: true }; // Nothing to delete
    }

    const mediaId = existing[0].id;

    // Get storage path before deleting
    const { data: mediaData } = await supabase
      .from('agent_media')
      .select('storage_path')
      .eq('id', mediaId)
      .single();

    // Delete from database
    const { error } = await supabase.rpc('delete_agent_media', {
      p_id: mediaId,
      p_project_id: projectId,
    });

    if (error) {
      console.error('[AgentMedia] Delete fixed media RPC error:', error);
      return { success: false, error: 'Error al eliminar' };
    }

    // Clean up storage
    if (mediaData?.storage_path) {
      await deleteMedia(mediaData.storage_path).catch(() => {});
    }

    invalidateMediaCache(agentId, projectId);

    return { success: true };
  } catch (error) {
    console.error('[AgentMedia] deleteFixedEventMedia error:', error);
    return { success: false, error: 'Error interno al eliminar imagen fija' };
  }
}
