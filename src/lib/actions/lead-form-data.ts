'use server';

import { prisma } from '@/lib/prisma';
import type { FormConfig } from '@/lib/types/form-template';

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
