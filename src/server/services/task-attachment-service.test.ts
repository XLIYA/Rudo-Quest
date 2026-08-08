import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskDto } from "@/types/domain";
import {
  commitTaskFileAttachment,
  createTaskFileUpload,
  createTaskLinkAttachment,
} from "./task-attachment-service";

const repository = vi.hoisted(() => ({
  commitTaskAttachmentUpload: vi.fn(),
  createTaskAttachmentUpload: vi.fn(),
  deleteTaskAttachmentRow: vi.fn(),
  findPendingTaskAttachmentUpload: vi.fn(),
  findTaskAttachmentRow: vi.fn(),
  insertTaskLinkAttachment: vi.fn(),
  listTaskAttachmentRows: vi.fn(),
}));
const taskService = vi.hoisted(() => ({ getTask: vi.fn(), getVisibleTask: vi.fn() }));
const storageHelpers = vi.hoisted(() => ({
  assertTaskAttachmentBytes: vi.fn(),
  removeTaskAttachmentObject: vi.fn(),
}));
const storage = vi.hoisted(() => ({ createSignedUploadUrl: vi.fn() }));

vi.mock("@/server/repositories/task-attachment-repository", () => repository);
vi.mock("@/server/services/task-service", () => taskService);
vi.mock("@/server/task-attachments", async (original) => ({
  ...(await original<typeof import("@/server/task-attachments")>()),
  assertTaskAttachmentBytes: storageHelpers.assertTaskAttachmentBytes,
  removeTaskAttachmentObject: storageHelpers.removeTaskAttachmentObject,
}));
vi.mock("@/lib/auth/supabase", () => ({
  createSupabaseAdminClient: () => ({
    storage: { from: () => ({ createSignedUploadUrl: storage.createSignedUploadUrl }) },
  }),
}));

const userId = "00000000-0000-4000-8000-000000000001";
const taskId = "00000000-0000-4000-8000-000000000010";

function task(canEditDetails = true): TaskDto {
  return {
    id: taskId,
    projectId: null,
    createdBy: { id: userId, handle: "owner", displayName: "Owner", avatarUrl: null },
    assignee: { id: userId, handle: "owner", displayName: "Owner", avatarUrl: null },
    title: "Attach evidence",
    description: null,
    iconKey: null,
    taskType: "TASK",
    priority: "NONE",
    parentTaskId: null,
    subtaskTotal: 0,
    subtaskCompleted: 0,
    subtaskProgressPercent: 0,
    status: "TODO",
    previousStatus: null,
    scheduledDate: "2026-08-08",
    scheduledTime: null,
    scheduledTimeZone: "UTC",
    completedAt: null,
    archivedAt: null,
    version: 1,
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
    permissions: {
      canEditDetails,
      canCreateSubtasks: canEditDetails,
      canTransition: canEditDetails,
      canArchive: canEditDetails,
    },
    project: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  taskService.getTask.mockResolvedValue(task());
  storage.createSignedUploadUrl.mockResolvedValue({
    data: { signedUrl: "https://storage.test/upload", token: "signed-token" },
    error: null,
  });
  repository.createTaskAttachmentUpload.mockImplementation(async (input) => ({
    id: "00000000-0000-4000-8000-000000000099",
    ...input,
  }));
});

describe("task attachment mutations", () => {
  it("prevents a read-only viewer from adding a link", async () => {
    taskService.getTask.mockResolvedValue(task(false));
    await expect(
      createTaskLinkAttachment(userId, taskId, {
        label: "Reference",
        url: "https://example.com",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.insertTaskLinkAttachment).not.toHaveBeenCalled();
  });

  it("creates a private signed upload authorization bound to task and user", async () => {
    const result = await createTaskFileUpload(userId, taskId, {
      fileName: "report.pdf",
      contentType: "application/pdf",
      size: 1024,
    });
    expect(repository.createTaskAttachmentUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId,
        userId,
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }),
    );
    expect(result).toMatchObject({
      uploadId: "00000000-0000-4000-8000-000000000099",
      token: "signed-token",
    });
  });

  it("validates stored bytes before atomically committing a file", async () => {
    const pending = {
      id: "00000000-0000-4000-8000-000000000099",
      taskId,
      userId,
      storagePath: `${taskId}/${userId}/file.pdf`,
      fileName: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    };
    repository.findPendingTaskAttachmentUpload.mockResolvedValue(pending);
    repository.commitTaskAttachmentUpload.mockResolvedValue({ id: "attachment" });

    await commitTaskFileAttachment(userId, taskId, pending.id);

    expect(storageHelpers.assertTaskAttachmentBytes).toHaveBeenCalledWith({
      storagePath: pending.storagePath,
      mimeType: pending.mimeType,
      sizeBytes: pending.sizeBytes,
    });
    expect(repository.commitTaskAttachmentUpload).toHaveBeenCalledWith({
      uploadId: pending.id,
      taskId,
      userId,
    });
  });
});
