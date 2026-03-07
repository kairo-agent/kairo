/**
 * Policies - Structured Knowledge Category
 */

import { z } from 'zod';

export interface PolicyItem {
  title: string;
  content: string;
}

export interface PoliciesData {
  items: PolicyItem[];
}

export const DEFAULT_POLICIES: PoliciesData = { items: [] };

const policyItemSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
});

export const policiesSchema = z.object({
  items: z.array(policyItemSchema).min(1).max(20),
});

export interface PolicyPreset {
  key: string;
  name: string;
  nameEs: string;
  group: 'common' | 'other';
}

export const POLICY_PRESETS: PolicyPreset[] = [
  { key: 'privacy', name: 'Privacy Policy', nameEs: 'Politica de Privacidad', group: 'common' },
  { key: 'terms', name: 'Terms of Use', nameEs: 'Terminos de Uso', group: 'common' },
  { key: 'refund', name: 'Refund Policy', nameEs: 'Politica de Reembolso', group: 'common' },
  { key: 'shipping', name: 'Shipping Policy', nameEs: 'Politica de Envios', group: 'common' },
  { key: 'cookie', name: 'Cookie Policy', nameEs: 'Politica de Cookies', group: 'common' },
  { key: 'accessibility', name: 'Accessibility', nameEs: 'Accesibilidad', group: 'common' },
  { key: 'data-protection', name: 'Data Protection', nameEs: 'Proteccion de Datos', group: 'other' },
  { key: 'cancellation', name: 'Cancellation Policy', nameEs: 'Politica de Cancelacion', group: 'other' },
  { key: 'warranty', name: 'Warranty Policy', nameEs: 'Politica de Garantia', group: 'other' },
];

export function composePoliciesText(data: PoliciesData): string {
  const sections: string[] = [];
  sections.push('POLICIES / POLITICAS:');
  for (const item of data.items) {
    sections.push(`\n[${item.title}]`);
    sections.push(item.content);
  }
  return sections.join('\n');
}
