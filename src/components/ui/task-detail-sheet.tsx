import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Play, Archive, RotateCcw } from "lucide-react";
import type { TaskDto, ProjectIconKey, ProfileSummary, ProjectSummary } from "@/types/domain";
import { projectIconKeys } from "@/types/domain";
import { resolveProjectIcon } from "@/features/projects/project-pickers";
import { AppButton } from "./app-button";
import { AppDatePicker } from "./app-date-picker";
import { AppDialog } from "./app-dialog";
import { AppSelect } from "./app-select";
import { AppTextarea } from "./app-textarea";
import { AppTimePicker } from "./app-time-picker";
import { AppInput } from "./app-input";
import { AppCombobox } from "./app-combobox";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { useQuery } from "@tanstack/react-query";

export type TaskDetailSheetProps = {
  task: TaskDto | null;
  open: boolean;
  offline?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (task: TaskDto, values: {
    title: string;
    description: string | null;
    scheduledDate: string;
    scheduledTime: string | null;
    projectId: string | null;
    assigneeId: string | null;
    iconKey: ProjectIconKey | null;
    status: "TODO" | "IN_PROGRESS" | "DONE";
    version: number;
  }) => void;
  onArchive: (task: TaskDto) => void;
};

function ProjectCombobox({
  value,
  onChange,
  disabled,
  placeholder = "Personal task (no project)",
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: ({ signal }) => apiGet<ProjectSummary[]>(`/api/projects`, signal),
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
    <div className="grid gap-1.5 text-sm font-medium">
      <label className="text-sm font-semibold">Project</label>
      <AppSelect
        label=""
        value={value ?? ""}
        onValueChange={(v) => onChange(v || null)}
        options={options}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}

function AssigneeCombobox({
  onChange,
  projectId,
  disabled,
  placeholder = "Select assignee",
}: {
  onChange: (value: string | null) => void;
  projectId: string | null;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const suggestionsQuery = useQuery({
    queryKey: ["user-suggestions", debouncedQuery, projectId],
    queryFn: ({ signal }) =>
      apiGet<ProfileSummary[]>(
        `/api/users/suggest?q=${encodeURIComponent(debouncedQuery)}${projectId ? `&excludeProjectId=${projectId}` : ""}`,
        signal,
      ),
    enabled: !disabled && debouncedQuery.length >= 2 && !!projectId,
  });

  const options = useMemo(
    () =>
      suggestionsQuery.data?.map((user) => ({
        value: user.id,
        label: `${user.displayName} (@${user.handle})`,
      })) ?? [],
    [suggestionsQuery.data],
  );

  const handleChange = (val: string) => {
    setQuery(val);
    const match = suggestionsQuery.data?.find((u) => u.id === val);
    onChange(match?.id ?? null);
  };

  return (
    <div className="grid gap-1.5 text-sm font-medium">
      <label className="text-sm font-semibold">Assignee</label>
      <AppCombobox
        label="Assignee"
        value={debouncedQuery}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled || !projectId}
      />
      {!projectId && <p className="text-xs text-text-tertiary">Select a project first</p>}
      {projectId && debouncedQuery.length < 2 && <p className="text-xs text-text-tertiary">Type at least 2 characters</p>}
      {projectId && debouncedQuery.length >= 2 && suggestionsQuery.isLoading && <p className="text-xs text-text-tertiary">Searching...</p>}
      {projectId && debouncedQuery.length >= 2 && !suggestionsQuery.isLoading && !options.length && <p className="text-xs text-text-tertiary">No matching users</p>}
    </div>
  );
}

function IconPicker({ value, onChange, disabled }: { value: ProjectIconKey | null; onChange: (value: ProjectIconKey | null) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold">Icon</label>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
        {projectIconKeys.map((key) => {
          const Icon = resolveProjectIcon(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(value === key ? null : key)}
              disabled={disabled}
              aria-pressed={value === key}
              className={`flex min-h-11 items-center justify-center rounded-md border transition-colors ${
                value === key ? "border-brand bg-brand-soft text-brand" : "border-border"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Icon className="size-5" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "TODO" | "IN_PROGRESS" | "DONE" }) {
  const colors = {
    TODO: "bg-surface-muted text-text-secondary",
    IN_PROGRESS: "bg-brand-soft text-brand",
    DONE: "bg-success-soft text-success",
  };
  const icons = {
    TODO: null,
    IN_PROGRESS: <Play className="size-3" />,
    DONE: <CheckCircle2 className="size-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs ${colors[status]}`}>
      {icons[status]} {status.replace("_", " ")}
    </span>
  );
}

export function TaskDetailSheet({ task, open, offline, onOpenChange, onSave, onArchive }: TaskDetailSheetProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [scheduledDate, setScheduledDate] = useState(task?.scheduledDate ?? "");
  const [scheduledTime, setScheduledTime] = useState(task?.scheduledTime?.slice(0, 5) ?? "");
  const [projectId, setProjectId] = useState<string | null>(task?.projectId ?? null);
  const [assigneeId, setAssigneeId] = useState<string | null>(task?.assignee?.id ?? null);
  const [iconKey, setIconKey] = useState<ProjectIconKey | null>(task?.iconKey ?? null);
  const [status, setStatus] = useState<"TODO" | "IN_PROGRESS" | "DONE">(task?.status ?? "TODO");

  const isPersonalTask = !projectId;
  const canChangeAssignee = !isPersonalTask && projectId;

  if (!task) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(task, {
      title: title.trim(),
      description: description.trim() || null,
      scheduledDate,
      scheduledTime: scheduledTime || null,
      projectId,
      assigneeId: isPersonalTask ? task.createdBy.id : assigneeId,
      iconKey,
      status,
      version: task.version,
    });
  };

  const handleStart = () => {
    if (status === "TODO") setStatus("IN_PROGRESS");
  };

  const handleComplete = () => {
    if (status === "DONE") setStatus(task.previousStatus ?? "TODO");
    else setStatus("DONE");
  };

  const handleReopen = () => {
    if (status === "DONE") setStatus(task.previousStatus ?? "TODO");
  };

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title="Task details">
      <form key={task.id} className="grid gap-4" onSubmit={handleSubmit}>
        <AppInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={offline} autoFocus />
        <AppTextarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={offline} rows={3} />

        <div className="grid grid-cols-2 gap-3">
          <AppDatePicker label="Date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} disabled={offline} />
          <AppTimePicker label="Time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} disabled={offline} />
        </div>

        <ProjectCombobox value={projectId} onChange={setProjectId} disabled={offline} />

        {canChangeAssignee ? (
          <AssigneeCombobox
            onChange={setAssigneeId}
            projectId={projectId}
            disabled={offline}
          />
        ) : isPersonalTask ? (
          <div className="grid gap-2">
            <label className="text-sm font-semibold">Assignee</label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-3">
              <span className="size-6 rounded-sm border border-border flex items-center justify-center" style={{ background: "var(--brand)" }} />
              <span className="text-sm font-medium">You (personal task)</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <label className="text-sm font-semibold">Assignee</label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-3">
              {task.assignee ? (
                <>
                  <span className="size-6 rounded-sm border border-border flex items-center justify-center" style={{ background: "var(--brand)" }} />
                  <span className="text-sm font-medium">{task.assignee.displayName}</span>
                </>
              ) : (
                <span className="text-sm text-text-secondary">Unassigned</span>
              )}
            </div>
          </div>
        )}

        <IconPicker value={iconKey} onChange={setIconKey} disabled={offline} />

        <div className="grid gap-2 rounded-md bg-surface-muted p-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-text-secondary">Status</dt>
            <dd><StatusBadge status={status} /></dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-text-secondary">Created</dt>
            <dd className="font-mono">{new Date(task.createdAt).toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-text-secondary">Updated</dt>
            <dd className="font-mono">{new Date(task.updatedAt).toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-text-secondary">Version</dt>
            <dd className="font-mono">{task.version}</dd>
          </div>
        </div>

<div className="flex flex-wrap gap-2">
            <div className="flex gap-2 flex-1">
              <AppButton type="button" variant="secondary" disabled={offline} onClick={() => onArchive(task)} className="flex-1">
                <Archive className="size-4 mr-2" /> Archive
              </AppButton>
              <AppButton type="submit" disabled={offline} className="flex-1">
                Save
              </AppButton>
            </div>

            <div className="flex gap-2">
              {status === "TODO" && (
                <AppButton
                  type="button"
                  variant="secondary"
                  disabled={offline}
                  onClick={handleStart}
                  className="flex-1"
                >
                  <Play className="size-4 mr-2" /> Start
                </AppButton>
              )}
              {status === "IN_PROGRESS" && (
                <AppButton
                  type="button"
                  variant="secondary"
                  disabled={offline}
                  onClick={handleComplete}
                  className="flex-1"
                >
                  <CheckCircle2 className="size-4 mr-2" /> Complete
                </AppButton>
              )}
              {status === "DONE" && (
                <AppButton
                  type="button"
                  variant="secondary"
                  disabled={offline}
                  onClick={handleReopen}
                  className="flex-1"
                >
                  <RotateCcw className="size-4 mr-2" /> Reopen
                </AppButton>
              )}
            </div>
        </div>
      </form>
    </AppDialog>
  );
}