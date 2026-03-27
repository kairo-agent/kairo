/**
 * Pricing / Services - Structured Knowledge Category
 */

import { z } from 'zod';

export interface ServiceItem {
  name: string;
  price: string;
  description?: string;
  currency?: string; // Per-service currency override. Empty or undefined = inherit global
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
  currency: z.string().max(10).optional(),
});

export const pricingSchema = z.object({
  currency: z.string().min(1).max(10),
  items: z.array(serviceItemSchema).min(1).max(50),
  notes: z.string().max(500).optional(),
});

export function composePricingText(data: PricingData): string {
  const sections: string[] = [];
  const globalCurrency = data.currency;
  const globalSym = CURRENCY_SYMBOLS[globalCurrency] || globalCurrency;

  sections.push('SERVICES & PRICING / SERVICIOS Y PRECIOS:');
  sections.push(`Default currency / Moneda por defecto: ${globalCurrency}`);

  for (const item of data.items) {
    const itemCurrency = item.currency || globalCurrency;
    const sym = CURRENCY_SYMBOLS[itemCurrency] || itemCurrency;
    const priceStr = /^\d/.test(item.price) ? `${sym}${item.price}` : item.price;
    const currencyLabel = itemCurrency !== globalCurrency ? ` ${itemCurrency}` : '';
    const desc = item.description ? ` - ${item.description}` : '';
    sections.push(`- ${item.name}: ${priceStr}${currencyLabel}${desc}`);
  }

  if (data.notes?.trim()) {
    sections.push(`\nAdditional notes / Notas adicionales: ${data.notes.trim()}`);
  }

  return sections.join('\n');
}
