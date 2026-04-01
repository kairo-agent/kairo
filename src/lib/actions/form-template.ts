'use server';

import { prisma } from '@/lib/prisma';
import { verifyAuth, verifyProjectAccess, getProjectRole } from '@/lib/actions/auth';
import { getEffectiveRole } from '@/lib/permissions';
import { DEFAULT_FORM_CONFIG, MAX_FORM_FIELDS } from '@/lib/types/form-template';
import type { FormConfig } from '@/lib/types/form-template';

// ============================================
// GET: Obtener configuración de formulario
// ============================================

export async function getFormConfig(agentId: string): Promise<FormConfig> {
  try {
    const agent = await prisma.aIAgent.findUnique({
      where: { id: agentId },
      select: { projectId: true, formConfig: true },
    });

    if (!agent) return DEFAULT_FORM_CONFIG;

    const user = await verifyAuth();
    if (!user) return DEFAULT_FORM_CONFIG;

    const hasAccess = await verifyProjectAccess(user.id, user.systemRole, agent.projectId);
    if (!hasAccess) return DEFAULT_FORM_CONFIG;

    const raw = agent.formConfig as Partial<FormConfig> | null;
    return { ...DEFAULT_FORM_CONFIG, ...raw };
  } catch (error) {
    console.error('Error getting form config:', error);
    return DEFAULT_FORM_CONFIG;
  }
}

// ============================================
// SAVE: Guardar configuración de formulario
// ============================================

export async function saveFormConfig(
  agentId: string,
  config: FormConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate fields
    if (config.fields.length > MAX_FORM_FIELDS) {
      return { success: false, error: `Maximum ${MAX_FORM_FIELDS} fields allowed` };
    }

    for (const field of config.fields) {
      if (!field.key || !field.label) {
        return { success: false, error: 'Each field must have a key and label' };
      }
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

    const roleInfo = await getProjectRole(user.id, user.systemRole, agent.projectId);
    if (!roleInfo.hasAccess) {
      return { success: false, error: 'Unauthorized' };
    }

    const effectiveRole = getEffectiveRole(user.systemRole, roleInfo.isOrgOwner ?? false, roleInfo.projectRole);
    if (!['super_admin', 'owner', 'admin', 'manager'].includes(effectiveRole)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    await prisma.aIAgent.update({
      where: { id: agentId },
      data: {
        formConfig: JSON.parse(JSON.stringify(config)),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error saving form config:', error);
    return { success: false, error: 'Failed to save form config' };
  }
}
