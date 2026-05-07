// ============================================
// KAIRO - Messages Server Actions
// Chat functionality for leads
// ============================================

'use server';

import { prisma } from '@/lib/prisma';
import { verifyAuth, verifyProjectAccess, getProjectRole } from './auth';
import { getProjectSecret } from './secrets';
import { getEffectiveRole, isViewerOnly, canActOnLead } from '@/lib/permissions';
import type { Message, Conversation, Prisma } from '@prisma/client';
import { MessageSender, HandoffMode } from '@prisma/client';

// ============================================
// Types
// ============================================

/**
 * Full Message type with sender info (used for message creation responses)
 */
export type MessageWithSender = Message & {
  sentByUser: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

/**
 * Optimized Message type for chat display (Phase 4 Performance)
 * Includes metadata for audio transcription display.
 * Excludes large fields not needed for rendering:
 * - deliveredAt/readAt: timestamps not shown in UI, isDelivered/isRead flags are sufficient
 */
export type MessageForChat = {
  id: string;
  conversationId: string;
  sender: Message['sender'];
  content: string;
  createdAt: Date;
  sentByUserId: string | null;
  whatsappMsgId: string | null;
  isDelivered: boolean;
  isRead: boolean;
  metadata: Prisma.JsonValue | null;
  sentByUser: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

// ============================================
// Optimized Select Patterns (Phase 4 Performance)
// ============================================

/**
 * Optimized select for chat display.
 * Includes metadata for audio transcription display.
 * Excludes large fields not needed for rendering:
 * - deliveredAt/readAt: timestamps not shown in UI, isDelivered/isRead flags are sufficient
 */
const messageSelectForChat = {
  id: true,
  conversationId: true,
  sender: true,
  content: true,
  createdAt: true,
  sentByUserId: true,
  whatsappMsgId: true,
  isDelivered: true,
  isRead: true,
  metadata: true,
  // Exclude: deliveredAt, readAt (not needed for display)
  sentByUser: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

/**
 * Minimal select for Lead access verification.
 * Only fetches projectId needed for permission check.
 */
const leadSelectForAccessCheck = {
  projectId: true,
} as const;

/**
 * Select for Lead when sending messages.
 * Includes only fields needed for message delivery.
 */
const leadSelectForSendMessage = {
  id: true,
  projectId: true,
  firstName: true,
  lastName: true,
  phone: true,
  whatsappId: true,
  assignedUserId: true,
  project: {
    select: {
      id: true,
    },
  },
  conversation: {
    select: { id: true },
  },
} as const;

/**
 * Select for Lead when toggling handoff mode.
 * Only needs projectId for access check.
 */
const leadSelectForHandoffToggle = {
  id: true,
  projectId: true,
  whatsappId: true,
  assignedUserId: true,
} as const;

/**
 * Conversation type with optimized messages for chat display
 */
export type ConversationWithMessages = Conversation & {
  messages: MessageForChat[];
};

export type PaginatedConversation = {
  conversation: ConversationWithMessages | null;
  pagination: {
    hasMore: boolean;
    nextCursor: string | null; // ID del mensaje más antiguo
    totalCount: number;
  };
};

// ============================================
// GET CONVERSATION FOR A LEAD
// ============================================

export async function getLeadConversation(
  leadId: string,
  options?: {
    cursor?: string;  // ID del mensaje desde donde cargar (excluido)
    limit?: number;   // Máximo 100, default 50
  }
): Promise<PaginatedConversation | null> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return null;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: leadSelectForAccessCheck,
    });

    if (!lead) {
      return null;
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return null;
    }

    // Get conversation first (without messages)
    const conversation = await prisma.conversation.findUnique({
      where: { leadId },
      select: { id: true, leadId: true, createdAt: true, updatedAt: true },
    });

    if (!conversation) {
      return {
        conversation: null,
        pagination: {
          hasMore: false,
          nextCursor: null,
          totalCount: 0,
        },
      };
    }

    // Calculate limit (max 100, default 50)
    const limit = Math.min(options?.limit || 50, 100);

    // PERFORMANCE (P2-3): Parallel count + messages query (~30-80ms savings)
    const [totalCount, messages] = await Promise.all([
      prisma.message.count({
        where: { conversationId: conversation.id },
      }),
      prisma.message.findMany({
        where: { conversationId: conversation.id },
        select: messageSelectForChat,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(options?.cursor && {
          cursor: { id: options.cursor },
          skip: 1,
        }),
      }),
    ]);

    // Check if there are more messages
    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop();  // Remove the extra message
    }

    // Reverse to get chronological order (oldest first)
    messages.reverse();

    // Next cursor is the ID of the oldest message in the current batch
    const nextCursor = hasMore ? messages[0]?.id ?? null : null;

    // Build the full conversation object with messages
    const conversationWithMessages: ConversationWithMessages = {
      id: conversation.id,
      leadId: conversation.leadId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages,
    };

    return {
      conversation: conversationWithMessages,
      pagination: {
        hasMore,
        nextCursor,
        totalCount,
      },
    };
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return null;
  }
}

// ============================================
// GET LEAD PROJECT ID (for client-side media upload)
// ============================================

export async function getLeadProjectId(
  leadId: string
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: leadSelectForAccessCheck,
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso a este lead' };
    }

    return { success: true, projectId: lead.projectId };
  } catch (error) {
    console.error('Error getting lead project ID:', error);
    return { success: false, error: 'Error al obtener proyecto' };
  }
}

// ============================================
// SEND MESSAGE (Asesor humano → Lead via WhatsApp Cloud API)
// ============================================

export async function sendMessage(
  leadId: string,
  content: string,
  mediaUrl?: string,
  mediaType?: 'image' | 'video' | 'document',
  filename?: string,
  caption?: string
): Promise<{ success: boolean; message?: MessageWithSender; error?: string }> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    // Allow empty content if there's a mediaUrl (image-only message)
    if (!content.trim() && !mediaUrl) {
      return { success: false, error: 'El mensaje no puede estar vacío' };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: leadSelectForSendMessage,
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso a este lead' };
    }

    // Role-based access control
    const roleInfo = await getProjectRole(user.id, user.systemRole, lead.projectId);
    const effectiveRole = getEffectiveRole(user.systemRole, roleInfo.isOrgOwner ?? false, roleInfo.projectRole);
    if (isViewerOnly(effectiveRole)) {
      return { success: false, error: 'Sin permisos para esta acción' };
    }
    if (!canActOnLead(effectiveRole, lead.assignedUserId, user.id)) {
      return { success: false, error: 'Este lead está asignado a otro usuario' };
    }

    // Ensure conversation exists
    let conversationId = lead.conversation?.id;
    if (!conversationId) {
      const conversation = await prisma.conversation.create({
        data: { leadId },
      });
      conversationId = conversation.id;
    }

    // Create message in database
    const message = await prisma.message.create({
      data: {
        conversationId,
        sender: MessageSender.human,
        content: content.trim(),
        sentByUserId: user.id,
        ...(mediaUrl && {
          metadata: {
            mediaAttachments: [{ url: mediaUrl, title: filename || (mediaType === 'image' ? 'Imagen' : mediaType === 'video' ? 'Video' : 'Archivo') }],
            mediaType: mediaType || 'image',
          },
        }),
      },
      include: {
        sentByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Send directly via WhatsApp Cloud API
    if (lead.whatsappId) {
      try {
        const [accessToken, phoneNumberId] = await Promise.all([
          getProjectSecret(lead.projectId, 'whatsapp_access_token'),
          getProjectSecret(lead.projectId, 'whatsapp_phone_number_id'),
        ]);

        if (accessToken && phoneNumberId) {
          const cleanPhone = lead.whatsappId.replace(/[^0-9]/g, '');
          const whatsappApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

          // Build payload based on media type
          let whatsappPayload: Record<string, unknown>;
          const msgType = mediaUrl ? (mediaType || 'image') : 'text';

          if (msgType === 'text' || !mediaUrl) {
            whatsappPayload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanPhone,
              type: 'text',
              text: { body: content.trim() },
            };
          } else if (msgType === 'image') {
            whatsappPayload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanPhone,
              type: 'image',
              image: { link: mediaUrl, ...(caption ? { caption } : content.trim() ? { caption: content.trim() } : {}) },
            };
          } else if (msgType === 'video') {
            whatsappPayload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanPhone,
              type: 'video',
              video: { link: mediaUrl, ...(caption ? { caption } : content.trim() ? { caption: content.trim() } : {}) },
            };
          } else if (msgType === 'document') {
            whatsappPayload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanPhone,
              type: 'document',
              document: { link: mediaUrl, ...(filename ? { filename } : {}), ...(caption ? { caption } : content.trim() ? { caption: content.trim() } : {}) },
            };
          } else {
            // Fallback: send as text
            whatsappPayload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanPhone,
              type: 'text',
              text: { body: content.trim() },
            };
          }

          console.log(`[SEND] Human message via WhatsApp API to ${cleanPhone.substring(0, 6)}...`);

          const waResponse = await fetch(whatsappApiUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(whatsappPayload),
          });

          const waData = await waResponse.json();

          if (!waResponse.ok) {
            console.error(`[FAIL] WhatsApp API error:`, waData.error?.message || waData);
            const existingMeta = (message.metadata as Record<string, unknown>) || {};
            await prisma.message.update({
              where: { id: message.id },
              data: {
                metadata: {
                  ...existingMeta,
                  whatsappError: waData.error?.message || 'Unknown error',
                  whatsappErrorCode: waData.error?.code,
                  sentVia: 'human_chat_direct',
                },
              },
            });
          } else {
            const whatsappMsgId = waData.messages?.[0]?.id;
            console.log(`[OK] Human message sent via WhatsApp API${whatsappMsgId ? ` (wamid: ${whatsappMsgId.substring(0, 12)}...)` : ''}`);
            const existingMeta = (message.metadata as Record<string, unknown>) || {};
            await prisma.message.update({
              where: { id: message.id },
              data: {
                ...(whatsappMsgId ? { whatsappMsgId, isDelivered: true, deliveredAt: new Date() } : {}),
                metadata: { ...existingMeta, sentVia: 'human_chat_direct' },
              },
            });
          }
        } else {
          console.error('[FAIL] WhatsApp credentials not configured for project');
        }
      } catch (waError) {
        console.error('[FAIL] Error sending to WhatsApp:', waError);
        // Don't fail the whole operation - message is saved in DB
      }
    }

    // PERFORMANCE (P2-5): Parallel post-send operations (~100-200ms savings)
    await Promise.all([
      prisma.lead.update({
        where: { id: leadId },
        data: { lastContactAt: new Date() },
      }),
      prisma.activity.create({
        data: {
          leadId,
          type: 'message_sent',
          description: 'Mensaje enviado por vendedor',
          performedBy: user.id,
        },
      }),
    ]);

    return { success: true, message };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: 'Error al enviar mensaje' };
  }
}

// ============================================
// TOGGLE HANDOFF MODE
// ============================================

export async function toggleHandoffMode(
  leadId: string,
  mode: 'ai' | 'human'
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: leadSelectForHandoffToggle,
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso a este lead' };
    }

    // Role-based access control
    const roleInfo = await getProjectRole(user.id, user.systemRole, lead.projectId);
    const effectiveRole = getEffectiveRole(user.systemRole, roleInfo.isOrgOwner ?? false, roleInfo.projectRole);
    if (isViewerOnly(effectiveRole)) {
      return { success: false, error: 'Sin permisos para esta acción' };
    }
    if (!canActOnLead(effectiveRole, lead.assignedUserId, user.id)) {
      return { success: false, error: 'Este lead está asignado a otro usuario' };
    }

    // Update handoff mode
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        handoffMode: mode === 'human' ? HandoffMode.human : HandoffMode.ai,
        handoffAt: mode === 'human' ? new Date() : null,
        handoffUserId: mode === 'human' ? user.id : null,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        leadId,
        type: 'handoff_change',
        description: mode === 'human'
          ? `${user.firstName} ${user.lastName} tomó el control de la conversación`
          : `${user.firstName} ${user.lastName} devolvió el control a la IA`,
        performedBy: user.id,
        metadata: { mode },
      },
    });

    // Auto-assign lead if unassigned when taking control
    if (mode === 'human' && !lead.assignedUserId) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { assignedUserId: user.id },
      });

      await prisma.activity.create({
        data: {
          leadId,
          type: 'lead_assigned',
          description: `${user.firstName} ${user.lastName} se auto-asignó el lead al tomar control`,
          performedBy: user.id,
          metadata: {
            previousAssignedUserId: null,
            newAssignedUserId: user.id,
            trigger: 'take_control',
          },
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error toggling handoff mode:', error);
    return { success: false, error: 'Error al cambiar modo' };
  }
}

// ============================================
// GET LEAD HANDOFF STATUS
// ============================================

export async function getLeadHandoffStatus(
  leadId: string
): Promise<{
  mode: 'ai' | 'human';
  handoffAt: Date | null;
  handoffUser: string | null;
  channel: string | null;
  lastLeadMessageAt: Date | null;
} | null> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return null;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        projectId: true,
        handoffMode: true,
        handoffAt: true,
        channel: true,
        handoffUser: {
          select: { firstName: true, lastName: true },
        },
        conversation: {
          select: { id: true },
        },
      },
    });

    if (!lead) {
      return null;
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, lead.projectId);
    if (!hasAccess) {
      return null;
    }

    // Get the last message from the lead (for WhatsApp 24h window calculation)
    let lastLeadMessageAt: Date | null = null;
    if (lead.conversation) {
      const lastLeadMsg = await prisma.message.findFirst({
        where: {
          conversationId: lead.conversation.id,
          sender: 'lead',
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      lastLeadMessageAt = lastLeadMsg?.createdAt ?? null;
    }

    return {
      mode: lead.handoffMode as 'ai' | 'human',
      handoffAt: lead.handoffAt,
      handoffUser: lead.handoffUser
        ? `${lead.handoffUser.firstName} ${lead.handoffUser.lastName}`
        : null,
      channel: lead.channel,
      lastLeadMessageAt,
    };
  } catch (error) {
    console.error('Error getting handoff status:', error);
    return null;
  }
}

// ============================================
// MARK MESSAGES AS READ (Local + WhatsApp)
// ============================================

export async function markMessagesAsRead(
  leadId: string
): Promise<{ success: boolean; error?: string; whatsappSent?: number }> {
  try {
    const user = await verifyAuth();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const conversation = await prisma.conversation.findUnique({
      where: { leadId },
      select: {
        id: true,
        lead: {
          select: {
            id: true,
            projectId: true,
            handoffMode: true,
          },
        },
      },
    });

    if (!conversation) {
      return { success: false, error: 'Conversación no encontrada' };
    }

    const projectId = conversation.lead.projectId;

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin acceso' };
    }

    // Get unread messages from lead that have WhatsApp IDs
    // Optimized select - only fetches id and whatsappMsgId needed for read receipts
    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        sender: MessageSender.lead,
        isRead: false,
        whatsappMsgId: { not: null },
      },
      select: {
        id: true,           // Message ID (for reference)
        whatsappMsgId: true, // WhatsApp message ID for sending read receipt
      },
    });

    // Mark all unread messages from lead as read in local DB
    await prisma.message.updateMany({
      where: {
        conversationId: conversation.id,
        sender: MessageSender.lead,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Send read receipts to WhatsApp if in human mode and there are messages with WhatsApp IDs
    let whatsappSent = 0;
    const isHumanMode = conversation.lead.handoffMode === HandoffMode.human;

    if (isHumanMode && unreadMessages.length > 0) {
      const whatsappMsgIds = unreadMessages
        .map((m) => m.whatsappMsgId)
        .filter((id): id is string => id !== null);

      if (whatsappMsgIds.length > 0) {
        try {
          // Get WhatsApp credentials
          const [accessToken, phoneNumberId] = await Promise.all([
            getProjectSecret(projectId, 'whatsapp_access_token'),
            getProjectSecret(projectId, 'whatsapp_phone_number_id'),
          ]);

          if (accessToken && phoneNumberId) {
            // Send read receipts to WhatsApp API directly
            // Process in batches of 10 to avoid overwhelming the API
            const batchSize = 10;
            const whatsappApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

            for (let i = 0; i < whatsappMsgIds.length; i += batchSize) {
              const batch = whatsappMsgIds.slice(i, i + batchSize);

              const results = await Promise.allSettled(
                batch.map(async (messageId) => {
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
                    }),
                  });

                  if (!response.ok) {
                    const errorText = await response.text().catch(() => '');
                    console.error(
                      `[KAIRO] WhatsApp read receipt failed for ${messageId}:`,
                      errorText.substring(0, 100)
                    );
                    throw new Error('Failed');
                  }

                  return messageId;
                })
              );

              // Count successful sends
              whatsappSent += results.filter((r) => r.status === 'fulfilled').length;
            }

            console.log(
              `[KAIRO] WhatsApp read receipts sent: ${whatsappSent}/${whatsappMsgIds.length}`
            );
          } else {
            console.log(
              '[KAIRO] WhatsApp credentials not configured, skipping read receipts'
            );
          }
        } catch (whatsappError) {
          // Don't fail the whole operation if WhatsApp fails
          console.error('[KAIRO] Error sending WhatsApp read receipts:', whatsappError);
        }
      }
    }

    return { success: true, whatsappSent };
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return { success: false, error: 'Error al marcar como leído' };
  }
}
