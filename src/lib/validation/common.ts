import { z } from "zod";
import { projectColorKeys, projectIconKeys, projectRoles } from "@/types/domain";
import { isValidTimeZone } from "@/lib/utils/dates";

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
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(10),
  }),
});
