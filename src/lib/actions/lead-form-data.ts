'use server';

import { prisma } from '@/lib/prisma';
import type { FormConfig } from '@/lib/types/form-template';
import { DEFAULT_FORM_CONFIG } from '@/lib/types/form-template';
import { getActiveAgentForProject } from '@/lib/ai/get-active-agent';

// ============================================
// GET: Obtener datos de formulario de un lead
// ============================================

export async function getLeadFormData(
  leadId: string,
  agentId: string
): Promise<Record<string, string>> {
  try {
    const record = await prisma.leadFormData.findUnique({
      where: { leadId_agentId: { leadId, agentId } },
      select: { fieldData: true },
    });

    if (!record) return {};
    return record.fieldData as Record<string, string>;
  } catch (error) {
    console.error('Error getting lead form data:', error);
    return {};
  }
}

// ============================================
// GET: Form config from agent
// ============================================

export async function getAgentFormConfig(
  agentId: string
): Promise<FormConfig> {
  try {
    const agent = await prisma.aIAgent.findUnique({
      where: { id: agentId },
      select: { formConfig: true },
    });
    if (!agent?.formConfig) return DEFAULT_FORM_CONFIG;
    return agent.formConfig as unknown as FormConfig;
  } catch (error) {
    console.error('Error getting agent form config:', error);
    return DEFAULT_FORM_CONFIG;
  }
}

// ============================================
// GET: Form config + agentId of project's ACTIVE agent
//
// Used by the lead detail panel UI to render the conversational form using
// the currently-active agent's schema (not the historical agent stored in
// `lead.assignedAgentId`). The returned `agentId` is the active agent's id —
// pass it to bulkUpdateLeadFormFields() when persisting edits so the new row
// in lead_form_data is keyed by the active agent.
// ============================================

export async function getActiveAgentFormConfigForProject(
  projectId: string
): Promise<{ agentId: string | null; formConfig: FormConfig }> {
  try {
    const active = await getActiveAgentForProject(projectId);
    if (!active) return { agentId: null, formConfig: DEFAULT_FORM_CONFIG };
    const formConfig =
      (active.formConfig as unknown as FormConfig | null) || DEFAULT_FORM_CONFIG;
    return { agentId: active.id, formConfig };
  } catch (error) {
    console.error('Error getting active agent form config:', error);
    return { agentId: null, formConfig: DEFAULT_FORM_CONFIG };
  }
}

// ============================================
// UPSERT: Actualizar campos del formulario
// ============================================

const VALID_LEAD_MAPPINGS = [
  'firstName', 'lastName', 'email', 'phone',
  'businessName', 'position', 'estimatedValue',
] as const;

export async function bulkUpdateLeadFormFields(
  leadId: string,
  agentId: string,
  fields: Record<string, string>,
  formConfig: FormConfig
): Promise<void> {
  try {
    // Get existing data
    const existing = await prisma.leadFormData.findUnique({
      where: { leadId_agentId: { leadId, agentId } },
      select: { fieldData: true },
    });

    const existingData = (existing?.fieldData as Record<string, string>) ?? {};
    const mergedData = { ...existingData, ...fields };

    // Check completion: all required fields present
    const allRequiredFilled = formConfig.fields
      .filter((f) => f.required)
      .every((f) => mergedData[f.key]?.trim());

    // Upsert form data
    await prisma.leadFormData.upsert({
      where: { leadId_agentId: { leadId, agentId } },
      create: {
        leadId,
        agentId,
        fieldData: mergedData,
        completedAt: allRequiredFilled ? new Date() : null,
      },
      update: {
        fieldData: mergedData,
        completedAt: allRequiredFilled ? new Date() : null,
      },
    });

    // Update mapped Lead fields
    const leadUpdate: Record<string, unknown> = {};

    for (const field of formConfig.fields) {
      const value = fields[field.key];
      if (!value || !field.leadFieldMapping) continue;

      const mapping = field.leadFieldMapping;
      if (!(VALID_LEAD_MAPPINGS as readonly string[]).includes(mapping)) continue;

      if (mapping === 'estimatedValue') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          leadUpdate[mapping] = parsed;
        }
      } else {
        leadUpdate[mapping] = value;
      }
    }

    if (Object.keys(leadUpdate).length > 0) {
      await prisma.lead.update({
        where: { id: leadId },
        data: leadUpdate,
      });
    }
  } catch (error) {
    console.error('Error updating lead form data:', error);
  }
}
