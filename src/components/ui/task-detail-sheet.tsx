"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Play, Archive, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import {
  projectIconKeys,
  type ProjectIconKey,
  type ProfileSummary,
  type ProjectSummary,
  type TaskDto,
} from "@/types/domain";
import { ProjectIconGlyph } from "@/features/projects/project-pickers";
import { AppButton } from "./app-button";
import { AppCombobox } from "./app-combobox";
import { AppConfirmDialog } from "./app-confirm-dialog";
import { AppDatePicker } from "./app-date-picker";
import { AppInput } from "./app-input";
import { AppSelect } from "./app-select";
import { AppSheet } from "./app-sheet";
import { AppTextarea } from "./app-textarea";
import { AppTimePicker } from "./app-time-picker";

type TaskDraft = {
  title: string;
  description: string | null;
  scheduledDate: string;
  scheduledTime: string | null;
  projectId: string | null;
  assigneeId: string | null;
  iconKey: ProjectIconKey | null;
  version: number;
};

export type TaskDetailAction = "start" | "complete" | "reopen";

export type TaskDetailSheetProps = {
  task: TaskDto | null;
  open: boolean;
  offline?: boolean;
  pending?: boolean;
  conflict?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (task: TaskDto, values: TaskDraft) => void;
  onAction: (task: TaskDto, action: TaskDetailAction) => void;
  onArchive: (task: TaskDto) => void;
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
    version: task.version,
  };
}

/**
 * Purpose: Select between personal scope and active editable projects.
 * Inputs: Current project, controlled change handler, and disabled state.
 * Output: Local project select UI.
 * Side effects: Reads the shared projects query.
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
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: ({ signal }) => apiGet<ProjectSummary[]>("/api/projects", signal),
  });
  const options = useMemo(
    () => [
      { value: "__personal__", label: "Personal task" },
      ...(projectsQuery.data
        ?.filter((project) => !project.archivedAt && project.role !== "VIEWER")
        .map((project) => ({
          value: project.id,
          label: project.title,
        })) ?? []),
    ],
    [projectsQuery.data],
  );
  return (
    <AppSelect
      label="Project"
      value={value ?? "__personal__"}
      onValueChange={(next) => onChange(next === "__personal__" ? null : next)}
      options={options}
      disabled={disabled}
    />
  );
}

/**
 * Purpose: Search and select a single active member for a project task.
 * Inputs: Current assignee/project, controlled change handler, and disabled state.
 * Output: Debounced accessible member combobox or personal-task guidance.
 * Side effects: Fetches project-member suggestions and updates controlled selection.
 */
function AssigneeCombobox({
  value,
  currentAssignee,
  projectId,
  onChange,
  disabled,
}: {
  value: string | null;
  currentAssignee: ProfileSummary | null;
  projectId: string | null;
  onChange: (value: string | null, profile?: ProfileSummary) => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState(
    currentAssignee ? `${currentAssignee.displayName} (@${currentAssignee.handle})` : "",
  );
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);
  const suggestions = useQuery({
    queryKey: ["user-suggestions", debouncedSearch, projectId],
    queryFn: ({ signal }) =>
      apiGet<ProfileSummary[]>(
        `/api/users/suggest?q=${encodeURIComponent(debouncedSearch)}&memberProjectId=${projectId}`,
        signal,
      ),
    enabled: !disabled && Boolean(projectId) && debouncedSearch.trim().length >= 2,
  });
  const options =
    suggestions.data?.map((profile) => ({
      value: profile.id,
      label: `${profile.displayName} (@${profile.handle})`,
    })) ?? [];

  if (!projectId)
    return (
      <p className="text-xs text-text-tertiary">Personal tasks stay assigned to you.</p>
    );
  return (
    <div className="grid gap-2">
      <AppCombobox
        label="Assignee"
        value={search}
        onChange={(next) => {
          setSearch(next);
          onChange(null);
        }}
        onOptionSelect={(option) => {
          const profile = suggestions.data?.find(
            (candidate) => candidate.id === option.value,
          );
          setSearch(option.label);
          onChange(option.value, profile);
        }}
        options={options}
        placeholder="Search project members"
        disabled={disabled}
      />
      {value ? (
        <button
          type="button"
          className="min-h-11 rounded-md border border-border text-left text-xs text-text-secondary hover:bg-surface-muted"
          onClick={() => {
            setSearch("");
            onChange(null);
          }}
          disabled={disabled}
        >
          Clear assignee
        </button>
      ) : (
        <span className="text-xs text-text-tertiary">
          Choose an active project member or leave unassigned.
        </span>
      )}
    </div>
  );
}

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
 * Output: Accessible mobile bottom sheet and desktop side sheet.
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
}: TaskDetailSheetProps) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [draftState, setDraftState] = useState<{ key: string; draft: TaskDraft } | null>(
    () => (task ? { key: `${task.id}:${task.version}`, draft: toDraft(task) } : null),
  );
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

  const draftKey = activeTask ? `${activeTask.id}:${activeTask.version}` : null;
  const draft = activeTask
    ? draftState?.key === draftKey
      ? draftState.draft
      : toDraft(activeTask)
    : null;

  if (!activeTask || !draft || !draftKey) return null;
  const detailsDisabled = offline || !activeTask.permissions.canEditDetails;
  const transitionsDisabled = offline || !activeTask.permissions.canTransition;
  /**
   * Purpose: Update one draft field while retaining its task-version identity.
   * Inputs: Draft key and typed replacement value.
   * Output: Void.
   * Side effects: Updates local form state.
   */
  const update = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraftState((current) => ({
      key: draftKey,
      draft: { ...(current?.key === draftKey ? current.draft : draft), [key]: value },
    }));

  /**
   * Purpose: Normalize and submit the latest editable task draft.
   * Inputs: Form submission event.
   * Output: Void.
   * Side effects: Prevents navigation and invokes the versioned save callback.
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(activeTask, {
      ...draft,
      title: draft.title.trim(),
      description: draft.description?.trim() || null,
      scheduledTime: draft.scheduledTime || null,
      assigneeId: draft.projectId ? draft.assigneeId : activeTask.createdBy.id,
    });
  };

  return (
    <>
      <AppSheet open={open} onOpenChange={onOpenChange} title="Task details">
        <form className="grid gap-5" onSubmit={submit}>
          <div className="flex items-center justify-between gap-3">
            <StatusBadge status={activeTask.status} />
            <span className="font-mono text-xs text-text-tertiary">
              v{activeTask.version}
            </span>
          </div>
          {!activeTask.permissions.canEditDetails ? (
            <p className="rounded-md border border-border bg-surface-muted p-3 text-sm text-text-secondary">
              You can view this task, but only its assignee or a project owner/admin can
              edit it.
            </p>
          ) : null}
          {conflict ? (
            <p
              role="alert"
              className="rounded-md border border-warning bg-warning-soft p-3 text-sm text-text-primary"
            >
              This task changed on another device. The latest version is loaded; review it
              before saving again.
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
                <AppDatePicker
                  label="Scheduled date"
                  value={draft.scheduledDate}
                  onChange={(event) => update("scheduledDate", event.currentTarget.value)}
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
              <AssigneeCombobox
                key={`${activeTask.id}:${activeTask.version}:${draft.projectId ?? "personal"}`}
                value={draft.assigneeId}
                currentAssignee={
                  draft.projectId === activeTask.projectId &&
                  draft.assigneeId === activeTask.assignee?.id
                    ? activeTask.assignee
                    : null
                }
                projectId={draft.projectId}
                onChange={(value) => update("assigneeId", value)}
                disabled={detailsDisabled}
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
          <div className="grid grid-cols-1 gap-2 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-5 [&>*]:w-full">
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
              </>
            ) : null}
            {activeTask.status === "IN_PROGRESS" ? (
              <AppButton
                type="button"
                variant="secondary"
                disabled={transitionsDisabled || pending}
                onClick={() => onAction(activeTask, "complete")}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Complete
              </AppButton>
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
              disabled={detailsDisabled || pending || !draft.title.trim()}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Save changes
            </AppButton>
            <AppButton
              type="button"
              variant="danger"
              disabled={offline || pending || !activeTask.permissions.canArchive}
              onClick={() => setConfirmArchive(true)}
            >
              <Archive className="size-4" aria-hidden="true" />
              Archive
            </AppButton>
          </div>
        </form>
      </AppSheet>
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
