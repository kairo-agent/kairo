// ============================================
// KAIRO - Messages Server Actions
// Chat functionality for leads
// ============================================

'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from './auth';
import { getProjectSecret } from './secrets';
import type { Message, Conversation } from '@prisma/client';
import { MessageSender, HandoffMode } from '@prisma/client';

// ============================================
// Types
// ============================================

export type MessageWithSender = Message & {
  sentByUser: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type ConversationWithMessages = Conversation & {
  messages: MessageWithSender[];
};

// ============================================
// GET CONVERSATION FOR A LEAD
// ============================================

export async function getLeadConversation(
  leadId: string
): Promise<ConversationWithMessages | null> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return null;
    }

    // Verify user has access to the lead's project
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { projectId: true },
    });

    if (!lead) {
      return null;
    }

    if (user.systemRole !== 'super_admin') {
      const hasAccess = user.projectMemberships?.some(
        (m) => m.projectId === lead.projectId
      );
      if (!hasAccess) {
        return null;
      }
    }

    // Get conversation with messages
    const conversation = await prisma.conversation.findUnique({
      where: { leadId },
      include: {
        messages: {
          include: {
            sentByUser: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return conversation;
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
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { projectId: true },
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    // Check user has access
    if (user.systemRole !== 'super_admin') {
      const hasAccess = user.projectMemberships?.some(
        (m) => m.projectId === lead.projectId
      );
      if (!hasAccess) {
        return { success: false, error: 'Sin acceso a este lead' };
      }
    }

    return { success: true, projectId: lead.projectId };
  } catch (error) {
    console.error('Error getting lead project ID:', error);
    return { success: false, error: 'Error al obtener proyecto' };
  }
}

// ============================================
// SEND MESSAGE (Human → Lead via n8n)
// ============================================

export async function sendMessage(
  leadId: string,
  content: string,
  mediaUrl?: string,
  mediaType?: 'image' | 'video' | 'document'
): Promise<{ success: boolean; message?: MessageWithSender; error?: string }> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    // Allow empty content if there's a mediaUrl (image-only message)
    if (!content.trim() && !mediaUrl) {
      return { success: false, error: 'El mensaje no puede estar vacío' };
    }

    // Get lead with project info
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        project: {
          select: {
            id: true,
            n8nWebhookUrl: true,
            whatsappPhoneNumber: true,
          },
        },
        conversation: true,
      },
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    // Check user has access
    if (user.systemRole !== 'super_admin') {
      const hasAccess = user.projectMemberships?.some(
        (m) => m.projectId === lead.projectId
      );
      if (!hasAccess) {
        return { success: false, error: 'Sin acceso a este lead' };
      }
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
      },
      include: {
        sentByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Send via n8n workflow (unified routing for both AI and Human modes)
    // n8n will handle the routing based on mode and send to WhatsApp
    if (lead.whatsappId && lead.project.n8nWebhookUrl) {
      try {
        // Get WhatsApp credentials for n8n to call WhatsApp API directly
        const [accessToken, phoneNumberId] = await Promise.all([
          getProjectSecret(lead.projectId, 'whatsapp_access_token'),
          getProjectSecret(lead.projectId, 'whatsapp_phone_number_id'),
        ]);

        const n8nPayload = {
          projectId: lead.projectId,
          conversationId,
          leadId: lead.id,
          leadName: `${lead.firstName} ${lead.lastName || ''}`.trim(),
          leadPhone: lead.phone,
          to: lead.whatsappId, // WhatsApp recipient number
          mode: 'human', // Human agent sending message
          message: content.trim(),
          messageType: mediaUrl ? mediaType || 'image' : 'text',
          mediaUrl: mediaUrl || null,
          timestamp: new Date().toISOString(),
          // WhatsApp API credentials for n8n to send directly
          accessToken: accessToken || '',
          phoneNumberId: phoneNumberId || '',
          metadata: {
            agentId: user.id,
            agentName: `${user.firstName} ${user.lastName}`,
            messageDbId: message.id,
          },
        };

        console.log(`📤 Sending human message via n8n: ${lead.project.n8nWebhookUrl}`);

        const n8nResponse = await fetch(lead.project.n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(n8nPayload),
        });

        if (!n8nResponse.ok) {
          console.error(`❌ n8n webhook failed: ${n8nResponse.status}`);
          await prisma.message.update({
            where: { id: message.id },
            data: {
              metadata: {
                sendError: `n8n webhook failed: ${n8nResponse.status}`,
                sentVia: 'human_chat_n8n',
              },
            },
          });
        } else {
          console.log(`✅ Human message sent via n8n successfully`);
          await prisma.message.update({
            where: { id: message.id },
            data: {
              metadata: {
                sentVia: 'human_chat_n8n',
              },
            },
          });
        }
      } catch (n8nError) {
        console.error('❌ Error sending to n8n:', n8nError);
        // Don't fail the whole operation - message is saved in DB
      }
    }

    // Update lead's lastContactAt
    await prisma.lead.update({
      where: { id: leadId },
      data: { lastContactAt: new Date() },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        leadId,
        type: 'message_sent',
        description: 'Mensaje enviado por vendedor',
        performedBy: user.id,
      },
    });

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
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    // Get lead with project info
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        project: {
          select: { n8nWebhookUrl: true },
        },
      },
    });

    if (!lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    // Check user has access
    if (user.systemRole !== 'super_admin') {
      const hasAccess = user.projectMemberships?.some(
        (m) => m.projectId === lead.projectId
      );
      if (!hasAccess) {
        return { success: false, error: 'Sin acceso a este lead' };
      }
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

    // Notify n8n about the handoff change
    if (lead.project.n8nWebhookUrl && lead.whatsappId) {
      try {
        await fetch(lead.project.n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'handoff_change',
            leadId: lead.id,
            whatsappId: lead.whatsappId,
            mode,
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
          }),
        });
      } catch (webhookError) {
        console.error('Error notifying n8n about handoff:', webhookError);
      }
    }

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
): Promise<{ mode: 'ai' | 'human'; handoffAt: Date | null; handoffUser: string | null } | null> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return null;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        projectId: true,
        handoffMode: true,
        handoffAt: true,
        handoffUser: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!lead) {
      return null;
    }

    // Check access
    if (user.systemRole !== 'super_admin') {
      const hasAccess = user.projectMemberships?.some(
        (m) => m.projectId === lead.projectId
      );
      if (!hasAccess) {
        return null;
      }
    }

    return {
      mode: lead.handoffMode as 'ai' | 'human',
      handoffAt: lead.handoffAt,
      handoffUser: lead.handoffUser
        ? `${lead.handoffUser.firstName} ${lead.handoffUser.lastName}`
        : null,
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
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    // Get conversation with lead info
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

    // Check access
    if (user.systemRole !== 'super_admin') {
      const hasAccess = user.projectMemberships?.some(
        (m) => m.projectId === projectId
      );
      if (!hasAccess) {
        return { success: false, error: 'Sin acceso' };
      }
    }

    // Get unread messages from lead that have WhatsApp IDs
    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        sender: MessageSender.lead,
        isRead: false,
        whatsappMsgId: { not: null },
      },
      select: {
        id: true,
        whatsappMsgId: true,
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
