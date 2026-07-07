"use client";

import { format, subDays } from "date-fns";
import type { Route } from "next";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { useQuery } from "@tanstack/react-query";
import type { ProjectSummary, TaskDto } from "@/types/domain";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { TaskRow } from "@/components/ui/task-row";
import { useTaskMutation } from "@/features/tasks/task-hooks";
import { getMondayWeekStart } from "@/lib/utils/dates";

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
  const from = getMondayWeekStart(new Date());
  const to = format(subDays(new Date(`${from}T00:00:00Z`), -6), "yyyy-MM-dd");
  const query = useQuery({
    queryKey: queryKeys.dashboard(from, to),
    queryFn: ({ signal }) =>
      apiGet<DashboardData>(`/api/dashboard?from=${from}&to=${to}`, signal),
  });
  const taskMutation = useTaskMutation(from);

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
  return (
    <main className="mx-auto grid min-w-0 max-w-7xl gap-4 overflow-x-hidden px-4 py-5 sm:gap-5 sm:px-5 md:gap-6 md:p-8">
      <PageHeader
        title="Dashboard"
        description="Today, weekly progress, completion rhythm, and project load."
      />
      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Widget title="Today">
          {todayTasks.length ? (
            <div className="grid min-w-0 gap-2">
              {todayTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onOpen={() => undefined}
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
            </div>
          ) : (
            <AppEmptyState
              title="Clear today"
              description="No overdue or incomplete tasks scheduled for today."
            />
          )}
        </Widget>
        <Widget title="Weekly progress">
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
          <div className="mt-5 h-32 min-w-0 overflow-hidden">
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
          </div>
        </Widget>
      </section>
      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Widget title="Activity heatmap">
          <p className="mb-3 text-sm text-text-secondary">
            {query.data.heatmap.streak} day current completion streak
          </p>
          <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            <div
              className="grid w-max grid-flow-col grid-rows-7 gap-1"
              aria-label="365 day task completion heatmap"
            >
              {Array.from({ length: 365 }, (_, index) => {
                const date = format(subDays(new Date(), 364 - index), "yyyy-MM-dd");
                const count =
                  query.data?.heatmap.days.find((day) => day.date === date)?.count ?? 0;
                return (
                  <span
                    key={date}
                    tabIndex={0}
                    title={`${date}: ${count} completed`}
                    aria-label={`${date}: ${count} completed tasks`}
                    className="size-2.5 shrink-0 rounded-[3px] sm:size-3"
                    style={{ background: heatmapColor(count) }}
                  />
                );
              })}
            </div>
          </div>
        </Widget>
        <Widget title="Project snapshot">
          {query.data.projects.length ? (
            <div className="grid min-w-0 gap-3">
              {query.data.projects.map((project) => (
                <a
                  key={project.id}
                  href={`/projects/${project.id}` as Route}
                  className="block min-w-0 rounded-md border border-border p-3 hover:bg-surface-muted"
                >
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <h3 className="min-w-0 truncate font-semibold">{project.title}</h3>
                    <span className="shrink-0 font-mono text-sm text-text-secondary">
                      {project.openTaskCount} open
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {project.weeklyCompletionPercent}% complete this week
                  </p>
                </a>
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
function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-surface)]">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-normal text-text-secondary">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Purpose: Map completion count to six brand-orange intensity levels.
 * Inputs: Completion count.
 * Output: CSS color string.
 * Side effects: None.
 */
function heatmapColor(count: number): string {
  const colors = [
    "var(--surface-muted)",
    "var(--brand-soft)",
    "color-mix(in srgb, var(--brand) 28%, var(--surface))",
    "color-mix(in srgb, var(--brand) 48%, var(--surface))",
    "color-mix(in srgb, var(--brand) 72%, var(--surface))",
    "var(--brand)",
  ];
  return colors[Math.min(count, colors.length - 1)] ?? "var(--surface-muted)";
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
