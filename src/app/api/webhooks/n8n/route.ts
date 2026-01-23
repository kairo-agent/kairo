// ============================================
// KAIRO - n8n Webhook Endpoints
// Receives leads and messages from n8n/WhatsApp
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { LeadChannel, LeadType, LeadStatus, LeadTemperature, HandoffMode, MessageSender } from '@prisma/client';

// ============================================
// Types for incoming webhook payloads
// ============================================

interface InboundLeadPayload {
  action: 'create_lead';
  // Project identification
  projectId: string;
  apiKey: string;
  // Lead data
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  whatsappId: string; // WhatsApp ID from Meta API
  // Initial message
  initialMessage: string;
  // Optional: AI analysis
  temperature?: 'cold' | 'warm' | 'hot';
  businessName?: string;
  position?: string;
}

interface InboundMessagePayload {
  action: 'new_message';
  projectId: string;
  apiKey: string;
  // Lead identification
  whatsappId: string;
  // Message data
  content: string;
  sender: 'ai' | 'lead'; // Only AI or lead can send inbound messages
  whatsappMsgId?: string;
  metadata?: Record<string, unknown>;
}

interface HandoffPayload {
  action: 'handoff';
  projectId: string;
  apiKey: string;
  whatsappId: string;
  mode: 'ai' | 'human';
}

type WebhookPayload = InboundLeadPayload | InboundMessagePayload | HandoffPayload;

// ============================================
// Helper: Validate API Key
// ============================================

async function validateApiKey(projectId: string, apiKey: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { n8nApiKey: true, isActive: true },
  });

  if (!project || !project.isActive) {
    return false;
  }

  // If no API key is set, allow requests (for development)
  if (!project.n8nApiKey) {
    return true;
  }

  return project.n8nApiKey === apiKey;
}

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload: WebhookPayload = await request.json();

    // Validate required fields
    if (!payload.projectId || !payload.apiKey) {
      return NextResponse.json(
        { error: 'Missing projectId or apiKey' },
        { status: 400 }
      );
    }

    // Validate API key
    const isValid = await validateApiKey(payload.projectId, payload.apiKey);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid API key or project not found' },
        { status: 401 }
      );
    }

    // Route to appropriate handler based on action
    switch (payload.action) {
      case 'create_lead':
        return handleCreateLead(payload);
      case 'new_message':
        return handleNewMessage(payload);
      case 'handoff':
        return handleHandoff(payload);
      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// Action: Create Lead
// ============================================

async function handleCreateLead(payload: InboundLeadPayload) {
  // Check if lead already exists by whatsappId
  const existingLead = await prisma.lead.findFirst({
    where: {
      projectId: payload.projectId,
      whatsappId: payload.whatsappId,
    },
  });

  if (existingLead) {
    // Lead exists, add message to conversation instead
    return handleNewMessage({
      action: 'new_message',
      projectId: payload.projectId,
      apiKey: payload.apiKey,
      whatsappId: payload.whatsappId,
      content: payload.initialMessage,
      sender: 'lead',
    });
  }

  // Create new lead with conversation and initial message
  const lead = await prisma.lead.create({
    data: {
      projectId: payload.projectId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      email: payload.email,
      whatsappId: payload.whatsappId,
      channel: LeadChannel.whatsapp,
      type: LeadType.ai_agent,
      status: LeadStatus.new,
      temperature: payload.temperature
        ? (payload.temperature.toUpperCase() as LeadTemperature)
        : LeadTemperature.cold,
      businessName: payload.businessName,
      position: payload.position,
      handoffMode: HandoffMode.ai,
      lastContactAt: new Date(),
      // Create conversation with initial message
      conversation: {
        create: {
          messages: {
            create: {
              sender: MessageSender.lead,
              content: payload.initialMessage,
            },
          },
        },
      },
    },
    include: {
      conversation: {
        include: {
          messages: true,
        },
      },
    },
  });

  // Log activity
  await prisma.activity.create({
    data: {
      leadId: lead.id,
      type: 'lead_created',
      description: 'Lead creado desde WhatsApp',
      metadata: { source: 'n8n', channel: 'whatsapp' },
    },
  });

  return NextResponse.json({
    success: true,
    leadId: lead.id,
    conversationId: lead.conversation?.id,
  });
}

// ============================================
// Action: New Message
// ============================================

async function handleNewMessage(payload: InboundMessagePayload) {
  // Find lead by whatsappId
  const lead = await prisma.lead.findFirst({
    where: {
      projectId: payload.projectId,
      whatsappId: payload.whatsappId,
    },
    include: {
      conversation: true,
    },
  });

  if (!lead) {
    return NextResponse.json(
      { error: 'Lead not found' },
      { status: 404 }
    );
  }

  // If handoffMode is human and sender is lead, we need to notify KAIRO
  // The message will be stored and visible in the UI

  let conversationId = lead.conversation?.id;

  // Create conversation if it doesn't exist
  if (!conversationId) {
    const conversation = await prisma.conversation.create({
      data: {
        leadId: lead.id,
      },
    });
    conversationId = conversation.id;
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      conversationId,
      sender: payload.sender === 'ai' ? MessageSender.ai : MessageSender.lead,
      content: payload.content,
      whatsappMsgId: payload.whatsappMsgId,
      metadata: payload.metadata as Prisma.InputJsonValue | undefined,
    },
  });

  // Update lead's lastContactAt
  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastContactAt: new Date() },
  });

  return NextResponse.json({
    success: true,
    messageId: message.id,
    leadId: lead.id,
    handoffMode: lead.handoffMode,
  });
}

// ============================================
// Action: Handoff Mode Change
// ============================================

async function handleHandoff(payload: HandoffPayload) {
  // Find lead by whatsappId
  const lead = await prisma.lead.findFirst({
    where: {
      projectId: payload.projectId,
      whatsappId: payload.whatsappId,
    },
  });

  if (!lead) {
    return NextResponse.json(
      { error: 'Lead not found' },
      { status: 404 }
    );
  }

  // Update handoff mode
  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      handoffMode: payload.mode === 'human' ? HandoffMode.human : HandoffMode.ai,
      handoffAt: payload.mode === 'human' ? new Date() : null,
    },
  });

  // Log activity
  await prisma.activity.create({
    data: {
      leadId: lead.id,
      type: 'handoff_change',
      description: payload.mode === 'human'
        ? 'Conversación transferida a humano'
        : 'Conversación retornada a IA',
      metadata: { mode: payload.mode },
    },
  });

  return NextResponse.json({
    success: true,
    leadId: lead.id,
    handoffMode: updatedLead.handoffMode,
  });
}

// ============================================
// GET Handler (for testing/health check)
// ============================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'KAIRO n8n Webhook',
    endpoints: {
      'POST /api/webhooks/n8n': {
        actions: ['create_lead', 'new_message', 'handoff'],
      },
    },
  });
}
