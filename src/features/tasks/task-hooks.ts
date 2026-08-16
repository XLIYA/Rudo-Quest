"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppToast } from "@/components/ui/app-toast";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  ProjectIconKey,
  TaskDto,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/types/domain";

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
      assigneeId?: string | null;
      description?: string | null;
      iconKey?: ProjectIconKey | null;
      taskType?: TaskType;
      priority?: TaskPriority;
      parentTaskId?: string | null;
      scheduledTime?: string | null;
    }) => apiMutation<TaskDto>("post", "/api/tasks", body),
    onMutate: async (body) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.tasksWeek(weekStart) }),
        queryClient.cancelQueries({ queryKey: ["dashboard"] }),
      ]);
      const previous = queryClient.getQueriesData<TaskDto[]>({
        queryKey: queryKeys.tasksWeek(weekStart),
      });
      const optimistic: TaskDto = {
        id: crypto.randomUUID(),
        projectId: body.projectId ?? null,
        createdBy: {
          id: "optimistic",
          handle: "you",
          displayName: "You",
          avatarUrl: null,
        },
        assignee: body.projectId
          ? null
          : {
              id: "optimistic",
              handle: "you",
              displayName: "You",
              avatarUrl: null,
            },
        title: body.title,
        description: body.description ?? null,
        iconKey: body.iconKey ?? null,
        taskType: body.taskType ?? "TASK",
        priority: body.priority ?? "NONE",
        parentTaskId: body.parentTaskId ?? null,
        subtaskTotal: 0,
        subtaskCompleted: 0,
        subtaskProgressPercent: 0,
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
        permissions: {
          canEditDetails: true,
          canCreateSubtasks: true,
          canTransition: true,
          canArchive: true,
        },
        project: null,
      };
      queryClient.setQueriesData<TaskDto[]>(
        { queryKey: queryKeys.tasksWeek(weekStart) },
        (current) => [...(current ?? []), optimistic],
      );
      return { previous };
    },
    onError: (error, _body, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
      AppToast(normalizeApiClientError(error).message, "error");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasksWeek(weekStart) });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["task-history"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      void queryClient.invalidateQueries({ queryKey: ["project"] });
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
      action:
        | "start"
        | "complete"
        | "reopen"
        | "move"
        | "update"
        | "archive"
        | "pending_review";
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
      if (input.action === "move" || input.action === "pending_review") {
        return apiMutation<TaskDto>("post", `/api/tasks/${input.task.id}/move`, {
          version: input.task.version,
          status:
            input.action === "pending_review" ? "PENDING_REVIEW" : input.body?.status,
        });
      }
      return apiMutation<TaskDto>("post", `/api/tasks/${input.task.id}/${input.action}`, {
        version: input.task.version,
      });
    },
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.tasksWeek(weekStart) }),
        queryClient.cancelQueries({ queryKey: queryKeys.task(input.task.id) }),
        queryClient.cancelQueries({ queryKey: ["dashboard"] }),
      ]);
      const previous = queryClient.getQueriesData<TaskDto[]>({
        queryKey: queryKeys.tasksWeek(weekStart),
      });
      const previousTask = queryClient.getQueryData<TaskDto>(
        queryKeys.task(input.task.id),
      );
      const parentId = input.task.parentTaskId;
      const previousSubtasks = parentId
        ? queryClient.getQueryData<TaskDto[]>(queryKeys.subtasks(parentId))
        : undefined;
      if (input.action !== "archive") {
        queryClient.setQueriesData<TaskDto[]>(
          { queryKey: queryKeys.tasksWeek(weekStart) },
          (current) =>
            current?.map((task) =>
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
      if (parentId) {
        queryClient.setQueryData<TaskDto[]>(queryKeys.subtasks(parentId), (current) =>
          input.action === "archive"
            ? current?.filter((task) => task.id !== input.task.id)
            : current?.map((task) =>
                task.id === input.task.id
                  ? optimisticTask(task, input.action, input.body)
                  : task,
              ),
        );
      }
      return { previous, previousTask, previousSubtasks };
    },
    onError: (error, input, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
      queryClient.setQueryData(
        queryKeys.task(input.task.id),
        context?.previousTask ?? input.task,
      );
      if (input.task.parentTaskId && context?.previousSubtasks) {
        queryClient.setQueryData(
          queryKeys.subtasks(input.task.parentTaskId),
          context.previousSubtasks,
        );
      }
      const normalized = normalizeApiClientError(error);
      AppToast(
        normalized.status === 409
          ? "This task changed elsewhere. The latest version has been loaded."
          : normalized.message,
        "error",
      );
    },
    onSuccess: (data, input) => {
      queryClient.setQueryData(queryKeys.task(input.task.id), data);
      queryClient.setQueriesData<TaskDto[]>(
        { queryKey: queryKeys.tasksWeek(weekStart) },
        (current) => current?.map((task) => (task.id === input.task.id ? data : task)),
      );
      if (input.task.parentTaskId) {
        queryClient.setQueryData<TaskDto[]>(
          queryKeys.subtasks(input.task.parentTaskId),
          (current) =>
            input.action === "archive"
              ? current?.filter((task) => task.id !== input.task.id)
              : current?.map((task) => (task.id === input.task.id ? data : task)),
        );
      }
    },
    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasksWeek(weekStart) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.task(input.task.id) });
      void queryClient.invalidateQueries({
        queryKey: ["task-activity", input.task.id],
      });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["task-history"] });
      if (input.task.parentTaskId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.subtasks(input.task.parentTaskId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.task(input.task.parentTaskId),
        });
      }
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
  if (action === "move") {
    const status = body?.status as TaskStatus | undefined;
    if (!status || status === task.status) return task;
    const previousStatus =
      status === "PENDING_REVIEW"
        ? task.status
        : status === "DONE"
          ? task.status === "DONE"
            ? task.previousStatus
            : task.status
          : null;
    return {
      ...task,
      status,
      previousStatus,
      completedAt: status === "DONE" ? now : null,
      version: task.version + 1,
      updatedAt: now,
    };
  }
  return { ...task, ...body, version: task.version + 1, updatedAt: now };
}
