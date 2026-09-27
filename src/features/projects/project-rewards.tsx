"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Plus } from "lucide-react";
import { AppButton } from "@/components/ui/app-button";
import { AppDialog } from "@/components/ui/app-dialog";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppTimePicker } from "@/components/ui/app-time-picker";
import { AppInput } from "@/components/ui/app-input";
import { AppToast } from "@/components/ui/app-toast";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import type { CreateTaskRewardInput } from "@/lib/validation/task-rewards";
import type { TaskDto, TaskRewardDto } from "@/types/domain";

/**
 * Purpose: Let project admins promise and approve a total reward for selected tasks.
 * Inputs: Project identity, visible tasks, permission and connection state.
 * Output: Compact reward list and accessible multi-select creation dialog.
 * Side effects: Fetches reward contracts and submits versioned API mutations.
 */
export function ProjectRewards({
  projectId,
  tasks,
  canManage,
  disabled,
}: {
  projectId: string;
  tasks: TaskDto[];
  canManage: boolean;
  disabled: boolean;
}) {
  const client = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["project-rewards", projectId],
    queryFn: ({ signal }) =>
      apiGet<TaskRewardDto[]>(`/api/projects/${projectId}/rewards`, signal),
  });
  const refresh = async () => {
    await Promise.all(
      [
        "project-rewards",
        "tasks-week",
        "dashboard",
        "activity",
        "task",
        "task-history",
        "project-archived-tasks",
      ].map((key) => client.invalidateQueries({ queryKey: [key] })),
    );
  };
  const action = useMutation({
    mutationFn: ({
      reward,
      action,
    }: {
      reward: TaskRewardDto;
      action: "approve" | "cancel";
    }) =>
      apiMutation("patch", `/api/projects/${projectId}/rewards/${reward.id}`, {
        version: reward.version,
        action,
      }),
    onSuccess: async () => {
      await refresh();
      AppToast("Reward updated", "success");
    },
    onError: (error) => {
      AppToast(normalizeApiClientError(error).message, "error");
      void refresh();
    },
  });
  return (
    <section className="app-card min-w-0 p-4" aria-label="Task rewards">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Gift className="size-4 text-brand" aria-hidden="true" /> Task rewards
        </h2>
        {canManage ? (
          <AppButton
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => setOpen(true)}
          >
            <Plus className="size-4" aria-hidden="true" /> Add reward
          </AppButton>
        ) : null}
      </div>
      {query.isError ? (
        <div className="mt-3 flex items-center justify-between gap-2 text-sm text-error">
          Rewards unavailable{" "}
          <AppButton size="sm" variant="secondary" onClick={() => void query.refetch()}>
            Retry
          </AppButton>
        </div>
      ) : null}
      {query.isLoading ? (
        <p className="mt-3 text-sm text-text-secondary" role="status">
          Loading rewards…
        </p>
      ) : null}
      {query.data?.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-text-secondary">
          One shared goal. A total reward when every selected task is completed and
          approved on time.
        </p>
      ) : null}
      <div className="mt-3 grid gap-2">
        {query.data?.map((reward) => {
          const expired =
            reward.status === "ACTIVE" && now > new Date(reward.deadline).getTime();
          return (
            <article
              key={reward.id}
              className="grid min-w-0 gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              data-reward={reward.status === "ACTIVE" ? "true" : undefined}
            >
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold" title={reward.title}>
                  {reward.title}
                </h3>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {reward.amountToman.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-text-secondary">
                    toman total
                  </span>
                </p>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  {reward.completedCount}/{reward.taskIds.length} complete · Due{" "}
                  {new Date(reward.deadline).toLocaleString()}
                </p>
                <p className="mt-1 text-xs font-medium text-brand">
                  {expired
                    ? "Deadline passed"
                    : reward.status === "APPROVED"
                      ? "Approved · eligible for reward"
                      : reward.status === "CANCELLED"
                        ? "Cancelled"
                        : "Awaiting completion and admin approval"}
                </p>
                <details className="mt-2 text-xs text-text-secondary">
                  <summary className="cursor-pointer py-1">Included tasks</summary>
                  <ul className="mt-1 grid gap-1">
                    {reward.taskIds.map((id) => (
                      <li key={id} className="break-words">
                        {reward.includedTasks.find((task) => task.id === id)?.title ??
                          "Task outside the current board"}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
              {canManage && reward.status === "ACTIVE" ? (
                <div className="flex items-center gap-2 sm:self-center">
                  <AppButton
                    size="sm"
                    disabled={
                      disabled ||
                      action.isPending ||
                      expired ||
                      reward.completedCount !== reward.taskIds.length
                    }
                    onClick={() => action.mutate({ reward, action: "approve" })}
                  >
                    Approve reward
                  </AppButton>
                  <AppButton
                    size="sm"
                    variant="ghost"
                    disabled={disabled || action.isPending}
                    onClick={() => action.mutate({ reward, action: "cancel" })}
                  >
                    Cancel
                  </AppButton>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {open ? (
        <RewardForm
          projectId={projectId}
          tasks={tasks}
          disabled={disabled}
          onClose={() => setOpen(false)}
          onSaved={refresh}
        />
      ) : null}
    </section>
  );
}

/** Purpose: Collect a total reward and stable task versions. Inputs: Project/tasks and callbacks. Output: Creation dialog. Side effects: Sends one atomic creation request. */
function RewardForm({
  projectId,
  tasks,
  disabled,
  onClose,
  onSaved,
}: {
  projectId: string;
  tasks: TaskDto[];
  disabled: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("12:00");
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const available = tasks.filter(
    (task) => !task.rewardId && !task.archivedAt && task.status !== "DONE",
  );
  const create = useMutation({
    mutationFn: (input: CreateTaskRewardInput) =>
      apiMutation("post", `/api/projects/${projectId}/rewards`, input),
    onSuccess: async () => {
      await onSaved();
      onClose();
      AppToast("Task reward created", "success");
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });
  return (
    <AppDialog
      open
      onOpenChange={(value) => {
        if (!value && !create.isPending) onClose();
      }}
      title="Create task reward"
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || create.isPending || selected.size < 2) return;
          create.mutate({
            title,
            amountToman: Number(amount),
            deadline: new Date(`${deadline}T${deadlineTime}`).toISOString(),
            tasks: Array.from(selected, ([id, version]) => ({ id, version })),
          });
        }}
      >
        <p className="text-sm leading-6 text-text-secondary">
          The total is earned only after an admin approves every selected task before the
          deadline. Payment is handled outside the app.
        </p>
        <AppInput
          label="Reward title"
          required
          maxLength={100}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={create.isPending}
        />
        <AppInput
          label="Total amount (toman)"
          type="number"
          min={1}
          max={1_000_000_000_000}
          step={1}
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={create.isPending}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AppDatePicker
            label="Approval date"
            required
            value={deadline}
            onValueChange={setDeadline}
            disabled={create.isPending}
          />
          <AppTimePicker
            label="Approval time"
            value={deadlineTime}
            onValueChange={(value) => setDeadlineTime(value ?? "12:00")}
            disabled={create.isPending}
          />
          <p className="text-xs text-text-tertiary sm:col-span-2">
            Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </p>
        </div>
        <fieldset disabled={create.isPending} className="min-w-0">
          <legend className="mb-2 text-sm font-medium">
            Select tasks · {selected.size} selected (2–100)
          </legend>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {available.map((task) => (
              <label
                key={task.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 p-3 text-sm hover:bg-surface-muted"
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-[var(--brand)]"
                  checked={selected.has(task.id)}
                  disabled={!selected.has(task.id) && selected.size >= 100}
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = new Map(current);
                      if (event.target.checked) next.set(task.id, task.version);
                      else next.delete(task.id);
                      return next;
                    })
                  }
                />
                <span className="min-w-0 break-words">{task.title}</span>
              </label>
            ))}
          </div>
          {available.length < 2 ? (
            <p className="mt-2 text-sm text-text-secondary">
              Create at least two unfinished tasks without an existing reward.
            </p>
          ) : null}
        </fieldset>
        <AppButton
          type="submit"
          disabled={disabled || create.isPending || selected.size < 2}
        >
          {create.isPending ? "Creating…" : `Create reward for ${selected.size} tasks`}
        </AppButton>
      </form>
    </AppDialog>
  );
}
