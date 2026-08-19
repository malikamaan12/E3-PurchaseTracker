import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

/**
 * High-performance Tailwind class merger.
 * Essential for Shadcn components and dynamic UI variant generation.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Robust date formatting that never throws RangeError or crashes on null/undefined/invalid values.
 */
export function safeFormatDate(date: any, formatPattern: string = 'MMM dd, yyyy', fallback: string = 'N/A'): string {
  if (!date) return fallback;
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatPattern);
  } catch {
    return fallback;
  }
}

/**
 * Robust relative time formatter (e.g., "5 minutes ago") that never crashes on invalid inputs.
 */
export function safeFormatDistanceToNow(date: any, fallback: string = 'recently'): string {
  if (!date) return fallback;
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return fallback;
  }
}

/**
 * Safe number formatter with locale string formatting that never crashes on null/undefined/NaN.
 */
export function safeFormatNumber(val: any, fallback: string = '0'): string {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  if (isNaN(num)) return fallback;
  return num.toLocaleString();
}

