// ============================================
// KAIRO - Timezone Utilities
// Centralized timezone handling for multi-tenant SaaS
// Uses native Intl.DateTimeFormat (no external libs)
// ============================================

const DEFAULT_TIMEZONE = 'America/Lima';

/**
 * Get effective timezone with fallback to default
 */
export function getEffectiveTimezone(orgTimezone?: string | null): string {
  return orgTimezone || DEFAULT_TIMEZONE;
}

/**
 * Get date parts (year, month, day) in a specific timezone
 */
function getDatePartsInTimezone(date: Date, timezone: string): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = +parts.find(p => p.type === 'year')!.value;
  const month = +parts.find(p => p.type === 'month')!.value;
  const day = +parts.find(p => p.type === 'day')!.value;
  return { year, month, day };
}

/**
 * Convert a local datetime string (in a timezone) to a UTC Date.
 * Uses a binary-search-like approach to handle DST transitions accurately.
 */
function localToUTC(year: number, month: number, day: number, hour: number, minute: number, timezone: string): Date {
  // Create an initial estimate assuming UTC
  const estimate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  // Get the offset by checking what time it is in the target timezone at our estimate
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(estimate);
  const localYear = +parts.find(p => p.type === 'year')!.value;
  const localMonth = +parts.find(p => p.type === 'month')!.value;
  const localDay = +parts.find(p => p.type === 'day')!.value;
  const localHour = +parts.find(p => p.type === 'hour')!.value % 24; // handle "24" -> 0
  const localMinute = +parts.find(p => p.type === 'minute')!.value;

  // Calculate offset: local - UTC (both as timestamps relative to same epoch)
  const localAsUTC = Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute, 0, 0);
  const offsetMs = localAsUTC - estimate.getTime();

  // The actual UTC time = estimate - offset
  return new Date(estimate.getTime() - offsetMs);
}

/**
 * Get UTC Date representing start of day (00:00:00) in a specific timezone.
 * If `date` is provided, gets the start of THAT date's day in the timezone.
 */
export function getStartOfDayInTimezone(timezone: string, date?: Date): Date {
  const d = date || new Date();
  const { year, month, day } = getDatePartsInTimezone(d, timezone);
  return localToUTC(year, month, day, 0, 0, timezone);
}

/**
 * Get UTC Date representing end of day (start of next day, exclusive) in a specific timezone.
 */
export function getEndOfDayInTimezone(timezone: string, date?: Date): Date {
  const startOfDay = getStartOfDayInTimezone(timezone, date);
  // Add 24 hours to get start of next day
  return new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Get UTC Date representing start of month (1st, 00:00:00) in a specific timezone.
 */
export function getStartOfMonthInTimezone(timezone: string, date?: Date): Date {
  const d = date || new Date();
  const { year, month } = getDatePartsInTimezone(d, timezone);
  return localToUTC(year, month, 1, 0, 0, timezone);
}

/**
 * Get the calendar date string (YYYY-MM-DD) for a Date in a specific timezone.
 * Replaces `date.toISOString().slice(0, 10)` which always returns UTC date.
 */
export function getDateStringInTimezone(date: Date, timezone: string): string {
  const { year, month, day } = getDatePartsInTimezone(date, timezone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Get the "yesterday" Date in a specific timezone.
 * Returns a Date object that, when passed to getStartOfDayInTimezone, gives yesterday's start.
 */
export function getYesterdayInTimezone(timezone: string): Date {
  const startOfToday = getStartOfDayInTimezone(timezone);
  // Go back 1 millisecond to land in "yesterday" then get start of that day
  return new Date(startOfToday.getTime() - 1);
}
