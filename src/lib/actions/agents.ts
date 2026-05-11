'use server';

/**
 * Server Actions para gestion de AI Agents
 *
 * CRUD completo para agentes de IA por proyecto
 */

import { prisma } from '@/lib/prisma';
import { verifyAuth, verifyProjectAccess } from '@/lib/actions/auth';
import { revalidatePath } from 'next/cache';
import {
  PromptStructure,
  composeSystemPrompt,
} from '@/lib/knowledge/prompt-builder';
import { invalidateActiveAgentCache } from '@/lib/ai/get-active-agent';

// ============================================
// Types
// ============================================

export type AIAgentType = 'sales' | 'support' | 'qualification' | 'appointment';

export interface CreateAgentInput {
  projectId: string;
  name: string;
  type: AIAgentType;
  description?: string;
  avatarUrl?: string;
  systemInstructions?: string;
}

export interface UpdateAgentInput {
  name?: string;
  type?: AIAgentType;
  description?: string;
  avatarUrl?: string;
  isActive?: boolean;
  systemInstructions?: string;
  promptStructure?: Record<string, unknown>;
}

export interface AIAgentData {
  id: string;
  name: string;
  type: AIAgentType;
  description: string | null;
  avatarUrl: string | null;
  systemInstructions: string | null;
  promptStructure: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
  stats: {
    satisfactionScore: number;
    totalConversations: number;
    averageResponseTime: number;
    totalLeadsGenerated: number;
  };
  _count?: {
    assignedLeads: number;
  };
}

// ============================================
// Helper: Verificar auth + acceso al proyecto
// Uses verifyAuth() + verifyProjectAccess() from auth.ts
// ============================================

// ============================================
// GET: Obtener agentes de un proyecto
// ============================================

export async function getProjectAgents(projectId: string): Promise<{
  success: boolean;
  agents?: AIAgentData[];
  error?: string;
}> {
  try {
    const user = await verifyAuth();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, projectId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized' };
    }

    const agents = await prisma.aIAgent.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { assignedLeads: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return {
      success: true,
      agents: agents.map(agent => ({
        ...agent,
        type: agent.type as AIAgentType,
        promptStructure: agent.promptStructure as Record<string, unknown> | null,
        stats: agent.stats as AIAgentData['stats']
      }))
    };
  } catch (error) {
    console.error('Error getting project agents:', error);
    return { success: false, error: 'Failed to get agents' };
  }
}

// ============================================
// GET: Obtener un agente por ID
// ============================================

export async function getAgent(agentId: string): Promise<{
  success: boolean;
  agent?: AIAgentData;
  error?: string;
}> {
  try {
    const agent = await prisma.aIAgent.findUnique({
      where: { id: agentId },
      include: {
        _count: {
          select: { assignedLeads: true }
        }
      }
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

    return {
      success: true,
      agent: {
        ...agent,
        type: agent.type as AIAgentType,
        promptStructure: agent.promptStructure as Record<string, unknown> | null,
        stats: agent.stats as AIAgentData['stats']
      }
    };
  } catch (error) {
    console.error('Error getting agent:', error);
    return { success: false, error: 'Failed to get agent' };
  }
}

// ============================================
// CREATE: Crear nuevo agente
// ============================================

export async function createAgent(input: CreateAgentInput): Promise<{
  success: boolean;
  agent?: AIAgentData;
  error?: string;
}> {
  try {
    const user = await verifyAuth();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, input.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validar nombre unico dentro del proyecto
    const existing = await prisma.aIAgent.findFirst({
      where: {
        projectId: input.projectId,
        name: input.name
      }
    });

    if (existing) {
      return { success: false, error: 'An agent with this name already exists in this project' };
    }

    const agent = await prisma.aIAgent.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        type: input.type,
        description: input.description || null,
        avatarUrl: input.avatarUrl || null,
        systemInstructions: input.systemInstructions || null,
        // Nuevos agentes nacen INACTIVOS. El usuario los activa explicitamente
        // via toggleAgentStatus, que se encarga de desactivar los demas del
        // proyecto e invalidar el cache del agente activo.
        isActive: false,
        stats: {
          satisfactionScore: 0,
          totalConversations: 0,
          averageResponseTime: 0,
          totalLeadsGenerated: 0
        }
      },
      include: {
        _count: {
          select: { assignedLeads: true }
        }
      }
    });

    revalidatePath('/admin');
    revalidatePath('/leads');

    return {
      success: true,
      agent: {
        ...agent,
        type: agent.type as AIAgentType,
        promptStructure: agent.promptStructure as Record<string, unknown> | null,
        stats: agent.stats as AIAgentData['stats']
      }
    };
  } catch (error) {
    console.error('Error creating agent:', error);
    return { success: false, error: 'Failed to create agent' };
  }
}

// ============================================
// UPDATE: Actualizar agente
// ============================================

export async function updateAgent(agentId: string, input: UpdateAgentInput): Promise<{
  success: boolean;
  agent?: AIAgentData;
  error?: string;
}> {
  try {
    // Primero obtener el agente para verificar acceso
    const existingAgent = await prisma.aIAgent.findUnique({
      where: { id: agentId }
    });

    if (!existingAgent) {
      return { success: false, error: 'Agent not found' };
    }

    const user = await verifyAuth();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, existingAgent.projectId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized' };
    }

    // Si cambia el nombre, verificar que no exista otro con ese nombre
    if (input.name && input.name !== existingAgent.name) {
      const duplicate = await prisma.aIAgent.findFirst({
        where: {
          projectId: existingAgent.projectId,
          name: input.name,
          id: { not: agentId }
        }
      });

      if (duplicate) {
        return { success: false, error: 'An agent with this name already exists in this project' };
      }
    }

    const agent = await prisma.aIAgent.update({
      where: { id: agentId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.systemInstructions !== undefined && { systemInstructions: input.systemInstructions }),
        ...(input.promptStructure !== undefined && { promptStructure: JSON.parse(JSON.stringify(input.promptStructure)) })
      },
      include: {
        _count: {
          select: { assignedLeads: true }
        }
      }
    });

    // Invalidar cache: si el agente activo cambia systemInstructions/promptStructure
    // u otros campos cacheados, el runtime debe releer en la siguiente request.
    await invalidateActiveAgentCache(agent.projectId);

    revalidatePath('/admin');
    revalidatePath('/leads');

    return {
      success: true,
      agent: {
        ...agent,
        type: agent.type as AIAgentType,
        promptStructure: agent.promptStructure as Record<string, unknown> | null,
        stats: agent.stats as AIAgentData['stats']
      }
    };
  } catch (error) {
    console.error('Error updating agent:', error);
    return { success: false, error: 'Failed to update agent' };
  }
}

// ============================================
// DELETE: Eliminar agente
// ============================================

export async function deleteAgent(agentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const agent = await prisma.aIAgent.findUnique({
      where: { id: agentId },
      include: {
        _count: {
          select: { assignedLeads: true }
        }
      }
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

    // No permitir eliminar si tiene leads asignados
    if (agent._count.assignedLeads > 0) {
      return {
        success: false,
        error: `Cannot delete agent with ${agent._count.assignedLeads} assigned leads. Reassign them first.`
      };
    }

    await prisma.aIAgent.delete({
      where: { id: agentId }
    });

    // Invalidar cache: si el agente eliminado era el activo, el siguiente
    // resolver re-consultara DB (devolvera null o el siguiente activo).
    await invalidateActiveAgentCache(agent.projectId);

    revalidatePath('/admin');
    revalidatePath('/leads');

    return { success: true };
  } catch (error) {
    console.error('Error deleting agent:', error);
    return { success: false, error: 'Failed to delete agent' };
  }
}

// ============================================
// TOGGLE: Activar/desactivar agente
// Solo 1 agente puede estar activo por proyecto
// ============================================

export async function toggleAgentStatus(agentId: string): Promise<{
  success: boolean;
  agent?: AIAgentData;
  error?: string;
}> {
  try {
    const agent = await prisma.aIAgent.findUnique({
      where: { id: agentId }
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

    const willBeActive = !agent.isActive;

    // Si se esta ACTIVANDO este agente, desactivar todos los demas del proyecto
    if (willBeActive) {
      await prisma.aIAgent.updateMany({
        where: {
          projectId: agent.projectId,
          id: { not: agentId },
          isActive: true
        },
        data: { isActive: false }
      });
    }

    const updated = await prisma.aIAgent.update({
      where: { id: agentId },
      data: { isActive: willBeActive },
      include: {
        _count: {
          select: { assignedLeads: true }
        }
      }
    });

    // Invalidar cache del agente activo del proyecto — fuerza a runtime AI
    // (WhatsApp/WebChat) a releer el activo en la siguiente request.
    await invalidateActiveAgentCache(agent.projectId);

    revalidatePath('/admin');
    revalidatePath('/leads');

    return {
      success: true,
      agent: {
        ...updated,
        type: updated.type as AIAgentType,
        promptStructure: updated.promptStructure as Record<string, unknown> | null,
        stats: updated.stats as AIAgentData['stats']
      }
    };
  } catch (error) {
    console.error('Error toggling agent status:', error);
    return { success: false, error: 'Failed to toggle agent status' };
  }
}

// ============================================
// SAVE: Guardar instrucciones estructuradas
// ============================================

export async function saveAgentInstructions(
  agentId: string,
  promptStructure: PromptStructure
): Promise<{ success: boolean; error?: string }> {
  try {
    const agent = await prisma.aIAgent.findUnique({
      where: { id: agentId },
      select: { projectId: true }
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

    // Compose structured fields into system prompt text
    const systemInstructions = composeSystemPrompt(promptStructure);

    await prisma.aIAgent.update({
      where: { id: agentId },
      data: {
        promptStructure: JSON.parse(JSON.stringify(promptStructure)),
        systemInstructions,
      }
    });

    // Invalidar cache del agente activo (si este es el activo, el cambio entra
    // en la siguiente request).
    await invalidateActiveAgentCache(agent.projectId);

    revalidatePath('/admin');
    revalidatePath('/leads');

    return { success: true };
  } catch (error) {
    console.error('Error saving agent instructions:', error);
    return { success: false, error: 'Failed to save agent instructions' };
  }
}

// ============================================
// GET: Obtener instrucciones estructuradas
// ============================================

export async function getAgentInstructions(agentId: string): Promise<{
  success: boolean;
  data?: { promptStructure: PromptStructure | null; systemInstructions: string | null };
  error?: string;
}> {
  try {
    const agent = await prisma.aIAgent.findUnique({
      where: { id: agentId },
      select: {
        projectId: true,
        promptStructure: true,
        systemInstructions: true,
      }
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

    return {
      success: true,
      data: {
        promptStructure: agent.promptStructure as PromptStructure | null,
        systemInstructions: agent.systemInstructions,
      }
    };
  } catch (error) {
    console.error('Error getting agent instructions:', error);
    return { success: false, error: 'Failed to get agent instructions' };
  }
}
