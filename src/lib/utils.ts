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
 * Format date to localized string
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

/**
 * Format date with smart threshold:
 * - ≤7 days: relative format ("hoy", "ayer", "hace 2 d", "hace 5 d")
 * - >7 days: absolute date ("7 ene. 2026", "19 dic. 2025")
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInMs = now.getTime() - dateObj.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  // Check if same calendar day (today)
  const isToday = dateObj.toDateString() === now.toDateString();
  if (isToday) {
    // If less than 1 hour ago, show minutes
    if (diffInSeconds < 3600) {
      if (diffInSeconds < 60) return 'hace un momento';
      return `hace ${Math.floor(diffInSeconds / 60)} min`;
    }
    // Otherwise show "hoy"
    return 'hoy';
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateObj.toDateString() === yesterday.toDateString()) {
    return 'ayer';
  }

  // ≤7 days: relative format
  if (diffInDays <= 7) {
    return `hace ${diffInDays} d`;
  }

  // >7 days: absolute date format
  return formatDate(dateObj);
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
