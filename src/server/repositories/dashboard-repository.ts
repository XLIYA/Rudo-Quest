import { addDays, format, subDays } from "date-fns";
import { listProjectSummaries } from "@/server/repositories/project-repository";
import {
  listCompletionCounts,
  listDashboardTasks,
} from "@/server/repositories/task-repository";
import { calculateCompletionStreak, getDateInTimeZone } from "@/lib/utils/dates";
import { findProfileById } from "@/server/repositories/profile-repository";

export type DashboardAggregate = {
  today: {
    overdue: Awaited<ReturnType<typeof listDashboardTasks>>;
    tasks: Awaited<ReturnType<typeof listDashboardTasks>>;
  };
  weeklyProgress: {
    completed: number;
    total: number;
    percent: number;
    days: { date: string; completed: number; total: number }[];
  };
  heatmap: {
    days: { date: string; count: number }[];
    streak: number;
  };
  projects: Awaited<ReturnType<typeof listProjectSummaries>>;
};

/**
 * Purpose: Build dashboard aggregates server-side.
 * Inputs: User ID and requested date range.
 * Output: Dashboard widgets without exposing unnecessary raw analytics inputs.
 * Side effects: Reads tasks and projects.
 */
export async function getDashboardAggregate(input: {
  userId: string;
  from: string;
  to: string;
}): Promise<DashboardAggregate> {
  const profile = await findProfileById(input.userId);
  const today = getDateInTimeZone(new Date(), profile?.timeZone ?? "UTC");
  const tasks = await listDashboardTasks({
    ...input,
    from: input.from < today ? input.from : today,
    to: input.to > today ? input.to : today,
  });
  const overdue = tasks.filter(
    (task) => task.scheduledDate < today && task.status !== "DONE",
  );
  const todayTasks = tasks.filter(
    (task) => task.scheduledDate === today && task.status !== "DONE",
  );
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    format(addDays(new Date(`${input.from}T00:00:00.000Z`), index), "yyyy-MM-dd"),
  );
  const days = weekDays.map((date) => {
    const dayTasks = tasks.filter((task) => task.scheduledDate === date);
    return {
      date,
      completed: dayTasks.filter((task) => task.status === "DONE").length,
      total: dayTasks.length,
    };
  });
  const completed = days.reduce((sum, day) => sum + day.completed, 0);
  const total = days.reduce((sum, day) => sum + day.total, 0);
  const heatmapToday = format(new Date(), "yyyy-MM-dd");
  const from365 = format(subDays(new Date(), 364), "yyyy-MM-dd");
  const heatmapDays = await listCompletionCounts({
    userId: input.userId,
    from: from365,
    to: heatmapToday,
  });
  return {
    today: { overdue, tasks: todayTasks },
    weeklyProgress: {
      completed,
      total,
      percent: total ? Math.round((completed / total) * 100) : 0,
      days,
    },
    heatmap: { days: heatmapDays, streak: calculateCompletionStreak(heatmapDays) },
    projects: (
      await listProjectSummaries({ userId: input.userId, archived: "active" })
    ).slice(0, 4),
  };
}
