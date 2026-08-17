"use client";

import type { Route } from "next";
import { useParams } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

import type {
  ActivityEventDto,
  ActivityPageDto,
  ArchivedTaskFilters,
  ProfileDto,
  ProfileSummary,
  ProjectRole,
  ProjectSummary,
  TaskDto,
  TaskStatus,
} from "@/types/domain";
import {
  AlertCircle,
  Archive,
  Calendar,
  CheckCircle2,
  Circle,
  CircleDotDashed,
  Clock3,
  ChevronDown,
  Filter,
  GripVertical,
  ListTodo,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  User,
  X,
} from "lucide-react";
import { AppAvatarStack } from "@/components/ui/app-avatar-stack";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppInput } from "@/components/ui/app-input";
import { AppPagination } from "@/components/ui/app-pagination";
import { AppSelect } from "@/components/ui/app-select";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { AppButton } from "@/components/ui/app-button";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { useTaskMutation } from "@/features/tasks/task-hooks";
import { getDateInTimeZone, getMondayWeekStart } from "@/lib/utils/dates";
import { TaskDetailSheet } from "@/components/ui/task-detail-sheet";
import { useOnline } from "@/hooks/use-online";
import { useState, type DragEvent } from "react";
import {
  useRestoreTask,
  useProjectArchivedTasks,
} from "@/features/tasks/task-history-hooks";
import Link from "next/link";
import { ProjectIconGlyph } from "./project-pickers";
import { getProjectColor } from "@/lib/theme/project-colors";
import { parseISO } from "date-fns";
import { AppAvatar } from "@/components/ui/app-avatar";
import { cn } from "@/lib/utils/cn";
import { TaskCreateSheet } from "@/components/ui/task-create-sheet";
import { TaskClassification } from "@/components/ui/task-classification";

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
  const currentDate = getDateInTimeZone(new Date(), calendarTimeZone);
  const weekStart = getMondayWeekStart(parseISO(currentDate));
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
  const [createOpen, setCreateOpen] = useState(false);
  const [archivedSearch, setArchivedSearch] = useState("");
  const [archivedFilters, setArchivedFilters] = useState<ArchivedTaskFilters>({});
  const [showArchivedFilters, setShowArchivedFilters] = useState(false);
  const [activityOpen, setActivityOpen] = useState(true);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const archivedTasks = useProjectArchivedTasks(
    projectId,
    archivedSearch,
    archivedFilters,
  );
  const restore = useRestoreTask();
  const archivedItems = archivedTasks.data?.pages.flatMap((page) => page.items) ?? [];
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {project.data.role !== "VIEWER" && !project.data.archivedAt ? (
            <AppButton onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Create task</span>
              <span className="sm:hidden">Create</span>
            </AppButton>
          ) : null}
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
      <section className="rounded-lg border border-border bg-surface p-4">
        <button
          type="button"
          onClick={() => setActivityOpen(!activityOpen)}
          aria-expanded={activityOpen}
          className="flex w-full min-h-11 items-center justify-between gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <h2 className="text-sm font-semibold uppercase text-text-secondary">
            Activity
          </h2>
          <ChevronDown
            className={cn(
              "size-4 text-text-tertiary transition-transform duration-200",
              activityOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            activityOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
          aria-hidden={!activityOpen}
          inert={!activityOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="pt-3">
              {activity.isLoading ? <AppSkeleton className="h-28" /> : null}
              {activity.isError ? (
                <AppEmptyState
                  title="Activity unavailable"
                  description="Project history could not be loaded."
                />
              ) : null}
              <div className="grid gap-2 max-h-[30rem] overflow-y-auto pr-2 [scrollbar-gutter:stable]">
                {activityItems.slice(0, 10).map((event) => (
                  <ActivityAccordionItem
                    key={event.id}
                    event={event}
                    todayDate={currentDate}
                  />
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
            </div>
          </div>
        </div>
      </section>
      <CollapsiblePanel
        title="Archived Tasks"
        open={archivedOpen}
        onToggle={() => setArchivedOpen(!archivedOpen)}
      >
        <ArchivedTasksSection
          _projectId={projectId}
          _projectData={project.data}
          members={members.data ?? []}
          archivedSearch={archivedSearch}
          setArchivedSearch={setArchivedSearch}
          archivedFilters={archivedFilters}
          setArchivedFilters={setArchivedFilters}
          showArchivedFilters={showArchivedFilters}
          setShowArchivedFilters={setShowArchivedFilters}
          archivedItems={archivedItems}
          archivedIsLoading={archivedTasks.isLoading}
          archivedIsError={archivedTasks.isError}
          archivedHasNextPage={archivedTasks.hasNextPage}
          archivedIsFetchingNextPage={archivedTasks.isFetchingNextPage}
          archivedFetchNextPage={archivedTasks.fetchNextPage}
          archivedRefetch={archivedTasks.refetch}
          restore={restore}
          online={online}
          _mutation={mutation}
          _selectedTask={selectedTask}
          setSelectedTask={setSelectedTask}
          _calendarTimeZone={calendarTimeZone}
        />
      </CollapsiblePanel>
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
        onOpenRelatedTask={setSelectedTask}
        onAction={(task, action) => mutation.mutate({ task, action })}
        onArchive={(task) => {
          mutation.mutate({ task, action: "archive" });
          setSelectedTask(null);
        }}
        onSave={async (task, values) => {
          await mutation.mutateAsync({ task, action: "update", body: values });
        }}
      />
      {createOpen ? (
        <TaskCreateSheet
          open
          project={{
            id: project.data.id,
            title: project.data.title,
            timeZone: calendarTimeZone,
          }}
          scheduledDate={currentDate}
          offline={!online}
          onOpenChange={setCreateOpen}
          onCreated={() => undefined}
        />
      ) : null}
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

/**
 * Purpose: Render an openable/closable section panel for Activity and Archived Tasks.
 * Inputs: Title, open state, toggle callback, and children.
 * Output: Accordion-style section card.
 * Side effects: None.
 */
function CollapsiblePanel({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full min-h-11 items-center justify-between gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <h2 className="text-sm font-semibold uppercase text-text-secondary">{title}</h2>
        <ChevronDown
          className={cn(
            "size-4 text-text-tertiary transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
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
    status: "PENDING_REVIEW",
    title: "Pending for Review",
    description: "Awaiting confirmation",
    icon: AlertCircle,
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
              column.status === "DONE" && "lg:col-span-3",
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
            <div
              className={cn(
                "grid gap-2",
                column.status === "DONE" && "lg:grid-cols-3 lg:items-start",
              )}
            >
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
          <TaskClassification
            taskType={task.taskType}
            priority={task.priority}
            className="mt-2"
          />
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

/**
 * Purpose: Render an expandable/collapsible activity feed item.
 * Inputs: Activity event and today's date for routing.
 * Output: Accordion item with summary and expandable details.
 * Side effects: None.
 */
function ActivityAccordionItem({
  event,
  todayDate,
}: {
  event: ActivityEventDto;
  todayDate: string;
}) {
  const [open, setOpen] = useState(false);
  const href = event.task ? getTaskActivityHref(event.task, todayDate) : null;

  return (
    <article className="rounded-md border border-border bg-surface-muted/55 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start p-3 text-left transition-colors duration-150 hover:bg-surface-muted/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <div className="min-w-0">
          <p className="text-sm">
            <span className="font-semibold">{event.actor?.displayName ?? "Someone"}</span>{" "}
            {event.label}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ChevronDown
            className={`size-4 text-text-tertiary transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          <time
            dateTime={event.createdAt}
            className="font-mono text-xs text-text-tertiary whitespace-nowrap"
          >
            {formatRelativeDay(event.createdAt, todayDate)} ·{" "}
            {new Date(event.createdAt).toLocaleString()}
          </time>
        </div>
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden border-t border-border bg-surface p-3">
          <div className="grid gap-2 text-sm">
            {event.task && href ? (
              <Link
                href={href as Route}
                aria-label={`Open task ${event.task.title}`}
                className="flex min-h-11 min-w-0 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-text-primary transition-colors hover:border-brand-muted hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <ListTodo className="size-4 shrink-0 text-brand" aria-hidden="true" />
                <span className="min-w-0 break-words">{event.task.title}</span>
              </Link>
            ) : null}
            <dl className="grid grid-cols-2 gap-1 text-xs text-text-secondary">
              <dt>Event type</dt>
              <dd className="font-mono">{event.eventType}</dd>
              <dt>Event ID</dt>
              <dd className="font-mono">{event.id}</dd>
              {event.projectId && (
                <>
                  <dt>Project ID</dt>
                  <dd className="font-mono">{event.projectId}</dd>
                </>
              )}
              {event.task && (
                <>
                  <dt>Task ID</dt>
                  <dd className="font-mono">{event.task.id}</dd>
                  <dt>Scheduled</dt>
                  <dd className="font-mono">{event.task.scheduledDate}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </div>
    </article>
  );
}

function getTaskActivityHref(
  task: NonNullable<ActivityEventDto["task"]>,
  todayDate: string,
): string {
  const taskId = encodeURIComponent(task.id);
  if (task.archivedAt) return `/task-history?view=archived&task=${taskId}`;
  if (task.scheduledDate < todayDate) {
    return `/task-history?view=missed&task=${taskId}`;
  }
  return `/weekly?date=${task.scheduledDate}&task=${taskId}`;
}

function formatRelativeDay(date: string, todayDate: string): string {
  const eventDate = new Date(date);
  const today = new Date(todayDate);
  const diff = Math.floor(
    (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  if (diff < -1 && diff >= -6) return `${Math.abs(diff)} days ago`;
  if (diff > 1 && diff <= 6) return `In ${diff} days`;
  return eventDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Purpose: Render the Archived Tasks section for a project.
 * Inputs: Project data, members, search/filters state, archived tasks data, and callbacks.
 * Output: Searchable, filterable list of archived tasks with restore capability.
 * Side effects: Fetches archived tasks, handles restore mutations.
 */
function ArchivedTasksSection({
  _projectId,
  _projectData,
  members,
  archivedSearch,
  setArchivedSearch,
  archivedFilters,
  setArchivedFilters,
  showArchivedFilters,
  setShowArchivedFilters,
  archivedItems,
  archivedIsLoading,
  archivedIsError,
  archivedHasNextPage,
  archivedIsFetchingNextPage,
  archivedFetchNextPage,
  archivedRefetch,
  restore,
  online,
  _mutation,
  _selectedTask,
  setSelectedTask,
  _calendarTimeZone,
}: {
  _projectId: string;
  _projectData: ProjectSummary;
  members: (ProfileSummary & { role: ProjectRole; joinedAt: string })[];
  archivedSearch: string;
  setArchivedSearch: (value: string) => void;
  archivedFilters: ArchivedTaskFilters;
  setArchivedFilters: (
    value: ArchivedTaskFilters | ((prev: ArchivedTaskFilters) => ArchivedTaskFilters),
  ) => void;
  showArchivedFilters: boolean;
  setShowArchivedFilters: (value: boolean) => void;
  archivedItems: TaskDto[];
  archivedIsLoading: boolean;
  archivedIsError: boolean;
  archivedHasNextPage: boolean;
  archivedIsFetchingNextPage: boolean;
  archivedFetchNextPage: () => void;
  archivedRefetch: () => void;
  restore: ReturnType<typeof useRestoreTask>;
  online: boolean;
  _mutation: ReturnType<typeof useTaskMutation>;
  _selectedTask: TaskDto | null;
  setSelectedTask: (task: TaskDto | null) => void;
  _calendarTimeZone: string;
}) {
  const hasActiveFilters = Boolean(
    archivedFilters.priority ||
    archivedFilters.assigneeId ||
    archivedFilters.completedFrom ||
    archivedFilters.completedTo ||
    archivedFilters.archivedFrom ||
    archivedFilters.archivedTo ||
    archivedFilters.status,
  );

  const handleFilterChange = (
    key: keyof ArchivedTaskFilters,
    value: string | undefined,
  ) => {
    setArchivedFilters((prev: ArchivedTaskFilters) => {
      const next: ArchivedTaskFilters = { ...prev };
      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const clearFilters = () => {
    setArchivedFilters({});
  };

  const memberOptions = members.map((m) => ({
    value: m.id,
    label: m.displayName,
  }));

  const priorityOptions = [
    { value: "NONE", label: "None" },
    { value: "LOW", label: "Low" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HIGH", label: "High" },
    { value: "URGENT", label: "Urgent" },
  ];

  const statusOptions = [
    { value: "TODO", label: "To Do" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "PENDING_REVIEW", label: "Pending for Review" },
    { value: "DONE", label: "Done" },
  ];

  const openArchivedTask = (task: TaskDto) => {
    setSelectedTask(task);
  };

  const handleRestore = (task: TaskDto) => {
    restore.mutate(task);
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-tertiary"
            aria-hidden="true"
          />
          <AppInput
            placeholder="Search by title or description..."
            value={archivedSearch}
            onChange={(e) => setArchivedSearch(e.currentTarget.value)}
            className="pl-9"
            disabled={archivedIsLoading}
          />
        </div>
        <AppButton
          variant={showArchivedFilters ? "secondary" : "ghost"}
          onClick={() => setShowArchivedFilters(!showArchivedFilters)}
          className="gap-2"
        >
          <Filter className="size-4" aria-hidden="true" />
          Filters
          {hasActiveFilters && (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand text-white text-[10px] font-medium">
              {Object.values(archivedFilters).filter(Boolean).length}
            </span>
          )}
        </AppButton>
        {archivedIsError && (
          <AppButton variant="secondary" size="sm" onClick={() => archivedRefetch()}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Retry
          </AppButton>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showArchivedFilters && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 p-3 rounded-lg border border-border bg-surface-muted/50">
          <AppSelect
            label="Priority"
            value={archivedFilters.priority ?? ""}
            onValueChange={(v) => handleFilterChange("priority", v)}
            options={[{ value: "", label: "All priorities" }, ...priorityOptions]}
            placeholder="All priorities"
          />
          <AppSelect
            label="Assignee"
            value={archivedFilters.assigneeId ?? ""}
            onValueChange={(v) => handleFilterChange("assigneeId", v)}
            options={[{ value: "", label: "All assignees" }, ...memberOptions]}
            placeholder="All assignees"
          />
          <AppSelect
            label="Status"
            value={archivedFilters.status ?? ""}
            onValueChange={(v) => handleFilterChange("status", v)}
            options={[{ value: "", label: "All statuses" }, ...statusOptions]}
            placeholder="All statuses"
          />
          <div className="flex items-center gap-2">
            <AppButton variant="ghost" size="sm" onClick={clearFilters} className="h-10">
              <X className="size-3.5 mr-1" aria-hidden="true" />
              Clear all
            </AppButton>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-text-secondary">Completed from</label>
            <AppDatePicker
              value={archivedFilters.completedFrom ?? ""}
              onChange={(e) => handleFilterChange("completedFrom", e.currentTarget.value)}
              placeholder="YYYY-MM-DD"
              className="h-10"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-text-secondary">Completed to</label>
            <AppDatePicker
              value={archivedFilters.completedTo ?? ""}
              onChange={(e) => handleFilterChange("completedTo", e.currentTarget.value)}
              placeholder="YYYY-MM-DD"
              className="h-10"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-text-secondary">Archived from</label>
            <AppDatePicker
              value={archivedFilters.archivedFrom ?? ""}
              onChange={(e) => handleFilterChange("archivedFrom", e.currentTarget.value)}
              placeholder="YYYY-MM-DD"
              className="h-10"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-text-secondary">Archived to</label>
            <AppDatePicker
              value={archivedFilters.archivedTo ?? ""}
              onChange={(e) => handleFilterChange("archivedTo", e.currentTarget.value)}
              placeholder="YYYY-MM-DD"
              className="h-10"
            />
          </div>
        </div>
      )}

      {/* Archived Tasks List */}
      <div className="grid gap-2 max-h-[28rem] overflow-y-auto pr-2 [scrollbar-gutter:stable]">
        {archivedIsLoading ? (
          <AppSkeleton className="h-64" />
        ) : archivedIsError ? (
          <AppEmptyState
            title="Archived tasks unavailable"
            description="The archived tasks list could not be loaded."
            action={
              <AppButton variant="secondary" onClick={() => archivedRefetch()}>
                Try again
              </AppButton>
            }
          />
        ) : !archivedItems.length ? (
          <AppEmptyState
            title="No archived tasks"
            description={
              archivedSearch || hasActiveFilters
                ? "No archived tasks match your search or filters."
                : "Archived tasks will appear here when tasks are archived."
            }
          />
        ) : (
          <>
            {archivedItems.map((task) => (
              <ArchivedTaskRow
                key={task.id}
                task={task}
                online={online}
                restoring={restore.isPending}
                onOpen={openArchivedTask}
                onRestore={handleRestore}
              />
            ))}
            <AppPagination
              hasNext={Boolean(archivedHasNextPage)}
              pending={archivedIsFetchingNextPage}
              label="Load older archived tasks"
              pendingLabel="Loading older tasks…"
              onNext={() => void archivedFetchNextPage()}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ArchivedTaskRow({
  task,
  online,
  restoring,
  onOpen,
  onRestore,
}: {
  task: TaskDto;
  online: boolean;
  restoring: boolean;
  onOpen: (task: TaskDto) => void;
  onRestore: (task: TaskDto) => void;
}) {
  const weekStart = getMondayWeekStart(parseISO(task.scheduledDate));
  const _mutation = useTaskMutation(weekStart);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString();
  };

  return (
    <article className="grid gap-2 rounded-lg border border-border bg-surface p-3 shadow-[var(--shadow-surface)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center opacity-80">
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span className="block break-words text-sm font-semibold">{task.title}</span>
        <TaskClassification
          taskType={task.taskType}
          priority={task.priority}
          className="mt-1"
        />
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-secondary">
          <Archive className="size-3.5" aria-hidden="true" />
          Archived {formatDate(task.archivedAt)}
          <span>·</span>
          <Calendar className="size-3.5" aria-hidden="true" />
          Completed {formatDate(task.completedAt)}
          <span>·</span>
          <User className="size-3.5" aria-hidden="true" />
          {task.assignee?.displayName ?? "Unassigned"}
          <span>·</span>
          <span>{task.status.replace("_", " ")}</span>
        </span>
      </button>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <AppButton
          size="sm"
          disabled={!online || restoring || !task.permissions.canArchive}
          onClick={() => onRestore(task)}
          aria-label={`Restore ${task.title}`}
        >
          <RotateCcw className="size-4" aria-hidden="true" /> Restore
        </AppButton>
      </div>
    </article>
  );
}
