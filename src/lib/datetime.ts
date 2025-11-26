/**
 * Date and time formatting utilities for Philippine Time (PHT/UTC+8)
 */

import { format as dateFnsFormat, formatInTimeZone, toZonedTime } from 'date-fns-tz';

/**
 * Philippine Time timezone identifier
 */
export const PHT_TIMEZONE = 'Asia/Manila';

/**
 * Format a date in Philippine Time
 * @param date - Date to format (Date object, string, or timestamp)
 * @param formatStr - Format string (e.g., "dd/MM/yyyy", "MMM dd, yyyy")
 * @param options - Optional configuration
 * @returns Formatted date string in PHT
 */
export function formatDate(
  date: Date | string | number,
  formatStr: string = 'dd/MM/yyyy',
  options?: { timezone?: string }
): string {
  const timezone = options?.timezone || PHT_TIMEZONE;
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  return formatInTimeZone(dateObj, timezone, formatStr);
}

/**
 * Format a date with time in Philippine Time
 */
export function formatDateTime(
  date: Date | string | number,
  formatStr: string = 'dd/MM/yyyy HH:mm'
): string {
  return formatDate(date, formatStr);
}

/**
 * Format a date for display in common formats
 */
export const dateFormatters = {
  /** Short date: 26/01/2025 */
  short: (date: Date | string | number) => formatDate(date, 'dd/MM/yyyy'),
  
  /** Medium date: Jan 26, 2025 */
  medium: (date: Date | string | number) => formatDate(date, 'MMM dd, yyyy'),
  
  /** Long date: January 26, 2025 */
  long: (date: Date | string | number) => formatDate(date, 'MMMM dd, yyyy'),
  
  /** Date with time: Jan 26, 2025 14:30 */
  dateTime: (date: Date | string | number) => formatDate(date, 'MMM dd, yyyy HH:mm'),
  
  /** ISO format for inputs: 2025-01-26 */
  input: (date: Date | string | number) => formatDate(date, 'yyyy-MM-dd'),
};

/**
 * Convert a date to Philippine Time zone
 * Useful when you need to work with the Date object in PHT
 */
export function toPHT(date: Date | string | number): Date {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return toZonedTime(dateObj, PHT_TIMEZONE);
}

/**
 * Get current date/time in Philippine Time
 */
export function nowPHT(): Date {
  return toPHT(new Date());
}
