import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskAttachmentDto, TaskDto } from "@/types/domain";
import { TaskAttachments } from "./task-attachments";

const hooks = vi.hoisted(() => ({
  createLink: { mutateAsync: vi.fn(), isPending: false },
  upload: { mutateAsync: vi.fn(), isPending: false },
  remove: { mutate: vi.fn(), isPending: false },
  query: { data: [] as TaskAttachmentDto[], isLoading: false, isError: false },
}));

vi.mock("@/features/tasks/task-attachment-hooks", () => ({
  useTaskAttachments: () => hooks.query,
  useCreateTaskLinkAttachment: () => hooks.createLink,
  useUploadTaskAttachment: () => hooks.upload,
  useDeleteTaskAttachment: () => hooks.remove,
}));

const task: TaskDto = {
  id: "00000000-0000-4000-8000-000000000010",
  projectId: null,
  createdBy: { id: "user", handle: "owner", displayName: "Owner", avatarUrl: null },
  assignee: { id: "user", handle: "owner", displayName: "Owner", avatarUrl: null },
  title: "Task",
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
    canEditDetails: true,
    canCreateSubtasks: true,
    canTransition: true,
    canArchive: true,
  },
  project: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  hooks.query.data = [];
});

describe("TaskAttachments", () => {
  it("renders external links with safe new-tab isolation", () => {
    hooks.query.data = [
      {
        id: "attachment",
        taskId: task.id,
        kind: "LINK",
        label: "Design spec",
        url: "https://example.com/spec",
        fileName: null,
        mimeType: null,
        sizeBytes: null,
        downloadUrl: null,
        createdBy: task.createdBy,
        createdAt: task.createdAt,
      },
    ];
    render(<TaskAttachments task={task} open offline={false} />);
    const link = screen.getByRole("link", { name: "Design spec" });
    expect(link).toHaveAttribute("href", "https://example.com/spec");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps archived attachment views read-only", () => {
    render(
      <TaskAttachments
        task={{ ...task, archivedAt: "2026-08-08T12:00:00.000Z" }}
        open
        offline={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Upload file" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add link" })).not.toBeInTheDocument();
  });
});
