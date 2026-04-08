import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * High-performance Tailwind class merger.
 * Essential for Shadcn components and dynamic UI variant generation.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
