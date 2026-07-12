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
import { resolveProjectIcon } from "@/features/projects/project-pickers";
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
  onOpenChange: (open: boolean) => void;
  onSave: (task: TaskDto, values: TaskDraft) => void;
  onAction: (task: TaskDto, action: TaskDetailAction) => void;
  onArchive: (task: TaskDto) => void;
};

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
    enabled: !disabled,
  });
  const options = useMemo(
    () =>
      projectsQuery.data?.map((project) => ({
        value: project.id,
        label: project.title,
      })) ?? [],
    [projectsQuery.data],
  );
  return (
    <AppSelect
      label="Project"
      value={value ?? ""}
      onValueChange={(next) => onChange(next || null)}
      options={options}
      placeholder="Personal task"
      disabled={disabled}
    />
  );
}

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
          if (!next) onChange(null);
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
          const Icon = resolveProjectIcon(key);
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
              <Icon className="size-5" aria-hidden={true} />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

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
  const update = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraftState((current) => ({
      key: draftKey,
      draft: { ...(current?.key === draftKey ? current.draft : draft), [key]: value },
    }));

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
          <AppInput
            label="Title"
            value={draft.title}
            onChange={(event) => update("title", event.currentTarget.value)}
            disabled={offline}
            autoFocus
          />
          <AppTextarea
            label="Description"
            value={draft.description ?? ""}
            onChange={(event) => update("description", event.currentTarget.value)}
            disabled={offline}
            rows={5}
          />
          <div className="grid grid-cols-2 gap-3">
            <AppDatePicker
              label="Scheduled date"
              value={draft.scheduledDate}
              onChange={(event) => update("scheduledDate", event.currentTarget.value)}
              disabled={offline}
            />
            <AppTimePicker
              label="Scheduled time"
              value={draft.scheduledTime ?? ""}
              onChange={(event) =>
                update("scheduledTime", event.currentTarget.value || null)
              }
              disabled={offline}
            />
          </div>
          <ProjectCombobox
            value={draft.projectId}
            onChange={(value) => {
              update("projectId", value);
              update("assigneeId", value ? null : activeTask.createdBy.id);
            }}
            disabled={offline}
          />
          <AssigneeCombobox
            key={activeTask.id}
            value={draft.assigneeId}
            currentAssignee={activeTask.assignee}
            projectId={draft.projectId}
            onChange={(value) => update("assigneeId", value)}
            disabled={offline}
          />
          <IconPicker
            value={draft.iconKey}
            onChange={(value) => update("iconKey", value)}
            disabled={offline}
          />
          <dl className="grid gap-2 rounded-md bg-surface-muted p-3 text-sm">
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
            {!activity.isLoading && !activity.data?.length ? (
              <p className="text-sm text-text-tertiary">No activity yet.</p>
            ) : null}
          </section>
          <div className="flex flex-wrap gap-2">
            {activeTask.status === "TODO" ? (
              <AppButton
                type="button"
                variant="secondary"
                disabled={offline}
                onClick={() => onAction(activeTask, "start")}
              >
                <Play className="size-4" aria-hidden="true" />
                Start
              </AppButton>
            ) : null}
            {activeTask.status === "IN_PROGRESS" ? (
              <AppButton
                type="button"
                variant="secondary"
                disabled={offline}
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
                disabled={offline}
                onClick={() => onAction(activeTask, "reopen")}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reopen
              </AppButton>
            ) : null}
            <AppButton type="submit" disabled={offline || !draft.title.trim()}>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Save changes
            </AppButton>
            <AppButton
              type="button"
              variant="danger"
              disabled={offline}
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
