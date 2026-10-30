"use client";

import { Bell, Check, CheckCheck, GitPullRequest, UserPlus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { MouseEvent } from "react";
import { BidiText } from "@/components/shared/bidi-text";
import { AppStateLogo } from "@/components/ui/app-empty-state";
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
  onNavigate,
}: {
  items: NotificationDto[];
  unreadCount: number;
  loading: boolean;
  error: boolean;
  online: boolean;
  reading: boolean;
  onRetry: () => void;
  onRead: (id: string) => void;
  onNavigate: (href: Route) => void;
}) {
  const navigateFromPreview = (event: MouseEvent<HTMLAnchorElement>, href: Route) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onNavigate(href);
  };

  return (
    <section
      id="notification-preview"
      aria-label="Notification preview"
      className="app-enter fixed start-[calc(0.5rem+env(safe-area-inset-left))] end-[calc(0.5rem+env(safe-area-inset-right))] top-[calc(3.75rem+env(safe-area-inset-top))] z-[60] mx-auto flex max-h-[min(34rem,calc(100dvh-4.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] w-auto max-w-[26rem] flex-col overflow-x-hidden overflow-y-hidden rounded-xl border-2 border-border bg-surface shadow-[var(--shadow-overlay)] md:absolute md:start-auto md:end-0 md:top-full md:mx-0 md:mt-2 md:max-h-[min(34rem,calc(100dvh-7rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] md:w-[26rem]"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-border px-3 py-2.5 sm:px-4 sm:py-3">
        <div>
          <h2 className="text-sm font-bold">Notifications</h2>
          <p className="text-xs text-text-secondary" aria-live="polite">
            {unreadCount ? `${unreadCount} unread` : "You are all caught up"}
          </p>
        </div>
        <Link
          href="/notifications"
          onClick={(event) => navigateFromPreview(event, "/notifications")}
          className="inline-flex min-h-11 items-center rounded-md border-2 border-border bg-surface-muted px-3 text-xs font-bold text-text-primary hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          View All
        </Link>
      </header>
      {loading ? (
        <p className="p-4 text-sm text-text-secondary" role="status">
          Loading notifications…
        </p>
      ) : error ? (
        <div className="flex items-start gap-3 p-4">
          <AppStateLogo size={32} />
          <p className="text-sm text-text-secondary">
            Notifications could not be loaded.
          </p>
          <div className="ms-auto">
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 text-xs font-bold text-brand underline"
            >
              Try again
            </button>
          </div>
        </div>
      ) : items.length ? (
        <div
          className="min-h-0 flex-1 divide-y divide-border overflow-x-hidden overflow-y-auto overscroll-contain"
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
                        onClick={(event) =>
                          navigateFromPreview(event, notification.href as Route)
                        }
                        className="inline-flex min-h-11 items-center text-xs font-bold text-brand underline"
                      >
                        Open
                      </Link>
                    ) : null}
                  </div>
                </div>
                {unread ? (
                  <AppIconButton
                    label={`Mark ${notification.title} as read`}
                    className="size-11 min-h-11 min-w-11"
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
        <div className="flex items-center gap-3 p-4 text-sm text-text-secondary">
          <AppStateLogo size={32} />
          <p>
            No notifications yet. Assignments and project invitations will appear here.
          </p>
        </div>
      )}
    </section>
  );
}
