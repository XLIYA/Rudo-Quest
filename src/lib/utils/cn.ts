import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Purpose: Merge conditional Tailwind class strings without duplicated utility conflicts.
 * Inputs: A variadic list of class-like values accepted by clsx.
 * Output: A deterministic className string.
 * Side effects: None.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
