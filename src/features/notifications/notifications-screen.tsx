"use client";

import { Bell, Check, CheckCheck, GitPullRequest, UserPlus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { AppButton } from "@/components/ui/app-button";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppIconButton } from "@/components/ui/app-icon-button";
import { AppPagination } from "@/components/ui/app-pagination";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { AppToast } from "@/components/ui/app-toast";
import { useOnline } from "@/hooks/use-online";
import { apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils/cn";
import type { NotificationDto, NotificationType } from "@/types/domain";
import { useNotifications, useReadNotifications } from "./notification-hooks";

const notificationIcons: Record<NotificationType, typeof Bell> = {
  PROJECT_INVITATION: UserPlus,
  INVITATION_ACCEPTED: GitPullRequest,
  TASK_ASSIGNED: Check,
  TASK_DUE_TODAY: Bell,
  DAILY_DIGEST: CheckCheck,
};

/**
 * Purpose: Render a compact, inbox-style notification center with optimistic actions.
 * Inputs: Optional compact mode for embedding.
 * Output: One bordered notification list with toolbar, rows, and pagination.
 * Side effects: Fetches and mutates notifications and project invitations.
 */
export function NotificationsPanel({ compact = false }: { compact?: boolean }) {
  const query = useNotifications();
  const online = useOnline();
  const read = useReadNotifications();
  const queryClient = useQueryClient();
  const router = useRouter();
  const invitation = useMutation({
    mutationFn: (input: {
      projectId: string;
      invitationId: string;
      action: "accept" | "decline";
    }) =>
      apiMutation(
        "post",
        `/api/projects/${input.projectId}/invitations/${input.invitationId}/${input.action}`,
      ),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.project(input.projectId),
      });
      AppToast(
        input.action === "accept" ? "Invitation accepted." : "Invitation declined.",
        "success",
      );
      if (input.action === "accept") router.push(`/projects/${input.projectId}` as Route);
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });
  const notifications = query.data?.pages.flatMap((page) => page.items) ?? [];
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  if (query.isError) {
    return (
      <AppEmptyState
        title="Notifications unavailable"
        description="The notification center could not be loaded."
        action={
          <AppButton variant="secondary" onClick={() => void query.refetch()}>
            Try again
          </AppButton>
        }
      />
    );
  }

  return (
    <section id="notifications" className="app-card overflow-hidden">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/55 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-md bg-quest-soft text-quest">
            <Bell className="size-4" aria-hidden="true" />
          </span>
          <div>
            {compact ? <h2 className="font-semibold">Notifications</h2> : null}
            <p className="text-xs text-text-secondary" aria-live="polite">
              {unreadCount
                ? `${unreadCount} unread on this page`
                : "You are all caught up"}
            </p>
          </div>
        </div>
        <AppButton
          variant="secondary"
          size="sm"
          onClick={() => read.mutate({ all: true })}
          disabled={!online || read.isPending || !unreadCount}
        >
          <CheckCheck className="size-4" aria-hidden="true" /> Mark all read
        </AppButton>
      </header>

      {query.isLoading ? (
        <div className="grid gap-px bg-border" aria-label="Loading notifications">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex gap-3 bg-surface p-4">
              <AppSkeleton className="size-9 shrink-0 rounded-full" />
              <div className="grid flex-1 gap-2">
                <AppSkeleton className="h-4 w-1/3" />
                <AppSkeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!query.isLoading && notifications.length ? (
        <div className="divide-y divide-border">
          {notifications.map((notification) => {
            const Icon = notificationIcons[notification.type];
            const unread = !notification.readAt;
            return (
              <article
                key={notification.id}
                className={cn(
                  "relative grid gap-3 px-4 py-3 transition-colors duration-150 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start",
                  unread ? "bg-quest-soft/55" : "bg-surface hover:bg-surface-muted/60",
                )}
              >
                {unread ? (
                  <span
                    className="absolute left-0 top-0 h-full w-0.5 bg-quest"
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-full border",
                    unread
                      ? "border-quest-muted bg-surface text-quest"
                      : "border-border bg-surface-muted text-text-secondary",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h2 className={cn("text-sm", unread ? "font-bold" : "font-semibold")}>
                      {notification.title}
                    </h2>
                    <span className="font-mono text-[11px] text-text-tertiary">
                      {new Date(notification.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {notification.body ? (
                    <p className="mt-1 text-sm leading-5 text-text-secondary">
                      {notification.body}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {notification.type === "PROJECT_INVITATION" ? (
                      <InvitationActions
                        notification={notification}
                        disabled={!online || invitation.isPending}
                        onAction={(input) => invitation.mutate(input)}
                      />
                    ) : null}
                    {notification.href &&
                    !(
                      notification.type === "PROJECT_INVITATION" &&
                      notification.href.includes("?invitation=")
                    ) ? (
                      <Link
                        className="inline-flex min-h-9 items-center rounded-md px-2 text-xs font-semibold text-quest hover:bg-surface hover:underline"
                        href={notification.href as Route}
                      >
                        Open
                      </Link>
                    ) : null}
                  </div>
                </div>
                {unread ? (
                  <AppIconButton
                    label={`Mark ${notification.title} as read`}
                    className="size-9 min-h-9 min-w-9"
                    onClick={() => read.mutate({ id: notification.id })}
                    disabled={!online || read.isPending}
                  >
                    <Check className="size-4" aria-hidden="true" />
                  </AppIconButton>
                ) : null}
              </article>
            );
          })}
          <div className="p-3">
            <AppPagination
              hasNext={Boolean(query.hasNextPage)}
              pending={query.isFetchingNextPage}
              label="Load older notifications"
              pendingLabel="Loading older notifications…"
              onNext={() => void query.fetchNextPage()}
            />
          </div>
        </div>
      ) : null}

      {!query.isLoading && query.data && !notifications.length ? (
        <AppEmptyState
          title="No notifications"
          description="Assignments and project invitations will appear here."
        />
      ) : null}
    </section>
  );
}

function InvitationActions({
  notification,
  disabled,
  onAction,
}: {
  notification: NotificationDto;
  disabled: boolean;
  onAction: (input: {
    projectId: string;
    invitationId: string;
    action: "accept" | "decline";
  }) => void;
}) {
  const match = notification.href?.match(/^\/projects\/([^?]+)\?invitation=([^&]+)/);
  if (!match?.[1] || !match[2]) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <AppButton
        size="sm"
        aria-label="Accept invitation"
        disabled={disabled}
        onClick={() =>
          onAction({ projectId: match[1]!, invitationId: match[2]!, action: "accept" })
        }
      >
        Accept
      </AppButton>
      <AppButton
        size="sm"
        variant="secondary"
        aria-label="Decline invitation"
        disabled={disabled}
        onClick={() =>
          onAction({ projectId: match[1]!, invitationId: match[2]!, action: "decline" })
        }
      >
        Decline
      </AppButton>
    </div>
  );
}

export function NotificationsScreen() {
  return (
    <main className="app-enter mx-auto grid max-w-5xl gap-5 p-5 md:p-8">
      <PageHeader
        title="Notifications"
        description="Review invitations, assignments, and reminders without the noise."
      />
      <NotificationsPanel />
    </main>
  );
}
