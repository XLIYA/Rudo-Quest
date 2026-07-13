"use client";

import Link from "next/link";
import type { Route } from "next";
import { AppButton } from "@/components/ui/app-button";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { useNotifications, useReadNotifications } from "./notification-hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { AppToast } from "@/components/ui/app-toast";
import type { NotificationDto } from "@/types/domain";
import { useOnline } from "@/hooks/use-online";

/**
 * Purpose: Render notification center content with optimistic read actions.
 * Inputs: Optional compact mode for embedding in profile.
 * Output: Notification center UI section.
 * Side effects: Fetches and mutates notifications.
 */
export function NotificationsPanel({ compact = false }: { compact?: boolean }) {
  const query = useNotifications();
  const online = useOnline();
  const read = useReadNotifications();
  const queryClient = useQueryClient();
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
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });
  const notifications = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section
      id="notifications"
      className={compact ? "grid gap-4" : "mx-auto grid max-w-3xl gap-5 p-5 md:p-8"}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={compact ? "text-lg font-semibold" : "text-2xl font-semibold"}>
            Notifications
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Invitations, assignments, and reminders.
          </p>
        </div>
        <AppButton
          variant="secondary"
          onClick={() => read.mutate({ all: true })}
          disabled={!online || read.isPending || !notifications.length}
        >
          Mark all read
        </AppButton>
      </div>
      {query.isLoading ? <AppSkeleton className="h-64" /> : null}
      {query.isError ? (
        <AppEmptyState
          title="Notifications unavailable"
          description="The notification center could not be loaded."
          action={
            <AppButton variant="secondary" onClick={() => void query.refetch()}>
              Try again
            </AppButton>
          }
        />
      ) : null}
      {!query.isError && notifications.length ? (
        <section className="grid gap-2">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{notification.title}</h2>
                  {notification.body ? (
                    <p className="mt-1 text-sm text-text-secondary">
                      {notification.body}
                    </p>
                  ) : null}
                  <p className="mt-2 font-mono text-xs text-text-tertiary">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notification.readAt ? (
                  <AppButton
                    size="sm"
                    variant="secondary"
                    onClick={() => read.mutate({ id: notification.id })}
                    disabled={!online || read.isPending}
                  >
                    Read
                  </AppButton>
                ) : null}
              </div>
              {notification.type === "PROJECT_INVITATION" ? (
                <InvitationActions
                  notification={notification}
                  disabled={!online || invitation.isPending}
                  onAction={(input) => {
                    read.mutate({ id: notification.id });
                    invitation.mutate(input);
                  }}
                />
              ) : null}
              {notification.href ? (
                <Link
                  className="mt-3 inline-flex text-sm font-semibold text-brand"
                  href={notification.href as Route}
                >
                  Open
                </Link>
              ) : null}
            </article>
          ))}
          {query.hasNextPage ? (
            <AppButton
              variant="secondary"
              onClick={() => void query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
            >
              {query.isFetchingNextPage ? "Loading…" : "Load older notifications"}
            </AppButton>
          ) : null}
        </section>
      ) : null}
      {!query.isError && query.data && !notifications.length ? (
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
    <div className="mt-3 flex flex-wrap gap-2">
      <AppButton
        size="sm"
        disabled={disabled}
        onClick={() =>
          onAction({ projectId: match[1]!, invitationId: match[2]!, action: "accept" })
        }
      >
        Accept invitation
      </AppButton>
      <AppButton
        size="sm"
        variant="secondary"
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

/**
 * Purpose: Render the full notification center page.
 * Inputs: None.
 * Output: Notification center UI.
 * Side effects: Fetches and mutates notifications.
 */
export function NotificationsScreen() {
  return (
    <main className="grid gap-5">
      <PageHeader
        title="Notifications"
        description="Invitations, assignments, and reminders."
      />
      <NotificationsPanel />
    </main>
  );
}
