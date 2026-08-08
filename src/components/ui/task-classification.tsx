import {
  BookOpen,
  Bug,
  Flag,
  FlaskConical,
  ListTodo,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { TaskPriority, TaskType } from "@/types/domain";

const taskTypePresentation: Record<TaskType, { label: string; icon: LucideIcon }> = {
  TASK: { label: "Task", icon: ListTodo },
  STORY: { label: "Story", icon: BookOpen },
  FEATURE: { label: "Feature", icon: Sparkles },
  BUG: { label: "Bug", icon: Bug },
  TEST: { label: "Test", icon: FlaskConical },
};

const priorityPresentation: Record<TaskPriority, { label: string; className: string }> = {
  NONE: { label: "None", className: "" },
  LOW: { label: "Low", className: "bg-surface-muted text-text-secondary" },
  MEDIUM: { label: "Medium", className: "bg-brand-soft text-brand" },
  HIGH: { label: "High", className: "bg-warning-soft text-warning" },
  URGENT: { label: "Urgent", className: "bg-error-soft text-error" },
};

export const taskTypeOptions = Object.entries(taskTypePresentation).map(
  ([value, presentation]) => ({ value, label: presentation.label }),
);
export const taskPriorityOptions = Object.entries(priorityPresentation).map(
  ([value, presentation]) => ({ value, label: presentation.label }),
);

/**
 * Purpose: Communicate task type and non-neutral priority with icon and text.
 * Inputs: Persisted task classification.
 * Output: Compact accessible badge group.
 * Side effects: None.
 */
export function TaskClassification({
  taskType,
  priority,
  className,
}: {
  taskType: TaskType;
  priority: TaskPriority;
  className?: string;
}) {
  const type = taskTypePresentation[taskType];
  const priorityView = priorityPresentation[priority];
  const TypeIcon = type.icon;

  return (
    <span
      aria-label={`${type.label}, ${priority === "NONE" ? "No" : priorityView.label} priority`}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-1 font-mono text-[10px] font-semibold text-text-secondary">
        <TypeIcon className="size-3" aria-hidden="true" />
        {type.label}
      </span>
      {priority !== "NONE" ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] font-semibold",
            priorityView.className,
          )}
        >
          <Flag className="size-3" aria-hidden="true" />
          {priorityView.label}
        </span>
      ) : null}
    </span>
  );
}
