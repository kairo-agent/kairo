// ============================================
// KAIRO - WhatsApp Send Message Endpoint
// Pure proxy to WhatsApp Cloud API (no DB saves)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProjectSecret } from '@/lib/actions/secrets';

// ============================================
// Types
// ============================================

interface SendMessageRequest {
  to: string; // Phone number in E.164 format (e.g., "51999888777")
  message: string;
  projectId: string;
}

interface WhatsAppApiResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

interface WhatsAppApiError {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id?: string;
  };
}

// ============================================
// POST Handler - Send WhatsApp Message
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: SendMessageRequest = await request.json();
    const { to, message, projectId } = body;

    // Validate required fields
    if (!to || !message || !projectId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: to, message, projectId',
        },
        { status: 400 }
      );
    }

    // Validate phone number format (basic validation)
    const cleanPhone = to.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid phone number format. Use E.164 format without + (e.g., 51999888777)',
        },
        { status: 400 }
      );
    }

    // Verify project exists and is active
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, isActive: true },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    if (!project.isActive) {
      return NextResponse.json(
        { success: false, error: 'Project is not active' },
        { status: 403 }
      );
    }

    // Get WhatsApp credentials from encrypted secrets
    const [accessToken, phoneNumberId] = await Promise.all([
      getProjectSecret(projectId, 'whatsapp_access_token'),
      getProjectSecret(projectId, 'whatsapp_phone_number_id'),
    ]);

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'WhatsApp access token not configured for this project',
        },
        { status: 400 }
      );
    }

    if (!phoneNumberId) {
      return NextResponse.json(
        {
          success: false,
          error: 'WhatsApp phone number ID not configured for this project',
        },
        { status: 400 }
      );
    }

    // Send message via WhatsApp Cloud API
    const whatsappApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const whatsappResponse = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: {
          body: message,
        },
      }),
    });

    const responseData = await whatsappResponse.json();

    // Handle WhatsApp API error
    if (!whatsappResponse.ok) {
      const errorData = responseData as WhatsAppApiError;
      console.error('WhatsApp API error:', errorData);

      return NextResponse.json(
        {
          success: false,
          error: errorData.error?.message || 'Failed to send WhatsApp message',
          code: errorData.error?.code,
        },
        { status: whatsappResponse.status }
      );
    }

    const successData = responseData as WhatsAppApiResponse;
    const whatsappMsgId = successData.messages?.[0]?.id;

    if (!whatsappMsgId) {
      console.error('WhatsApp API returned unexpected response:', responseData);
      return NextResponse.json(
        {
          success: false,
          error: 'WhatsApp API returned unexpected response',
        },
        { status: 500 }
      );
    }

    // Success response - pure proxy, no DB operations
    return NextResponse.json({
      success: true,
      whatsappMessageId: whatsappMsgId,
      recipient: cleanPhone,
    });
  } catch (error) {
    console.error('WhatsApp send error:', error);

    // Handle specific error types
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
