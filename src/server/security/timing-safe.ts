import crypto from "node:crypto";

/**
 * Purpose: Compare two secret strings without leaking matching-prefix timing.
 * Inputs: Candidate and expected secret strings.
 * Output: True only when equal in length and contents.
 * Side effects: None.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.byteLength !== right.byteLength) return false;
  return crypto.timingSafeEqual(left, right);
}
