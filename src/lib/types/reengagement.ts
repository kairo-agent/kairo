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
  delayHours: number;              // 1-5, wait time before each message
  maxAttempts: number;             // 0-2, follow-up attempts AFTER initial reengagement
  promptTemplate: string;          // Instructions for initial reengagement
  attempt1Instructions: string;    // Instructions for 1st follow-up (angle change)
  attempt2Instructions: string;    // Instructions for 2nd/final follow-up
  sendWindowStart?: string;        // Send window start time e.g. "17:00" (default: "09:00")
  sendWindowEnd?: string;          // Send window end time e.g. "23:00" (default: "22:00")
}

export const DEFAULT_REENGAGEMENT_CONFIG: ReEngagementConfig = {
  enabled: false,
  delayHours: 3,
  maxAttempts: 2,
  promptTemplate: '',
  attempt1Instructions: 'Cambia de angulo respecto al mensaje anterior. Ofrece algo nuevo o diferente que no se haya mencionado. Se mas directo y ofrece valor concreto.',
  attempt2Instructions: 'Este es el ultimo seguimiento. Se breve, directo y respetuoso. Ofrece una ultima propuesta de valor o una pregunta concreta de si/no.',
  sendWindowStart: '17:00',
  sendWindowEnd: '23:00',
};

/** Generate time options in 30-min increments for AM/PM selector */
export function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h < 12 ? 'AM' : 'PM';
      const label = `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
      options.push({ value, label });
    }
  }
  return options;
}

/** Calculate window duration in hours, handling midnight crossing */
export function getWindowDurationHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const diff = endMin > startMin ? endMin - startMin : (1440 - startMin) + endMin;
  return diff / 60;
}
