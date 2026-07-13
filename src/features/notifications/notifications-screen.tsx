"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { AppButton } from "@/components/ui/app-button";
import { AppPagination } from "@/components/ui/app-pagination";
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
      if (input.action === "accept") {
        router.push(`/projects/${input.projectId}` as Route);
      }
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });
  const notifications = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section id="notifications" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {compact ? (
          <div>
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Invitations, assignments, and reminders.
            </p>
          </div>
        ) : (
          <p className="text-sm text-text-secondary" aria-live="polite">
            {notifications.filter((notification) => !notification.readAt).length} unread
            on this page
          </p>
        )}
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
                    invitation.mutate(input);
                  }}
                />
              ) : null}
              {notification.href &&
              !(
                notification.type === "PROJECT_INVITATION" &&
                notification.href.includes("?invitation=")
              ) ? (
                <Link
                  className="mt-2 inline-flex min-h-11 min-w-11 items-center justify-center text-sm font-semibold text-brand hover:underline"
                  href={notification.href as Route}
                >
                  Open
                </Link>
              ) : null}
            </article>
          ))}
          <AppPagination
            hasNext={Boolean(query.hasNextPage)}
            pending={query.isFetchingNextPage}
            label="Load older notifications"
            pendingLabel="Loading older notifications…"
            onNext={() => void query.fetchNextPage()}
          />
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

/**
 * Purpose: Render valid project-invitation response actions from a safe deep link.
 * Inputs: Notification, disabled state, and controlled transition callback.
 * Output: Accept/decline controls or null for unrelated/malformed notifications.
 * Side effects: Invokes the selected invitation transition.
 */
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
    <main className="mx-auto grid max-w-3xl gap-5 p-5 md:p-8">
      <PageHeader
        title="Notifications"
        description="Invitations, assignments, and reminders."
      />
      <NotificationsPanel />
    </main>
  );
}
