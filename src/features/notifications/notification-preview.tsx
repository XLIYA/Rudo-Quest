"use client";

import { Bell, Check, CheckCheck, GitPullRequest, UserPlus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { BidiText } from "@/components/shared/bidi-text";
import { AppIconButton } from "@/components/ui/app-icon-button";
import { cn } from "@/lib/utils/cn";
import type { NotificationDto, NotificationType } from "@/types/domain";

const notificationIcons: Record<NotificationType, typeof Bell> = {
  PROJECT_INVITATION: UserPlus,
  INVITATION_ACCEPTED: GitPullRequest,
  TASK_ASSIGNED: Check,
  TASK_DUE_TODAY: Bell,
  DAILY_DIGEST: CheckCheck,
};

/**
 * Purpose: Preview recent notifications without leaving the current route.
 * Inputs: First-page notifications, query/mutation state, and panel callbacks.
 * Output: Compact, responsive notification preview with a full-center link.
 * Side effects: Allows optimistic marking of individual notifications as read.
 */
export function NotificationPreview({
  items,
  unreadCount,
  loading,
  error,
  online,
  reading,
  onRetry,
  onRead,
  onClose,
}: {
  items: NotificationDto[];
  unreadCount: number;
  loading: boolean;
  error: boolean;
  online: boolean;
  reading: boolean;
  onRetry: () => void;
  onRead: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <section
      id="notification-preview"
      aria-label="Notification preview"
      className="app-enter absolute end-0 top-full z-[60] mt-2 flex max-h-[min(34rem,calc(100dvh-7rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] w-[min(26rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border-2 border-border bg-surface shadow-[var(--shadow-overlay)]"
    >
      <header className="flex items-center justify-between gap-3 border-b-2 border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-bold">Notifications</h2>
          <p className="text-xs text-text-secondary" aria-live="polite">
            {unreadCount ? `${unreadCount} unread` : "You are all caught up"}
          </p>
        </div>
        <Link
          href="/notifications"
          onClick={onClose}
          className="inline-flex min-h-10 items-center rounded-md border-2 border-border bg-surface-muted px-3 text-xs font-bold text-text-primary hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          View All
        </Link>
      </header>
      {loading ? (
        <p className="p-4 text-sm text-text-secondary" role="status">
          Loading notifications…
        </p>
      ) : error ? (
        <div className="p-4">
          <p className="text-sm text-text-secondary">
            Notifications could not be loaded.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 min-h-10 text-xs font-bold text-brand underline"
          >
            Try again
          </button>
        </div>
      ) : items.length ? (
        <div
          className="min-h-0 divide-y divide-border overflow-y-auto overscroll-contain"
          role="region"
          aria-label="Recent notifications"
        >
          {items.map((notification) => {
            const Icon = notificationIcons[notification.type];
            const unread = notification.readAt === null;
            return (
              <article
                key={notification.id}
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-3 py-3",
                  unread ? "bg-brand-soft/20" : "bg-surface",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-8 items-center justify-center rounded-md",
                    unread
                      ? "bg-brand-soft text-brand"
                      : "bg-surface-muted text-text-tertiary",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <BidiText
                    className={cn(
                      "block truncate text-xs",
                      unread ? "font-bold text-text-primary" : "font-semibold",
                    )}
                  >
                    {notification.title}
                  </BidiText>
                  {notification.body ? (
                    <BidiText className="mt-1 block line-clamp-2 text-xs leading-4 text-text-secondary">
                      {notification.body}
                    </BidiText>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <time
                      dateTime={notification.createdAt}
                      className="font-mono text-[10px] text-text-tertiary"
                    >
                      {new Date(notification.createdAt).toLocaleString()}
                    </time>
                    {notification.href ? (
                      <Link
                        href={notification.href as Route}
                        onClick={onClose}
                        className="text-[10px] font-bold text-brand underline"
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
                    disabled={!online || reading}
                    onClick={() => onRead(notification.id)}
                  >
                    <Check className="size-4" aria-hidden="true" />
                  </AppIconButton>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="p-4 text-sm text-text-secondary">
          No notifications yet. Assignments and project invitations will appear here.
        </p>
      )}
    </section>
  );
}
