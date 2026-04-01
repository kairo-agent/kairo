// ============================================
// KAIRO - Utility Functions
// ============================================

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  parsePhoneNumberFromString,
  isValidPhoneNumber,
  type CountryCode,
} from 'libphonenumber-js';

/**
 * Merge Tailwind CSS classes with clsx
 * Handles conflicts and duplicates intelligently
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format time portion as "3:45 PM" (12h format, es-PE)
 * @param timezone - Optional IANA timezone (e.g., 'America/Lima'). If omitted, uses browser local time.
 */
function formatTime12h(date: Date, timezone?: string): string {
  return date.toLocaleTimeString('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(timezone ? { timeZone: timezone } : {}),
  }).toUpperCase(); // "3:45 PM"
}

/**
 * Format date to localized string (includes time by default)
 * Example: "14 mar. 2026 3:45 PM"
 * @param timezone - Optional IANA timezone. If omitted, uses browser local time.
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions, timezone?: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const datePart = dateObj.toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
    ...(timezone ? { timeZone: timezone } : {}),
  });
  // If custom options are passed, don't append time (caller controls format)
  if (options) return datePart;
  return `${datePart} ${formatTime12h(dateObj, timezone)}`;
}

/**
 * Format date with smart threshold — always includes time:
 * - Today: "Hoy 3:45 PM"
 * - Yesterday: "Ayer 3:45 PM"
 * - ≤7 days: "hace 2 d 3:45 PM"
 * - >7 days: "14 mar. 2026 3:45 PM"
 * @param timezone - Optional IANA timezone. If omitted, uses browser local time.
 */
export function formatRelativeTime(date: Date | string, timezone?: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInMs = now.getTime() - dateObj.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const time = formatTime12h(dateObj, timezone);

  if (timezone) {
    // Compare calendar dates in the target timezone (YYYY-MM-DD)
    const fmt = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: timezone });
    const dateStr = fmt(dateObj);
    const todayStr = fmt(now);
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayStr = fmt(yesterday);

    if (dateStr === todayStr) return `Hoy ${time}`;
    if (dateStr === yesterdayStr) return `Ayer ${time}`;
  } else {
    // Browser-local logic (existing behavior)
    if (dateObj.toDateString() === now.toDateString()) {
      return `Hoy ${time}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateObj.toDateString() === yesterday.toDateString()) {
      return `Ayer ${time}`;
    }
  }

  // ≤7 days: relative format with time
  if (diffInDays <= 7) {
    return `hace ${diffInDays} d ${time}`;
  }

  // >7 days: absolute date format (already includes time)
  return formatDate(dateObj, undefined, timezone);
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = 'PEN'): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format phone number for display (international format)
 * Uses libphonenumber-js for proper formatting
 * @example "+51912345678" → "+51 912 345 678"
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';

  try {
    const parsed = parsePhoneNumberFromString(phone);
    if (parsed) {
      return parsed.formatInternational();
    }
    return phone;
  } catch {
    // If parsing fails, return original
    return phone;
  }
}

/**
 * Validate phone number using libphonenumber-js
 * @param phone - Phone number in E.164 format (e.g., "+51912345678")
 * @param country - Optional country code for validation context
 * @returns true if valid, false otherwise
 */
export function validatePhone(phone: string, country?: CountryCode): boolean {
  if (!phone) return false;

  try {
    return isValidPhoneNumber(phone, country);
  } catch {
    return false;
  }
}

/**
 * Parse phone number and extract details
 * @param phone - Phone number in any format
 * @param defaultCountry - Default country if not specified in number
 * @returns Parsed phone object or null if invalid
 */
export function parsePhone(phone: string, defaultCountry: CountryCode = 'PE') {
  if (!phone) return null;

  try {
    const parsed = parsePhoneNumberFromString(phone, defaultCountry);
    if (!parsed) return null;

    return {
      e164: parsed.format('E.164'), // +51912345678
      international: parsed.formatInternational(), // +51 912 345 678
      national: parsed.formatNational(), // 912 345 678
      country: parsed.country, // PE
      countryCallingCode: parsed.countryCallingCode, // 51
      nationalNumber: parsed.nationalNumber, // 912345678
      isValid: parsed.isValid(),
    };
  } catch {
    return null;
  }
}

/**
 * Normalize phone number to E.164 format
 * @param phone - Phone number in any format
 * @param defaultCountry - Default country if not specified
 * @returns E.164 format (e.g., "+51912345678") or null if invalid
 */
export function normalizePhone(phone: string, defaultCountry: CountryCode = 'PE'): string | null {
  const parsed = parsePhone(phone, defaultCountry);
  return parsed?.e164 || null;
}

/**
 * Get initials from name
 */
export function getInitials(firstName: string, lastName?: string): string {
  const first = firstName.charAt(0).toUpperCase();
  const last = lastName ? lastName.charAt(0).toUpperCase() : '';
  return `${first}${last}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

/**
 * Generate a random ID (for mock data)
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

/**
 * Sleep function for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
