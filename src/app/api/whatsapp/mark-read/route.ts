// ============================================
// KAIRO - WhatsApp Mark Messages as Read Endpoint
// Sends read receipts to WhatsApp Cloud API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getProjectSecret } from '@/lib/actions/secrets';
import { rateLimiters } from '@/lib/rate-limit';

// ============================================
// Zod Schema for Request Validation
// ============================================

// WhatsApp message ID format: wamid.XXXXX
const whatsappMessageIdRegex = /^wamid\.[A-Za-z0-9+/=_-]+$/;

const MarkReadRequestSchema = z.object({
  messageIds: z
    .array(
      z.string().regex(whatsappMessageIdRegex, {
        message: 'Invalid WhatsApp message ID format',
      })
    )
    .min(1, 'At least one message ID is required')
    .max(50, 'Maximum 50 messages per request'),
  projectId: z.string().uuid('Invalid project ID format'),
  leadId: z.string().uuid('Invalid lead ID format'),
});

type MarkReadRequest = z.infer<typeof MarkReadRequestSchema>;

// ============================================
// Types
// ============================================

interface WhatsAppMarkReadPayload {
  messaging_product: 'whatsapp';
  status: 'read';
  message_id: string;
}

interface MarkReadResult {
  messageId: string;
  success: boolean;
  error?: string;
}

// ============================================
// Helper: Create Supabase Server Client
// ============================================

async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

// ============================================
// Helper: Verify User Has Access to Project
// ============================================

async function verifyProjectAccess(
  userId: string,
  projectId: string
): Promise<boolean> {
  // Check if user is super admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  });

  if (user?.systemRole === 'super_admin') {
    return true;
  }

  // Check project membership
  const membership = await prisma.projectMember.findFirst({
    where: {
      userId,
      projectId,
    },
  });

  return !!membership;
}

// ============================================
// Helper: Verify Ownership Chain
// ============================================

async function verifyOwnership(
  projectId: string,
  leadId: string,
  messageIds: string[]
): Promise<{ valid: boolean; phoneNumberId?: string; error?: string }> {
  // 1. Verify lead belongs to project
  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      projectId: projectId,
    },
    select: {
      id: true,
      whatsappId: true,
      conversation: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!lead) {
    return { valid: false, error: 'Lead not found or does not belong to project' };
  }

  if (!lead.whatsappId) {
    return { valid: false, error: 'Lead does not have a WhatsApp ID' };
  }

  if (!lead.conversation) {
    return { valid: false, error: 'Lead does not have a conversation' };
  }

  // 2. Verify all messages belong to this conversation and are from the lead
  const messages = await prisma.message.findMany({
    where: {
      whatsappMsgId: { in: messageIds },
      conversationId: lead.conversation.id,
      sender: 'lead', // Only mark lead messages as read
    },
    select: {
      id: true,
      whatsappMsgId: true,
    },
  });

  const foundMessageIds = new Set(messages.map((m) => m.whatsappMsgId));
  const invalidMessages = messageIds.filter((id) => !foundMessageIds.has(id));

  if (invalidMessages.length > 0) {
    // Don't expose which messages are invalid (security)
    return { valid: false, error: 'One or more messages not found or not from lead' };
  }

  // 3. Get project's WhatsApp phone number ID
  const phoneNumberId = await getProjectSecret(projectId, 'whatsapp_phone_number_id');

  if (!phoneNumberId) {
    return { valid: false, error: 'WhatsApp not configured for this project' };
  }

  return { valid: true, phoneNumberId };
}

// ============================================
// POST Handler - Mark Messages as Read
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authenticate user via Supabase
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    let body: MarkReadRequest;
    try {
      const rawBody = await request.json();
      body = MarkReadRequestSchema.parse(rawBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation error',
            details: error.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { messageIds, projectId, leadId } = body;

    // 3. Rate limiting
    const rateLimitResult = await rateLimiters.whatsapp(`project:${projectId}`);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(
              (rateLimitResult.resetAt - Date.now()) / 1000
            ).toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
          },
        }
      );
    }

    // 4. Verify user has access to project
    const hasAccess = await verifyProjectAccess(user.id, projectId);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied to project' },
        { status: 403 }
      );
    }

    // 5. Verify ownership chain (project -> lead -> messages)
    const ownership = await verifyOwnership(projectId, leadId, messageIds);
    if (!ownership.valid) {
      return NextResponse.json(
        { success: false, error: ownership.error },
        { status: 403 }
      );
    }

    // 6. Get WhatsApp access token
    const accessToken = await getProjectSecret(projectId, 'whatsapp_access_token');
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp access token not configured' },
        { status: 400 }
      );
    }

    // 7. Send read receipts to WhatsApp API
    const whatsappApiUrl = `https://graph.facebook.com/v21.0/${ownership.phoneNumberId}/messages`;
    const results: MarkReadResult[] = [];

    // Process messages in parallel with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const promises = messageIds.map(async (messageId): Promise<MarkReadResult> => {
        try {
          const payload: WhatsAppMarkReadPayload = {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
          };

          const response = await fetch(whatsappApiUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            // Sanitize error - don't expose WhatsApp API details
            console.error(
              `[KAIRO] WhatsApp mark-read failed for ${messageId}:`,
              JSON.stringify(errorData).substring(0, 200)
            );
            return {
              messageId,
              success: false,
              error: 'Failed to mark as read',
            };
          }

          return { messageId, success: true };
        } catch (error) {
          // Sanitize error logging
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          console.error(
            `[KAIRO] WhatsApp mark-read error for ${messageId}:`,
            errorMessage.substring(0, 100)
          );
          return {
            messageId,
            success: false,
            error: 'Request failed',
          };
        }
      });

      const settledResults = await Promise.all(promises);
      results.push(...settledResults);
    } finally {
      clearTimeout(timeout);
    }

    // 8. Update local database to mark messages as read
    const successfulIds = results
      .filter((r) => r.success)
      .map((r) => r.messageId);

    if (successfulIds.length > 0) {
      await prisma.message.updateMany({
        where: {
          whatsappMsgId: { in: successfulIds },
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    // 9. Return results
    const allSuccess = results.every((r) => r.success);
    const duration = Date.now() - startTime;

    console.log(
      `[KAIRO] Mark-read completed: ${successfulIds.length}/${messageIds.length} success, ${duration}ms`
    );

    return NextResponse.json({
      success: allSuccess,
      results,
      processed: messageIds.length,
      successful: successfulIds.length,
    });
  } catch (error) {
    // Sanitize error logging - never log tokens or sensitive data
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[KAIRO] Mark-read endpoint error:', errorMessage.substring(0, 200));

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
    service: 'KAIRO WhatsApp Mark Read',
    endpoint: 'POST /api/whatsapp/mark-read',
    description: 'Sends read receipts to WhatsApp for lead messages',
    request: {
      messageIds: 'string[] (required) - WhatsApp message IDs (wamid.XXX format)',
      projectId: 'string (required) - UUID of the project',
      leadId: 'string (required) - UUID of the lead',
    },
    response: {
      success: 'boolean',
      results: 'Array of { messageId, success, error? }',
      processed: 'number - Total messages processed',
      successful: 'number - Successfully marked as read',
    },
    security: {
      authentication: 'Supabase Auth (session cookie)',
      authorization: 'Project membership required',
      rateLimit: '100 requests per minute per project',
      validation: 'Zod schema with WhatsApp ID format regex',
    },
  });
}
