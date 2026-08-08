"use client";

import { CheckCircle2 } from "lucide-react";
import { parseISO } from "date-fns";
import { useState, type FormEvent } from "react";
import { useCreateTask } from "@/features/tasks/task-hooks";
import { getMondayWeekStart } from "@/lib/utils/dates";
import type { TaskDto, TaskPriority, TaskType } from "@/types/domain";
import { AppButton } from "./app-button";
import { AppDatePicker } from "./app-date-picker";
import { AppInput } from "./app-input";
import { AppSelect } from "./app-select";
import { AppSheet } from "./app-sheet";
import { AppTextarea } from "./app-textarea";
import { AppTimePicker } from "./app-time-picker";
import { TaskAssigneeCombobox } from "./task-assignee-combobox";
import { taskPriorityOptions, taskTypeOptions } from "./task-classification";

export type TaskCreateSheetProps = {
  open: boolean;
  project: { id: string; title: string; timeZone: string };
  scheduledDate: string;
  offline?: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (task: TaskDto) => void;
};

/**
 * Purpose: Create a fully classified task from inside a fixed project scope.
 * Inputs: Project context, default schedule date, network state, and lifecycle callbacks.
 * Output: Accessible task creation sheet with optional assignee.
 * Side effects: Posts a task mutation and closes only after successful creation.
 */
export function TaskCreateSheet({
  open,
  project,
  scheduledDate: initialScheduledDate,
  offline = false,
  onOpenChange,
  onCreated,
}: TaskCreateSheetProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState(initialScheduledDate);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<TaskType>("TASK");
  const [priority, setPriority] = useState<TaskPriority>("NONE");
  const weekStart = getMondayWeekStart(parseISO(scheduledDate));
  const createTask = useCreateTask(weekStart);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || offline || createTask.isPending) return;
    try {
      const created = await createTask.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        scheduledDate,
        scheduledTime,
        scheduledTimeZone: project.timeZone,
        projectId: project.id,
        assigneeId,
        taskType,
        priority,
      });
      onCreated(created);
      onOpenChange(false);
    } catch {
      // The mutation hook reports a safe error and the sheet preserves the draft.
    }
  };

  return (
    <AppSheet open={open} onOpenChange={onOpenChange} title="Create project task">
      <form className="grid gap-5" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-4 sm:col-span-2">
            <AppInput
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              maxLength={140}
              disabled={offline || createTask.isPending}
              autoFocus
              required
            />
            <AppTextarea
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              maxLength={5000}
              rows={4}
              disabled={offline || createTask.isPending}
            />
          </div>
          <AppInput label="Project" value={project.title} disabled readOnly />
          <TaskAssigneeCombobox
            value={assigneeId}
            currentAssignee={null}
            projectId={project.id}
            onChange={(value) => setAssigneeId(value)}
            disabled={offline || createTask.isPending}
          />
          <AppSelect
            label="Type"
            value={taskType}
            onValueChange={(value) => setTaskType(value as TaskType)}
            options={taskTypeOptions}
            disabled={offline || createTask.isPending}
          />
          <AppSelect
            label="Priority"
            value={priority}
            onValueChange={(value) => setPriority(value as TaskPriority)}
            options={taskPriorityOptions}
            disabled={offline || createTask.isPending}
          />
          <AppDatePicker
            label="Scheduled date"
            value={scheduledDate}
            onChange={(event) => setScheduledDate(event.currentTarget.value)}
            disabled={offline || createTask.isPending}
            required
          />
          <AppTimePicker
            label="Scheduled time"
            value={scheduledTime}
            onValueChange={setScheduledTime}
            allowEmpty
            emptyLabel="Any time"
            disabled={offline || createTask.isPending}
          />
        </div>
        <div className="flex justify-end border-t border-border pt-4">
          <AppButton
            type="submit"
            disabled={offline || createTask.isPending || !title.trim()}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Create task
          </AppButton>
        </div>
      </form>
    </AppSheet>
  );
}
