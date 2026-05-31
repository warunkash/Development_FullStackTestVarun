/**
 * Date utility functions for the ECNT platform.
 * Uses native Date APIs to avoid external dependencies where possible.
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Formats a date to IST (Indian Standard Time) string.
 * @param date - Date to format
 * @param includeTime - Whether to include time (default: true)
 * @returns Formatted date string in IST
 */
export function formatToIST(date: Date, includeTime = true): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime && {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
  };
  return new Intl.DateTimeFormat('en-IN', options).format(date);
}

/**
 * Gets the start of day in IST for a given date.
 * @param date - Input date (defaults to current date)
 * @returns Date object representing start of day in IST
 */
export function getStartOfDayIST(date = new Date()): Date {
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: IST_TIMEZONE }));
  istDate.setHours(0, 0, 0, 0);
  const offset = istDate.getTime() - date.getTime();
  return new Date(date.getTime() - (date.getTime() % 86400000) - offset % 86400000);
}

/**
 * Calculates the duration between two dates in minutes.
 * @param start - Start date
 * @param end - End date (defaults to now)
 * @returns Duration in minutes (rounded to 2 decimals)
 */
export function getDurationMinutes(start: Date, end = new Date()): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.round((diffMs / 60000) * 100) / 100;
}

/**
 * Calculates the duration between two dates in seconds.
 */
export function getDurationSeconds(start: Date, end = new Date()): number {
  return Math.floor((end.getTime() - start.getTime()) / 1000);
}

/**
 * Formats a duration in seconds to human-readable string.
 * @param seconds - Duration in seconds
 * @returns Formatted string like "2h 30m 15s"
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Checks if a date falls within a time range (for tariff calculations).
 * @param date - Date to check
 * @param startHour - Start hour (0-23)
 * @param endHour - End hour (0-23)
 * @returns True if the date's hour falls within the range
 */
export function isWithinHourRange(date: Date, startHour: number, endHour: number): boolean {
  const hour = parseInt(
    new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: IST_TIMEZONE }).format(date),
    10,
  );
  if (startHour <= endHour) {
    return hour >= startHour && hour < endHour;
  }
  // Handles overnight ranges (e.g., 22:00 - 06:00)
  return hour >= startHour || hour < endHour;
}

/**
 * Gets the day of week in IST (0 = Sunday, 6 = Saturday).
 */
export function getDayOfWeekIST(date = new Date()): number {
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: IST_TIMEZONE }));
  return istDate.getDay();
}

/**
 * Returns a date N days ago from now.
 */
export function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
}

/**
 * Returns a date N days from now.
 */
export function daysFromNow(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + n);
  return date;
}

/**
 * Parses an ISO date string safely, returning null if invalid.
 */
export function safeParseDateISO(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}
