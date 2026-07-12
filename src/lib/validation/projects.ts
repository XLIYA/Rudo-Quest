import { z } from "zod";
import {
  projectColorKeySchema,
  projectDescriptionSchema,
  projectIconKeySchema,
  projectRoleSchema,
  projectTitleSchema,
  timeZoneSchema,
  uuidSchema,
} from "./common";

export const createProjectSchema = z.object({
  title: projectTitleSchema,
  description: projectDescriptionSchema,
  iconKey: projectIconKeySchema,
  colorKey: projectColorKeySchema,
  timeZone: timeZoneSchema,
  invitations: z
    .array(
      z.object({
        userId: uuidSchema,
        role: projectRoleSchema.exclude(["OWNER"]),
      }),
    )
    .max(20)
    .refine(
      (items) => new Set(items.map((item) => item.userId)).size === items.length,
      "Each collaborator may only be invited once.",
    )
    .default([]),
});

export const updateProjectSchema = createProjectSchema
  .pick({
    title: true,
    description: true,
    iconKey: true,
    colorKey: true,
    timeZone: true,
  })
  .partial();

export const createInvitationSchema = z.object({
  invitedUserId: uuidSchema,
  role: projectRoleSchema.exclude(["OWNER"]),
});

export const updateMemberRoleSchema = z.object({
  role: projectRoleSchema.exclude(["OWNER"]),
});

export const projectListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  role: projectRoleSchema.optional(),
  archived: z.enum(["active", "archived", "all"]).default("active"),
});

export const transferOwnershipSchema = z.object({
  targetUserId: uuidSchema,
  confirm: z.literal(true),
});
