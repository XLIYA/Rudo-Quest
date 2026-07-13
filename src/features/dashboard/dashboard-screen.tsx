"use client";

import { addDays, format, parseISO } from "date-fns";
import type { Route } from "next";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { useQuery } from "@tanstack/react-query";
import type { ProfileDto, ProjectSummary, TaskDto } from "@/types/domain";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { AppAvatarStack } from "@/components/ui/app-avatar-stack";
import { ActivityHeatmap } from "@/components/shared/activity-heatmap";
import { PageHeader } from "@/components/shared/page-header";
import { TaskRow } from "@/components/ui/task-row";
import { useTaskMutation } from "@/features/tasks/task-hooks";
import { getDateInTimeZone, getMondayWeekStart } from "@/lib/utils/dates";
import { TaskDetailSheet } from "@/components/ui/task-detail-sheet";
import { useOnline } from "@/hooks/use-online";
import { useState } from "react";
import Link from "next/link";
import { ProjectIconGlyph } from "@/features/projects/project-pickers";
import { getProjectColor } from "@/lib/theme/project-colors";

type DashboardData = {
  today: { overdue: TaskDto[]; tasks: TaskDto[] };
  weeklyProgress: {
    completed: number;
    total: number;
    percent: number;
    days: { date: string; completed: number; total: number }[];
  };
  heatmap: { days: { date: string; count: number }[]; streak: number };
  projects: ProjectSummary[];
};

/**
 * Purpose: Render the four useful dashboard widgets.
 * Inputs: None.
 * Output: Dashboard UI backed by server aggregates.
 * Side effects: Fetches dashboard data and mutates tasks through hooks.
 */
export function DashboardScreen() {
  const profile = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<ProfileDto>("/api/me", signal),
  });
  const timeZone =
    profile.data?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayDate = getDateInTimeZone(new Date(), timeZone);
  const from = getMondayWeekStart(parseISO(todayDate));
  const to = format(addDays(parseISO(from), 6), "yyyy-MM-dd");
  const query = useQuery({
    queryKey: queryKeys.dashboard(from, to),
    queryFn: ({ signal }) =>
      apiGet<DashboardData>(`/api/dashboard?from=${from}&to=${to}`, signal),
  });
  const taskMutation = useTaskMutation(from);
  const online = useOnline();
  const [selectedTask, setSelectedTask] = useState<TaskDto | null>(null);

  if (query.isLoading) return <DashboardSkeleton />;
  if (query.isError || !query.data) {
    return (
      <AppEmptyState
        title="Dashboard unavailable"
        description="Rudo Quest could not load the dashboard aggregates."
      />
    );
  }
  const todayTasks = [...query.data.today.overdue, ...query.data.today.tasks];
  const todayGroups = Array.from(
    todayTasks.reduce((groups, task) => {
      const key = task.project?.id ?? "personal";
      const current = groups.get(key) ?? {
        title: task.project?.title ?? "Personal",
        tasks: [] as TaskDto[],
      };
      current.tasks.push(task);
      groups.set(key, current);
      return groups;
    }, new Map<string, { title: string; tasks: TaskDto[] }>()),
  );
  return (
    <main className="mx-auto grid min-w-0 max-w-7xl gap-4 overflow-x-hidden px-4 py-5 sm:gap-5 sm:px-5 md:gap-6 md:p-8">
      <PageHeader
        title="Dashboard"
        description="Today, weekly progress, completion rhythm, and project load."
      />
      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Widget title="Today" description="Overdue and scheduled work for the day.">
          {todayTasks.length ? (
            <div className="grid min-w-0 gap-4">
              {todayGroups.map(([key, group]) => (
                <section key={key} className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">{group.title}</h3>
                    <Link
                      href={`/weekly?date=${todayDate}`}
                      className="inline-flex min-h-11 items-center text-xs font-semibold text-brand hover:underline"
                    >
                      Open in Weekly
                    </Link>
                  </div>
                  {group.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      disabled={!online}
                      onOpen={(target) => setSelectedTask(target)}
                      onStart={(target) =>
                        taskMutation.mutate({ task: target, action: "start" })
                      }
                      onCompleteToggle={(target) =>
                        taskMutation.mutate({
                          task: target,
                          action: target.status === "DONE" ? "reopen" : "complete",
                        })
                      }
                    />
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <AppEmptyState
              title="Clear today"
              description="No overdue or incomplete tasks scheduled for today."
            />
          )}
        </Widget>
        <Widget title="Weekly progress" description="Completed tasks across this week.">
          <div className="flex min-w-0 items-end justify-between">
            <div className="min-w-0">
              <p className="font-mono text-3xl font-semibold sm:text-4xl">
                {query.data.weeklyProgress.percent}%
              </p>
              <p className="text-sm text-text-secondary">
                {query.data.weeklyProgress.completed} / {query.data.weeklyProgress.total}{" "}
                completed
              </p>
            </div>
          </div>
          <div
            className="mt-5 h-32 min-w-0 overflow-hidden"
            role="img"
            aria-label={`Seven-day completion chart. ${query.data.weeklyProgress.completed} of ${query.data.weeklyProgress.total} tasks completed this week.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={query.data.weeklyProgress.days}
                margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
              >
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => value.slice(5)}
                  fontSize={11}
                  interval={0}
                  minTickGap={0}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip />
                <Bar dataKey="completed" fill="var(--brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <span className="sr-only">
              {query.data.weeklyProgress.days
                .map(
                  (day) =>
                    `${format(parseISO(day.date), "EEEE")}: ${day.completed} of ${day.total} completed`,
                )
                .join("; ")}
            </span>
          </div>
        </Widget>
      </section>
      <TaskDetailSheet
        task={selectedTask}
        open={Boolean(selectedTask)}
        offline={!online}
        pending={taskMutation.isPending}
        conflict={
          taskMutation.isError &&
          typeof taskMutation.error === "object" &&
          taskMutation.error !== null &&
          "status" in taskMutation.error &&
          taskMutation.error.status === 409
        }
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onAction={(task, action) => taskMutation.mutate({ task, action })}
        onArchive={(task) => {
          taskMutation.mutate({ task, action: "archive" });
          setSelectedTask(null);
        }}
        onSave={(task, values) =>
          taskMutation.mutate({ task, action: "update", body: values })
        }
      />
      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Widget
          title="Activity"
          description={`${query.data.heatmap.streak} day current completion streak.`}
        >
          <ActivityHeatmap days={query.data.heatmap.days} endDate={todayDate} />
        </Widget>
        <Widget
          title="Projects"
          description="Open work and weekly completion by project."
        >
          {query.data.projects.length ? (
            <div className="grid min-w-0 gap-3">
              {query.data.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}` as Route}
                  className="block min-w-0 rounded-md border border-border p-3 hover:bg-surface-muted"
                >
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-md"
                        style={{
                          background: getProjectColor(project.colorKey).soft,
                          color: getProjectColor(project.colorKey).text,
                        }}
                      >
                        <ProjectIconGlyph iconKey={project.iconKey} className="size-4" />
                      </span>
                      <h3 className="min-w-0 truncate font-semibold">{project.title}</h3>
                    </div>
                    <span className="shrink-0 font-mono text-sm text-text-secondary">
                      {project.openTaskCount} open
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {project.completedThisWeek} completed ·{" "}
                    {project.weeklyCompletionPercent}% of scheduled work
                  </p>
                  <div className="mt-2">
                    <AppAvatarStack users={project.members} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <AppEmptyState
              title="No projects yet"
              description="Create a project when work needs collaborators."
            />
          )}
        </Widget>
      </section>
    </main>
  );
}

/**
 * Purpose: Render a consistent dashboard widget container.
 * Inputs: Title and children.
 * Output: Section card.
 * Side effects: None.
 */
function Widget({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-surface)] md:p-5">
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-[-0.02em] text-text-primary">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-text-secondary">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Purpose: Render dashboard loading skeletons.
 * Inputs: None.
 * Output: Skeleton page.
 * Side effects: None.
 */
function DashboardSkeleton() {
  return (
    <main className="grid min-w-0 gap-4 px-4 py-5 sm:px-5 md:p-8">
      <AppSkeleton className="h-12 w-56" />
      <AppSkeleton className="h-64 w-full" />
      <AppSkeleton className="h-64 w-full" />
    </main>
  );
}
