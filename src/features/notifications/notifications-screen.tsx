"use client";

import Link from "next/link";
import type { Route } from "next";
import { AppButton } from "@/components/ui/app-button";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { useNotifications, useReadNotifications } from "./notification-hooks";

/**
 * Purpose: Render notification center content with optimistic read actions.
 * Inputs: Optional compact mode for embedding in profile.
 * Output: Notification center UI section.
 * Side effects: Fetches and mutates notifications.
 */
export function NotificationsPanel({ compact = false }: { compact?: boolean }) {
  const query = useNotifications();
  const read = useReadNotifications();
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
          disabled={read.isPending || !query.data?.length}
        >
          Mark all read
        </AppButton>
      </div>
      {query.isLoading ? <AppSkeleton className="h-64" /> : null}
      {query.data?.length ? (
        <section className="grid gap-2">
          {query.data.map((notification) => (
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
                  >
                    Read
                  </AppButton>
                ) : null}
              </div>
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
        </section>
      ) : null}
      {query.data && !query.data.length ? (
        <AppEmptyState
          title="No notifications"
          description="Assignments and project invitations will appear here."
        />
      ) : null}
    </section>
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
