// ============================================
// KAIRO - Audio Transcription Endpoint
// Downloads audio from WhatsApp and transcribes using OpenAI Whisper
// Used by n8n workflow for voice message processing
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getProjectSecret } from '@/lib/actions/secrets';
import { checkRateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';

// ============================================
// Types
// ============================================

interface TranscribeRequest {
  mediaId: string;
  projectId: string;
  agentId?: string;
  language?: string; // ISO-639-1 code (e.g., 'es', 'en')
}

// ============================================
// Constants
// ============================================

// WhatsApp supported audio formats
const ALLOWED_MIME_TYPES = [
  'audio/ogg',      // OGG/Opus - WhatsApp voice notes
  'audio/opus',     // Opus codec
  'audio/mpeg',     // MP3
  'audio/mp4',      // M4A/AAC
  'audio/wav',      // WAV
  'audio/webm',     // WebM audio
];

// Max file size: 16MB (WhatsApp limit)
const MAX_FILE_SIZE = 16 * 1024 * 1024;

// Max audio duration for Whisper: 2 hours (we'll use a practical limit)
const MAX_DURATION_SECONDS = 300; // 5 minutes practical limit

// ============================================
// POST Handler - Transcribe Audio
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // === SECURITY: Verify n8n shared secret (fail-closed) ===
    const n8nSecret = request.headers.get('X-N8N-Secret');
    const expectedSecret = process.env.N8N_CALLBACK_SECRET;
    const isDev = process.env.NODE_ENV === 'development';

    // Fail-closed: Reject if secret not configured in production
    if (!isDev && !expectedSecret) {
      console.error('[Audio Transcribe] CRITICAL: N8N_CALLBACK_SECRET not configured');
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      );
    }

    // Use timing-safe comparison to prevent timing attacks
    if (!isDev && expectedSecret) {
      const secretValid =
        n8nSecret &&
        n8nSecret.length === expectedSecret.length &&
        require('crypto').timingSafeEqual(
          Buffer.from(n8nSecret),
          Buffer.from(expectedSecret)
        );

      if (!secretValid) {
        console.warn('[Audio Transcribe] Invalid X-N8N-Secret header');
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Parse request body
    const body: TranscribeRequest = await request.json();
    const { mediaId, projectId, agentId, language } = body;

    // ============================================
    // Rate Limiting (by project to prevent abuse)
    // ============================================
    if (projectId) {
      const rateLimit = await checkRateLimit(`audio:transcribe:${projectId}`, {
        maxRequests: 30, // 30 transcriptions per minute per project
        windowMs: 60_000,
      });

      if (!rateLimit.success) {
        console.warn(`[Audio Transcribe] Rate limit exceeded for project: ${projectId}`);
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
            },
          }
        );
      }
    }

    // ============================================
    // Input Validation
    // ============================================

    // Validate required fields
    if (!mediaId || !projectId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: mediaId, projectId' },
        { status: 400 }
      );
    }

    // Validate string types
    if (typeof mediaId !== 'string' || typeof projectId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid field types: all fields must be strings' },
        { status: 400 }
      );
    }

    // Validate ID format (alphanumeric, 10-100 chars for mediaId which is longer)
    const isValidProjectId = (id: string) => /^[a-zA-Z0-9_-]{20,40}$/.test(id);
    const isValidMediaId = (id: string) => /^[a-zA-Z0-9_-]{10,100}$/.test(id);

    if (!isValidProjectId(projectId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid projectId format' },
        { status: 400 }
      );
    }

    if (!isValidMediaId(mediaId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mediaId format' },
        { status: 400 }
      );
    }

    // Validate optional language code
    if (language !== undefined && language !== null) {
      if (typeof language !== 'string' || !/^[a-z]{2}(-[A-Z]{2})?$/.test(language)) {
        return NextResponse.json(
          { success: false, error: 'Invalid language code (use ISO-639-1, e.g., "es" or "en")' },
          { status: 400 }
        );
      }
    }

    // Validate optional agentId
    if (agentId !== undefined && agentId !== null && typeof agentId === 'string' && agentId.length > 0) {
      if (!isValidProjectId(agentId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid agentId format' },
          { status: 400 }
        );
      }
    }

    console.log(`[Audio Transcribe] Processing audio ${mediaId} for project ${projectId}`);

    // ============================================
    // Step 1: Get WhatsApp access token (needed for Steps 2+3)
    // ============================================

    const accessToken = await getProjectSecret(projectId, 'whatsapp_access_token');

    if (!accessToken) {
      console.error(`[Audio Transcribe] WhatsApp credentials not configured for project ${projectId}`);
      return NextResponse.json(
        { success: false, error: 'WhatsApp credentials not configured' },
        { status: 400 }
      );
    }

    // ============================================
    // Steps 2+3+OpenAI key: Fetch media info, download audio, and get OpenAI key in parallel
    // P1-5: openaiKey fetches concurrently while audio downloads from WhatsApp
    // ============================================

    const mediaInfoUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
    const mediaInfoResponse = await fetch(mediaInfoUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!mediaInfoResponse.ok) {
      const errorData = await mediaInfoResponse.json().catch(() => ({}));
      console.error('[Audio Transcribe] Failed to get media info:', errorData);
      return NextResponse.json(
        { success: false, error: 'Failed to get media info from WhatsApp' },
        { status: 502 }
      );
    }

    const mediaInfo = await mediaInfoResponse.json();
    const mediaUrl = mediaInfo.url;
    const mimeType = mediaInfo.mime_type;
    const fileSize = mediaInfo.file_size;

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.some(allowed => mimeType?.startsWith(allowed.split('/')[0]))) {
      console.warn(`[Audio Transcribe] Invalid MIME type: ${mimeType}`);
      return NextResponse.json(
        { success: false, error: `Unsupported audio format: ${mimeType}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      console.warn(`[Audio Transcribe] File too large: ${fileSize} bytes`);
      return NextResponse.json(
        { success: false, error: 'Audio file too large (max 16MB)' },
        { status: 400 }
      );
    }

    console.log(`[Audio Transcribe] Media info: ${mimeType}, ${fileSize} bytes`);

    // P1-5: Download audio AND fetch OpenAI key in parallel
    const [audioResponse, openaiKey] = await Promise.all([
      fetch(mediaUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      getProjectSecret(projectId, 'openai_api_key'),
    ]);

    if (!audioResponse.ok) {
      console.error('[Audio Transcribe] Failed to download audio');
      return NextResponse.json(
        { success: false, error: 'Failed to download audio from WhatsApp' },
        { status: 502 }
      );
    }

    if (!openaiKey) {
      console.error(`[Audio Transcribe] OpenAI API key not configured for project ${projectId}`);
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 400 }
      );
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: mimeType || 'audio/ogg' });

    console.log(`[Audio Transcribe] Downloaded ${audioBlob.size} bytes`);

    // ============================================
    // Step 4: Transcribe with OpenAI Whisper
    // ============================================

    // Determine file extension from MIME type
    const extMap: Record<string, string> = {
      'audio/ogg': 'ogg',
      'audio/opus': 'opus',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
    };
    const ext = extMap[mimeType] || 'ogg';

    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${ext}`);
    formData.append('model', 'whisper-1');

    // Add language hint if provided (improves accuracy)
    if (language) {
      formData.append('language', language);
    }

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorData = await whisperResponse.json().catch(() => ({}));
      console.error('[Audio Transcribe] Whisper API error:', errorData);
      return NextResponse.json(
        { success: false, error: 'Transcription failed' },
        { status: 502 }
      );
    }

    const whisperResult = await whisperResponse.json();
    const transcription = whisperResult.text;

    const duration = Date.now() - startTime;
    console.log(`[Audio Transcribe] Complete in ${duration}ms - ${transcription.length} chars`);

    // ============================================
    // Step 5: Persist transcription to message metadata
    // Find the message by mediaId in metadata, verify project ownership
    // Non-blocking: if this fails, still return transcription for AI flow
    // ============================================
    try {
      // Truncate transcription to 10,000 chars max (security: prevent metadata bloat)
      const truncatedTranscription = transcription.length > 10_000
        ? transcription.slice(0, 10_000) + '...'
        : transcription;

      // Find message by mediaId in metadata JSON (PostgreSQL JSON path query)
      const audioMessage = await prisma.message.findFirst({
        where: {
          metadata: { path: ['mediaId'], equals: mediaId },
          conversation: {
            lead: { projectId },
          },
        },
        select: { id: true, metadata: true },
      });

      if (audioMessage) {
        const existingMetadata = (audioMessage.metadata as Record<string, unknown>) || {};
        await prisma.message.update({
          where: { id: audioMessage.id },
          data: {
            metadata: {
              ...existingMetadata,
              transcription: truncatedTranscription,
              transcribedAt: new Date().toISOString(),
            },
          },
        });
        console.log(`[Audio Transcribe] Transcription saved to message ${audioMessage.id}`);
      } else {
        console.warn(`[Audio Transcribe] Message not found for mediaId ${mediaId} in project ${projectId}`);
      }
    } catch (dbError) {
      // Non-blocking: log error but don't fail the transcription response
      console.error('[Audio Transcribe] Failed to persist transcription:', dbError);
    }

    // ============================================
    // Return transcription
    // ============================================

    return NextResponse.json({
      success: true,
      transcription,
      metadata: {
        mediaId,
        projectId,
        agentId: agentId || null,
        mimeType,
        fileSize,
        language: language || 'auto',
        duration,
      },
    });
  } catch (error) {
    console.error('[Audio Transcribe] Error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// GET Handler - Health check / documentation
// ============================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'KAIRO Audio Transcription',
    endpoint: 'POST /api/audio/transcribe',
    description: 'Downloads audio from WhatsApp and transcribes using OpenAI Whisper. Used by n8n workflow.',
    authentication: {
      header: 'X-N8N-Secret',
      description: 'Shared secret to authenticate requests from n8n',
      envVar: 'N8N_CALLBACK_SECRET',
    },
    request: {
      mediaId: 'string (required) - WhatsApp media ID from incoming message',
      projectId: 'string (required) - KAIRO project ID',
      agentId: 'string (optional) - AI agent ID for context',
      language: 'string (optional) - ISO-639-1 language code (e.g., "es", "en") for better accuracy',
    },
    response: {
      success: 'boolean',
      transcription: 'string - The transcribed text',
      metadata: {
        mediaId: 'string',
        projectId: 'string',
        agentId: 'string | null',
        mimeType: 'string',
        fileSize: 'number',
        language: 'string',
        duration: 'number - Processing time in ms',
      },
    },
    requirements: {
      projectSecrets: [
        'whatsapp_access_token - To download audio from WhatsApp',
        'openai_api_key - For Whisper transcription',
      ],
    },
    limits: {
      maxFileSize: '16MB',
      rateLimit: '30 requests/minute per project',
      supportedFormats: ['audio/ogg', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'],
    },
    cost: '$0.006/minute of audio',
  });
}
