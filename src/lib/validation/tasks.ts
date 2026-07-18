import { z } from "zod";
import {
  dateSchema,
  projectIconKeySchema,
  taskDescriptionSchema,
  taskTitleSchema,
  timeSchema,
  timeZoneSchema,
  uuidSchema,
} from "./common";
import { taskStatuses } from "@/types/domain";

export const createTaskSchema = z.object({
  projectId: uuidSchema.nullable().optional(),
  assigneeId: uuidSchema.nullable().optional(),
  title: taskTitleSchema,
  description: taskDescriptionSchema,
  iconKey: projectIconKeySchema.nullable().optional(),
  scheduledDate: dateSchema,
  scheduledTime: timeSchema.nullable().optional(),
  scheduledTimeZone: timeZoneSchema,
});

export const updateTaskSchema = createTaskSchema
  .partial()
  .extend({
    version: z.number().int().positive(),
  })
  .refine(
    (value) => Object.keys(value).length > 1,
    "Provide at least one field to update.",
  );

export const taskActionSchema = z.object({
  version: z.number().int().positive(),
});

export const taskMoveSchema = taskActionSchema.extend({
  status: z.enum(taskStatuses),
});

export const weekQuerySchema = z.object({
  weekStart: dateSchema,
  projectId: uuidSchema.optional(),
});
