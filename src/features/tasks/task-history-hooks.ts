"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { AppToast } from "@/components/ui/app-toast";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  TaskDto,
  TaskHistoryPageDto,
  TaskHistoryView,
  ArchivedTaskFilters,
} from "@/types/domain";

/**
 * Purpose: Read a cursor-paginated task-history collection.
 * Inputs: Missed or Archived view.
 * Output: TanStack infinite-query result.
 * Side effects: Performs authenticated history GET requests.
 */
export function useTaskHistory(view: TaskHistoryView) {
  return useInfiniteQuery({
    queryKey: queryKeys.taskHistory(view),
    queryFn: ({ pageParam, signal }) =>
      apiGet<TaskHistoryPageDto>(
        `/api/tasks/history?view=${view}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.cursor,
  });
}

/**
 * Purpose: Read cursor-paginated archived tasks for a specific project with search and filters.
 * Inputs: Project ID, search term, and filters.
 * Output: TanStack infinite-query result.
 * Side effects: Performs authenticated GET requests.
 */
export function useProjectArchivedTasks(
  projectId: string,
  search: string,
  filters: ArchivedTaskFilters,
) {
  return useInfiniteQuery({
    queryKey: ["project-archived-tasks", projectId, search, filters],
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filters.priority) params.set("filters[priority]", filters.priority);
      if (filters.assigneeId) params.set("filters[assigneeId]", filters.assigneeId);
      if (filters.completedFrom)
        params.set("filters[completedFrom]", filters.completedFrom);
      if (filters.completedTo) params.set("filters[completedTo]", filters.completedTo);
      if (filters.archivedFrom) params.set("filters[archivedFrom]", filters.archivedFrom);
      if (filters.archivedTo) params.set("filters[archivedTo]", filters.archivedTo);
      if (filters.status) params.set("filters[status]", filters.status);
      if (pageParam) params.set("cursor", pageParam);
      return apiGet<TaskHistoryPageDto>(
        `/api/projects/${projectId}/tasks/archived?${params.toString()}`,
        signal,
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.cursor,
    enabled: Boolean(projectId),
  });
}

/**
 * Purpose: Restore an archived task with immediate reversible removal from History.
 * Inputs: None; mutation receives the archived task DTO.
 * Output: TanStack restore mutation.
 * Side effects: Mutates cache, posts the versioned restore, rolls back failures, and invalidates affected surfaces.
 */
export function useRestoreTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: TaskDto) =>
      apiMutation<TaskDto>("post", `/api/tasks/${task.id}/restore`, {
        version: task.version,
      }),
    onMutate: async (task) => {
      const key = queryKeys.taskHistory("archived");
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<InfiniteData<TaskHistoryPageDto>>(key);
      queryClient.setQueryData<InfiniteData<TaskHistoryPageDto>>(key, (current) =>
        current
          ? {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                items: page.items.filter((item) => item.id !== task.id),
              })),
            }
          : current,
      );
      return { previous };
    },
    onError: (error, _task, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.taskHistory("archived"), context.previous);
      }
      AppToast(normalizeApiClientError(error).message, "error");
    },
    onSuccess: (restored) => {
      queryClient.setQueryData(queryKeys.task(restored.id), restored);
      AppToast(`${restored.title} restored.`, "success");
    },
    onSettled: (_data, _error, task) => {
      void queryClient.invalidateQueries({ queryKey: ["task-history"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks-week"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      void queryClient.invalidateQueries({ queryKey: ["project"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({ queryKey: ["task-activity", task.id] });
    },
  });
}
