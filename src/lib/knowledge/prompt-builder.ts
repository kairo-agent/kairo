/**
 * KAIRO - Structured Prompt Builder
 *
 * Composes structured instruction fields into a system prompt string.
 * Used by the AI pipeline to build the agent's system prompt.
 */

import { z } from 'zod';

// --- Types ---

export interface PromptStructure {
  agentName: string;
  role: string;
  rules: string[];
  personality: string;
  additionalInstructions: string;
}

export const promptStructureSchema = z.object({
  agentName: z.string().max(100).default('Kaira'),
  role: z.string().max(1000).default(''),
  rules: z.array(z.string().max(500)).max(50).default([]),
  personality: z.string().max(1000).default(''),
  additionalInstructions: z.string().max(2000).default(''),
});

export const DEFAULT_AGENT_NAME = 'Kaira';

export const EMPTY_PROMPT_STRUCTURE: PromptStructure = {
  agentName: DEFAULT_AGENT_NAME,
  role: '',
  rules: [],
  personality: '',
  additionalInstructions: '',
};

/**
 * Compose structured fields into a system prompt string.
 * Returns null if all fields are empty.
 */
export function composeSystemPrompt(structure: PromptStructure): string | null {
  const sections: string[] = [];

  if (structure.agentName.trim()) {
    sections.push(`Your name is: ${structure.agentName.trim()}.`);
  }

  if (structure.role.trim()) {
    sections.push(structure.role.trim());
  }

  if (structure.rules.length > 0) {
    const ruleLines = structure.rules
      .filter((r) => r.trim())
      .map((r) => `- ${r.trim()}`)
      .join('\n');
    if (ruleLines) {
      sections.push(`RULES:\n${ruleLines}`);
    }
  }

  if (structure.personality.trim()) {
    sections.push(`PERSONALITY:\n${structure.personality.trim()}`);
  }

  if (structure.additionalInstructions?.trim()) {
    sections.push(`ADDITIONAL INSTRUCTIONS:\n${structure.additionalInstructions.trim()}`);
  }

  if (sections.length === 0) return null;

  return sections.join('\n\n');
}

/**
 * Check if a PromptStructure has any content.
 */
export function isStructureEmpty(structure: PromptStructure): boolean {
  return (
    !structure.agentName.trim() &&
    !structure.role.trim() &&
    structure.rules.filter((r) => r.trim()).length === 0 &&
    !structure.personality.trim() &&
    !structure.additionalInstructions?.trim()
  );
}
