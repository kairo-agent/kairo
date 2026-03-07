/**
 * Pricing / Services - Structured Knowledge Category
 */

import { z } from 'zod';

export interface ServiceItem {
  name: string;
  price: string;
  description?: string;
}

export interface PricingData {
  currency: string;
  items: ServiceItem[];
  notes?: string;
}

export const DEFAULT_PRICING: PricingData = {
  currency: 'PEN',
  items: [],
  notes: '',
};

export const CURRENCY_OPTIONS = [
  { value: 'PEN', label: 'PEN (S/)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (E)' },
  { value: 'MXN', label: 'MXN ($)' },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  PEN: 'S/',
  USD: '$',
  EUR: 'E',
  MXN: 'MXN $',
};

const serviceItemSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.string().min(1).max(50),
  description: z.string().max(300).optional(),
});

export const pricingSchema = z.object({
  currency: z.string().min(1).max(10),
  items: z.array(serviceItemSchema).min(1).max(50),
  notes: z.string().max(500).optional(),
});

export function composePricingText(data: PricingData): string {
  const sections: string[] = [];
  const sym = CURRENCY_SYMBOLS[data.currency] || data.currency;

  sections.push('SERVICES & PRICING / SERVICIOS Y PRECIOS:');
  sections.push(`Currency / Moneda: ${data.currency}`);

  for (const item of data.items) {
    const priceStr = /^\d/.test(item.price) ? `${sym}${item.price}` : item.price;
    const desc = item.description ? ` - ${item.description}` : '';
    sections.push(`- ${item.name}: ${priceStr}${desc}`);
  }

  if (data.notes?.trim()) {
    sections.push(`\nAdditional notes / Notas adicionales: ${data.notes.trim()}`);
  }

  return sections.join('\n');
}
