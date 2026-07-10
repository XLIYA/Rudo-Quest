"use client";

import { Clock, Play } from "lucide-react";
import type { TaskDto } from "@/types/domain";
import { getProjectColor } from "@/lib/theme/project-colors";
import { AppAvatar } from "./app-avatar";
import { AppIconButton } from "./app-icon-button";
import { TaskCheckbox } from "./task-checkbox";

export type TaskRowProps = {
  task: TaskDto;
  disabled?: boolean;
  onOpen: (task: TaskDto) => void;
  onCompleteToggle: (task: TaskDto) => void;
  onStart: (task: TaskDto) => void;
};

/**
 * Purpose: Render a compact task row for weekly and dashboard views.
 * Inputs: Task DTO and action handlers.
 * Output: Keyboard/touch-operable task row.
 * Side effects: Invokes action callbacks.
 */
export function TaskRow({
  task,
  disabled,
  onOpen,
  onCompleteToggle,
  onStart,
}: TaskRowProps) {
  const color = task.project ? getProjectColor(task.project.colorKey) : null;
  return (
    <article
      className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-md border border-border bg-surface p-3 shadow-[var(--shadow-surface)]"
    >
      <TaskCheckbox
        checked={task.status === "DONE"}
        disabled={disabled}
        label={`${task.status === "DONE" ? "Reopen" : "Complete"} ${task.title}`}
        onChange={() => onCompleteToggle(task)}
      />
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <h3 className="line-clamp-2 text-sm font-semibold">{task.title}</h3>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-text-secondary">
          {task.project ? (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1">
              <span
                className="size-2 shrink-0 rounded-sm"
                style={{ background: color?.main }}
              />
              <span className="truncate">{task.project.title}</span>
            </span>
          ) : (
            <span>Personal</span>
          )}
          {task.scheduledTime ? (
            <span className="inline-flex items-center gap-1 font-mono">
              <Clock className="size-3" />
              {task.scheduledTime.slice(0, 5)}
            </span>
          ) : null}
          <span>{task.status.replace("_", " ")}</span>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        {task.status === "TODO" ? (
          <AppIconButton
            label={`Start ${task.title}`}
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onStart(task);
            }}
          >
            <Play className="size-4" />
          </AppIconButton>
        ) : null}
        {task.assignee ? (
          <AppAvatar
            name={task.assignee.displayName}
            src={task.assignee.avatarUrl}
            className="size-8"
          />
        ) : null}
      </div>
    </article>
  );
}
