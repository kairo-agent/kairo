// ============================================
// KAIRO - WhatsApp Webhook Endpoints
// Receives messages directly from Meta WhatsApp Cloud API
// PERFORMANCE: In-memory cache for phoneNumberId → projectId mapping
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import * as crypto from 'crypto';

// Vercel serverless config
export const maxDuration = 25; // 25s max (Meta expects 200 within 20s)
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  LeadChannel,
  LeadType,
  LeadStatus,
  LeadTemperature,
  HandoffMode,
  MessageSender,
} from '@prisma/client';
import { decryptSecret } from '@/lib/crypto/secrets';
import { getProjectSecret } from '@/lib/actions/secrets';
import { checkRateLimit } from '@/lib/rate-limit';
import { notifyProjectMembers } from '@/lib/actions/notifications';
import { processAIResponse } from '@/lib/ai/process-ai-response';

// ============================================
// In-Memory Cache for phoneNumberId → Project
// TTL: 5 minutes (300000ms)
// ============================================

interface CachedProject {
  project: { id: string; name: string } | null;
  appSecret: string | null; // Per-project App Secret (null = use global fallback)
  timestamp: number;
}

interface ProjectLookupResult {
  project: { id: string; name: string } | null;
  appSecret: string | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_PHONE_CACHE_SIZE = 500;
const phoneNumberIdCache = new Map<string, CachedProject>();

function getCachedProject(phoneNumberId: string): ProjectLookupResult | undefined {
  const cached = phoneNumberIdCache.get(phoneNumberId);
  if (!cached) return undefined; // Not in cache

  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    phoneNumberIdCache.delete(phoneNumberId);
    return undefined; // Expired
  }

  return { project: cached.project, appSecret: cached.appSecret };
}

function setCachedProject(phoneNumberId: string, project: { id: string; name: string } | null, appSecret: string | null = null): void {
  // Evict expired entries if cache approaching limit
  if (phoneNumberIdCache.size >= MAX_PHONE_CACHE_SIZE) {
    const now = Date.now();
    for (const [k, v] of phoneNumberIdCache.entries()) {
      if (now - v.timestamp > CACHE_TTL_MS) phoneNumberIdCache.delete(k);
    }
    // If still over limit, remove oldest entry
    if (phoneNumberIdCache.size >= MAX_PHONE_CACHE_SIZE) {
      const oldestKey = phoneNumberIdCache.keys().next().value;
      if (oldestKey) phoneNumberIdCache.delete(oldestKey);
    }
  }

  phoneNumberIdCache.set(phoneNumberId, {
    project,
    appSecret,
    timestamp: Date.now(),
  });
}

// Allow manual cache invalidation (e.g., when project settings change)
export function invalidatePhoneNumberCache(phoneNumberId?: string): void {
  if (phoneNumberId) {
    phoneNumberIdCache.delete(phoneNumberId);
  } else {
    phoneNumberIdCache.clear();
  }
}

// ============================================
// Types for WhatsApp Cloud API Webhooks
// https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
// ============================================

interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppEntry[];
}

interface WhatsAppEntry {
  id: string; // WhatsApp Business Account ID
  changes: WhatsAppChange[];
}

interface WhatsAppChange {
  value: WhatsAppValue;
  field: 'messages';
}

interface WhatsAppValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string; // WhatsApp ID (phone number without +)
}

interface WhatsAppMessage {
  from: string; // Sender's WhatsApp ID
  id: string; // Message ID
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contacts' | 'button' | 'interactive';
  text?: {
    body: string;
  };
  image?: WhatsAppMedia;
  audio?: WhatsAppMedia;
  video?: WhatsAppMedia;
  document?: WhatsAppMedia & { filename?: string };
  // Add more types as needed
}

interface WhatsAppMedia {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
}

interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

// ============================================
// Webhook Signature Verification (Security)
// Verifies X-Hub-Signature-256 header from Meta
// https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
// ============================================

function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature) {
    return false;
  }

  // La firma viene como "sha256=abc123..."
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');

  try {
    // Usar timingSafeEqual para prevenir ataques de timing
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    // Si los buffers tienen diferente longitud, timingSafeEqual lanza error
    return false;
  }
}

// ============================================
// GET Handler - Webhook Verification
// Meta sends a GET request to verify the webhook URL
// ============================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Meta sends these parameters for verification
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Get verify token from environment
  const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!VERIFY_TOKEN) {
    console.error('WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  // Check if this is a verification request (timing-safe comparison)
  if (mode === 'subscribe' && token && VERIFY_TOKEN &&
      token.length === VERIFY_TOKEN.length &&
      crypto.timingSafeEqual(
        Buffer.from(token, 'utf8'),
        Buffer.from(VERIFY_TOKEN, 'utf8')
      )) {
    console.log('[OK] WhatsApp webhook verified successfully');
    // Return the challenge as plain text (required by Meta)
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // If verification fails (don't log the token value)
  console.warn('[FAIL] WhatsApp webhook verification failed', {
    mode,
    hasToken: !!token,
    tokenLength: token?.length || 0,
  });
  return NextResponse.json(
    { error: 'Verification failed' },
    { status: 403 }
  );
}

// ============================================
// POST Handler - Incoming Messages
// ============================================

export async function POST(request: NextRequest) {
  try {
    // ============================================
    // Rate Limiting (by IP to prevent DDoS)
    // Higher limit for webhooks as Meta can send bursts
    // ============================================
    const rawIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                  request.headers.get('x-real-ip')?.trim();

    // Reject requests without identifiable IP in production
    if (!rawIp && process.env.NODE_ENV === 'production') {
      console.warn('[WhatsApp Webhook] Request without identifiable IP rejected');
      return NextResponse.json({ success: true });
    }

    const clientIp = rawIp || `dev-${Date.now()}`;

    const rateLimit = await checkRateLimit(`webhook:whatsapp:${clientIp}`, {
      maxRequests: 300, // 300 requests per minute per IP (Meta can burst)
      windowMs: 60_000,
    });

    if (!rateLimit.success) {
      console.warn(`[WhatsApp Webhook] Rate limit exceeded for IP: ${clientIp}`);
      // Return 200 to not trigger Meta's retry mechanism
      return NextResponse.json({ success: true });
    }

    // IMPORTANTE: Leer body raw ANTES de cualquier otra cosa
    // Necesitamos el texto crudo para verificar la firma HMAC
    const rawBody = await request.text();

    // Reject abnormally large payloads (Meta webhooks are typically <50KB)
    const MAX_WEBHOOK_BODY_SIZE = 1_048_576; // 1MB
    if (rawBody.length > MAX_WEBHOOK_BODY_SIZE) {
      console.warn(`[WhatsApp Webhook] Payload too large: ${rawBody.length} bytes`);
      return NextResponse.json({ success: true });
    }

    // ============================================
    // Parse JSON tentatively (needed for per-project HMAC)
    // Safe: 1MB limit enforced above, JSON.parse is robust
    // ============================================
    let payload: WhatsAppWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[WhatsApp Webhook] Invalid JSON payload:', parseError);
      return NextResponse.json({ success: true });
    }

    // Validate it's from WhatsApp
    if (payload.object !== 'whatsapp_business_account') {
      console.warn('[WhatsApp Webhook] Invalid payload object:', payload.object);
      return NextResponse.json({ success: true });
    }

    // ============================================
    // HMAC Signature Verification (per-project with global fallback)
    // 1. Extract phone_number_ids from payload
    // 2. Look up project + per-project App Secret
    // 3. Verify HMAC with per-project secret
    // 4. Fallback to global WHATSAPP_APP_SECRET if no per-project
    // ============================================
    const signature = request.headers.get('X-Hub-Signature-256');
    const isDev = process.env.NODE_ENV === 'development';
    const bypassSignature = process.env.WEBHOOK_BYPASS_SIGNATURE === 'true';

    if (!isDev || !bypassSignature) {
      // Extract unique phone_number_ids from payload
      const phoneNumberIds = new Set<string>();
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages' && change.value?.metadata?.phone_number_id) {
            phoneNumberIds.add(change.value.metadata.phone_number_id);
          }
        }
      }

      let hmacVerified = false;

      // Try per-project App Secret first
      if (phoneNumberIds.size > 0) {
        for (const phoneNumberId of phoneNumberIds) {
          const result = await findProjectByPhoneNumberId(phoneNumberId);
          if (result.appSecret) {
            if (verifyWebhookSignature(rawBody, signature, result.appSecret)) {
              hmacVerified = true;
              console.log('[WhatsApp Webhook] Signature verified with per-project App Secret');
              break;
            }
            // Per-project secret exists but HMAC failed -> do NOT fallback to global
            // (Security: prevents global secret from bypassing per-project verification)
            console.warn('[WhatsApp Webhook] Per-project App Secret HMAC failed, rejecting');
            return NextResponse.json({ success: true });
          }
        }
      }

      // Fallback to global App Secret ONLY if no per-project secret was found
      if (!hmacVerified) {
        const globalAppSecret = process.env.WHATSAPP_APP_SECRET;

        if (!globalAppSecret) {
          console.error('[WhatsApp Webhook] No App Secret configured (neither per-project nor global)');
          return NextResponse.json({ success: true });
        }

        if (verifyWebhookSignature(rawBody, signature, globalAppSecret)) {
          hmacVerified = true;
          console.log('[WhatsApp Webhook] Signature verified with global WHATSAPP_APP_SECRET');
        }
      }

      if (!hmacVerified) {
        // Track HMAC failures per IP - block after 10 failures in 5 minutes
        const hmacFailLimit = await checkRateLimit(`webhook:hmac-fail:${clientIp}`, {
          maxRequests: 10,
          windowMs: 5 * 60_000, // 5 minutes
        });

        if (!hmacFailLimit.success) {
          console.warn(`[WhatsApp Webhook] HMAC failure rate limit exceeded for IP: ${clientIp}`);
        } else {
          console.warn('[WhatsApp Webhook] Invalid signature - possible spoofing attempt', {
            hasSignature: !!signature,
            timestamp: new Date().toISOString(),
            ip: clientIp,
          });
        }
        return NextResponse.json({ success: true });
      }
    } else {
      console.warn('[WhatsApp Webhook] DEV MODE: Signature verification bypassed');
    }

    // Process each entry (payload already parsed and verified)
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          await processMessagesChange(change.value, entry.id);
        }
      }
    }

    // Always return 200 quickly to acknowledge receipt
    // Meta expects response within 20 seconds
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WhatsApp Webhook] Unexpected error:', error);
    // Still return 200 to prevent Meta from retrying
    return NextResponse.json({ success: true });
  }
}

// ============================================
// Process Messages
// ============================================

async function processMessagesChange(value: WhatsAppValue, businessAccountId: string) {
  const { metadata, contacts, messages, statuses } = value;
  const phoneNumberId = metadata.phone_number_id;

  // Find project by phone number ID (likely cache hit from HMAC step)
  const result = await findProjectByPhoneNumberId(phoneNumberId);
  const project = result.project;

  if (!project) {
    console.warn(`No project found for phone_number_id: ${phoneNumberId}`);
    return;
  }

  // Process incoming messages
  if (messages && contacts) {
    for (const message of messages) {
      const contact = contacts.find((c) => c.wa_id === message.from);
      await handleIncomingMessage(project.id, message, contact);
    }
  }

  // Process status updates (sent, delivered, read)
  // Fire-and-forget: don't block webhook response for status updates
  // WhatsApp sends status events repeatedly, so missed updates will be retried by Meta
  if (statuses) {
    for (const status of statuses) {
      waitUntil(
        handleStatusUpdate(project.id, status).catch((err) =>
          console.error('[WhatsApp Webhook] Status update error:', err)
        )
      );
    }
  }
}

// ============================================
// Find Project by Phone Number ID
// PERFORMANCE: Uses in-memory cache with 5-minute TTL
// ============================================

async function findProjectByPhoneNumberId(phoneNumberId: string): Promise<ProjectLookupResult> {
  // Check cache first
  const cachedResult = getCachedProject(phoneNumberId);
  if (cachedResult !== undefined) {
    if (cachedResult.project) {
      console.log(`[CACHE HIT] phone_number_id: ${phoneNumberId} -> ${cachedResult.project.name}`);
    } else {
      console.log(`[CACHE HIT] (no project) for phone_number_id: ${phoneNumberId}`);
    }
    return cachedResult;
  }

  console.log(`[CACHE MISS] Looking for project with phone_number_id: ${phoneNumberId}`);

  // Get all projects with whatsapp_phone_number_id configured
  const secrets = await prisma.projectSecret.findMany({
    where: {
      key: 'whatsapp_phone_number_id',
    },
    include: {
      project: {
        select: { id: true, name: true },
      },
    },
  });

  // Decrypt each and compare
  for (const secret of secrets) {
    try {
      const decryptedPhoneNumberId = decryptSecret({
        encryptedValue: secret.encryptedValue,
        iv: secret.iv,
        authTag: secret.authTag,
      });

      if (decryptedPhoneNumberId === phoneNumberId) {
        console.log(`[OK] Found project: ${secret.projectId.substring(0, 8)}...`);

        // Also fetch the project's App Secret (if configured)
        let projectAppSecret: string | null = null;
        try {
          projectAppSecret = await getProjectSecret(secret.projectId, 'whatsapp_app_secret');
        } catch {
          // No app secret configured - will use global fallback
        }

        // Cache the successful match WITH app secret
        setCachedProject(phoneNumberId, secret.project, projectAppSecret);
        return { project: secret.project, appSecret: projectAppSecret };
      }
    } catch (error) {
      console.error(`Error decrypting secret for project ${secret.projectId.substring(0, 8)}...:`, error);
    }
  }

  // Fallback only in development with explicit opt-in (prevents cross-tenant routing)
  if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_WEBHOOK_FALLBACK === 'true') {
    console.warn('[DEV] No matching project found, using fallback (ALLOW_WEBHOOK_FALLBACK=true)');
    const fallbackProject = await prisma.project.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    setCachedProject(phoneNumberId, fallbackProject, null);
    return { project: fallbackProject, appSecret: null };
  }

  // Production: no fallback, discard message
  console.warn(`No matching project for phoneNumberId: ${phoneNumberId.substring(0, 6)}...`);
  setCachedProject(phoneNumberId, null, null);
  return { project: null, appSecret: null };
}

// ============================================
// Send Read Receipt + Typing Indicator to WhatsApp
// Makes the lead see checkmarks + "typing..." while AI processes
// ============================================

async function sendReadReceipt(
  projectId: string,
  messageId: string
): Promise<void> {
  try {
    // Get WhatsApp credentials
    const [accessToken, phoneNumberId] = await Promise.all([
      getProjectSecret(projectId, 'whatsapp_access_token'),
      getProjectSecret(projectId, 'whatsapp_phone_number_id'),
    ]);

    if (!accessToken || !phoneNumberId) {
      console.log('WhatsApp credentials not configured, skipping read receipt');
      return;
    }

    const whatsappApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        typing_indicator: { type: 'text' },
      }),
    });

    if (response.ok) {
      console.log(`Read receipt + typing indicator sent for: ${messageId}`);
    } else {
      const errorData = await response.json();
      console.error(`Failed to send read receipt:`, errorData);
    }
  } catch (error) {
    console.error('Error sending read receipt:', error);
    // Don't throw - read receipt is not critical
  }
}

// ============================================
// Sanitize Contact Name
// Strips emojis (above-BMP + BMP decorative + joiners),
// escapes HTML entities (anti-XSS), normalizes unicode, limits length.
// Falls back to phone number if name is empty after sanitization.
// ============================================

function sanitizeContactName(raw: string, phoneNumber: string): string {
  const cleaned = raw
    .normalize('NFC')
    // Strip emojis: above-BMP, BMP decorative symbols, variation selectors, ZWJ
    .replace(/[\u{10000}-\u{10FFFF}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    // Escape HTML entities (anti-XSS)
    .replace(/[&<>"']/g, '')
    .trim()
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .slice(0, 100);

  // Fallback to phone number if name is empty after sanitization
  return cleaned || `+${phoneNumber}`;
}

// ============================================
// Handle Incoming Message
// ============================================

async function handleIncomingMessage(
  projectId: string,
  message: WhatsAppMessage,
  contact?: WhatsAppContact
) {
  const whatsappId = message.from;
  const contactName = sanitizeContactName(contact?.profile?.name || '', whatsappId);

  // === DEDUP: Skip if message already processed ===
  // Meta retries webhooks when it doesn't receive 200 fast enough.
  // Without this check, duplicate messages trigger duplicate AI responses.
  if (message.id) {
    const existingMessage = await prisma.message.findFirst({
      where: { whatsappMsgId: message.id },
      select: { id: true },
    });

    if (existingMessage) {
      console.log(`[DEDUP] Message ${message.id} already processed, skipping`);
      return;
    }
  }

  // Extract message content based on type
  let content = '';
  let metadata: Record<string, unknown> = {
    messageType: message.type,
    whatsappMsgId: message.id,
  };

  switch (message.type) {
    case 'text':
      content = (message.text?.body || '').slice(0, 4096);
      break;
    case 'image':
      content = (message.image?.caption || '[Imagen recibida]').slice(0, 2048);
      metadata.mediaId = message.image?.id;
      metadata.mimeType = message.image?.mime_type;
      break;
    case 'audio':
      content = '[Audio recibido]';
      metadata.mediaId = message.audio?.id;
      metadata.mimeType = message.audio?.mime_type;
      break;
    case 'video':
      content = (message.video?.caption || '[Video recibido]').slice(0, 2048);
      metadata.mediaId = message.video?.id;
      metadata.mimeType = message.video?.mime_type;
      break;
    case 'document':
      content = `[Documento: ${(message.document?.filename || 'archivo').slice(0, 255)}]`;
      metadata.mediaId = message.document?.id;
      metadata.mimeType = message.document?.mime_type;
      metadata.filename = message.document?.filename;
      break;
    default:
      content = `[Mensaje tipo: ${message.type}]`;
  }

  // Find or create lead
  let lead = await prisma.lead.findFirst({
    where: {
      projectId,
      whatsappId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      whatsappId: true,
      summary: true,
      handoffMode: true,
      conversation: true,
      assignedAgent: {
        select: { id: true, name: true, systemInstructions: true },
      },
    },
  });

  if (!lead) {
    // Parse sanitized name into first/last
    const nameParts = contactName.split(' ').filter(Boolean);
    const firstName = nameParts[0] || 'Sin nombre';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Find default agent for the project (first active agent)
    const defaultAgent = await prisma.aIAgent.findFirst({
      where: { projectId, isActive: true },
      select: { id: true, name: true, systemInstructions: true },
      orderBy: { createdAt: 'asc' },
    });

    // Create new lead with conversation and assigned agent
    lead = await prisma.lead.create({
      data: {
        projectId,
        firstName,
        lastName,
        phone: `+${whatsappId}`,
        whatsappId,
        channel: LeadChannel.whatsapp,
        type: LeadType.ai_agent,
        status: LeadStatus.new,
        temperature: LeadTemperature.cold,
        handoffMode: HandoffMode.ai,
        lastContactAt: new Date(),
        assignedAgentId: defaultAgent?.id || null,
        conversation: {
          create: {
            messages: {
              create: {
                sender: MessageSender.lead,
                content,
                whatsappMsgId: message.id,
                metadata: metadata as Prisma.InputJsonValue,
              },
            },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        whatsappId: true,
        summary: true,
        handoffMode: true,
        conversation: true,
        assignedAgent: {
          select: { id: true, name: true, systemInstructions: true },
        },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: 'lead_created',
        description: 'Lead creado desde WhatsApp',
        metadata: { source: 'whatsapp_direct', channel: 'whatsapp' },
      },
    });

    console.log(`[OK] New lead created: ${lead.id.substring(0, 8)}...`);
  } else {
    // Add message to existing conversation
    let conversationId = lead.conversation?.id;

    if (!conversationId) {
      const conversation = await prisma.conversation.create({
        data: { leadId: lead.id },
      });
      conversationId = conversation.id;
    }

    // If lead has no assigned agent, assign the first active agent
    // This path requires sequential operations (find agent, then create message + update lead)
    if (!lead.assignedAgent) {
      // Message creation can proceed while we find the agent
      const messageCreatePromise = prisma.message.create({
        data: {
          conversationId,
          sender: MessageSender.lead,
          content,
          whatsappMsgId: message.id,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });

      const defaultAgent = await prisma.aIAgent.findFirst({
        where: { projectId, isActive: true },
        select: { id: true, name: true, systemInstructions: true },
        orderBy: { createdAt: 'asc' },
      });

      if (defaultAgent) {
        await Promise.all([
          messageCreatePromise,
          prisma.lead.update({
            where: { id: lead.id },
            data: {
              lastContactAt: new Date(),
              assignedAgentId: defaultAgent.id,
            },
          }),
        ]);
        // Update lead object for n8n trigger
        lead.assignedAgent = defaultAgent;
        console.log(`[OK] Assigned agent ${defaultAgent.name} to existing lead: ${lead.id}`);
      } else {
        await Promise.all([
          messageCreatePromise,
          prisma.lead.update({
            where: { id: lead.id },
            data: { lastContactAt: new Date() },
          }),
        ]);
      }
    } else {
      // Most common path: lead has agent assigned
      // Parallel: create message + update lastContactAt (independent operations)
      await Promise.all([
        prisma.message.create({
          data: {
            conversationId,
            sender: MessageSender.lead,
            content,
            whatsappMsgId: message.id,
            metadata: metadata as Prisma.InputJsonValue,
          },
        }),
        prisma.lead.update({
          where: { id: lead.id },
          data: { lastContactAt: new Date() },
        }),
      ]);
    }

    console.log(`[OK] Message added to lead: ${lead.id.substring(0, 8)}...`);
  }

  // Background: notify project members about new message
  // waitUntil keeps the function alive on Vercel after response is sent
  const leadName = lead.firstName || contactName;
  waitUntil(
    prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    }).then((project) => {
      if (project) {
        return notifyProjectMembers({
          projectId,
          organizationId: project.organizationId,
          type: 'new_message',
          title: `Nuevo mensaje de ${leadName}`,
          message: content.substring(0, 100),
          metadata: { leadId: lead.id },
          source: 'webhook',
        });
      }
    }).catch((err) => console.error('Notification error:', err))
  );

  // Send read receipt to WhatsApp so lead sees double checkmarks (blue)
  // waitUntil keeps the function alive on Vercel after response is sent
  waitUntil(
    sendReadReceipt(projectId, message.id).catch((err) =>
      console.error('Read receipt error:', err)
    )
  );

  // Process AI response internally if handoffMode is 'ai'
  // Fire-and-forget: don't block webhook response to Meta (must respond <20s)
  if (lead.handoffMode === HandoffMode.ai) {
    // Rate limit per project to protect OpenAI credits
    const aiRateLimit = await checkRateLimit(`ai:pipeline:${projectId}`, {
      maxRequests: 60, // 60 AI responses per minute per project
      windowMs: 60_000,
    });

    if (!aiRateLimit.success) {
      console.warn(`[WhatsApp Webhook] AI pipeline rate limit for project ${projectId.substring(0, 8)}...`);
      return; // Message is saved, lead just won't get AI response this time
    }

    const mediaId = (metadata.mediaId as string) || null;

    // Fetch conversation history + message count for AI pipeline
    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let totalMessageCount = 1;

    if (lead.conversation?.id) {
      const [messageCount, recentMessages] = await Promise.all([
        prisma.message.count({ where: { conversationId: lead.conversation.id } }),
        prisma.message.findMany({
          where: { conversationId: lead.conversation.id },
          orderBy: { createdAt: 'desc' },
          take: 9,
          select: { content: true, sender: true },
        }),
      ]);

      totalMessageCount = messageCount;
      conversationHistory = recentMessages
        .slice(1)
        .reverse()
        .map((msg) => ({
          role: msg.sender === 'lead' ? 'user' as const : 'assistant' as const,
          content: msg.content,
        }));
    }

    // Get project name for company context
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    // Fire-and-forget: process AI response in background
    // waitUntil keeps the serverless function alive after response is sent
    waitUntil(
      processAIResponse({
        projectId,
        conversationId: lead.conversation?.id || '',
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName || ''}`.trim(),
        leadPhone: lead.phone,
        whatsappId: lead.whatsappId || null,
        message: content,
        messageType: message.type,
        mediaId,
        agentId: lead.assignedAgent?.id || null,
        agentName: lead.assignedAgent?.name || 'Asistente',
        systemInstructions: lead.assignedAgent?.systemInstructions || null,
        companyName: project?.name || 'KAIRO',
        conversationHistory,
        historyCount: conversationHistory.length,
        messageCount: totalMessageCount,
        summaryThreshold: 5,
        leadSummary: lead.summary || null,
      }).catch((err) =>
        console.error('[WhatsApp Webhook] AI pipeline error:', err)
      )
    );
  }
}

// NOTE: triggerN8nWorkflow() was removed in v0.8.0
// AI pipeline now runs internally via processAIResponse() from @/lib/ai/process-ai-response
// See docs/RAG-AGENTS.md for architecture details

// ============================================
// Handle Status Update
// Single lookup - no retry loop needed since this runs fire-and-forget
// and WhatsApp sends status updates repeatedly (sent → delivered → read)
// If the message isn't saved yet, the next status event will pick it up
// ============================================

async function handleStatusUpdate(projectId: string, status: WhatsAppStatus) {
  const message = await prisma.message.findFirst({
    where: {
      whatsappMsgId: status.id,
    },
  });

  if (!message) {
    // Message might not be saved yet (race condition with /api/ai/respond)
    // This is acceptable - WhatsApp sends status updates repeatedly
    // and the status will be picked up on the next delivery
    console.log(`[WhatsApp Webhook] Message not found for status update - will be updated on next event`);
    return;
  }

  console.log(`[FOUND] Message ${message.id.substring(0, 8)}... status: ${status.status}`);

  const now = new Date();
  const existingMetadata = (message.metadata as Record<string, unknown>) || {};

  // Build update data based on status
  // WhatsApp status flow: sent → delivered → read
  const newMetadata: Prisma.InputJsonValue = {
    ...existingMetadata,
    deliveryStatus: status.status,
    statusTimestamp: status.timestamp,
  };

  // Start with just metadata
  const updateData: Prisma.MessageUpdateInput = {
    metadata: newMetadata,
  };

  // Update delivery status
  if (status.status === 'delivered') {
    updateData.isDelivered = true;
    updateData.deliveredAt = now;
    console.log(`[DELIVERED] Message: ${status.id}`);
  }

  // Update read status (also implies delivered)
  if (status.status === 'read') {
    updateData.isDelivered = true;
    updateData.deliveredAt = message.deliveredAt || now;
    updateData.isRead = true;
    updateData.readAt = now;
    console.log(`[READ] Message: ${status.id}`);
  }

  await prisma.message.update({
    where: { id: message.id },
    data: updateData,
  });

  console.log(`[OK] Message ${status.id} status updated: ${status.status}`);
}
