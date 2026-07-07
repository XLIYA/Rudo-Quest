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
export function TaskRow({ task, disabled, onOpen, onCompleteToggle, onStart }: TaskRowProps) {
  const color = task.project ? getProjectColor(task.project.colorKey) : null;
  return (
    <article
      tabIndex={0}
      role="button"
      onClick={() => onOpen(task)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(task);
      }}
      className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-md border border-border bg-surface p-3 shadow-[var(--shadow-surface)]"
    >
      <TaskCheckbox
        checked={task.status === "DONE"}
        disabled={disabled}
        label={`${task.status === "DONE" ? "Reopen" : "Complete"} ${task.title}`}
        onChange={() => onCompleteToggle(task)}
      />
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-sm font-semibold">{task.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          {task.project ? (
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-sm" style={{ background: color?.main }} />
              {task.project.title}
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
      </div>
      <div className="flex items-center gap-1">
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
        {task.assignee ? <AppAvatar name={task.assignee.displayName} src={task.assignee.avatarUrl} className="size-8" /> : null}
      </div>
    </article>
  );
}
