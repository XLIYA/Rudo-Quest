import { describe, expect, it } from "vitest";
import { createProjectSchema } from "@/lib/validation/projects";
import {
  createTaskLinkAttachmentSchema,
  createTaskSchema,
  taskAttachmentUploadMetadataSchema,
  updateTaskSchema,
} from "@/lib/validation/tasks";

describe("validation schemas", () => {
  it("rejects owner invitations", () => {
    const result = createProjectSchema.safeParse({
      title: "Launch",
      iconKey: "Compass",
      colorKey: "orange",
      timeZone: "UTC",
      invitations: [{ userId: crypto.randomUUID(), role: "OWNER" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid personal task payload", () => {
    const result = createTaskSchema.safeParse({
      title: "Ship task",
      scheduledDate: "2026-07-07",
      scheduledTimeZone: "UTC",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ taskType: "TASK", priority: "NONE" });
    }
  });

  it("accepts approved task classification and rejects unknown values", () => {
    expect(
      createTaskSchema.safeParse({
        title: "Investigate checkout",
        scheduledDate: "2026-08-08",
        scheduledTimeZone: "UTC",
        taskType: "BUG",
        priority: "URGENT",
      }).success,
    ).toBe(true);
    expect(
      createTaskSchema.safeParse({
        title: "Unknown kind",
        scheduledDate: "2026-08-08",
        scheduledTimeZone: "UTC",
        taskType: "EPIC",
      }).success,
    ).toBe(false);
  });

  it("does not allow a Story to be nested as a subtask", () => {
    expect(
      createTaskSchema.safeParse({
        title: "Nested story",
        scheduledDate: "2026-08-08",
        scheduledTimeZone: "UTC",
        taskType: "STORY",
        parentTaskId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });

  it("does not inject create defaults into a partial task update", () => {
    expect(updateTaskSchema.parse({ version: 2, title: "Rename" })).toEqual({
      version: 2,
      title: "Rename",
    });
  });

  it("allows only http(s) attachment links", () => {
    expect(
      createTaskLinkAttachmentSchema.safeParse({
        label: "Product brief",
        url: "https://example.com/brief",
      }).success,
    ).toBe(true);
    expect(
      createTaskLinkAttachmentSchema.safeParse({
        label: "Unsafe",
        url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("rejects executable and oversized task uploads", () => {
    expect(
      taskAttachmentUploadMetadataSchema.safeParse({
        fileName: "run.exe",
        contentType: "application/x-msdownload",
        size: 12,
      }).success,
    ).toBe(false);
    expect(
      taskAttachmentUploadMetadataSchema.safeParse({
        fileName: "large.pdf",
        contentType: "application/pdf",
        size: 10 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false);
  });
});
