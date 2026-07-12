"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppToast } from "@/components/ui/app-toast";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { TaskDto } from "@/types/domain";

/**
 * Purpose: Fetch weekly task data through the central API client.
 * Inputs: Week start ISO date.
 * Output: TanStack Query result for task DTOs.
 * Side effects: Performs browser HTTP GET.
 */
export function useWeekTasks(weekStart: string) {
  return useQuery({
    queryKey: queryKeys.tasksWeek(weekStart),
    queryFn: ({ signal }) =>
      apiGet<TaskDto[]>(`/api/tasks/week?weekStart=${weekStart}`, signal),
  });
}

/**
 * Purpose: Create a quick task with optimistic insertion.
 * Inputs: Week start whose cache should receive the optimistic row.
 * Output: TanStack mutation.
 * Side effects: Mutates cache, sends POST, invalidates week/dashboard queries.
 */
export function useCreateTask(weekStart: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      scheduledDate: string;
      scheduledTimeZone: string;
      projectId?: string | null;
      scheduledTime?: string | null;
    }) => apiMutation<TaskDto>("post", "/api/tasks", body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasksWeek(weekStart) });
      const previous =
        queryClient.getQueryData<TaskDto[]>(queryKeys.tasksWeek(weekStart)) ?? [];
      const optimistic: TaskDto = {
        id: crypto.randomUUID(),
        projectId: body.projectId ?? null,
        createdBy: {
          id: "optimistic",
          handle: "you",
          displayName: "You",
          avatarUrl: null,
        },
        assignee: {
          id: "optimistic",
          handle: "you",
          displayName: "You",
          avatarUrl: null,
        },
        title: body.title,
        description: null,
        iconKey: null,
        status: "TODO",
        previousStatus: null,
        scheduledDate: body.scheduledDate,
        scheduledTime: body.scheduledTime ?? null,
        scheduledTimeZone: body.scheduledTimeZone,
        completedAt: null,
        archivedAt: null,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        project: null,
      };
      queryClient.setQueryData<TaskDto[]>(queryKeys.tasksWeek(weekStart), [
        ...previous,
        optimistic,
      ]);
      return { previous };
    },
    onError: (error, _body, context) => {
      queryClient.setQueryData(queryKeys.tasksWeek(weekStart), context?.previous ?? []);
      AppToast(normalizeApiClientError(error).message, "error");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasksWeek(weekStart) });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * Purpose: Apply optimistic task state or field mutations.
 * Inputs: Week start and mutation mode.
 * Output: Mutation function for task updates.
 * Side effects: Mutates cache, calls task API, rolls back on failure.
 */
export function useTaskMutation(weekStart: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      task: TaskDto;
      action: "start" | "complete" | "reopen" | "update" | "archive";
      body?: Record<string, unknown>;
    }) => {
      if (input.action === "update") {
        return apiMutation<TaskDto>("patch", `/api/tasks/${input.task.id}`, {
          ...input.body,
          version: input.task.version,
        });
      }
      if (input.action === "archive") {
        return apiMutation<TaskDto>("delete", `/api/tasks/${input.task.id}`, {
          version: input.task.version,
        });
      }
      return apiMutation<TaskDto>("post", `/api/tasks/${input.task.id}/${input.action}`, {
        version: input.task.version,
      });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasksWeek(weekStart) });
      const previous =
        queryClient.getQueryData<TaskDto[]>(queryKeys.tasksWeek(weekStart)) ?? [];
      if (input.action !== "archive") {
        queryClient.setQueryData<TaskDto[]>(
          queryKeys.tasksWeek(weekStart),
          previous.map((task) =>
            task.id === input.task.id
              ? optimisticTask(task, input.action, input.body)
              : task,
          ),
        );
        queryClient.setQueryData<TaskDto>(
          queryKeys.task(input.task.id),
          optimisticTask(input.task, input.action, input.body),
        );
      }
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(queryKeys.tasksWeek(weekStart), context?.previous ?? []);
      if (_input) queryClient.setQueryData(queryKeys.task(_input.task.id), _input.task);
      AppToast(normalizeApiClientError(error).message, "error");
    },
    onSuccess: (data, input) => {
      queryClient.setQueryData(queryKeys.task(input.task.id), data);
    },
    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasksWeek(weekStart) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.task(input.task.id) });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * Purpose: Produce a reversible optimistic task projection.
 * Inputs: Task DTO, action, and optional field body.
 * Output: Updated task DTO.
 * Side effects: None.
 */
function optimisticTask(
  task: TaskDto,
  action: string,
  body?: Record<string, unknown>,
): TaskDto {
  const now = new Date().toISOString();
  if (action === "start")
    return { ...task, status: "IN_PROGRESS", version: task.version + 1, updatedAt: now };
  if (action === "complete") {
    return {
      ...task,
      status: "DONE",
      previousStatus: task.status === "DONE" ? task.previousStatus : task.status,
      completedAt: now,
      version: task.version + 1,
      updatedAt: now,
    };
  }
  if (action === "reopen") {
    return {
      ...task,
      status: task.previousStatus ?? "TODO",
      previousStatus: null,
      completedAt: null,
      version: task.version + 1,
      updatedAt: now,
    };
  }
  return { ...task, ...body, version: task.version + 1, updatedAt: now };
}
