// ============================================
// KAIRO - WhatsApp Webhook Endpoints
// Receives messages directly from Meta WhatsApp Cloud API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
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

  // Check if this is a verification request
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verified successfully');
    // Return the challenge as plain text (required by Meta)
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // If verification fails
  console.warn('❌ WhatsApp webhook verification failed', { mode, token });
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
    // IMPORTANTE: Leer body raw ANTES de cualquier otra cosa
    // Necesitamos el texto crudo para verificar la firma HMAC
    const rawBody = await request.text();

    // ============================================
    // Verificar firma de Meta (X-Hub-Signature-256)
    // ============================================
    const signature = request.headers.get('X-Hub-Signature-256');
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    const isDev = process.env.NODE_ENV === 'development';
    const bypassSignature = process.env.WEBHOOK_BYPASS_SIGNATURE === 'true';

    if (!isDev || !bypassSignature) {
      // Produccion o desarrollo sin bypass: verificar firma obligatoriamente
      if (!appSecret) {
        console.error('[WhatsApp Webhook] WHATSAPP_APP_SECRET not configured');
        // Retornar 200 para no exponer error de configuracion a posibles atacantes
        return NextResponse.json({ success: true });
      }

      if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
        console.warn('[WhatsApp Webhook] Invalid signature - possible spoofing attempt', {
          hasSignature: !!signature,
          timestamp: new Date().toISOString(),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        });
        // Retornar 200 para no dar pistas a atacantes (security by obscurity)
        return NextResponse.json({ success: true });
      }

      console.log('[WhatsApp Webhook] Signature verified successfully');
    } else {
      console.warn('[WhatsApp Webhook] DEV MODE: Signature verification bypassed');
    }

    // ============================================
    // Parsear JSON despues de verificar firma
    // ============================================
    let payload: WhatsAppWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[WhatsApp Webhook] Invalid JSON payload:', parseError);
      // Retornar 200 para no exponer errores
      return NextResponse.json({ success: true });
    }

    // Validate it's from WhatsApp
    if (payload.object !== 'whatsapp_business_account') {
      console.warn('[WhatsApp Webhook] Invalid payload object:', payload.object);
      return NextResponse.json({ success: true });
    }

    // Process each entry
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

  // Find project by phone number ID
  const project = await findProjectByPhoneNumberId(phoneNumberId);

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
  if (statuses) {
    for (const status of statuses) {
      await handleStatusUpdate(project.id, status);
    }
  }
}

// ============================================
// Find Project by Phone Number ID
// ============================================

async function findProjectByPhoneNumberId(phoneNumberId: string) {
  console.log(`🔍 Looking for project with phone_number_id: ${phoneNumberId}`);

  // Get all projects with whatsapp_phone_number_id configured
  const secrets = await prisma.projectSecret.findMany({
    where: {
      key: 'whatsapp_phone_number_id',
    },
    include: {
      project: true,
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
        console.log(`✅ Found project: ${secret.project.name} (${secret.projectId})`);
        return secret.project;
      }
    } catch (error) {
      console.error(`Error decrypting secret for project ${secret.projectId}:`, error);
    }
  }

  // Fallback for development: use first active project
  console.warn('⚠️ No matching project found, using fallback for development');
  const fallbackProject = await prisma.project.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  if (fallbackProject) {
    console.log(`📍 Using fallback project: ${fallbackProject.name}`);
  }

  return fallbackProject;
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
  const contactName = contact?.profile?.name || 'Unknown';

  // Extract message content based on type
  let content = '';
  let metadata: Record<string, unknown> = {
    messageType: message.type,
    whatsappMsgId: message.id,
  };

  switch (message.type) {
    case 'text':
      content = message.text?.body || '';
      break;
    case 'image':
      content = message.image?.caption || '[Imagen recibida]';
      metadata.mediaId = message.image?.id;
      metadata.mimeType = message.image?.mime_type;
      break;
    case 'audio':
      content = '[Audio recibido]';
      metadata.mediaId = message.audio?.id;
      metadata.mimeType = message.audio?.mime_type;
      break;
    case 'video':
      content = message.video?.caption || '[Video recibido]';
      metadata.mediaId = message.video?.id;
      metadata.mimeType = message.video?.mime_type;
      break;
    case 'document':
      content = `[Documento: ${message.document?.filename || 'archivo'}]`;
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
    include: {
      conversation: true,
    },
  });

  if (!lead) {
    // Parse name into first/last
    const nameParts = contactName.split(' ');
    const firstName = nameParts[0] || 'Sin nombre';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create new lead with conversation
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
      include: {
        conversation: true,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: 'lead_created',
        description: `Lead creado desde WhatsApp: ${contactName}`,
        metadata: { source: 'whatsapp_direct', channel: 'whatsapp' },
      },
    });

    console.log(`✅ New lead created: ${lead.id} (${contactName})`);
  } else {
    // Add message to existing conversation
    let conversationId = lead.conversation?.id;

    if (!conversationId) {
      const conversation = await prisma.conversation.create({
        data: { leadId: lead.id },
      });
      conversationId = conversation.id;
    }

    await prisma.message.create({
      data: {
        conversationId,
        sender: MessageSender.lead,
        content,
        whatsappMsgId: message.id,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    // Update last contact
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastContactAt: new Date() },
    });

    console.log(`✅ Message added to lead: ${lead.id}`);
  }

  // Trigger n8n workflow for AI response if handoffMode is 'ai'
  if (lead.handoffMode === HandoffMode.ai) {
    await triggerN8nWorkflow(projectId, lead, content, message.type);
  }
}

// ============================================
// Trigger n8n Workflow
// ============================================

async function triggerN8nWorkflow(
  projectId: string,
  lead: { id: string; firstName: string; lastName: string | null; phone: string | null; conversation: { id: string } | null },
  messageContent: string,
  messageType: string
) {
  // Get n8n webhook URL from project settings
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { n8nWebhookUrl: true, name: true },
  });

  // Default to local n8n if no URL configured
  const n8nUrl = project?.n8nWebhookUrl || 'http://localhost:5678/webhook/kairo-incoming';

  if (!n8nUrl) {
    console.log('⚠️ No n8n webhook URL configured, skipping AI trigger');
    return;
  }

  const payload = {
    projectId,
    conversationId: lead.conversation?.id,
    leadId: lead.id,
    leadName: `${lead.firstName} ${lead.lastName || ''}`.trim(),
    leadPhone: lead.phone,
    mode: 'ai', // AI mode - n8n will generate response
    message: messageContent,
    messageType,
    timestamp: new Date().toISOString(),
  };

  try {
    console.log(`🤖 Triggering n8n workflow: ${n8nUrl}`);

    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`✅ n8n workflow triggered successfully`);
    } else {
      console.error(`❌ n8n webhook failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('❌ Error triggering n8n workflow:', error);
    // Don't throw - we don't want to fail the webhook response
  }
}

// ============================================
// Handle Status Update
// ============================================

async function handleStatusUpdate(projectId: string, status: WhatsAppStatus) {
  // Find message by whatsappMsgId
  const message = await prisma.message.findFirst({
    where: {
      whatsappMsgId: status.id,
    },
  });

  if (!message) {
    console.log(`⚠️ Message not found for whatsappMsgId: ${status.id}`);
    return;
  }

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
    console.log(`📬 Message delivered: ${status.id}`);
  }

  // Update read status (also implies delivered)
  if (status.status === 'read') {
    updateData.isDelivered = true;
    updateData.deliveredAt = message.deliveredAt || now;
    updateData.isRead = true;
    updateData.readAt = now;
    console.log(`👁️ Message read: ${status.id}`);
  }

  await prisma.message.update({
    where: { id: message.id },
    data: updateData,
  });

  console.log(`✅ Message ${status.id} status updated: ${status.status}`);
}
