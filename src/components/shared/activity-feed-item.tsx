import { ListTodo } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { formatRelativeDay } from "@/lib/utils/dates";
import type { ActivityEventDto } from "@/types/domain";

export type ActivityFeedItemProps = {
  event: ActivityEventDto;
  todayDate: string;
};

/**
 * Purpose: Render consistent activity copy and unambiguous task context.
 * Inputs: Authorized activity DTO and viewer-local current date.
 * Output: Activity row with an appropriate task deep link when applicable.
 * Side effects: None.
 */
export function ActivityFeedItem({ event, todayDate }: ActivityFeedItemProps) {
  const href = event.task ? getTaskActivityHref(event.task, todayDate) : null;

  return (
    <article className="grid gap-2 rounded-md border border-border bg-surface-muted/55 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-semibold">{event.actor?.displayName ?? "Someone"}</span>{" "}
          {event.label}
        </p>
        {event.task && href ? (
          <Link
            href={href as Route}
            aria-label={`Open task ${event.task.title}`}
            className="mt-2 flex min-h-11 min-w-0 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-text-primary transition-colors hover:border-brand-muted hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <ListTodo className="size-4 shrink-0 text-brand" aria-hidden="true" />
            <span className="min-w-0 break-words">{event.task.title}</span>
          </Link>
        ) : null}
      </div>
      <time
        dateTime={event.createdAt}
        className="font-mono text-xs text-text-tertiary sm:text-right"
      >
        {formatRelativeDay(event.createdAt)} ·{" "}
        {new Date(event.createdAt).toLocaleString()}
      </time>
    </article>
  );
}

/**
 * Purpose: Route task activity to the surface where that task can currently be handled.
 * Inputs: Task activity context and viewer-local current date.
 * Output: Stable task detail URL.
 * Side effects: None.
 */
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
