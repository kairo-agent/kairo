/**
 * FAQs - Structured Knowledge Category
 */

import { z } from 'zod';

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQsData {
  items: FAQItem[];
}

export const DEFAULT_FAQS: FAQsData = { items: [] };

const faqItemSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(1000),
});

export const faqsSchema = z.object({
  items: z.array(faqItemSchema).min(1).max(20),
});

export function composeFaqsText(data: FAQsData): string {
  const sections: string[] = [];
  sections.push('FREQUENTLY ASKED QUESTIONS / PREGUNTAS FRECUENTES:');
  for (const item of data.items) {
    sections.push(`\nQ: ${item.question}`);
    sections.push(`A: ${item.answer}`);
  }
  return sections.join('\n');
}
