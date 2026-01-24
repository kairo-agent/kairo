// ============================================
// KAIRO - WhatsApp Send Message Endpoint
// Pure proxy to WhatsApp Cloud API (no DB saves)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getProjectSecret } from '@/lib/actions/secrets';

// ============================================
// Types
// ============================================

interface SendMessageRequest {
  to: string; // Phone number in E.164 format (e.g., "51999888777")
  message: string;
  projectId: string;
  messageType?: 'text' | 'image' | 'video'; // Type of message (default: text)
  mediaUrl?: string; // URL for image or video media
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
    const { to, message, projectId, messageType = 'text', mediaUrl } = body;

    // Validate required fields
    if (!to || !projectId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: to, projectId',
        },
        { status: 400 }
      );
    }

    // Validate message type and required fields
    if (messageType === 'text' && !message) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: message (required for text messages)',
        },
        { status: 400 }
      );
    }

    if ((messageType === 'image' || messageType === 'video') && !mediaUrl) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required field: mediaUrl (required for ${messageType} messages)`,
        },
        { status: 400 }
      );
    }

    // ============================================
    // Authentication & Authorization
    // ============================================

    // Create Supabase server client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    // Verify authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Development bypass check
    const isDev = process.env.NODE_ENV === 'development';
    const bypassAuth = process.env.BYPASS_AUTH_DEV === 'true';

    if (!user && !(isDev && bypassAuth)) {
      console.log('[WhatsApp Send] Unauthorized request - no authenticated user');
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    if (!user && isDev && bypassAuth) {
      console.log('[WhatsApp Send] Dev mode: Auth bypass enabled, proceeding without user');
    }

    // If user exists, verify access to project
    if (user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { systemRole: true }
      });

      // Super admin has access to everything
      const isSuperAdmin = dbUser?.systemRole === 'super_admin';

      if (!isSuperAdmin) {
        const membership = await prisma.projectMember.findFirst({
          where: {
            projectId,
            userId: user.id,
          },
        });

        if (!membership) {
          console.log(`[WhatsApp Send] User ${user.id} denied access to project ${projectId}`);
          return NextResponse.json(
            { success: false, error: 'Forbidden - No access to this project' },
            { status: 403 }
          );
        }
      }

      console.log(`[WhatsApp Send] User ${user.id} authorized for project ${projectId}`);
    }

    // ============================================
    // Input Validation
    // ============================================

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

    // Build the request body based on message type
    let whatsappBody: Record<string, unknown>;

    switch (messageType) {
      case 'image':
        whatsappBody = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'image',
          image: {
            link: mediaUrl,
            ...(message && { caption: message }),
          },
        };
        break;

      case 'video':
        whatsappBody = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'video',
          video: {
            link: mediaUrl,
            ...(message && { caption: message }),
          },
        };
        break;

      case 'text':
      default:
        whatsappBody = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: {
            body: message,
          },
        };
        break;
    }

    console.log(`[WhatsApp Send] Sending ${messageType} message to ${cleanPhone}`);

    const whatsappResponse = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(whatsappBody),
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
