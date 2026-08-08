import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskDto } from "@/types/domain";
import { StorySubtasks } from "./story-subtasks";

vi.mock("@/features/tasks/subtask-hooks", () => ({
  useSubtasks: () => ({ data: undefined, isLoading: false, isError: false }),
  useCreateSubtask: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/features/tasks/task-hooks", () => ({
  useTaskMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("./task-assignee-combobox", () => ({
  TaskAssigneeCombobox: () => null,
}));

const story = {
  id: "00000000-0000-4000-8000-000000000040",
  projectId: null,
  createdBy: {
    id: "00000000-0000-4000-8000-000000000001",
    handle: "owner",
    displayName: "Owner",
    avatarUrl: null,
  },
  assignee: null,
  title: "Checkout Story",
  description: null,
  iconKey: null,
  taskType: "STORY",
  priority: "HIGH",
  parentTaskId: null,
  subtaskTotal: 3,
  subtaskCompleted: 2,
  subtaskProgressPercent: 67,
  status: "IN_PROGRESS",
  previousStatus: null,
  scheduledDate: "2026-08-08",
  scheduledTime: null,
  scheduledTimeZone: "UTC",
  completedAt: null,
  archivedAt: null,
  version: 3,
  createdAt: "2026-08-08T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
  permissions: {
    canEditDetails: true,
    canCreateSubtasks: true,
    canTransition: true,
    canArchive: true,
  },
  project: null,
} satisfies TaskDto;

describe("StorySubtasks", () => {
  it("shows the numeric and accessible Story completion ratio", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <StorySubtasks story={story} offline={false} onOpenTask={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("67%")).toBeVisible();
    expect(screen.getByText("2 / 3 completed")).toBeVisible();
    expect(
      screen.getByRole("progressbar", { name: "2 of 3 subtasks completed" }),
    ).toHaveAttribute("aria-valuenow", "67");
  });
});
