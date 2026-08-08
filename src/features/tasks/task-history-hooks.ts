"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { AppToast } from "@/components/ui/app-toast";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { TaskDto, TaskHistoryPageDto, TaskHistoryView } from "@/types/domain";

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
