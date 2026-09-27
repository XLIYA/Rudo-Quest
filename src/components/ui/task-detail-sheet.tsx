"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Play,
  Archive,
  RotateCcw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { useAllProjects } from "@/features/projects/project-hooks";
import {
  projectIconKeys,
  type ProjectIconKey,
  type ProfileSummary,
  type TaskDto,
  type TaskPriority,
  type TaskType,
} from "@/types/domain";
import { ProjectIconGlyph } from "@/features/projects/project-pickers";
import { AppButton } from "./app-button";
import { AppConfirmDialog } from "./app-confirm-dialog";
import { AppDatePicker } from "./app-date-picker";
import { AppInput } from "./app-input";
import { AppSelect } from "./app-select";
import { AppDialog } from "./app-dialog";
import { AppTextarea } from "./app-textarea";
import { AppTimePicker } from "./app-time-picker";
import { TaskAssigneeCombobox } from "./task-assignee-combobox";
import { TaskAttachments } from "./task-attachments";
import { StorySubtasks } from "./story-subtasks";
import {
  TaskClassification,
  taskPriorityOptions,
  taskTypeOptions,
} from "./task-classification";

import { TaskDifficulty, TaskDifficultyPicker } from "./task-difficulty";

type TaskDraft = {
  title: string;
  description: string | null;
  scheduledDate: string;
  scheduledTime: string | null;
  projectId: string | null;
  assigneeId: string | null;
  iconKey: ProjectIconKey | null;
  taskType: TaskType;
  priority: TaskPriority;
  difficulty: number;
  version: number;
};

export type TaskDetailAction = "start" | "complete" | "reopen" | "pending_review";

/**
 * Payload sent to onSave. Viewers without detail-edit rights may submit an
 * assignment-only change, so a partial field set must be representable.
 */
export type TaskDetailSaveValues = Partial<Omit<TaskDraft, "version">> & {
  version: number;
};

export type TaskDetailSheetProps = {
  task: TaskDto | null;
  open: boolean;
  offline?: boolean;
  pending?: boolean;
  conflict?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (task: TaskDto, values: TaskDetailSaveValues) => Promise<void>;
  onAction: (task: TaskDto, action: TaskDetailAction) => void;
  onArchive: (task: TaskDto) => void;
  onOpenRelatedTask: (task: TaskDto) => void;
};

/**
 * Purpose: Create an editable snapshot from the latest versioned task DTO.
 * Inputs: Current task.
 * Output: Form draft with normalized time and assignee values.
 * Side effects: None.
 */
function toDraft(task: TaskDto): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    scheduledDate: task.scheduledDate,
    scheduledTime: task.scheduledTime?.slice(0, 5) ?? null,
    projectId: task.projectId,
    assigneeId: task.assignee?.id ?? null,
    iconKey: task.iconKey,
    taskType: task.taskType,
    priority: task.priority,
    difficulty: task.difficulty,
    version: task.version,
  };
}

/**
 * Purpose: Select between personal scope and active editable projects.
 * Inputs: Current project, controlled change handler, and disabled state.
 * Output: Project select UI with loading state.
 * Side effects: Reads the shared projects query via useAllProjects.
 */
function ProjectCombobox({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled: boolean;
}) {
  const projectsQuery = useAllProjects();

  const options = [
    { value: "__personal__", label: "Personal task" },
    ...(projectsQuery.data
      ?.filter((project) => !project.archivedAt && project.role !== "VIEWER")
      .map((project) => ({
        value: project.id,
        label: project.title,
      })) ?? []),
  ];

  const isLoading = projectsQuery.isLoading;
  const isError = projectsQuery.isError;

  if (isError) {
    return (
      <AppSelect
        label="Project"
        value={value ?? "__personal__"}
        onValueChange={(next) => onChange(next === "__personal__" ? null : next)}
        options={[{ value: "__personal__", label: "Personal task" }]}
        disabled={disabled || true}
        placeholder="Failed to load projects"
      />
    );
  }

  return (
    <div className="grid gap-1.5 text-sm font-medium">
      {isLoading ? (
        <>
          <label className="text-sm font-medium text-text-primary">Project</label>
          <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-text-tertiary">
            <Loader2 className="size-4 animate-spin" />
            <span>Loading projects...</span>
          </div>
        </>
      ) : (
        <AppSelect
          label="Project"
          value={value ?? "__personal__"}
          onValueChange={(next) => onChange(next === "__personal__" ? null : next)}
          options={options}
          disabled={disabled}
          placeholder="Select a project..."
        />
      )}
    </div>
  );
}

/**
 * Purpose: Search and select a single active member for a project task.
 * Inputs: Current assignee/project, controlled change handler, and disabled state.
 * Output: Debounced accessible member combobox or personal-task guidance.
 * Side effects: Fetches project-member suggestions and updates controlled selection.
 */
/**
 * Purpose: Select or clear an allowlisted Lucide task icon.
 * Inputs: Current icon, controlled change handler, and disabled state.
 * Output: Accessible pressed-state icon grid.
 * Side effects: Invokes the controlled selection callback.
 */
function IconPicker({
  value,
  onChange,
  disabled,
}: {
  value: ProjectIconKey | null;
  onChange: (value: ProjectIconKey | null) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold">Icon</legend>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
        {projectIconKeys.map((key) => {
          return (
            <button
              key={key}
              type="button"
              aria-label={`${key} icon`}
              aria-pressed={value === key}
              onClick={() => onChange(value === key ? null : key)}
              disabled={disabled}
              className={`flex min-h-11 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${value === key ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-surface-muted"}`}
            >
              <ProjectIconGlyph iconKey={key} className="size-5" />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Purpose: Present a task state with text and a supporting icon.
 * Inputs: Current task status.
 * Output: Compact status badge.
 * Side effects: None.
 */
function StatusBadge({ status }: { status: TaskDto["status"] }) {
  const icon =
    status === "IN_PROGRESS" ? (
      <Play className="size-3" aria-hidden="true" />
    ) : status === "DONE" ? (
      <CheckCircle2 className="size-3" aria-hidden="true" />
    ) : status === "PENDING_REVIEW" ? (
      <AlertCircle className="size-3" aria-hidden="true" />
    ) : null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-1 font-mono text-xs">
      {icon}
      {status.replace("_", " ")}
    </span>
  );
}

/**
 * Purpose: Render editable task data and immediately persistent state actions in a responsive sheet.
 * Inputs: Selected task, offline state, save/action/archive callbacks, and open state.
 * Output: Accessible centered task dialog.
 * Side effects: Reads fresh task/activity data and invokes mutation callbacks.
 * Failure behavior: Parent mutation errors roll back through TanStack Query and keep the sheet open.
 */
export function TaskDetailSheet({
  task,
  open,
  offline = false,
  pending = false,
  conflict = false,
  onOpenChange,
  onSave,
  onAction,
  onArchive,
  onOpenRelatedTask,
}: TaskDetailSheetProps) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [saving, setSaving] = useState(false);
  // The draft is keyed to the task identity only. Version bumps from
  // optimistic updates or background refetches must not discard unsaved
  // edits; the field values below keep precedence over a refetched task,
  // matching the save-failure retention path.
  const [draftState, setDraftState] = useState<{
    taskId: string;
    draft: TaskDraft;
  } | null>(null);
  const taskQuery = useQuery({
    queryKey: queryKeys.task(task?.id ?? ""),
    queryFn: ({ signal }) => apiGet<TaskDto>(`/api/tasks/${task?.id}`, signal),
    enabled: open && Boolean(task?.id),
  });
  const activeTask = taskQuery.data ?? task;
  const activity = useQuery({
    queryKey: ["task-activity", activeTask?.id],
    queryFn: ({ signal }) =>
      apiGet<
        { id: string; actor: ProfileSummary | null; label: string; createdAt: string }[]
      >(`/api/tasks/${activeTask?.id}/activity`, signal),
    enabled: open && Boolean(activeTask?.id),
  });

  const draft = activeTask
    ? draftState?.taskId === activeTask.id
      ? draftState.draft
      : toDraft(activeTask)
    : null;

  if (!activeTask || !draft) return null;
  const archivedReadOnly = Boolean(activeTask.archivedAt);
  const detailsDisabled =
    archivedReadOnly || offline || saving || !activeTask.permissions.canEditDetails;
  // Members may reassign project tasks without broader edit rights, so the
  // assignee combobox follows canAssign instead of the whole-pane gate.
  const assigneeDisabled =
    archivedReadOnly || offline || saving || !activeTask.permissions.canAssign;
  const transitionsDisabled =
    archivedReadOnly || offline || saving || !activeTask.permissions.canTransition;
  /**
   * Purpose: Update one draft field while retaining its task identity.
   * Inputs: Draft key and typed replacement value.
   * Output: Void.
   * Side effects: Updates local form state.
   */
  const update = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraftState((current) => ({
      taskId: activeTask.id,
      draft: {
        ...(current?.taskId === activeTask.id ? current.draft : draft),
        [key]: value,
      },
    }));

  /**
   * Purpose: Normalize and submit the latest editable task draft.
   * Inputs: Form submission event.
   * Output: Void.
   * Side effects: Prevents navigation and invokes the versioned save callback.
   * Business rule: Viewers who may only assign send an assignment-only patch
   * so the server accepts the update under the member assignment policy.
   */
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const nextAssigneeId = draft.projectId ? draft.assigneeId : activeTask.createdBy.id;
      const values: TaskDetailSaveValues =
        !activeTask.permissions.canEditDetails && activeTask.permissions.canAssign
          ? { version: draft.version, assigneeId: nextAssigneeId }
          : {
              ...draft,
              title: draft.title.trim(),
              description: draft.description?.trim() || null,
              scheduledTime: draft.scheduledTime || null,
              assigneeId: nextAssigneeId,
              version: draft.version,
            };
      await onSave(activeTask, values);
      onOpenChange(false);
    } catch {
      // The mutation hook owns error presentation; preserve the draft for retry.
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppDialog open={open} onOpenChange={onOpenChange} title="Task details">
        <form className="grid gap-5" onSubmit={submit}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={activeTask.status} />
              <TaskClassification
                taskType={activeTask.taskType}
                priority={activeTask.priority}
              />
              <TaskDifficulty value={activeTask.difficulty} />
            </div>
            <span className="font-mono text-xs text-text-tertiary">
              v{activeTask.version}
            </span>
          </div>
          {!activeTask.permissions.canEditDetails ? (
            <p className="rounded-md border border-border bg-surface-muted p-3 text-sm text-text-secondary">
              {activeTask.permissions.canAssign
                ? "You can update the assignee, but only the assignee or a project owner/admin can edit the other details."
                : "You can view this task, but only its assignee or a project owner/admin can edit it."}
            </p>
          ) : null}
          {archivedReadOnly ? (
            <p className="rounded-md border border-border bg-surface-muted p-3 text-sm text-text-secondary">
              This task is archived. Restore it from Task history before making changes.
            </p>
          ) : null}
          {conflict || draft.version !== activeTask.version ? (
            <p
              role="alert"
              className="rounded-md border border-warning bg-warning-soft p-3 text-sm text-text-primary"
            >
              This task changed. Your draft is preserved. Review your edits before
              applying them to the latest version.
              <AppButton
                type="button"
                variant="secondary"
                disabled={pending || saving}
                onClick={() => update("version", activeTask.version)}
              >
                Use latest version
              </AppButton>
            </p>
          ) : null}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.8fr)]">
            <div className="grid content-start gap-4">
              <AppInput
                label="Title"
                maxLength={140}
                value={draft.title}
                onChange={(event) => update("title", event.currentTarget.value)}
                disabled={detailsDisabled}
                autoFocus
              />
              <AppTextarea
                label="Description"
                maxLength={5000}
                value={draft.description ?? ""}
                onChange={(event) => update("description", event.currentTarget.value)}
                disabled={detailsDisabled}
                rows={6}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <AppSelect
                  label="Type"
                  value={draft.taskType}
                  onValueChange={(value) => update("taskType", value as TaskType)}
                  options={taskTypeOptions}
                  disabled={detailsDisabled || Boolean(activeTask.parentTaskId)}
                />
                <AppSelect
                  label="Priority"
                  value={draft.priority}
                  onValueChange={(value) => update("priority", value as TaskPriority)}
                  options={taskPriorityOptions}
                  disabled={detailsDisabled}
                />
                <TaskDifficultyPicker
                  value={draft.difficulty}
                  onChange={(value) => update("difficulty", value)}
                  disabled={detailsDisabled}
                />
                <AppDatePicker
                  label="Scheduled date"
                  value={draft.scheduledDate}
                  onValueChange={(value) => update("scheduledDate", value)}
                  disabled={detailsDisabled}
                />
                <AppTimePicker
                  label="Scheduled time"
                  value={draft.scheduledTime}
                  onValueChange={(value) => update("scheduledTime", value)}
                  allowEmpty
                  emptyLabel="Any time"
                  disabled={detailsDisabled}
                />
              </div>
              <ProjectCombobox
                value={draft.projectId}
                onChange={(value) => {
                  update("projectId", value);
                  update("assigneeId", value ? null : activeTask.createdBy.id);
                }}
                disabled={detailsDisabled}
              />
              <TaskAssigneeCombobox
                key={`${activeTask.id}:${activeTask.projectId ?? "personal"}`}
                value={draft.assigneeId}
                currentAssignee={
                  draft.projectId === activeTask.projectId &&
                  draft.assigneeId === activeTask.assignee?.id
                    ? activeTask.assignee
                    : null
                }
                projectId={draft.projectId}
                onChange={(value) => update("assigneeId", value)}
                disabled={assigneeDisabled}
              />
              <IconPicker
                value={draft.iconKey}
                onChange={(value) => update("iconKey", value)}
                disabled={detailsDisabled}
              />
            </div>
            <aside className="grid content-start gap-4 rounded-lg border border-border bg-surface-muted/45 p-3 sm:p-4">
              <dl className="grid gap-2 rounded-md bg-surface p-3 text-sm shadow-[var(--shadow-surface)]">
                <div className="flex justify-between gap-3">
                  <dt className="text-text-secondary">Created by</dt>
                  <dd>{activeTask.createdBy.displayName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-secondary">Created</dt>
                  <dd className="font-mono text-xs">
                    {new Date(activeTask.createdAt).toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-secondary">Last updated</dt>
                  <dd className="font-mono text-xs">
                    {new Date(activeTask.updatedAt).toLocaleString()}
                  </dd>
                </div>
              </dl>
              <section className="grid gap-2">
                <h2 className="text-sm font-semibold">Activity history</h2>
                {activity.isLoading ? (
                  <p className="text-sm text-text-tertiary">Loading activity…</p>
                ) : null}
                {activity.isError ? (
                  <p role="alert" className="text-sm text-error">
                    Activity history could not be loaded.
                  </p>
                ) : null}
                {activity.data?.length
                  ? activity.data.map((event) => (
                      <p
                        key={event.id}
                        className="rounded-md border border-border bg-surface-muted p-2 text-sm"
                      >
                        <span className="font-semibold">
                          {event.actor?.displayName ?? "Someone"}
                        </span>{" "}
                        {event.label}
                        <span className="mt-1 block font-mono text-xs text-text-tertiary">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </p>
                    ))
                  : null}
                {!activity.isLoading && !activity.isError && !activity.data?.length ? (
                  <p className="text-sm text-text-tertiary">No activity yet.</p>
                ) : null}
              </section>
            </aside>
          </div>
          {!archivedReadOnly ? (
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(120px,1fr))] [&>*]:w-full">
              {activeTask.status === "TODO" ? (
                <>
                  <AppButton
                    type="button"
                    variant="secondary"
                    disabled={transitionsDisabled || pending}
                    onClick={() => onAction(activeTask, "start")}
                  >
                    <Play className="size-4" aria-hidden="true" />
                    Start
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="secondary"
                    disabled={transitionsDisabled || pending}
                    onClick={() => onAction(activeTask, "complete")}
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Complete
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="secondary"
                    disabled={transitionsDisabled || pending}
                    onClick={() => onAction(activeTask, "pending_review")}
                  >
                    <AlertCircle className="size-4" aria-hidden="true" />
                    Pending Review
                  </AppButton>
                </>
              ) : null}
              {activeTask.status === "IN_PROGRESS" ? (
                <>
                  <AppButton
                    type="button"
                    variant="secondary"
                    disabled={transitionsDisabled || pending}
                    onClick={() => onAction(activeTask, "complete")}
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Complete
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="secondary"
                    disabled={transitionsDisabled || pending}
                    onClick={() => onAction(activeTask, "pending_review")}
                  >
                    <AlertCircle className="size-4" aria-hidden="true" />
                    Pending Review
                  </AppButton>
                </>
              ) : null}
              {activeTask.status === "PENDING_REVIEW" ? (
                <>
                  <AppButton
                    type="button"
                    variant="secondary"
                    disabled={transitionsDisabled || pending}
                    onClick={() => onAction(activeTask, "complete")}
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Complete
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="secondary"
                    disabled={transitionsDisabled || pending}
                    onClick={() => onAction(activeTask, "reopen")}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Reopen
                  </AppButton>
                </>
              ) : null}
              {activeTask.status === "DONE" ? (
                <AppButton
                  type="button"
                  variant="secondary"
                  disabled={transitionsDisabled || pending}
                  onClick={() => onAction(activeTask, "reopen")}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Reopen
                </AppButton>
              ) : null}
              <AppButton
                type="submit"
                aria-label="Save changes"
                disabled={
                  (detailsDisabled && assigneeDisabled) ||
                  pending ||
                  saving ||
                  !draft.title.trim()
                }
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {saving ? "Saving…" : "Save changes"}
              </AppButton>
              <AppButton
                type="button"
                variant="danger"
                className="col-span-full sm:col-span-1"
                disabled={offline || pending || !activeTask.permissions.canArchive}
                onClick={() => setConfirmArchive(true)}
              >
                <Archive className="size-4" aria-hidden="true" />
                Archive
              </AppButton>
            </div>
          ) : null}
        </form>
        {activeTask.taskType === "STORY" && !activeTask.parentTaskId ? (
          <div className="mt-5">
            <StorySubtasks
              story={activeTask}
              offline={offline}
              onOpenTask={onOpenRelatedTask}
            />
          </div>
        ) : null}
        <TaskAttachments task={activeTask} open={open} offline={offline} />
      </AppDialog>
      <AppConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive task?"
        description="The task will leave normal weekly and dashboard views, but its history will be preserved."
        confirmLabel="Archive task"
        onConfirm={() => {
          setConfirmArchive(false);
          onArchive(activeTask);
        }}
      />
    </>
  );
}
