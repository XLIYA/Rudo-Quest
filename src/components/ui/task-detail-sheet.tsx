"use client";

import type { TaskDto } from "@/types/domain";
import { AppButton } from "./app-button";
import { AppDatePicker } from "./app-date-picker";
import { AppSheet } from "./app-sheet";
import { AppTextarea } from "./app-textarea";
import { AppTimePicker } from "./app-time-picker";
import { AppInput } from "./app-input";

export type TaskDetailSheetProps = {
  task: TaskDto | null;
  open: boolean;
  offline?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (task: TaskDto, values: { title: string; description: string | null; scheduledDate: string; scheduledTime: string | null }) => void;
  onArchive: (task: TaskDto) => void;
};

/**
 * Purpose: Render editable task details and archive action.
 * Inputs: Selected task, controlled open state, and mutation callbacks.
 * Output: Responsive sheet.
 * Side effects: Calls save/archive callbacks.
 */
export function TaskDetailSheet({ task, open, offline, onOpenChange, onSave, onArchive }: TaskDetailSheetProps) {
  if (!task) return null;
  return (
    <AppSheet open={open} onOpenChange={onOpenChange} title="Task details">
      <form
        key={task.id}
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onSave(task, {
            title: String(data.get("title") ?? ""),
            description: String(data.get("description") ?? "") || null,
            scheduledDate: String(data.get("scheduledDate") ?? task.scheduledDate),
            scheduledTime: String(data.get("scheduledTime") ?? "") || null,
          });
        }}
      >
        <AppInput label="Title" name="title" defaultValue={task.title} />
        <AppTextarea label="Description" name="description" defaultValue={task.description ?? ""} />
        <div className="grid grid-cols-2 gap-3">
          <AppDatePicker label="Date" name="scheduledDate" defaultValue={task.scheduledDate} />
          <AppTimePicker label="Time" name="scheduledTime" defaultValue={task.scheduledTime?.slice(0, 5) ?? ""} />
        </div>
        <dl className="grid gap-2 rounded-md bg-surface-muted p-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Status</dt>
            <dd className="font-mono">{task.status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Created</dt>
            <dd className="font-mono">{new Date(task.createdAt).toLocaleString()}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Updated</dt>
            <dd className="font-mono">{new Date(task.updatedAt).toLocaleString()}</dd>
          </div>
        </dl>
        <div className="flex justify-between gap-2">
          <AppButton variant="danger" disabled={offline} onClick={() => onArchive(task)}>
            Archive
          </AppButton>
          <AppButton type="submit" disabled={offline}>
            Save
          </AppButton>
        </div>
      </form>
    </AppSheet>
  );
}
