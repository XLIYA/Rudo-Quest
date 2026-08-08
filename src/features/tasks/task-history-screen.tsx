"use client";

import { Archive, CalendarClock, CheckCircle2, Play, RotateCcw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { AppButton } from "@/components/ui/app-button";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppPagination } from "@/components/ui/app-pagination";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { TaskDetailSheet } from "@/components/ui/task-detail-sheet";
import { useOnline } from "@/hooks/use-online";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { getMondayWeekStart } from "@/lib/utils/dates";
import type { TaskDto, TaskHistoryView } from "@/types/domain";
import { useTaskMutation } from "./task-hooks";
import { useRestoreTask, useTaskHistory } from "./task-history-hooks";

export type TaskHistoryScreenProps = {
  initialView: TaskHistoryView;
  initialTaskId?: string;
};

/**
 * Purpose: Provide URL-backed Missed and Archived recovery workflows.
 * Inputs: Server-normalized initial view and optional deep-linked task ID.
 * Output: Paginated accessible history workspace and task detail sheet.
 * Side effects: Fetches history/detail data, navigates tab/detail URLs, mutates tasks, and restores archives.
 */
export function TaskHistoryScreen({
  initialView,
  initialTaskId,
}: TaskHistoryScreenProps) {
  const router = useRouter();
  const online = useOnline();
  const [view, setView] = useState(initialView);
  const [selectedTaskId, setSelectedTaskId] = useState(initialTaskId ?? null);
  const history = useTaskHistory(view);
  const restore = useRestoreTask();
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  const selectedFromPage = items.find((task) => task.id === selectedTaskId) ?? null;
  const selectedQuery = useQuery({
    queryKey: queryKeys.task(selectedTaskId ?? ""),
    queryFn: ({ signal }) => apiGet<TaskDto>(`/api/tasks/${selectedTaskId}`, signal),
    enabled: Boolean(selectedTaskId) && !selectedFromPage,
  });
  const selectedTask = selectedFromPage ?? selectedQuery.data ?? null;
  const selectedWeek = selectedTask
    ? getMondayWeekStart(parseISO(selectedTask.scheduledDate))
    : "history";
  const selectedMutation = useTaskMutation(selectedWeek);

  const switchView = (next: TaskHistoryView) => {
    setView(next);
    setSelectedTaskId(null);
    router.push(`/task-history?view=${next}` as Route);
  };
  const openTask = (task: TaskDto) => {
    setSelectedTaskId(task.id);
    router.replace(`/task-history?view=${view}&task=${task.id}` as Route);
  };
  const closeTask = () => {
    setSelectedTaskId(null);
    router.replace(`/task-history?view=${view}` as Route);
  };

  return (
    <main className="app-enter mx-auto grid w-full max-w-5xl gap-5 p-5 md:p-8">
      <PageHeader
        title="Task history"
        description="Recover work that slipped past its date or restore tasks you archived."
      />
      <div
        role="tablist"
        aria-label="Task history view"
        className="grid grid-cols-2 rounded-lg border border-border bg-surface-muted p-1"
      >
        {(["missed", "archived"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={view === option}
            onClick={() => switchView(option)}
            className={`min-h-11 rounded-md px-4 text-sm font-semibold capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${view === option ? "bg-surface text-brand shadow-[var(--shadow-surface)]" : "text-text-secondary hover:text-text-primary"}`}
          >
            {option === "missed" ? "Missed" : "Archived"}
          </button>
        ))}
      </div>

      <section aria-live="polite" aria-busy={history.isLoading} className="grid gap-3">
        {history.isLoading ? <AppSkeleton className="h-64" /> : null}
        {history.isError ? (
          <AppEmptyState
            title="Task history unavailable"
            description="The history list could not be loaded."
            action={
              <AppButton variant="secondary" onClick={() => void history.refetch()}>
                Try again
              </AppButton>
            }
          />
        ) : null}
        {!history.isLoading && !history.isError && !items.length ? (
          <AppEmptyState
            title={view === "missed" ? "Nothing missed" : "Archive is empty"}
            description={
              view === "missed"
                ? "Incomplete tasks from earlier dates will appear here."
                : "Archived tasks remain recoverable here."
            }
          />
        ) : null}
        {items.map((task) => (
          <HistoryTaskRow
            key={task.id}
            task={task}
            view={view}
            online={online}
            restoring={restore.isPending}
            onOpen={openTask}
            onRestore={(target) => restore.mutate(target)}
          />
        ))}
        <AppPagination
          hasNext={Boolean(history.hasNextPage)}
          pending={history.isFetchingNextPage}
          label="Load older tasks"
          pendingLabel="Loading older tasks…"
          onNext={() => void history.fetchNextPage()}
        />
      </section>

      <TaskDetailSheet
        task={selectedTask}
        open={Boolean(selectedTaskId)}
        offline={!online}
        pending={selectedMutation.isPending}
        conflict={false}
        onOpenChange={(open) => !open && closeTask()}
        onAction={(task, action) => selectedMutation.mutate({ task, action })}
        onArchive={(task) => selectedMutation.mutate({ task, action: "archive" })}
        onSave={(task, values) =>
          selectedMutation.mutate({ task, action: "update", body: values })
        }
      />
    </main>
  );
}

function HistoryTaskRow({
  task,
  view,
  online,
  restoring,
  onOpen,
  onRestore,
}: {
  task: TaskDto;
  view: TaskHistoryView;
  online: boolean;
  restoring: boolean;
  onOpen: (task: TaskDto) => void;
  onRestore: (task: TaskDto) => void;
}) {
  const weekStart = getMondayWeekStart(parseISO(task.scheduledDate));
  const mutation = useTaskMutation(weekStart);
  const disabled = !online || mutation.isPending;

  return (
    <article
      className={`grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-surface)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${view === "archived" ? "opacity-80" : ""}`}
    >
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-h-11 min-w-0 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span className="block break-words font-semibold">{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          {view === "missed" ? (
            <>
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Scheduled {format(parseISO(task.scheduledDate), "MMM d, yyyy")}
            </>
          ) : (
            <>
              <Archive className="size-3.5" aria-hidden="true" />
              Archived {task.archivedAt ? new Date(task.archivedAt).toLocaleString() : ""}
            </>
          )}
          <span>·</span>
          <span>{task.project?.title ?? "Personal"}</span>
          <span>·</span>
          <span>{task.status.replace("_", " ")}</span>
        </span>
      </button>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {view === "missed" && task.status === "TODO" ? (
          <AppButton
            variant="secondary"
            disabled={disabled || !task.permissions.canTransition}
            onClick={() => mutation.mutate({ task, action: "start" })}
          >
            <Play className="size-4" aria-hidden="true" /> Start
          </AppButton>
        ) : null}
        {view === "missed" ? (
          <AppButton
            variant="secondary"
            disabled={disabled || !task.permissions.canTransition}
            onClick={() => mutation.mutate({ task, action: "complete" })}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" /> Complete
          </AppButton>
        ) : null}
        {view === "archived" && task.permissions.canArchive ? (
          <AppButton
            disabled={!online || restoring}
            onClick={() => onRestore(task)}
            aria-label={`Restore ${task.title}`}
          >
            <RotateCcw className="size-4" aria-hidden="true" /> Restore
          </AppButton>
        ) : null}
      </div>
    </article>
  );
}
