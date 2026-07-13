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
} from "@/types/domain";
import { AppAvatarStack } from "@/components/ui/app-avatar-stack";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { AppButton } from "@/components/ui/app-button";
import { AppPagination } from "@/components/ui/app-pagination";
import { TaskRow } from "@/components/ui/task-row";
import { useTaskMutation } from "@/features/tasks/task-hooks";
import { getDateInTimeZone, getMondayWeekStart } from "@/lib/utils/dates";
import { TaskDetailSheet } from "@/components/ui/task-detail-sheet";
import { useOnline } from "@/hooks/use-online";
import { useState } from "react";
import Link from "next/link";
import { ProjectIconGlyph } from "./project-pickers";
import { getProjectColor } from "@/lib/theme/project-colors";
import { parseISO } from "date-fns";

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
    <main className="mx-auto grid max-w-6xl gap-5 p-5 md:p-8">
      <div className="flex items-start gap-3 sm:gap-4">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-lg sm:size-14"
          style={{ background: projectColor.soft, color: projectColor.text }}
        >
          <ProjectIconGlyph iconKey={project.data.iconKey} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <PageHeader
            title={project.data.title}
            description={project.data.description ?? "Project task space."}
            action={
              project.data.role === "OWNER" || project.data.role === "ADMIN" ? (
                <AppButton asChild variant="secondary">
                  <Link href={`/projects/${project.data.id}/settings`}>Settings</Link>
                </AppButton>
              ) : undefined
            }
          />
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
      <Panel title="This week's project tasks">
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
        ) : tasks.data?.length ? (
          <div className="grid gap-2">
            {tasks.data.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                disabled={!online}
                onOpen={(target) => setSelectedTask(target)}
                onStart={(target) => mutation.mutate({ task: target, action: "start" })}
                onCompleteToggle={(target) =>
                  mutation.mutate({
                    task: target,
                    action: target.status === "DONE" ? "reopen" : "complete",
                  })
                }
              />
            ))}
          </div>
        ) : !tasks.isLoading ? (
          <AppEmptyState
            title="No project tasks"
            description="Create a task from Weekly and attach it to this project."
          />
        ) : null}
      </Panel>
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
