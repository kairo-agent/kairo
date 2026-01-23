// ============================================
// KAIRO - Endpoint de Confirmación de Mensajes
// Recibe callback de n8n después de enviar mensaje a WhatsApp
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// ============================================
// Types para el payload del request
// ============================================

interface ConfirmMessageRequest {
  messageId: string;       // ID del mensaje en KAIRO (viene de metadata.messageDbId)
  whatsappMsgId?: string;  // ID del mensaje en WhatsApp (devuelto por la API)
  success: boolean;        // Si el envío fue exitoso
  error?: string;          // Mensaje de error si falló
}

// ============================================
// POST Handler - Confirmar envío de mensaje
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Parsear el body del request
    const body: ConfirmMessageRequest = await request.json();
    const { messageId, whatsappMsgId, success, error } = body;

    // Validar campos requeridos
    if (!messageId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campo requerido: messageId',
        },
        { status: 400 }
      );
    }

    // Si success es true, whatsappMsgId es requerido
    if (success && !whatsappMsgId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campo requerido cuando success=true: whatsappMsgId',
        },
        { status: 400 }
      );
    }

    // Si success es false, error debería estar presente
    if (!success && !error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campo requerido cuando success=false: error',
        },
        { status: 400 }
      );
    }

    // Buscar el mensaje por ID
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        metadata: true,
        conversationId: true,
      },
    });

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: 'Mensaje no encontrado',
        },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    // Obtener metadata existente (puede ser null o JsonValue)
    const existingMetadata = (message.metadata as Record<string, unknown>) || {};

    if (success) {
      // Actualizar mensaje como enviado exitosamente
      const updatedMetadata: Prisma.InputJsonValue = {
        ...existingMetadata,
        status: 'sent',
        confirmedAt: now,
      };

      await prisma.message.update({
        where: { id: messageId },
        data: {
          whatsappMsgId: whatsappMsgId,
          isDelivered: true,
          deliveredAt: new Date(),
          metadata: updatedMetadata,
        },
      });

      console.log(
        `[KAIRO] Mensaje confirmado: ${messageId} -> WhatsApp ID: ${whatsappMsgId}`
      );

      return NextResponse.json({
        success: true,
        message: 'Mensaje confirmado exitosamente',
      });
    } else {
      // Actualizar mensaje como fallido
      const updatedMetadata: Prisma.InputJsonValue = {
        ...existingMetadata,
        status: 'failed',
        error: error,
        failedAt: now,
      };

      await prisma.message.update({
        where: { id: messageId },
        data: {
          metadata: updatedMetadata,
        },
      });

      console.log(
        `[KAIRO] Mensaje fallido: ${messageId} -> Error: ${error}`
      );

      return NextResponse.json({
        success: true,
        message: 'Fallo de mensaje registrado',
      });
    }
  } catch (err) {
    console.error('[KAIRO] Error en /api/messages/confirm:', err);

    // Manejar errores específicos
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'JSON inválido en el body del request' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET Handler - Health check / documentación
// ============================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'KAIRO Message Confirmation',
    endpoint: 'POST /api/messages/confirm',
    description: 'Recibe callback de n8n después de enviar mensaje a WhatsApp',
    request: {
      messageId: 'string (requerido) - ID del mensaje en KAIRO',
      whatsappMsgId: 'string (requerido si success=true) - ID del mensaje en WhatsApp',
      success: 'boolean (requerido) - Si el envío fue exitoso',
      error: 'string (requerido si success=false) - Mensaje de error',
    },
    response: {
      success: 'boolean',
      message: 'string (en caso de éxito)',
      error: 'string (en caso de error)',
    },
    // TODO: Agregar autenticación con API key
    security: 'Sin autenticación (por ahora)',
  });
}
