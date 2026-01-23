'use server';

/**
 * Server Actions para gestión de AI Agents
 *
 * CRUD completo para agentes de IA por proyecto
 */

import { prisma } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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
}

export interface UpdateAgentInput {
  name?: string;
  type?: AIAgentType;
  description?: string;
  avatarUrl?: string;
  isActive?: boolean;
}

export interface AIAgentData {
  id: string;
  name: string;
  type: AIAgentType;
  description: string | null;
  avatarUrl: string | null;
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
// Helper: Verificar acceso al proyecto
// ============================================

async function verifyProjectAccess(projectId: string): Promise<{ userId: string; isSuperAdmin: boolean } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Obtener usuario de la BD
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { systemRole: true }
  });

  if (!dbUser) return null;

  const isSuperAdmin = dbUser.systemRole === 'super_admin';

  // Super admin tiene acceso a todo
  if (isSuperAdmin) {
    return { userId: user.id, isSuperAdmin: true };
  }

  // Verificar membresía al proyecto con rol admin o manager
  const membership = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId: user.id,
      role: { in: ['admin', 'manager'] }
    }
  });

  if (!membership) return null;

  return { userId: user.id, isSuperAdmin: false };
}

// ============================================
// GET: Obtener agentes de un proyecto
// ============================================

export async function getProjectAgents(projectId: string): Promise<{
  success: boolean;
  agents?: AIAgentData[];
  error?: string;
}> {
  try {
    const access = await verifyProjectAccess(projectId);
    if (!access) {
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

    const access = await verifyProjectAccess(agent.projectId);
    if (!access) {
      return { success: false, error: 'Unauthorized' };
    }

    return {
      success: true,
      agent: {
        ...agent,
        type: agent.type as AIAgentType,
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
    const access = await verifyProjectAccess(input.projectId);
    if (!access) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validar nombre único dentro del proyecto
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
        isActive: true,
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

    const access = await verifyProjectAccess(existingAgent.projectId);
    if (!access) {
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
        ...(input.isActive !== undefined && { isActive: input.isActive })
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

    const access = await verifyProjectAccess(agent.projectId);
    if (!access) {
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

    const access = await verifyProjectAccess(agent.projectId);
    if (!access) {
      return { success: false, error: 'Unauthorized' };
    }

    const updated = await prisma.aIAgent.update({
      where: { id: agentId },
      data: { isActive: !agent.isActive },
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
        ...updated,
        type: updated.type as AIAgentType,
        stats: updated.stats as AIAgentData['stats']
      }
    };
  } catch (error) {
    console.error('Error toggling agent status:', error);
    return { success: false, error: 'Failed to toggle agent status' };
  }
}
