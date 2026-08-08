"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppToast } from "@/components/ui/app-toast";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { TaskDto, TaskPriority, TaskType } from "@/types/domain";

/**
 * Purpose: Lazily read a Story's active one-level children.
 * Inputs: Story ID and whether its detail surface is active.
 * Output: TanStack child-task query.
 * Side effects: Performs an authenticated child collection GET.
 */
export function useSubtasks(storyId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.subtasks(storyId),
    queryFn: ({ signal }) => apiGet<TaskDto[]>(`/api/tasks/${storyId}/subtasks`, signal),
    enabled: enabled && Boolean(storyId),
  });
}

/**
 * Purpose: Create a Subtask and refresh its Story aggregate surfaces.
 * Inputs: Parent Story DTO; mutation receives child-editable fields.
 * Output: TanStack create mutation.
 * Side effects: Posts child data, updates child cache, and invalidates parent/list aggregates.
 */
export function useCreateSubtask(story: TaskDto) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      description?: string | null;
      assigneeId?: string | null;
      taskType?: Exclude<TaskType, "STORY">;
      priority?: TaskPriority;
      scheduledDate?: string;
      scheduledTime?: string | null;
    }) => apiMutation<TaskDto>("post", `/api/tasks/${story.id}/subtasks`, body),
    onSuccess: (created) => {
      queryClient.setQueryData<TaskDto[]>(queryKeys.subtasks(story.id), (current) => [
        ...(current ?? []),
        created,
      ]);
      queryClient.setQueryData(queryKeys.task(created.id), created);
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(story.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.task(story.id) });
      void queryClient.invalidateQueries({ queryKey: ["tasks-week"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["project"] });
      void queryClient.invalidateQueries({ queryKey: ["task-history"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}
