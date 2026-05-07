/**
 * Download media from WhatsApp Cloud API and upload to Supabase Storage
 * Used by webhook to persist incoming lead media (images, videos, audio, documents)
 * Files are temporary — cleaned up by cron after 5 days
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getProjectSecret } from '@/lib/actions/secrets';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

const BUCKET_NAME = 'media';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB - Supabase free tier limit

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
};

interface DownloadAndStoreResult {
  success: boolean;
  storagePath?: string;
  publicUrl?: string;
  error?: string;
}

/**
 * Downloads media from WhatsApp API and uploads to Supabase Storage.
 * Updates the message metadata with the storage path and public URL.
 */
export async function downloadAndStoreMedia(params: {
  mediaId: string;
  mimeType: string;
  projectId: string;
  whatsappMsgId: string;
  conversationId: string;
  messageType: string;
}): Promise<DownloadAndStoreResult> {
  const { mediaId, mimeType, projectId, whatsappMsgId, conversationId, messageType } = params;

  try {
    // 1. Get WhatsApp access token
    const accessToken = await getProjectSecret(projectId, 'whatsapp_access_token');
    if (!accessToken) {
      console.error(`[Media Download] No WhatsApp token for project ${projectId}`);
      return { success: false, error: 'No WhatsApp token' };
    }

    // 2. Get media info (download URL) from WhatsApp
    const mediaInfoRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!mediaInfoRes.ok) {
      console.error(`[Media Download] Failed to get media info: ${mediaInfoRes.status}`);
      return { success: false, error: 'Failed to get media info' };
    }

    const mediaInfo = await mediaInfoRes.json();
    const downloadUrl = mediaInfo.url;
    const fileSize = mediaInfo.file_size;

    if (!downloadUrl) {
      return { success: false, error: 'No download URL in media info' };
    }

    // 3. Validate file size
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      console.warn(`[Media Download] File too large: ${fileSize} bytes`);
      return { success: false, error: 'File too large' };
    }

    // 4. Download the file
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!fileRes.ok) {
      console.error(`[Media Download] Failed to download: ${fileRes.status}`);
      return { success: false, error: 'Failed to download file' };
    }

    const buffer = await fileRes.arrayBuffer();
    const fileBuffer = new Uint8Array(buffer);

    // 5. Generate storage path
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const baseMime = mimeType?.split(';')[0]?.trim() || 'application/octet-stream';
    const ext = MIME_TO_EXT[baseMime] || 'bin';
    const storagePath = `incoming/${projectId}/${year}/${month}/${randomUUID()}.${ext}`;

    // 6. Upload to Supabase Storage (service client, no auth needed)
    const supabase = createAdminClient();
    let { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: baseMime,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error(`[Media Download] Upload failed:`, uploadError.message);
      return { success: false, error: uploadError.message };
    }

    // 7. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData.publicUrl;

    // 8. Update message metadata with storage info (find by whatsappMsgId)
    const existingMessage = await prisma.message.findFirst({
      where: { conversationId, whatsappMsgId },
      select: { id: true, metadata: true },
    });

    if (existingMessage) {
      const existingMeta = (existingMessage.metadata as Record<string, unknown>) || {};
      await prisma.message.update({
        where: { id: existingMessage.id },
        data: {
          metadata: {
            ...existingMeta,
            downloadedPath: storagePath,
            downloadedUrl: publicUrl,
            downloadedAt: new Date().toISOString(),
          },
        },
      });
    }

    console.log(`[Media Download] ${messageType} stored: ${storagePath} (${fileBuffer.length} bytes)`);

    // 9. Transcribe audio with Whisper (for all modes, not just AI)
    if (messageType === 'audio' && existingMessage) {
      try {
        const openaiKey = await getProjectSecret(projectId, 'openai_api_key');
        if (openaiKey && buffer.byteLength <= 10 * 1024 * 1024) {
          const audioBlob = new Blob([buffer], { type: baseMime || 'audio/ogg' });
          const extMap: Record<string, string> = { 'audio/ogg': 'ogg', 'audio/opus': 'opus', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/webm': 'webm' };
          const audioExt = extMap[baseMime] || 'ogg';
          const formData = new FormData();
          formData.append('file', audioBlob, `audio.${audioExt}`);
          formData.append('model', 'whisper-1');
          formData.append('language', 'es');

          const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${openaiKey}` },
            body: formData,
          });

          if (whisperRes.ok) {
            const result = await whisperRes.json();
            const transcription = (result.text || '').slice(0, 10000);
            if (transcription) {
              const currentMeta = (await prisma.message.findUnique({ where: { id: existingMessage.id }, select: { metadata: true } }))?.metadata as Record<string, unknown> || {};
              await prisma.message.update({
                where: { id: existingMessage.id },
                data: {
                  metadata: { ...currentMeta, transcription, transcribedAt: new Date().toISOString() },
                },
              });
              console.log(`[Media Download] Audio transcribed: ${transcription.substring(0, 50)}...`);
            }
          }
        }
      } catch (err) {
        console.error('[Media Download] Whisper transcription error:', err);
      }
    }

    return { success: true, storagePath, publicUrl };
  } catch (error) {
    console.error(`[Media Download] Error:`, error);
    return { success: false, error: String(error) };
  }
}
