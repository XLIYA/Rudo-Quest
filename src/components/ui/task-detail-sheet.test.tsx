import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskDto } from "@/types/domain";
import { TaskDetailSheet } from "./task-detail-sheet";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(({ queryKey }: { queryKey: readonly string[] }) =>
    queryKey[0] === "task"
      ? { data: undefined, isLoading: false, isError: false }
      : { data: [], isLoading: false, isError: false },
  ),
}));
vi.mock("./app-sheet", () => ({
  AppSheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
}));
vi.mock("./task-attachments", () => ({ TaskAttachments: () => null }));
vi.mock("./story-subtasks", () => ({ StorySubtasks: () => null }));

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

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function renderSheet(onSave: () => Promise<void>, onOpenChange = vi.fn()) {
  render(
    <TaskDetailSheet
      task={task}
      open
      onOpenChange={onOpenChange}
      onOpenRelatedTask={vi.fn()}
      onSave={onSave}
      onAction={vi.fn()}
      onArchive={vi.fn()}
    />,
  );
  return onOpenChange;
}

describe("TaskDetailSheet save lifecycle", () => {
  it("waits for a successful save before closing", async () => {
    const save = deferred();
    const onOpenChange = renderSheet(() => save.promise);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    save.resolve();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("keeps the sheet and draft open when saving fails", async () => {
    const save = deferred();
    const onOpenChange = renderSheet(() => save.promise);
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Retained draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    save.reject(new Error("Save failed"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled(),
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Retained draft");
  });
});
