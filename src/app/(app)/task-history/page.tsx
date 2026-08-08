import { TaskHistoryScreen } from "@/features/tasks/task-history-screen";
import type { TaskHistoryView } from "@/types/domain";

type TaskHistoryPageProps = {
  searchParams: Promise<{ view?: string; task?: string }>;
};

/**
 * Purpose: Normalize shareable task-history URL state for the client workspace.
 * Inputs: App Router search parameters.
 * Output: Task history feature screen.
 * Side effects: None.
 */
export default async function TaskHistoryPage({ searchParams }: TaskHistoryPageProps) {
  const params = await searchParams;
  const view: TaskHistoryView = params.view === "archived" ? "archived" : "missed";
  const taskId =
    params.task &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      params.task,
    )
      ? params.task
      : undefined;
  return (
    <TaskHistoryScreen
      key={`${view}:${taskId ?? "none"}`}
      initialView={view}
      initialTaskId={taskId}
    />
  );
}
