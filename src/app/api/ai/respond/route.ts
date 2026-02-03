// ============================================
// KAIRO - AI Respond Endpoint
// Saves bot message to DB AND sends to WhatsApp
// Used by n8n workflow for AI responses
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProjectSecret } from '@/lib/actions/secrets';
import { checkRateLimit } from '@/lib/rate-limit';

// ============================================
// Types
// ============================================

interface AIRespondRequest {
  conversationId: string;
  leadId: string;
  projectId: string;
  message: string;
  agentId?: string;
  agentName?: string;
  suggestedTemperature?: 'hot' | 'warm' | 'cold';
  suggestedSummary?: string;
}

// Minimum messages required before accepting a summary (defense in depth)
const SUMMARY_MIN_MESSAGES = 5;

interface WhatsAppApiResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

// ============================================
// POST Handler - Save and Send AI Response
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
      console.error('[AI Respond] CRITICAL: N8N_CALLBACK_SECRET not configured');
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      );
    }

    // Use timing-safe comparison to prevent timing attacks
    if (!isDev && expectedSecret) {
      const secretValid = n8nSecret &&
        n8nSecret.length === expectedSecret.length &&
        require('crypto').timingSafeEqual(
          Buffer.from(n8nSecret),
          Buffer.from(expectedSecret)
        );

      if (!secretValid) {
        console.warn('[AI Respond] Invalid X-N8N-Secret header');
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Parse request body
    const body: AIRespondRequest = await request.json();
    const { conversationId, leadId, projectId, message, agentId, agentName, suggestedTemperature, suggestedSummary } = body;

    // ============================================
    // Rate Limiting (by project to prevent abuse)
    // ============================================
    if (projectId) {
      const rateLimit = await checkRateLimit(`ai:respond:${projectId}`, {
        maxRequests: 60, // 60 AI responses per minute per project
        windowMs: 60_000,
      });

      if (!rateLimit.success) {
        console.warn(`[AI Respond] Rate limit exceeded for project: ${projectId}`);
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

    // Validate required fields
    if (!conversationId || !leadId || !projectId || !message) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: conversationId, leadId, projectId, message',
        },
        { status: 400 }
      );
    }

    // Validate string types (prevent injection of objects/arrays)
    if (
      typeof conversationId !== 'string' ||
      typeof leadId !== 'string' ||
      typeof projectId !== 'string' ||
      typeof message !== 'string'
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid field types: all fields must be strings' },
        { status: 400 }
      );
    }

    // Validate ID format (UUID or CUID, 20-40 chars alphanumeric with hyphens)
    const isValidId = (id: string) => /^[a-zA-Z0-9_-]{20,40}$/.test(id);
    if (!isValidId(conversationId) || !isValidId(leadId) || !isValidId(projectId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Validate message length (WhatsApp limit is 4096 characters)
    if (message.length > 4096) {
      return NextResponse.json(
        { success: false, error: 'Message too long (max 4096 characters)' },
        { status: 400 }
      );
    }

    // Validate message is not empty after trimming
    if (message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    // Validate optional fields if provided
    if (agentId !== undefined && agentId !== null && typeof agentId === 'string' && agentId.length > 0) {
      if (!isValidId(agentId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid agentId format' },
          { status: 400 }
        );
      }
    }

    if (agentName !== undefined && agentName !== null) {
      if (typeof agentName !== 'string' || agentName.length > 100) {
        return NextResponse.json(
          { success: false, error: 'Invalid agentName (max 100 characters)' },
          { status: 400 }
        );
      }
    }

    // Validate suggestedTemperature if provided
    const validTemperatures = ['hot', 'warm', 'cold'];
    if (suggestedTemperature !== undefined && suggestedTemperature !== null) {
      if (typeof suggestedTemperature !== 'string' || !validTemperatures.includes(suggestedTemperature)) {
        return NextResponse.json(
          { success: false, error: 'Invalid suggestedTemperature (must be: hot, warm, or cold)' },
          { status: 400 }
        );
      }
    }

    // Validate suggestedSummary if provided (max 500 characters)
    if (suggestedSummary !== undefined && suggestedSummary !== null) {
      if (typeof suggestedSummary !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Invalid suggestedSummary (must be a string)' },
          { status: 400 }
        );
      }
      if (suggestedSummary.length > 500) {
        return NextResponse.json(
          { success: false, error: 'suggestedSummary too long (max 500 characters)' },
          { status: 400 }
        );
      }
    }

    console.log(`[AI Respond] Processing response for lead ${leadId}, agent: ${agentName || 'unknown'}`);

    // Get lead info for WhatsApp
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        phone: true,
        whatsappId: true,
        projectId: true,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Verify project matches
    if (lead.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: 'Project mismatch' },
        { status: 400 }
      );
    }

    // === STEP 1: Save message to database ===
    const savedMessage = await prisma.message.create({
      data: {
        conversationId,
        sender: 'ai',
        content: message,
        metadata: {
          agentId: agentId || null,
          agentName: agentName || null,
          source: 'n8n_ai',
          createdAt: new Date().toISOString(),
        },
      },
    });

    console.log(`[AI Respond] Message saved to DB: ${savedMessage.id}`);

    // === STEP 1.5: Update lead temperature if suggested ===
    if (suggestedTemperature && validTemperatures.includes(suggestedTemperature)) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { temperature: suggestedTemperature },
      });
      console.log(`[AI Respond] Updated lead ${leadId} temperature to ${suggestedTemperature}`);
    }

    // === STEP 1.6: Update lead summary if suggested (defense in depth: verify message count) ===
    if (suggestedSummary && suggestedSummary.trim().length > 0) {
      // Count messages in conversation to enforce threshold (fail-closed)
      const messageCount = await prisma.message.count({
        where: { conversationId },
      });

      if (messageCount >= SUMMARY_MIN_MESSAGES) {
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            summary: suggestedSummary.trim(),
            summaryUpdatedAt: new Date(),
          },
        });
        console.log(`[AI Respond] Updated lead ${leadId} summary (${messageCount} messages)`);
      } else {
        console.log(`[AI Respond] Skipped summary update for lead ${leadId} (${messageCount} < ${SUMMARY_MIN_MESSAGES} messages)`);
      }
    }

    // === STEP 2: Send to WhatsApp ===
    const phoneNumber = lead.whatsappId || lead.phone;
    if (!phoneNumber) {
      console.error(`[AI Respond] No phone number for lead ${leadId}`);
      return NextResponse.json({
        success: true,
        messageId: savedMessage.id,
        whatsappSent: false,
        reason: 'No phone number available',
      });
    }

    // Get WhatsApp credentials
    const [accessToken, phoneNumberId] = await Promise.all([
      getProjectSecret(projectId, 'whatsapp_access_token'),
      getProjectSecret(projectId, 'whatsapp_phone_number_id'),
    ]);

    if (!accessToken || !phoneNumberId) {
      console.error(`[AI Respond] WhatsApp credentials not configured for project ${projectId}`);
      return NextResponse.json({
        success: true,
        messageId: savedMessage.id,
        whatsappSent: false,
        reason: 'WhatsApp credentials not configured',
      });
    }

    // Clean phone number
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

    // Send to WhatsApp Cloud API
    const whatsappApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    const whatsappResponse = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body: message },
      }),
    });

    const whatsappData = await whatsappResponse.json();

    if (!whatsappResponse.ok) {
      console.error('[AI Respond] WhatsApp API error:', whatsappData);
      // Update message with error
      await prisma.message.update({
        where: { id: savedMessage.id },
        data: {
          metadata: {
            ...(savedMessage.metadata as object),
            whatsappError: whatsappData.error?.message || 'Unknown error',
            whatsappErrorCode: whatsappData.error?.code,
          },
        },
      });

      return NextResponse.json({
        success: true,
        messageId: savedMessage.id,
        whatsappSent: false,
        error: whatsappData.error?.message || 'WhatsApp API error',
      });
    }

    // === STEP 3: Update message with WhatsApp ID ===
    const waResponse = whatsappData as WhatsAppApiResponse;
    const whatsappMsgId = waResponse.messages?.[0]?.id;

    if (whatsappMsgId) {
      await prisma.message.update({
        where: { id: savedMessage.id },
        data: {
          whatsappMsgId,
          isDelivered: true,
          deliveredAt: new Date(),
        },
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[AI Respond] Complete in ${duration}ms - Message ${savedMessage.id}, WhatsApp ${whatsappMsgId}`);

    return NextResponse.json({
      success: true,
      messageId: savedMessage.id,
      whatsappMsgId,
      whatsappSent: true,
      duration,
    });
  } catch (error) {
    console.error('[AI Respond] Error:', error);

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
    service: 'KAIRO AI Respond',
    endpoint: 'POST /api/ai/respond',
    description: 'Saves AI bot response to database AND sends to WhatsApp. Used by n8n workflow.',
    authentication: {
      header: 'X-N8N-Secret',
      description: 'Shared secret to authenticate requests from n8n',
      envVar: 'N8N_CALLBACK_SECRET',
    },
    request: {
      conversationId: 'string (required) - KAIRO conversation ID',
      leadId: 'string (required) - KAIRO lead ID',
      projectId: 'string (required) - KAIRO project ID',
      message: 'string (required) - Bot response text',
      agentId: 'string (optional) - AI agent ID',
      agentName: 'string (optional) - AI agent name for metadata',
      suggestedTemperature: 'string (optional) - Lead temperature suggestion from AI (hot, warm, cold)',
      suggestedSummary: 'string (optional) - Lead summary suggestion from AI (max 500 chars, requires 5+ messages)',
    },
    response: {
      success: 'boolean',
      messageId: 'string - KAIRO message ID',
      whatsappMsgId: 'string - WhatsApp message ID (if sent)',
      whatsappSent: 'boolean - Whether WhatsApp delivery succeeded',
      duration: 'number - Processing time in ms',
    },
  });
}
