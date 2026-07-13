"use client";

import { addDays, format, isValid, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppToast } from "@/components/ui/app-toast";
import { AppButton } from "@/components/ui/app-button";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppIconButton } from "@/components/ui/app-icon-button";
import { AppInput } from "@/components/ui/app-input";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { TaskDetailSheet } from "@/components/ui/task-detail-sheet";
import { TaskRow } from "@/components/ui/task-row";
import { PageHeader } from "@/components/shared/page-header";
import { useOnline } from "@/hooks/use-online";
import { getMondayWeekStart, getWeekDates } from "@/lib/utils/dates";
import type { TaskDto } from "@/types/domain";
import {
  useCreateTask,
  useTaskMutation,
  useWeekTasks,
} from "@/features/tasks/task-hooks";

/**
 * Purpose: Render the central Monday-Sunday accordion planner.
 * Inputs: URL search params for week/date state.
 * Output: Weekly task planning UI.
 * Side effects: Fetches and mutates tasks through Query hooks.
 */
export function WeeklyScreen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const today = format(new Date(), "yyyy-MM-dd");
  const requestedDateValue = searchParams.get("date");
  const requestedDate =
    requestedDateValue === "closed" ||
    (requestedDateValue &&
      /^\d{4}-\d{2}-\d{2}$/.test(requestedDateValue) &&
      isValid(parseISO(requestedDateValue)))
      ? requestedDateValue
      : null;
  const weekStart =
    searchParams.get("weekStart") ??
    (requestedDate && requestedDate !== "closed"
      ? getMondayWeekStart(parseISO(requestedDate))
      : getMondayWeekStart(new Date()));
  const selectedDate =
    requestedDate ?? (getWeekDates(weekStart).includes(today) ? today : weekStart);
  const [selectedTask, setSelectedTask] = useState<TaskDto | null>(null);
  const [quickDate, setQuickDate] = useState<string | null>(
    searchParams.get("quickAdd") ? selectedDate : null,
  );
  const [quickTitle, setQuickTitle] = useState("");
  const online = useOnline();
  const query = useWeekTasks(weekStart);
  const createTask = useCreateTask(weekStart);
  const mutateTask = useTaskMutation(weekStart);
  const dates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const expandedDate = dates.includes(selectedDate) ? selectedDate : "";

  const navigateWeek = (direction: -1 | 1) => {
    const next = format(addDays(parseISO(weekStart), direction * 7), "yyyy-MM-dd");
    router.push(`/weekly?weekStart=${next}&date=${next}`);
  };

  const submitQuick = async (date: string) => {
    if (!online) return AppToast("Offline. Task creation is disabled.", "error");
    if (!quickTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        title: quickTitle.trim(),
        scheduledDate: date,
        scheduledTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch {
      return;
    }
    setQuickTitle("");
    setQuickDate(null);
  };

  return (
    <main className="mx-auto grid max-w-5xl gap-5 p-5 md:p-8">
      <PageHeader
        title="Weekly"
        description={`${format(parseISO(weekStart), "MMM d")} - ${format(addDays(parseISO(weekStart), 6), "MMM d, yyyy")}`}
        action={
          <div className="flex items-center gap-2">
            <AppIconButton label="Previous week" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="size-5" />
            </AppIconButton>
            <AppButton
              variant="secondary"
              onClick={() =>
                router.push(
                  `/weekly?weekStart=${getMondayWeekStart(new Date())}&date=${today}`,
                )
              }
            >
              Today
            </AppButton>
            <AppIconButton label="Next week" onClick={() => navigateWeek(1)}>
              <ChevronRight className="size-5" />
            </AppIconButton>
          </div>
        }
      />
      {query.isLoading ? <AppSkeleton className="h-96 w-full" /> : null}
      {query.isError ? (
        <AppEmptyState
          title="Week unavailable"
          description="The task list could not be loaded. Check the connection and try again."
          action={
            <AppButton variant="secondary" onClick={() => void query.refetch()}>
              Try again
            </AppButton>
          }
        />
      ) : null}
      {!query.isError && query.data ? (
        <section className="grid gap-3">
          {dates.map((date) => {
            const tasks = query.data.filter(
              (task) => task.scheduledDate === date && !task.archivedAt,
            );
            const done = tasks.filter((task) => task.status === "DONE").length;
            const open = expandedDate === date;
            const ordered = [...tasks].sort(
              (a, b) => Number(a.status === "DONE") - Number(b.status === "DONE"),
            );
            return (
              <article key={date} className="rounded-lg border border-border bg-surface">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => {
                    const nextDate = open ? "closed" : date;
                    router.push(`/weekly?weekStart=${weekStart}&date=${nextDate}`);
                  }}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-3 p-4 text-left"
                >
                  <span>
                    <span className="font-display text-3xl uppercase leading-none">
                      {format(parseISO(date), "EEEE")}
                    </span>
                    <span className="mt-1 block font-mono text-xs text-text-secondary">
                      {format(parseISO(date), "MMMM d, yyyy")} - {done} / {tasks.length}{" "}
                      completed
                    </span>
                  </span>
                  <span className="font-mono text-sm text-text-secondary">
                    {open ? "Close" : "Open"}
                  </span>
                </button>
                {open ? (
                  <div className="grid gap-2 border-t border-border p-3">
                    {ordered.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        disabled={!online}
                        onOpen={(target) => setSelectedTask(target)}
                        onStart={(target) =>
                          mutateTask.mutate({ task: target, action: "start" })
                        }
                        onCompleteToggle={(target) =>
                          mutateTask.mutate({
                            task: target,
                            action: target.status === "DONE" ? "reopen" : "complete",
                          })
                        }
                      />
                    ))}
                    {quickDate === date ? (
                      <AppInput
                        autoFocus
                        label="Add a task"
                        value={quickTitle}
                        onChange={(event) => setQuickTitle(event.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void submitQuick(date);
                          if (event.key === "Escape") setQuickDate(null);
                        }}
                      />
                    ) : (
                      <AppButton
                        variant="ghost"
                        disabled={!online}
                        onClick={() => setQuickDate(date)}
                      >
                        <Plus className="size-4" />
                        Add a task...
                      </AppButton>
                    )}
                    {!ordered.length && quickDate !== date ? (
                      <AppEmptyState
                        title="Open day"
                        description="No tasks scheduled here."
                      />
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
      <TaskDetailSheet
        task={selectedTask}
        open={Boolean(selectedTask)}
        offline={!online}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onAction={(task, action) => mutateTask.mutate({ task, action })}
        onArchive={(task) => {
          mutateTask.mutate({ task, action: "archive" });
          setSelectedTask(null);
        }}
        onSave={(task, values) =>
          mutateTask.mutate({ task, action: "update", body: values })
        }
      />
    </main>
  );
}
