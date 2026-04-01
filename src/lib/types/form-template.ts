// ============================================
// KAIRO - Conversational Form Types
// Defines form config stored in AIAgent.formConfig (JSONB)
// Pattern: same as reengagement.ts
// ============================================

export type FormFieldType = 'text' | 'email' | 'number' | 'phone' | 'options';
export type FormTriggerMode = 'immediate' | 'on_interest';

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
  leadFieldMapping?: string | null;
  order: number;
}

export interface FormConfig {
  isActive: boolean;
  triggerMode: FormTriggerMode;
  fields: FormField[];
}

export const MAX_FORM_FIELDS = 8;

export const DEFAULT_FORM_CONFIG: FormConfig = {
  isActive: false,
  triggerMode: 'immediate',
  fields: [],
};

export const LEAD_FIELD_MAPPINGS = [
  { value: 'firstName', labelKey: 'settings.form.mapping.firstName' },
  { value: 'lastName', labelKey: 'settings.form.mapping.lastName' },
  { value: 'email', labelKey: 'settings.form.mapping.email' },
  { value: 'phone', labelKey: 'settings.form.mapping.phone' },
  { value: 'businessName', labelKey: 'settings.form.mapping.businessName' },
  { value: 'position', labelKey: 'settings.form.mapping.position' },
  { value: 'estimatedValue', labelKey: 'settings.form.mapping.estimatedValue' },
] as const;

export function generateFieldKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30);
}
