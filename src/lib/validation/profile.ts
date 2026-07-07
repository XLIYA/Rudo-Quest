import { z } from "zod";
import { displayNameSchema, handleSchema, timeZoneSchema } from "./common";

export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  handle: handleSchema.optional(),
});

export const updatePreferencesSchema = z.object({
  themePreference: z.enum(["system", "light", "dark"]).optional(),
  timeZone: timeZoneSchema.optional(),
  notificationsEnabled: z.boolean().optional(),
  dailyReminderEnabled: z.boolean().optional(),
  dailyReminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
    .nullable()
    .optional(),
});
