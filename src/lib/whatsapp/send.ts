/**
 * KAIRO - WhatsApp Send Helper
 *
 * Shared utility for sending messages via WhatsApp Cloud API.
 * Supports: text messages, image messages, video messages.
 * Used by: AI pipeline (process-ai-response), ReEngagement cron, manual messages.
 */

import { prisma } from '@/lib/prisma';
import { getProjectSecret } from '@/lib/actions/secrets';

/**
 * Send a text message via WhatsApp Cloud API and update message record
 */
export async function sendToWhatsApp(
  projectId: string,
  phoneNumber: string,
  message: string,
  messageId: string
): Promise<{ success: boolean; whatsappMsgId?: string }> {
  try {
    const [accessToken, phoneNumberId] = await Promise.all([
      getProjectSecret(projectId, 'whatsapp_access_token'),
      getProjectSecret(projectId, 'whatsapp_phone_number_id'),
    ]);

    if (!accessToken || !phoneNumberId) {
      console.error('[WhatsApp] Credentials not configured for project:', projectId);
      return { success: false };
    }

    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const whatsappApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const response = await fetch(whatsappApiUrl, {
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

    const data = await response.json();

    if (!response.ok) {
      console.error('[WhatsApp] Send error:', data);
      await prisma.message.update({
        where: { id: messageId },
        data: {
          metadata: {
            whatsappError: data.error?.message || 'Unknown error',
            whatsappErrorCode: data.error?.code,
          },
        },
      });
      return { success: false };
    }

    // Update message with WhatsApp ID
    const whatsappMsgId = data.messages?.[0]?.id;
    if (whatsappMsgId) {
      await prisma.message.update({
        where: { id: messageId },
        data: {
          whatsappMsgId,
          isDelivered: true,
          deliveredAt: new Date(),
        },
      });
    }

    return { success: true, whatsappMsgId };
  } catch (error) {
    console.error('[WhatsApp] Send failed:', error);
    return { success: false };
  }
}

/**
 * Send an image message via WhatsApp Cloud API.
 * Used by AI pipeline to send media alongside text responses.
 *
 * NOTE: This function does NOT create/update DB records.
 * Images are supplementary to the main text message which is already tracked.
 * If this fails, the text message has already been sent - the lead is not left hanging.
 */
export async function sendImageToWhatsApp(
  projectId: string,
  phoneNumber: string,
  imageUrl: string,
  caption?: string
): Promise<{ success: boolean }> {
  try {
    const [accessToken, phoneNumberId] = await Promise.all([
      getProjectSecret(projectId, 'whatsapp_access_token'),
      getProjectSecret(projectId, 'whatsapp_phone_number_id'),
    ]);

    if (!accessToken || !phoneNumberId) {
      console.error('[WhatsApp] Credentials not configured for project:', projectId);
      return { success: false };
    }

    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const whatsappApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'image',
        image: {
          link: imageUrl,
          ...(caption ? { caption } : {}),
        },
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('[WhatsApp] Image send error:', data);
      return { success: false };
    }

    return { success: true };
  } catch (error) {
    console.error('[WhatsApp] Image send failed:', error);
    return { success: false };
  }
}

/**
 * Send a video message via WhatsApp Cloud API.
 * Used by AI pipeline to send video media alongside text responses.
 *
 * NOTE: Same fire-and-forget pattern as sendImageToWhatsApp.
 * Videos must be MP4 (H.264 + AAC), max 16MB.
 */
export async function sendVideoToWhatsApp(
  projectId: string,
  phoneNumber: string,
  videoUrl: string,
  caption?: string
): Promise<{ success: boolean }> {
  try {
    const [accessToken, phoneNumberId] = await Promise.all([
      getProjectSecret(projectId, 'whatsapp_access_token'),
      getProjectSecret(projectId, 'whatsapp_phone_number_id'),
    ]);

    if (!accessToken || !phoneNumberId) {
      console.error('[WhatsApp] Credentials not configured for project:', projectId);
      return { success: false };
    }

    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const whatsappApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'video',
        video: {
          link: videoUrl,
          ...(caption ? { caption } : {}),
        },
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('[WhatsApp] Video send error:', data);
      return { success: false };
    }

    return { success: true };
  } catch (error) {
    console.error('[WhatsApp] Video send failed:', error);
    return { success: false };
  }
}
