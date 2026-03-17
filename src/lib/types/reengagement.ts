/**
 * ReEngagement types and constants
 *
 * Separated from server actions to avoid "use server" export restrictions.
 * Next.js requires that 'use server' files only export async functions.
 */

export interface ReEngagementConfig {
  enabled: boolean;
  delayHours: number;      // 1-20
  maxAttempts: number;     // 1-3, max reengagements per silence period
  promptTemplate: string;  // Instrucciones para el AI al generar el mensaje
}

export const DEFAULT_REENGAGEMENT_CONFIG: ReEngagementConfig = {
  enabled: false,
  delayHours: 6,
  maxAttempts: 2,
  promptTemplate: '',
};
