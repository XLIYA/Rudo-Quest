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
import {
  taskHistoryViews,
  taskPriorities,
  taskStatuses,
  taskTypes,
} from "@/types/domain";
import {
  taskAttachmentMimeByExtension,
  taskAttachmentMimeTypes,
} from "@/lib/task-attachment-types";

const taskFieldsSchema = z.object({
  projectId: uuidSchema.nullable().optional(),
  assigneeId: uuidSchema.nullable().optional(),
  title: taskTitleSchema,
  description: taskDescriptionSchema,
  iconKey: projectIconKeySchema.nullable().optional(),
  scheduledDate: dateSchema,
  scheduledTime: timeSchema.nullable().optional(),
  scheduledTimeZone: timeZoneSchema,
  taskType: z.enum(taskTypes),
  priority: z.enum(taskPriorities),
  parentTaskId: uuidSchema.nullable().optional(),
});

export const createTaskSchema = taskFieldsSchema
  .extend({
    taskType: z.enum(taskTypes).default("TASK"),
    priority: z.enum(taskPriorities).default("NONE"),
  })
  .refine((value) => !value.parentTaskId || value.taskType !== "STORY", {
    message: "A Story cannot be nested under another Story.",
    path: ["taskType"],
  });

export const updateTaskSchema = taskFieldsSchema
  .omit({ parentTaskId: true })
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

export const subtaskTypes = ["TASK", "FEATURE", "BUG", "TEST"] as const;
export const createSubtaskSchema = z.object({
  title: taskTitleSchema,
  description: taskDescriptionSchema,
  iconKey: projectIconKeySchema.nullable().optional(),
  assigneeId: uuidSchema.nullable().optional(),
  taskType: z.enum(subtaskTypes).default("TASK"),
  priority: z.enum(taskPriorities).default("NONE"),
  scheduledDate: dateSchema.optional(),
  scheduledTime: timeSchema.nullable().optional(),
});

export const weekQuerySchema = z.object({
  weekStart: dateSchema,
  projectId: uuidSchema.optional(),
});

export const taskHistoryQuerySchema = z.object({
  view: z.enum(taskHistoryViews).default("missed"),
  cursor: z.string().trim().min(1).max(512).optional(),
});

export const taskAttachmentUploadMetadataSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    contentType: z.enum(taskAttachmentMimeTypes),
    size: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024),
  })
  .refine(
    (value) => {
      const extension = value.fileName.toLowerCase().split(".").pop();
      return Boolean(
        extension &&
        taskAttachmentMimeByExtension[extension]?.includes(value.contentType),
      );
    },
    { message: "File extension and content type do not match.", path: ["fileName"] },
  );

export const createTaskLinkAttachmentSchema = z.object({
  label: z.string().trim().min(1).max(140),
  url: z
    .url()
    .max(2048)
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "Link must use http or https."),
});

export const commitTaskAttachmentUploadSchema = z.object({
  uploadId: uuidSchema,
});
