import { z } from "zod";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { projectColorKeys, projectIconKeys, projectRoles } from "@/types/domain";
import { isValidTimeZone } from "@/lib/utils/dates";
import { AppError } from "@/lib/api/errors";

export const uuidSchema = z.uuid();
export const dateSchema = z.iso.date();
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Use HH:mm or HH:mm:ss.");
export const timeZoneSchema = z
  .string()
  .refine(isValidTimeZone, "Use a valid IANA timezone.");
export const handleSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_-]+$/, "Use lowercase letters, numbers, hyphens, and underscores.");
export const displayNameSchema = z.string().trim().min(2).max(60);
export const projectTitleSchema = z.string().trim().min(2).max(60);
export const projectDescriptionSchema = z.string().trim().max(500).nullable().optional();
export const taskTitleSchema = z.string().trim().min(1).max(140);
export const taskDescriptionSchema = z.string().trim().max(5000).nullable().optional();
export const projectRoleSchema = z.enum(projectRoles);
export const projectColorKeySchema = z.enum(projectColorKeys);
export const projectIconKeySchema = z.enum(projectIconKeys);
export const cursorSchema = z.string().min(1).max(500).optional();
export const searchQuerySchema = z.string().trim().min(2).max(80);

export const uploadMetadataSchema = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(4_000_000),
  width: z.number().int().min(128).max(4096),
  height: z.number().int().min(128).max(4096),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z
    .url()
    .refine(
      (value) => new URL(value).protocol === "https:",
      "Push endpoint must use https.",
    ),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(10),
  }),
});

/**
 * Purpose: Detect IPv4 addresses within private, loopback, link-local, or other
 * non-routable ranges that must never be reachable via a user-supplied endpoint.
 * Inputs: Dotted-quad IPv4 address.
 * Output: True when the address is forbidden.
 * Side effects: None.
 */
function isForbiddenIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && b >= 18 && b <= 19) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

/**
 * Purpose: Detect IPv6 addresses within loopback, link-local, unique-local, or
 * IPv4-mapped private ranges.
 * Inputs: IPv6 address string.
 * Output: True when the address is forbidden.
 * Side effects: None.
 */
function isForbiddenIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const mappedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedMatch) return isForbiddenIpv4(mappedMatch[1]);
  return false;
}

/**
 * Purpose: Reject resolved addresses in private, reserved, or loopback ranges.
 * Inputs: Resolved IPv4/IPv6 address string.
 * Output: True when the address must not be used as a push endpoint target.
 * Side effects: None.
 */
function isForbiddenIpAddress(address: string): boolean {
  return isIP(address) === 4 ? isForbiddenIpv4(address) : isForbiddenIpv6(address);
}

/**
 * Purpose: Verify a user-supplied push endpoint cannot target internal infrastructure.
 * Inputs: Endpoint URL string already validated by `pushSubscriptionSchema`.
 * Output: Resolves when the endpoint is safe to call.
 * Side effects: Performs a DNS lookup for non-literal hostnames.
 * Failure behavior: Throws a BAD_REQUEST AppError for disallowed protocols or
 * addresses, including addresses discovered only after DNS resolution so a
 * benign-looking hostname cannot rebind to an internal target.
 */
export async function assertSafePushEndpoint(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new AppError("BAD_REQUEST", 400, "Push endpoint must use https.");
  }
  const hostname = url.hostname;
  const literalIpVersion = isIP(hostname);
  const addresses = literalIpVersion
    ? [hostname]
    : (await lookup(hostname, { all: true })).map((entry) => entry.address);
  if (addresses.length === 0 || addresses.some(isForbiddenIpAddress)) {
    throw new AppError("BAD_REQUEST", 400, "Push endpoint host is not allowed.");
  }
}
