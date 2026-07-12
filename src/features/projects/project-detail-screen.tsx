"use client";

import { useParams } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ActivityPageDto, ProjectSummary, TaskDto } from "@/types/domain";
import { AppAvatarStack } from "@/components/ui/app-avatar-stack";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { AppButton } from "@/components/ui/app-button";
import { TaskRow } from "@/components/ui/task-row";
import { useTaskMutation } from "@/features/tasks/task-hooks";
import { getMondayWeekStart } from "@/lib/utils/dates";
import { TaskDetailSheet } from "@/components/ui/task-detail-sheet";
import { useOnline } from "@/hooks/use-online";
import { useState } from "react";
import Link from "next/link";

/**
 * Purpose: Render project detail with tasks, members, GitHub status, and activity.
 * Inputs: Project route parameter.
 * Output: Project detail UI.
 * Side effects: Fetches project, tasks, and activity data.
 */
export function ProjectDetailScreen() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const weekStart = getMondayWeekStart(new Date());
  const project = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: ({ signal }) => apiGet<ProjectSummary>(`/api/projects/${projectId}`, signal),
  });
  const tasks = useQuery({
    queryKey: [...queryKeys.tasksWeek(weekStart), projectId],
    queryFn: ({ signal }) =>
      apiGet<TaskDto[]>(
        `/api/tasks/week?weekStart=${weekStart}&projectId=${projectId}`,
        signal,
      ),
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
  return (
    <main className="mx-auto grid max-w-6xl gap-5 p-5 md:p-8">
      <PageHeader
        title={project.data.title}
        description={project.data.description ?? "Project task space."}
      />
      <section className="grid gap-4 md:grid-cols-3">
        <Panel title="Status">
          <p className="font-mono text-3xl font-semibold">{project.data.openTaskCount}</p>
          <p className="text-sm text-text-secondary">open tasks</p>
          <p className="mt-3 text-sm text-text-secondary">
            {project.data.githubRepositoryFullName ?? "No GitHub repository connected."}
          </p>
          {!project.data.githubRepositoryFullName && (
            <Link
              href={`/projects/${project.data.id}/settings`}
              className="mt-3 inline-block"
            >
              <AppButton variant="secondary" size="sm">
                Connect GitHub Repository
              </AppButton>
            </Link>
          )}
        </Panel>
        <Panel title="Members">
          <AppAvatarStack users={project.data.members} />
        </Panel>
        <Panel title="Completion">
          <p className="font-mono text-3xl font-semibold">
            {project.data.weeklyCompletionPercent}%
          </p>
          <p className="text-sm text-text-secondary">this week</p>
        </Panel>
      </section>
      <Panel title="Project tasks">
        {tasks.data?.length ? (
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
        ) : (
          <AppEmptyState
            title="No project tasks"
            description="Create a task from Weekly and attach it to this project."
          />
        )}
      </Panel>
      <Panel title="Activity">
        <div className="grid gap-2">
          {activityItems.slice(0, 10).map((event) => (
            <p key={event.id} className="rounded-md bg-surface-muted p-3 text-sm">
              {event.actor?.displayName ?? "Someone"} {event.label}
            </p>
          ))}
          {activity.hasNextPage ? (
            <AppButton
              variant="secondary"
              onClick={() => void activity.fetchNextPage()}
              disabled={activity.isFetchingNextPage}
            >
              {activity.isFetchingNextPage
                ? "Loading older activity…"
                : "Load older activity"}
            </AppButton>
          ) : null}
        </div>
      </Panel>
      <TaskDetailSheet
        task={selectedTask}
        open={Boolean(selectedTask)}
        offline={!online}
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
