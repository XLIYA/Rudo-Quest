import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TaskDto, TaskHistoryPageDto, TaskHistoryView } from "@/types/domain";
import { TaskHistoryScreen } from "./task-history-screen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const useTaskHistory = vi.hoisted(() => vi.fn());
const restoreMutate = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/hooks/use-online", () => ({ useOnline: () => true }));
vi.mock("@/features/tasks/task-history-hooks", () => ({
  useTaskHistory: (view: TaskHistoryView) => useTaskHistory(view),
  useRestoreTask: () => ({ mutate: restoreMutate, isPending: false }),
}));
vi.mock("@/features/tasks/task-hooks", () => ({
  useTaskMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

const userId = "00000000-0000-4000-8000-000000000001";

function task(title: string, archived: boolean): TaskDto {
  return {
    id: archived
      ? "00000000-0000-4000-8000-000000000010"
      : "00000000-0000-4000-8000-000000000011",
    projectId: null,
    createdBy: { id: userId, handle: "owner", displayName: "Owner", avatarUrl: null },
    assignee: { id: userId, handle: "owner", displayName: "Owner", avatarUrl: null },
    title,
    description: null,
    iconKey: null,
    taskType: "TASK",
    priority: "NONE",
    parentTaskId: null,
    status: "TODO",
    previousStatus: null,
    scheduledDate: "2026-08-07",
    scheduledTime: null,
    scheduledTimeZone: "Asia/Tehran",
    completedAt: null,
    archivedAt: archived ? "2026-08-08T08:00:00.000Z" : null,
    version: 2,
    createdAt: "2026-08-07T08:00:00.000Z",
    updatedAt: "2026-08-08T08:00:00.000Z",
    permissions: {
      canEditDetails: true,
      canTransition: true,
      canArchive: true,
    },
    project: null,
  };
}

const missed = task("Yesterday's unfinished task", false);
const archived = task("Archived task", true);

function renderScreen(initialView: TaskHistoryView) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TaskHistoryScreen initialView={initialView} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useTaskHistory.mockImplementation((view: TaskHistoryView) => ({
    data: {
      pages: [
        { items: view === "missed" ? [missed] : [archived] },
      ] satisfies TaskHistoryPageDto[],
    },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }));
});

describe("TaskHistoryScreen", () => {
  it("uses URL-backed tabs and renders the selected history collection", async () => {
    const user = userEvent.setup();
    renderScreen("missed");

    expect(screen.getByRole("tab", { name: "Missed" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Yesterday's unfinished task")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Archived" }));

    expect(router.push).toHaveBeenCalledWith("/task-history?view=archived");
    expect(screen.getByText("Archived task")).toBeVisible();
  });

  it("offers an explicit task-specific restore action for archived work", async () => {
    const user = userEvent.setup();
    renderScreen("archived");

    await user.click(screen.getByRole("button", { name: "Restore Archived task" }));

    expect(restoreMutate).toHaveBeenCalledWith(archived);
  });
});
