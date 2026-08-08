import { act, renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  type InfiniteData,
} from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { TaskDto, TaskHistoryPageDto } from "@/types/domain";
import { queryKeys } from "@/lib/api/query-keys";
import { useRestoreTask } from "./task-history-hooks";

const apiMutation = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  apiMutation,
  apiGet: vi.fn(),
  normalizeApiClientError: () => ({ message: "Restore failed" }),
}));
vi.mock("@/components/ui/app-toast", () => ({ AppToast: vi.fn() }));

const archivedTask = {
  id: "00000000-0000-4000-8000-000000000010",
  projectId: null,
  createdBy: {
    id: "00000000-0000-4000-8000-000000000001",
    handle: "owner",
    displayName: "Owner",
    avatarUrl: null,
  },
  assignee: null,
  title: "Archived task",
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
  scheduledDate: "2026-08-07",
  scheduledTime: null,
  scheduledTimeZone: "UTC",
  completedAt: null,
  archivedAt: "2026-08-08T00:00:00.000Z",
  version: 2,
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
  permissions: {
    canEditDetails: true,
    canCreateSubtasks: true,
    canTransition: true,
    canArchive: true,
  },
  project: null,
} satisfies TaskDto;

describe("useRestoreTask", () => {
  it("optimistically removes an archived row and restores it after failure", async () => {
    let rejectRestore: ((reason?: unknown) => void) | undefined;
    apiMutation.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRestore = reject;
        }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const key = queryKeys.taskHistory("archived");
    queryClient.setQueryData<InfiniteData<TaskHistoryPageDto>>(key, {
      pages: [{ items: [archivedTask] }],
      pageParams: [undefined],
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRestoreTask(), { wrapper });

    act(() => result.current.mutate(archivedTask));

    await waitFor(() =>
      expect(
        queryClient.getQueryData<InfiniteData<TaskHistoryPageDto>>(key)?.pages[0]?.items,
      ).toEqual([]),
    );
    act(() => rejectRestore?.(new Error("failed")));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(
      queryClient.getQueryData<InfiniteData<TaskHistoryPageDto>>(key)?.pages[0]?.items,
    ).toEqual([archivedTask]);
  });
});
