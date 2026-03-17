'use server';

/**
 * Server Actions para configuración de ReEngagement
 *
 * Gestiona la configuración de re-engagement automático por agente.
 * Cuando un lead deja de responder, el sistema envía un mensaje
 * de seguimiento después del tiempo configurado (dentro de ventana 24h WhatsApp).
 */

import { prisma } from '@/lib/prisma';
import { verifyAuth, verifyProjectAccess } from '@/lib/actions/auth';
import { z } from 'zod';
import { DEFAULT_REENGAGEMENT_CONFIG } from '@/lib/types/reengagement';
import type { ReEngagementConfig } from '@/lib/types/reengagement';

// ============================================
// Validation
// ============================================

const reEngagementConfigSchema = z.object({
  enabled: z.boolean(),
  delayHours: z.number().int().min(1).max(20),
  maxAttempts: z.number().int().min(1).max(3),
  promptTemplate: z.string().max(1000),
});

// ============================================
// GET: Obtener configuración de ReEngagement
// ============================================

export async function getReEngagementConfig(agentId: string): Promise<{
  success: boolean;
  data?: ReEngagementConfig;
  error?: string;
}> {
  try {
    const agent = await prisma.aIAgent.findUnique({
      where: { id: agentId },
      select: { projectId: true, reEngagementConfig: true },
    });

    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    const user = await verifyAuth();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, agent.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized' };
    }

    const config = agent.reEngagementConfig as ReEngagementConfig | null;
    return {
      success: true,
      data: config || DEFAULT_REENGAGEMENT_CONFIG,
    };
  } catch (error) {
    console.error('Error getting reengagement config:', error);
    return { success: false, error: 'Failed to get reengagement config' };
  }
}

// ============================================
// SAVE: Guardar configuración de ReEngagement
// ============================================

export async function saveReEngagementConfig(
  agentId: string,
  config: ReEngagementConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate input
    const parsed = reEngagementConfigSchema.safeParse(config);
    if (!parsed.success) {
      return { success: false, error: 'Invalid configuration' };
    }

    const agent = await prisma.aIAgent.findUnique({
      where: { id: agentId },
      select: { projectId: true },
    });

    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    const user = await verifyAuth();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, agent.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized' };
    }

    await prisma.aIAgent.update({
      where: { id: agentId },
      data: {
        reEngagementConfig: JSON.parse(JSON.stringify(parsed.data)),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error saving reengagement config:', error);
    return { success: false, error: 'Failed to save reengagement config' };
  }
}
