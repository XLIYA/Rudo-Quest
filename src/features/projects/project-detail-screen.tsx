"use client";

import { useParams } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  ActivityPageDto,
  ProfileDto,
  ProfileSummary,
  ProjectRole,
  ProjectSummary,
  TaskDto,
  TaskStatus,
} from "@/types/domain";
import {
  CheckCircle2,
  Circle,
  CircleDotDashed,
  Clock3,
  GripVertical,
  Play,
  Settings2,
} from "lucide-react";
import { AppAvatarStack } from "@/components/ui/app-avatar-stack";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { AppButton } from "@/components/ui/app-button";
import { AppPagination } from "@/components/ui/app-pagination";
import { useTaskMutation } from "@/features/tasks/task-hooks";
import { getDateInTimeZone, getMondayWeekStart } from "@/lib/utils/dates";
import { TaskDetailSheet } from "@/components/ui/task-detail-sheet";
import { useOnline } from "@/hooks/use-online";
import { useState, type DragEvent } from "react";
import Link from "next/link";
import { ProjectIconGlyph } from "./project-pickers";
import { getProjectColor } from "@/lib/theme/project-colors";
import { parseISO } from "date-fns";
import { AppAvatar } from "@/components/ui/app-avatar";
import { cn } from "@/lib/utils/cn";

/**
 * Purpose: Render project detail with tasks, members, GitHub status, and activity.
 * Inputs: Project route parameter.
 * Output: Project detail UI.
 * Side effects: Fetches project, tasks, and activity data.
 */
export function ProjectDetailScreen() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const project = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: ({ signal }) => apiGet<ProjectSummary>(`/api/projects/${projectId}`, signal),
  });
  const profile = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<ProfileDto>("/api/me", signal),
  });
  const calendarTimeZone =
    project.data?.timeZone ??
    profile.data?.timeZone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const weekStart = getMondayWeekStart(
    parseISO(getDateInTimeZone(new Date(), calendarTimeZone)),
  );
  const tasks = useQuery({
    queryKey: [...queryKeys.tasksWeek(weekStart), projectId],
    queryFn: ({ signal }) =>
      apiGet<TaskDto[]>(
        `/api/tasks/week?weekStart=${weekStart}&projectId=${projectId}`,
        signal,
      ),
    enabled: Boolean(project.data),
  });
  const members = useQuery({
    queryKey: queryKeys.projectMembers(projectId),
    queryFn: ({ signal }) =>
      apiGet<(ProfileSummary & { role: ProjectRole; joinedAt: string })[]>(
        `/api/projects/${projectId}/members`,
        signal,
      ),
    enabled: Boolean(project.data),
  });
  const invitations = useQuery({
    queryKey: queryKeys.projectInvitations(projectId),
    queryFn: ({ signal }) =>
      apiGet<{ id: string; displayName: string; role: ProjectRole }[]>(
        `/api/projects/${projectId}/invitations`,
        signal,
      ),
    enabled: project.data?.role === "OWNER" || project.data?.role === "ADMIN",
  });
  const activity = useInfiniteQuery({
    queryKey: ["activity", "project", projectId],
    queryFn: ({ pageParam, signal }) =>
      apiGet<ActivityPageDto>(
        `/api/activity?projectId=${projectId}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.cursor,
    enabled: Boolean(project.data),
  });
  const mutation = useTaskMutation(weekStart);
  const online = useOnline();
  const [selectedTask, setSelectedTask] = useState<TaskDto | null>(null);
  if (project.isLoading)
    return (
      <main className="p-5 md:p-8">
        <AppSkeleton className="h-64" />
      </main>
    );
  if (!project.data)
    return (
      <main className="p-5 md:p-8">
        <AppEmptyState
          title="Project unavailable"
          description="This project could not be loaded."
        />
      </main>
    );
  const activityItems = activity.data?.pages.flatMap((page) => page.items) ?? [];
  const projectColor = getProjectColor(project.data.colorKey);
  return (
    <main className="mx-auto grid w-full max-w-[100rem] gap-5 p-5 md:p-8">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 sm:gap-4">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-lg sm:size-14"
          style={{ background: projectColor.soft, color: projectColor.text }}
        >
          <ProjectIconGlyph iconKey={project.data.iconKey} className="size-6" />
        </span>
        <div className="min-w-0">
          <PageHeader
            title={project.data.title}
            description={project.data.description ?? "Project task space."}
          />
        </div>
        {project.data.role === "OWNER" || project.data.role === "ADMIN" ? (
          <AppButton asChild variant="secondary" className="px-3">
            <Link
              href={`/projects/${project.data.id}/settings`}
              aria-label="Project settings"
              title="Project settings"
            >
              <Settings2 className="size-5" aria-hidden="true" />
            </Link>
          </AppButton>
        ) : null}
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        <Panel title="Status">
          <p className="font-mono text-3xl font-semibold">{project.data.openTaskCount}</p>
          <p className="text-sm text-text-secondary">open tasks</p>
          <p className="mt-3 text-sm text-text-secondary">
            {project.data.githubRepositoryFullName ?? "No GitHub repository connected."}
          </p>
          <p className="mt-2 text-xs text-text-tertiary">Role: {project.data.role}</p>
        </Panel>
        <Panel title="Members">
          {members.isLoading ? <AppSkeleton className="h-10" /> : null}
          {members.data?.length ? <AppAvatarStack users={members.data} /> : null}
          {members.data ? (
            <p className="mt-2 text-sm text-text-secondary">
              {members.data.length} active member{members.data.length === 1 ? "" : "s"}
            </p>
          ) : null}
          {invitations.data?.length ? (
            <Link
              href={`/projects/${project.data.id}/settings`}
              className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline"
            >
              {invitations.data.length} pending invitation
              {invitations.data.length === 1 ? "" : "s"}
            </Link>
          ) : null}
        </Panel>
        <Panel title="Completion">
          <p className="font-mono text-3xl font-semibold">
            {project.data.completedThisWeek}
          </p>
          <p className="text-sm text-text-secondary">completed this week</p>
          <p className="mt-2 text-xs text-text-tertiary">
            {project.data.weeklyCompletionPercent}% of scheduled tasks complete
          </p>
        </Panel>
      </section>
      {project.data.archivedAt ? (
        <p className="rounded-lg border border-warning bg-warning-soft p-4 text-sm text-text-primary">
          This project is archived. Its tasks and history remain available in read-only
          mode.
        </p>
      ) : null}
      <section className="app-card overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4 md:p-5">
          <div>
            <h2 className="text-lg font-semibold">This week’s board</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Drag work between columns or use each card’s move controls.
            </p>
          </div>
          <span className="rounded-full bg-quest-soft px-3 py-1 font-mono text-xs text-quest">
            {tasks.data?.length ?? 0} tasks
          </span>
        </header>
        {tasks.isLoading ? <AppSkeleton className="h-36" /> : null}
        {tasks.isError ? (
          <AppEmptyState
            title="Tasks unavailable"
            description="Project tasks could not be loaded."
            action={
              <AppButton variant="secondary" onClick={() => void tasks.refetch()}>
                Try again
              </AppButton>
            }
          />
        ) : tasks.data ? (
          <ProjectKanban
            tasks={tasks.data}
            disabled={!online || Boolean(project.data.archivedAt)}
            pending={mutation.isPending}
            onOpen={setSelectedTask}
            onMove={(task, status) =>
              mutation.mutate({ task, action: "move", body: { status } })
            }
          />
        ) : null}
      </section>
      <Panel title="Activity">
        {activity.isLoading ? <AppSkeleton className="h-28" /> : null}
        {activity.isError ? (
          <AppEmptyState
            title="Activity unavailable"
            description="Project history could not be loaded."
          />
        ) : null}
        <div className="grid gap-2">
          {activityItems.slice(0, 10).map((event) => (
            <p key={event.id} className="rounded-md bg-surface-muted p-3 text-sm">
              {event.actor?.displayName ?? "Someone"} {event.label}
            </p>
          ))}
          <AppPagination
            hasNext={Boolean(activity.hasNextPage)}
            pending={activity.isFetchingNextPage}
            label="Load older activity"
            pendingLabel="Loading older activity…"
            onNext={() => void activity.fetchNextPage()}
          />
          {!activity.isLoading && !activity.isError && !activityItems.length ? (
            <AppEmptyState
              title="No project activity"
              description="Task and membership changes will appear here."
            />
          ) : null}
        </div>
      </Panel>
      <TaskDetailSheet
        task={selectedTask}
        open={Boolean(selectedTask)}
        offline={!online}
        pending={mutation.isPending}
        conflict={
          mutation.isError &&
          typeof mutation.error === "object" &&
          mutation.error !== null &&
          "status" in mutation.error &&
          mutation.error.status === 409
        }
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onAction={(task, action) => mutation.mutate({ task, action })}
        onArchive={(task) => {
          mutation.mutate({ task, action: "archive" });
          setSelectedTask(null);
        }}
        onSave={(task, values) =>
          mutation.mutate({ task, action: "update", body: values })
        }
      />
    </main>
  );
}

/**
 * Purpose: Render a project detail panel.
 * Inputs: Title and children.
 * Output: Bordered section.
 * Side effects: None.
 */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase text-text-secondary">
        {title}
      </h2>
      {children}
    </section>
  );
}

const kanbanColumns: {
  status: TaskStatus;
  title: string;
  description: string;
  icon: typeof Circle;
}[] = [
  {
    status: "TODO",
    title: "To do",
    description: "Ready to be picked up",
    icon: Circle,
  },
  {
    status: "IN_PROGRESS",
    title: "In progress",
    description: "Actively moving",
    icon: Play,
  },
  {
    status: "DONE",
    title: "Done",
    description: "Completed this week",
    icon: CheckCircle2,
  },
];

function ProjectKanban({
  tasks,
  disabled,
  pending,
  onOpen,
  onMove,
}: {
  tasks: TaskDto[];
  disabled: boolean;
  pending: boolean;
  onOpen: (task: TaskDto) => void;
  onMove: (task: TaskDto, status: TaskStatus) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);

  const dropTask = (event: DragEvent<HTMLElement>, status: TaskStatus) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/rudo-task") || draggedId;
    const task = tasks.find((candidate) => candidate.id === id);
    setDraggedId(null);
    setOverStatus(null);
    if (task && task.status !== status && task.permissions.canTransition) {
      onMove(task, status);
    }
  };

  return (
    <div className="grid gap-3 bg-surface-muted/35 p-3 lg:grid-cols-3 lg:p-4">
      {kanbanColumns.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.status);
        const Icon = column.icon;
        const activeDrop = overStatus === column.status && draggedId;
        return (
          <section
            key={column.status}
            className={cn(
              "min-h-72 rounded-lg border bg-surface p-3 transition-[border-color,background-color,box-shadow] duration-150",
              activeDrop
                ? "border-quest bg-quest-soft/45 shadow-[0_0_0_3px_var(--quest-soft)]"
                : "border-border",
            )}
            onDragOver={(event) => {
              if (disabled || pending) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOverStatus(column.status);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setOverStatus(null);
              }
            }}
            onDrop={(event) => dropTask(event, column.status)}
          >
            <header className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-md bg-quest-soft text-quest">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-bold">{column.title}</h3>
                  <p className="text-[11px] text-text-tertiary">{column.description}</p>
                </div>
              </div>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 font-mono text-xs text-text-secondary">
                {columnTasks.length}
              </span>
            </header>
            <div className="grid gap-2">
              {columnTasks.map((task) => (
                <KanbanTaskCard
                  key={task.id}
                  task={task}
                  disabled={disabled || pending}
                  dragging={draggedId === task.id}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/rudo-task", task.id);
                    setDraggedId(task.id);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setOverStatus(null);
                  }}
                  onOpen={() => onOpen(task)}
                  onMove={(status) => onMove(task, status)}
                />
              ))}
              {!columnTasks.length ? (
                <div className="grid min-h-28 place-items-center rounded-md border border-dashed border-border p-4 text-center text-xs text-text-tertiary">
                  <span>
                    <CircleDotDashed className="mx-auto mb-2 size-5" aria-hidden="true" />
                    Drop tasks here
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function KanbanTaskCard({
  task,
  disabled,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onMove,
}: {
  task: TaskDto;
  disabled: boolean;
  dragging: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onMove: (status: TaskStatus) => void;
}) {
  const canMove = !disabled && task.permissions.canTransition;
  return (
    <article
      draggable={canMove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group rounded-lg border border-border bg-surface p-3 shadow-[var(--shadow-surface)] transition-[border-color,box-shadow,transform,opacity] duration-150 hover:-translate-y-0.5 hover:border-quest-muted hover:shadow-[var(--shadow-raised)]",
        dragging ? "scale-[0.98] opacity-45" : null,
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical
          className="mt-0.5 size-4 shrink-0 text-text-tertiary group-hover:text-quest"
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={onOpen}
          className="min-h-11 min-w-0 flex-1 text-left"
        >
          <span className="flex items-start gap-2 text-sm font-semibold">
            {task.iconKey ? (
              <ProjectIconGlyph
                iconKey={task.iconKey}
                className="mt-0.5 size-4 shrink-0 text-quest"
              />
            ) : null}
            <span className="line-clamp-2">{task.title}</span>
          </span>
          {task.description ? (
            <span className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">
              {task.description}
            </span>
          ) : null}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
        <div className="flex min-w-0 items-center gap-2">
          {task.assignee ? (
            <AppAvatar
              name={task.assignee.displayName}
              src={task.assignee.avatarUrl}
              className="size-7"
            />
          ) : null}
          {task.scheduledTime ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-text-tertiary">
              <Clock3 className="size-3" aria-hidden="true" />
              {task.scheduledTime.slice(0, 5)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1" aria-label={`Move ${task.title}`}>
          {kanbanColumns
            .filter((column) => column.status !== task.status)
            .map((column) => (
              <button
                key={column.status}
                type="button"
                title={`Move to ${column.title}`}
                aria-label={`Move ${task.title} to ${column.title}`}
                className="inline-flex size-8 items-center justify-center rounded-md text-text-tertiary hover:bg-quest-soft hover:text-quest disabled:opacity-40"
                disabled={!canMove}
                onClick={() => onMove(column.status)}
              >
                <column.icon className="size-3.5" aria-hidden="true" />
              </button>
            ))}
        </div>
      </div>
    </article>
  );
}
