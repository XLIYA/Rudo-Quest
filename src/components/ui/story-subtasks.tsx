"use client";

import { Plus, X } from "lucide-react";
import { parseISO } from "date-fns";
import { useState, type FormEvent } from "react";
import { useCreateSubtask, useSubtasks } from "@/features/tasks/subtask-hooks";
import { useTaskMutation } from "@/features/tasks/task-hooks";
import { getMondayWeekStart } from "@/lib/utils/dates";
import type { TaskDto, TaskPriority, TaskType } from "@/types/domain";
import { AppButton } from "./app-button";
import { AppDatePicker } from "./app-date-picker";
import { AppInput } from "./app-input";
import { AppProgress } from "./app-progress";
import { AppSelect } from "./app-select";
import { AppSkeleton } from "./app-skeleton";
import { TaskAssigneeCombobox } from "./task-assignee-combobox";
import { taskPriorityOptions, taskTypeOptions } from "./task-classification";
import { TaskRow } from "./task-row";

const subtaskTypeOptions = taskTypeOptions.filter((option) => option.value !== "STORY");

export type StorySubtasksProps = {
  story: TaskDto;
  offline: boolean;
  onOpenTask: (task: TaskDto) => void;
};

/**
 * Purpose: Render Story completion and lazily actionable one-level Subtasks.
 * Inputs: Story DTO, connectivity, and related-task navigation callback.
 * Output: Accessible progress, child rows, and compact child creation form.
 * Side effects: Fetches, creates, and transitions Subtasks through query hooks.
 */
export function StorySubtasks({ story, offline, onOpenTask }: StorySubtasksProps) {
  const subtasks = useSubtasks(story.id);
  const createSubtask = useCreateSubtask(story);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<Exclude<TaskType, "STORY">>("TASK");
  const [priority, setPriority] = useState<TaskPriority>("NONE");
  const [scheduledDate, setScheduledDate] = useState(story.scheduledDate);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const total = subtasks.data?.length ?? story.subtaskTotal;
  const completed =
    subtasks.data?.filter((task) => task.status === "DONE").length ??
    story.subtaskCompleted;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || offline || createSubtask.isPending) return;
    try {
      await createSubtask.mutateAsync({
        title: title.trim(),
        taskType,
        priority,
        scheduledDate,
        assigneeId,
      });
      setTitle("");
      setTaskType("TASK");
      setPriority("NONE");
      setScheduledDate(story.scheduledDate);
      setAssigneeId(null);
      setCreating(false);
    } catch {
      // The mutation hook owns error copy; retain the child draft for correction/retry.
    }
  };

  return (
    <section className="grid gap-4 rounded-lg border border-border bg-surface-muted/35 p-4">
      <header className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div>
          <h2 className="text-base font-semibold">Story progress</h2>
          <p className="mt-1 text-sm text-text-secondary">
            The Story completes automatically when every active Subtask is done.
          </p>
        </div>
        {story.permissions.canCreateSubtasks && !story.archivedAt ? (
          <AppButton
            variant="secondary"
            disabled={offline}
            onClick={() => setCreating((current) => !current)}
          >
            {creating ? (
              <X className="size-4" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            {creating ? "Cancel" : "Add Subtask"}
          </AppButton>
        ) : null}
      </header>

      {total ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-text-secondary">
              {completed} / {total} completed
            </span>
            <span className="font-mono font-semibold">{percent}%</span>
          </div>
          <AppProgress
            value={percent}
            label={`${completed} of ${total} subtasks completed`}
          />
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-text-tertiary">
          No active Subtasks yet. This Story can still be completed manually.
        </p>
      )}

      {creating ? (
        <form
          className="grid gap-3 rounded-md border border-border bg-surface p-3 sm:grid-cols-2"
          onSubmit={submit}
        >
          <div className="sm:col-span-2">
            <AppInput
              label="Subtask title"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              maxLength={140}
              required
              autoFocus
              disabled={offline || createSubtask.isPending}
            />
          </div>
          <AppSelect
            label="Type"
            value={taskType}
            onValueChange={(value) => setTaskType(value as Exclude<TaskType, "STORY">)}
            options={subtaskTypeOptions}
            disabled={offline || createSubtask.isPending}
          />
          <AppSelect
            label="Priority"
            value={priority}
            onValueChange={(value) => setPriority(value as TaskPriority)}
            options={taskPriorityOptions}
            disabled={offline || createSubtask.isPending}
          />
          <AppDatePicker
            label="Scheduled date"
            value={scheduledDate}
            onChange={(event) => setScheduledDate(event.currentTarget.value)}
            required
            disabled={offline || createSubtask.isPending}
          />
          <TaskAssigneeCombobox
            value={assigneeId}
            currentAssignee={null}
            projectId={story.projectId}
            onChange={(value) => setAssigneeId(value)}
            disabled={offline || createSubtask.isPending}
          />
          <div className="flex justify-end sm:col-span-2">
            <AppButton
              type="submit"
              disabled={offline || createSubtask.isPending || !title.trim()}
            >
              Create Subtask
            </AppButton>
          </div>
        </form>
      ) : null}

      {subtasks.isLoading ? <AppSkeleton className="h-24" /> : null}
      {subtasks.isError ? (
        <p role="alert" className="text-sm text-error">
          Subtasks could not be loaded.
        </p>
      ) : null}
      {subtasks.data?.length ? (
        <div className="grid gap-2">
          {subtasks.data.map((task) => (
            <StorySubtaskRow
              key={task.id}
              task={task}
              offline={offline}
              onOpenTask={onOpenTask}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StorySubtaskRow({
  task,
  offline,
  onOpenTask,
}: {
  task: TaskDto;
  offline: boolean;
  onOpenTask: (task: TaskDto) => void;
}) {
  const mutation = useTaskMutation(getMondayWeekStart(parseISO(task.scheduledDate)));
  return (
    <TaskRow
      task={task}
      disabled={offline || mutation.isPending}
      onOpen={onOpenTask}
      onStart={(target) => mutation.mutate({ task: target, action: "start" })}
      onCompleteToggle={(target) =>
        mutation.mutate({
          task: target,
          action: target.status === "DONE" ? "reopen" : "complete",
        })
      }
    />
  );
}
