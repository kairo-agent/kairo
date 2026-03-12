'use server';

/**
 * Server Actions for Global Rules (super_admin only)
 *
 * Global rules are injected into ALL agent system prompts.
 * They cannot be overridden by per-agent instructions.
 */

import { prisma } from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/auth-helpers';

// ============================================
// Types
// ============================================

export interface GlobalRule {
  id: string;
  content: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// LIST: Get all global rules (ordered)
// ============================================

export async function getGlobalRules(): Promise<ActionResult<GlobalRule[]>> {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    const rules = await prisma.globalRule.findMany({
      orderBy: { order: 'asc' },
    });

    return { success: true, data: rules };
  } catch (error) {
    console.error('Failed to get global rules:', error);
    return { success: false, error: 'Error al obtener reglas globales' };
  }
}

// ============================================
// GET ACTIVE: For system prompt injection (no auth required - called from webhook)
// ============================================

export async function getActiveGlobalRules(): Promise<string[]> {
  try {
    const rules = await prisma.globalRule.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { content: true },
    });

    return rules.map(r => r.content);
  } catch (error) {
    console.error('Failed to get active global rules:', error);
    return []; // Graceful degradation
  }
}

// ============================================
// CREATE: Add a new global rule
// ============================================

export async function createGlobalRule(content: string): Promise<ActionResult<GlobalRule>> {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 500) {
      return { success: false, error: 'La regla debe tener entre 1 y 500 caracteres' };
    }

    // Get max order
    const lastRule = await prisma.globalRule.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (lastRule?.order ?? -1) + 1;

    const rule = await prisma.globalRule.create({
      data: {
        content: trimmed,
        order: nextOrder,
        createdBy: auth.userId,
      },
    });

    return { success: true, data: rule };
  } catch (error) {
    console.error('Failed to create global rule:', error);
    return { success: false, error: 'Error al crear regla' };
  }
}

// ============================================
// UPDATE: Edit a global rule
// ============================================

export async function updateGlobalRule(
  id: string,
  content: string
): Promise<ActionResult<GlobalRule>> {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 500) {
      return { success: false, error: 'La regla debe tener entre 1 y 500 caracteres' };
    }

    const rule = await prisma.globalRule.update({
      where: { id },
      data: { content: trimmed },
    });

    return { success: true, data: rule };
  } catch (error) {
    console.error('Failed to update global rule:', error);
    return { success: false, error: 'Error al actualizar regla' };
  }
}

// ============================================
// DELETE: Remove a global rule
// ============================================

export async function deleteGlobalRule(id: string): Promise<ActionResult> {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    await prisma.globalRule.delete({ where: { id } });

    return { success: true };
  } catch (error) {
    console.error('Failed to delete global rule:', error);
    return { success: false, error: 'Error al eliminar regla' };
  }
}

// ============================================
// TOGGLE: Enable/disable a rule
// ============================================

export async function toggleGlobalRule(id: string): Promise<ActionResult<GlobalRule>> {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    const existing = await prisma.globalRule.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'Regla no encontrada' };
    }

    const rule = await prisma.globalRule.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return { success: true, data: rule };
  } catch (error) {
    console.error('Failed to toggle global rule:', error);
    return { success: false, error: 'Error al cambiar estado' };
  }
}

// ============================================
// REORDER: Update rule order
// ============================================

export async function reorderGlobalRules(
  orderedIds: string[]
): Promise<ActionResult> {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Update each rule's order in a transaction
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.globalRule.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    return { success: true };
  } catch (error) {
    console.error('Failed to reorder global rules:', error);
    return { success: false, error: 'Error al reordenar reglas' };
  }
}
