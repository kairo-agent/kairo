/**
 * ReEngagement types and constants
 *
 * Separated from server actions to avoid "use server" export restrictions.
 * Next.js requires that 'use server' files only export async functions.
 *
 * Flow:
 * - Initial ReEngagement: fires on lead silence (existing behavior)
 * - Follow-up attempt 1: ONLY if lead responded to initial + went silent again
 * - Follow-up attempt 2: ONLY if lead responded to attempt 1 + went silent again
 */

export interface ReEngagementConfig {
  enabled: boolean;
  delayHours: number;              // 1-20, wait time before each message
  maxAttempts: number;             // 0-2, follow-up attempts AFTER initial reengagement
  promptTemplate: string;          // Instructions for initial reengagement
  attempt1Instructions: string;    // Instructions for 1st follow-up (angle change)
  attempt2Instructions: string;    // Instructions for 2nd/final follow-up
}

export const DEFAULT_REENGAGEMENT_CONFIG: ReEngagementConfig = {
  enabled: false,
  delayHours: 6,
  maxAttempts: 2,
  promptTemplate: '',
  attempt1Instructions: 'Cambia de angulo respecto al mensaje anterior. Ofrece algo nuevo o diferente que no se haya mencionado. Se mas directo y ofrece valor concreto.',
  attempt2Instructions: 'Este es el ultimo seguimiento. Se breve, directo y respetuoso. Ofrece una ultima propuesta de valor o una pregunta concreta de si/no.',
};
