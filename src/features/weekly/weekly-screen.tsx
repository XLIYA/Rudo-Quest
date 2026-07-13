"use client";

import { addDays, format, isValid, parseISO } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { getDateInTimeZone, getMondayWeekStart, getWeekDates } from "@/lib/utils/dates";
import type { ProfileDto, TaskDto } from "@/types/domain";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
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
  const profile = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<ProfileDto>("/api/me", signal),
  });
  const timeZone =
    profile.data?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = getDateInTimeZone(new Date(), timeZone);
  const requestedDateValue = searchParams.get("date");
  const requestedDate =
    requestedDateValue === "closed" ||
    (requestedDateValue &&
      /^\d{4}-\d{2}-\d{2}$/.test(requestedDateValue) &&
      isValid(parseISO(requestedDateValue)))
      ? requestedDateValue
      : null;
  const requestedWeekStart = validDate(searchParams.get("weekStart"));
  const weekStart = requestedWeekStart
    ? getMondayWeekStart(parseISO(requestedWeekStart))
    : requestedDate && requestedDate !== "closed"
      ? getMondayWeekStart(parseISO(requestedDate))
      : getMondayWeekStart(parseISO(today));
  const dates = getWeekDates(weekStart);
  const selectedDate =
    requestedDate === "closed"
      ? "closed"
      : requestedDate && dates.includes(requestedDate)
        ? requestedDate
        : dates.includes(today)
          ? today
          : weekStart;
  const [quickDate, setQuickDate] = useState<string | null>(
    searchParams.get("quickAdd") && selectedDate !== "closed" ? selectedDate : null,
  );
  const [quickTitle, setQuickTitle] = useState("");
  const online = useOnline();
  const query = useWeekTasks(weekStart);
  const createTask = useCreateTask(weekStart);
  const mutateTask = useTaskMutation(weekStart);
  const expandedDate = dates.includes(selectedDate) ? selectedDate : "";
  const linkedTaskId = searchParams.get("task");
  const linkedTask = query.data?.find((task) => task.id === linkedTaskId) ?? null;

  /**
   * Purpose: Open a task detail deep link without losing week/day URL state.
   * Inputs: Selected task.
   * Output: Void.
   * Side effects: Replaces the current route query.
   */
  const openTask = (task: TaskDto) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("task", task.id);
    router.replace(`/weekly?${next.toString()}`);
  };

  /**
   * Purpose: Close task detail while preserving the current planner location.
   * Inputs: None.
   * Output: Void.
   * Side effects: Removes the task query parameter.
   */
  const closeTask = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("task");
    const queryString = next.toString();
    router.replace(queryString ? `/weekly?${queryString}` : "/weekly");
  };

  /**
   * Purpose: Navigate exactly one Monday-Sunday interval.
   * Inputs: Previous or next direction.
   * Output: Void.
   * Side effects: Pushes restorable week/day URL state.
   */
  const navigateWeek = (direction: -1 | 1) => {
    const next = format(addDays(parseISO(weekStart), direction * 7), "yyyy-MM-dd");
    router.push(`/weekly?weekStart=${next}&date=${next}`);
  };

  /**
   * Purpose: Create a personal task for the expanded day from the inline input.
   * Inputs: Target ISO date.
   * Output: Promise resolving after optimistic creation settles.
   * Side effects: Starts a mutation and clears quick-add state on success.
   * Failure behavior: Blocks offline and retains input after API failure.
   */
  const submitQuick = async (date: string) => {
    if (!online) return AppToast("Offline. Task creation is disabled.", "error");
    if (!quickTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        title: quickTitle.trim(),
        scheduledDate: date,
        scheduledTimeZone: timeZone,
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
                  `/weekly?weekStart=${getMondayWeekStart(parseISO(today))}&date=${today}`,
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
            const currentDay = date === today;
            const ordered = [...tasks].sort(
              (a, b) => Number(a.status === "DONE") - Number(b.status === "DONE"),
            );
            return (
              <article
                key={date}
                className={`rounded-lg border bg-surface ${currentDay ? "border-brand shadow-[0_0_0_1px_var(--brand-soft)]" : "border-border"}`}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => {
                    const nextDate = open ? "closed" : date;
                    router.push(`/weekly?weekStart=${weekStart}&date=${nextDate}`);
                  }}
                  className="grid min-h-20 w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg p-4 text-left"
                >
                  <span>
                    <span className="font-display text-3xl uppercase leading-none">
                      {format(parseISO(date), "EEEE")}
                    </span>
                    <span className="mt-1 block font-mono text-xs text-text-secondary">
                      {format(parseISO(date), "MMMM d, yyyy")} - {done} / {tasks.length}{" "}
                      completed
                      {currentDay ? " · Today" : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {tasks.length ? (
                      <span
                        aria-hidden="true"
                        className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-surface-muted sm:block"
                      >
                        <span
                          className="block h-full rounded-full bg-brand"
                          style={{ width: `${Math.round((done / tasks.length) * 100)}%` }}
                        />
                      </span>
                    ) : null}
                    <ChevronDown
                      className={`size-5 text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </span>
                </button>
                {open ? (
                  <div className="grid gap-2 border-t border-border p-3">
                    {ordered.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        disabled={!online}
                        onOpen={openTask}
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
                        disabled={createTask.isPending}
                        onChange={(event) => setQuickTitle(event.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !createTask.isPending) {
                            event.preventDefault();
                            void submitQuick(date);
                          }
                          if (event.key === "Escape") {
                            setQuickTitle("");
                            setQuickDate(null);
                          }
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
        task={linkedTask}
        open={Boolean(linkedTask)}
        offline={!online}
        pending={mutateTask.isPending}
        conflict={
          mutateTask.isError &&
          typeof mutateTask.error === "object" &&
          mutateTask.error !== null &&
          "status" in mutateTask.error &&
          mutateTask.error.status === 409
        }
        onOpenChange={(open) => !open && closeTask()}
        onAction={(task, action) => mutateTask.mutate({ task, action })}
        onArchive={(task) => {
          mutateTask.mutate({ task, action: "archive" });
          closeTask();
        }}
        onSave={(task, values) =>
          mutateTask.mutate({ task, action: "update", body: values })
        }
      />
    </main>
  );
}

/**
 * Purpose: Accept only real ISO calendar dates from weekly URL state.
 * Inputs: Candidate URL parameter.
 * Output: Valid date string or null.
 * Side effects: None.
 */
function validDate(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
    ? value
    : null;
}
