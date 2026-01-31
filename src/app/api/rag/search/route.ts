/**
 * RAG Search API Endpoint
 *
 * Provides semantic search over agent knowledge base for n8n workflows.
 * Uses OpenAI embeddings + pgvector for similarity search.
 *
 * Authentication: X-N8N-Secret header (shared secret)
 *
 * @see docs/RAG-AGENTS.md for architecture details
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/supabase/server';
import {
  generateEmbedding,
  formatEmbeddingForPg,
} from '@/lib/openai/embeddings';
import { createClient } from '@/lib/supabase/server';

// ============================================
// Types
// ============================================

interface RAGSearchRequest {
  agentId: string;
  projectId: string;
  query: string;
  limit?: number;
  threshold?: number;
}

interface RAGSearchResult {
  id: string;
  content: string;
  title: string | null;
  source: string;
  similarity: number;
}

// ============================================
// POST - Search Agent Knowledge
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // ============================================
    // 1. Authentication via shared secret
    // ============================================
    const n8nSecret = request.headers.get('X-N8N-Secret');
    const expectedSecret = process.env.N8N_CALLBACK_SECRET;

    if (!expectedSecret) {
      console.error('[RAG Search] N8N_CALLBACK_SECRET not configured');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Use timing-safe comparison to prevent timing attacks
    const secretValid = n8nSecret &&
      n8nSecret.length === expectedSecret.length &&
      require('crypto').timingSafeEqual(
        Buffer.from(n8nSecret),
        Buffer.from(expectedSecret)
      );

    if (!secretValid) {
      console.warn('[RAG Search] Invalid X-N8N-Secret header');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ============================================
    // 2. Parse and validate request body
    // ============================================
    let body: RAGSearchRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { agentId, projectId, query, limit = 5, threshold = 0.7 } = body;

    if (!agentId || !projectId || !query) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: agentId, projectId, query',
        },
        { status: 400 }
      );
    }

    // Validate query length (avoid embedding very long texts)
    if (query.length > 8000) {
      return NextResponse.json(
        { success: false, error: 'Query too long (max 8000 characters)' },
        { status: 400 }
      );
    }

    // Validate limit and threshold
    const safeLimit = Math.min(Math.max(1, limit), 20); // 1-20
    const safeThreshold = Math.min(Math.max(0, threshold), 1); // 0-1

    // ============================================
    // 3. Validate project and agent exist
    // ============================================
    const agent = await prisma.aIAgent.findFirst({
      where: {
        id: agentId,
        projectId,
        isActive: true,
      },
      include: {
        project: {
          select: { isActive: true, name: true },
        },
      },
    });

    if (!agent) {
      console.warn(
        `[RAG Search] Agent not found or inactive: ${agentId} in project ${projectId}`
      );
      return NextResponse.json(
        { success: false, error: 'Agent not found or inactive' },
        { status: 404 }
      );
    }

    if (!agent.project.isActive) {
      console.warn(`[RAG Search] Project inactive: ${projectId}`);
      return NextResponse.json(
        { success: false, error: 'Project is not active' },
        { status: 403 }
      );
    }

    // ============================================
    // 4. Generate embedding for query
    // ============================================
    const embeddingStartTime = Date.now();
    const queryEmbedding = await generateEmbedding(query, projectId);
    const embeddingStr = formatEmbeddingForPg(queryEmbedding);
    const embeddingTime = Date.now() - embeddingStartTime;

    // ============================================
    // 5. Search in Supabase via RPC
    // ============================================
    const searchStartTime = Date.now();
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('search_agent_knowledge', {
      p_agent_id: agentId,
      p_project_id: projectId,
      p_query_embedding: embeddingStr,
      p_match_count: safeLimit,
      p_match_threshold: safeThreshold,
    });

    if (error) {
      console.error('[RAG Search] Supabase RPC error:', error);
      return NextResponse.json(
        { success: false, error: 'Search failed' },
        { status: 500 }
      );
    }

    const searchTime = Date.now() - searchStartTime;

    // ============================================
    // 6. Format and return results
    // ============================================
    const results: RAGSearchResult[] = (data || []).map(
      (row: {
        id: string;
        content: string;
        title: string | null;
        source: string;
        similarity: number;
      }) => ({
        id: row.id,
        content: row.content,
        title: row.title,
        source: row.source,
        similarity: Math.round(row.similarity * 1000) / 1000, // 3 decimal places
      })
    );

    const totalTime = Date.now() - startTime;

    console.log(
      `[RAG Search] Agent: ${agent.name} | Project: ${agent.project.name} | ` +
        `Results: ${results.length} | Embedding: ${embeddingTime}ms | ` +
        `Search: ${searchTime}ms | Total: ${totalTime}ms`
    );

    return NextResponse.json({
      success: true,
      results,
      metadata: {
        agentId,
        agentName: agent.name,
        projectId,
        projectName: agent.project.name,
        queryLength: query.length,
        resultsCount: results.length,
        threshold: safeThreshold,
        timing: {
          embedding: embeddingTime,
          search: searchTime,
          total: totalTime,
        },
      },
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[RAG Search] Error after ${totalTime}ms:`, error);

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// GET - Health check / Documentation
// ============================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'KAIRO RAG Search API',
    version: '1.0.0',
    endpoint: 'POST /api/rag/search',
    authentication: {
      method: 'Shared Secret',
      header: 'X-N8N-Secret',
      required: true,
    },
    request: {
      agentId: 'string (required) - AI Agent ID',
      projectId: 'string (required) - Project ID',
      query: 'string (required) - Search query text (max 8000 chars)',
      limit: 'number (optional, default: 5, max: 20) - Max results',
      threshold: 'number (optional, default: 0.7, range: 0-1) - Similarity threshold',
    },
    response: {
      success: 'boolean',
      results: 'array of { id, content, title, source, similarity }',
      metadata: 'object with timing and query stats',
    },
    example: {
      request: {
        agentId: 'agent_123',
        projectId: 'project_456',
        query: '¿Cuáles son los horarios de atención?',
        limit: 5,
        threshold: 0.7,
      },
      response: {
        success: true,
        results: [
          {
            id: 'know_789',
            content: 'Nuestro horario de atención es de lunes a viernes...',
            title: 'Horarios',
            source: 'manual',
            similarity: 0.892,
          },
        ],
        metadata: {
          resultsCount: 1,
          timing: { embedding: 150, search: 45, total: 210 },
        },
      },
    },
  });
}
