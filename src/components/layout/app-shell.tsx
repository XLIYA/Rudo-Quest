"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sun,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import RudoMark from "@/assets/brand/rudo-mark.svg";
import { OfflineStatusToast } from "@/components/shared/offline-status-toast";
import { AppToast } from "@/components/ui/app-toast";
import { useOnline } from "@/hooks/use-online";
import { AppAvatar } from "@/components/ui/app-avatar";
import { AppIconButton } from "@/components/ui/app-icon-button";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { clearUserQueryCache } from "@/lib/pwa/query-persistence";
import { cn } from "@/lib/utils/cn";
import { useNotifications } from "@/features/notifications/notification-hooks";
import { unsubscribeCurrentBrowserFromPush } from "@/lib/pwa/push";
import type { NotificationPageDto, ProfileDto } from "@/types/domain";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/weekly", label: "Weekly", icon: CalendarDays },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
] as const;

type NavProfile = Pick<
  ProfileDto,
  "id" | "displayName" | "handle" | "avatarPath" | "themePreference"
>;

/**
 * Purpose: Provide React's hydration snapshot hook with a stable no-op subscription.
 * Inputs: Store-change callback supplied by React.
 * Output: No-op unsubscribe callback.
 * Side effects: None.
 */
function subscribeToHydration(): () => void {
  return () => undefined;
}

/**
 * Purpose: Report that browser hydration has completed.
 * Inputs: None.
 * Output: True for post-hydration browser renders.
 * Side effects: None.
 */
function readHydratedClient(): boolean {
  return true;
}

/**
 * Purpose: Keep protected query screens in their deterministic shell during SSR/hydration.
 * Inputs: None.
 * Output: False for the server snapshot and first hydration render.
 * Side effects: None.
 */
function readHydratedServer(): boolean {
  return false;
}

/**
 * Purpose: Render responsive protected navigation, account actions, theme controls, and the global offline state.
 * Inputs: Protected route children and the server-verified initial profile.
 * Output: Collapsible desktop shell and five-item mobile navigation.
 * Side effects: Reads profile/notifications and can sign out or persist a theme preference.
 * Failure behavior: Keeps navigation usable when profile or notification data is unavailable.
 */
export function AppShell({
  children,
  initialProfile,
  initialNotifications,
}: {
  children: React.ReactNode;
  initialProfile: NavProfile;
  initialNotifications: NotificationPageDto;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    readHydratedClient,
    readHydratedServer,
  );
  const online = useOnline();
  const [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const firstAccountItemRef = useRef<HTMLAnchorElement>(null);
  const profile = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<NavProfile>("/api/me", signal),
    initialData: initialProfile,
    staleTime: 60_000,
  });
  const notifications = useNotifications(initialNotifications);
  const unreadCount = notifications.data?.pages[0]?.unreadCount ?? 0;
  const signOut = useMutation({
    mutationFn: async () => {
      try {
        await unsubscribeCurrentBrowserFromPush();
      } catch {
        // Push cleanup is best effort; signing out must still clear the local session.
      }
      return apiMutation("post", "/api/auth/signout");
    },
    onSuccess: async () => {
      if (profile.data?.id) await clearUserQueryCache(profile.data.id);
      queryClient.clear();
      router.push("/login");
      router.refresh();
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });
  const saveTheme = useMutation({
    mutationFn: (nextTheme: "system" | "light" | "dark") =>
      apiMutation<NavProfile>("patch", "/api/me/preferences", {
        themePreference: nextTheme,
      }),
    onMutate: (nextTheme) => {
      const previousTheme = profile.data?.themePreference ?? "system";
      setTheme(nextTheme);
      return { previousTheme };
    },
    onSuccess: (data) => queryClient.setQueryData(queryKeys.me, data),
    onError: (error, _nextTheme, context) => {
      setTheme(context?.previousTheme ?? "system");
      AppToast(normalizeApiClientError(error).message, "error");
    },
  });

  /**
   * Purpose: Apply and persist an explicit theme selection.
   * Inputs: System, light, or dark preference.
   * Output: Void.
   * Side effects: Starts the optimistic preference mutation.
   */
  const setPreferredTheme = (nextTheme: "system" | "light" | "dark") => {
    saveTheme.mutate(nextTheme);
  };

  useEffect(() => {
    if (profile.data?.themePreference) setTheme(profile.data.themePreference);
  }, [profile.data?.themePreference, setTheme]);

  useEffect(() => {
    if (!accountOpen) return;
    const focusFrame = window.requestAnimationFrame(() =>
      firstAccountItemRef.current?.focus(),
    );
    /**
     * Purpose: Close the account menu with Escape and restore trigger focus.
     * Inputs: Keyboard event.
     * Output: Void.
     * Side effects: Updates menu state and focus.
     */
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        accountTriggerRef.current?.focus();
      }
    };
    /**
     * Purpose: Close the account menu when pointer input occurs outside it.
     * Inputs: Pointer event.
     * Output: Void.
     * Side effects: Updates menu state.
     */
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target))
        setAccountOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [accountOpen]);

  return (
    <div
      className={cn(
        "min-h-dvh bg-background text-text-primary md:grid",
        collapsed ? "md:grid-cols-[4.5rem_1fr]" : "md:grid-cols-[15rem_1fr]",
      )}
    >
      <OfflineStatusToast />
      <aside className="sticky top-0 hidden h-screen border-r border-border bg-surface p-3 md:flex md:flex-col">
        <div
          className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "justify-between gap-2",
          )}
        >
          <Link
            href="/dashboard"
            aria-label="Rudo Quest dashboard"
            className="inline-flex min-h-11 shrink-0 items-center"
          >
            {collapsed ? (
              <Image src={RudoMark} alt="" className="size-10" priority />
            ) : (
              <span
                className="inline-flex items-center gap-2"
                style={{ fontFamily: "var(--font-bitcount-ink)" }}
              >
                <Image src={RudoMark} alt="" className="size-8" priority />
                <span className="text-xl font-medium">Rudo Quest</span>
              </span>
            )}
          </Link>
          {!collapsed ? (
            <AppIconButton label="Collapse sidebar" onClick={() => setCollapsed(true)}>
              <PanelLeftClose className="size-5" aria-hidden="true" />
            </AppIconButton>
          ) : null}
        </div>
        {collapsed ? (
          <AppIconButton
            className="mt-4"
            label="Expand sidebar"
            onClick={() => setCollapsed(false)}
          >
            <PanelLeftOpen className="size-5" aria-hidden="true" />
          </AppIconButton>
        ) : null}
        <nav className="mt-8 grid gap-1" aria-label="Primary">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  collapsed ? "justify-center px-0" : null,
                  active ? "bg-brand-soft text-brand" : null,
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                {!collapsed ? item.label : null}
                {hydrated && item.href === "/notifications" && unreadCount > 0 ? (
                  <span
                    className={cn(
                      "inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1 font-mono text-[10px] text-white",
                      collapsed ? "absolute right-1 top-1" : "ml-auto",
                    )}
                    aria-label={`${unreadCount} unread notifications`}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-2">
          <div
            ref={accountMenuRef}
            className={cn("relative", collapsed ? "flex justify-center" : null)}
          >
            <button
              ref={accountTriggerRef}
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              aria-controls="account-menu"
              aria-label="Open account menu"
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md p-2 text-left hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-brand",
                collapsed ? "justify-center" : "w-full",
              )}
            >
              <AppAvatar
                name={profile.data?.displayName ?? "Rudo user"}
                src={profile.data?.avatarPath}
                className="size-8"
              />
              {!collapsed ? (
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {profile.data?.displayName ?? "Account"}
                </span>
              ) : null}
              {!collapsed ? <ChevronDown className="size-4" aria-hidden="true" /> : null}
            </button>
            {accountOpen ? (
              <div
                id="account-menu"
                role="menu"
                aria-label="Account"
                className={cn(
                  "absolute bottom-full z-40 mb-2 grid min-w-56 gap-1 rounded-md border border-border bg-surface p-2 shadow-[var(--shadow-overlay)]",
                  collapsed ? "left-0" : "inset-x-0",
                )}
              >
                <Link
                  ref={firstAccountItemRef}
                  role="menuitem"
                  href="/profile"
                  className="rounded-sm px-3 py-2 text-sm hover:bg-surface-muted"
                  onClick={() => setAccountOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  role="menuitem"
                  href="/settings"
                  className="rounded-sm px-3 py-2 text-sm hover:bg-surface-muted"
                  onClick={() => setAccountOpen(false)}
                >
                  Settings
                </Link>
                <div className="grid grid-cols-3 gap-1 border-t border-border pt-1">
                  <AppIconButton
                    role="menuitemradio"
                    aria-checked={theme === "system"}
                    label="Use system theme"
                    disabled={!online}
                    className={
                      theme === "system" ? "bg-brand-soft text-brand" : undefined
                    }
                    onClick={() => setPreferredTheme("system")}
                  >
                    <Menu className="size-4" aria-hidden="true" />
                  </AppIconButton>
                  <AppIconButton
                    role="menuitemradio"
                    aria-checked={theme === "light"}
                    label="Use light theme"
                    disabled={!online}
                    className={theme === "light" ? "bg-brand-soft text-brand" : undefined}
                    onClick={() => setPreferredTheme("light")}
                  >
                    <Sun className="size-4" aria-hidden="true" />
                  </AppIconButton>
                  <AppIconButton
                    role="menuitemradio"
                    aria-checked={theme === "dark"}
                    label="Use dark theme"
                    disabled={!online}
                    className={theme === "dark" ? "bg-brand-soft text-brand" : undefined}
                    onClick={() => setPreferredTheme("dark")}
                  >
                    <Moon className="size-4" aria-hidden="true" />
                  </AppIconButton>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="flex min-h-11 items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-error hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-error"
                  disabled={signOut.isPending}
                  onClick={() => signOut.mutate()}
                >
                  <LogOut className="size-4" aria-hidden="true" /> Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
      <div className="min-w-0 pb-[calc(6rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] md:pb-0 md:pl-0 md:pr-0 md:pt-0">
        {hydrated ? (
          children
        ) : (
          <main
            className="mx-auto max-w-7xl p-5 md:p-8"
            aria-busy="true"
            aria-label="Loading page"
          >
            <AppSkeleton className="h-[32rem] w-full" />
          </main>
        )}
        <Link
          href="/weekly?quickAdd=1"
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-30 inline-flex size-14 items-center justify-center rounded-lg bg-brand text-white shadow-[var(--shadow-raised)] md:hidden"
          aria-label="Add task"
        >
          <Plus className="size-6" aria-hidden="true" />
        </Link>
        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] pl-[calc(0.25rem+env(safe-area-inset-left))] pr-[calc(0.25rem+env(safe-area-inset-right))] backdrop-blur md:hidden"
          aria-label="Mobile primary"
        >
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-semibold text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand",
                  active ? "text-brand" : null,
                )}
              >
                <item.icon className="size-5" aria-hidden="true" />
                <span>{item.label}</span>
                {hydrated && item.href === "/notifications" && unreadCount > 0 ? (
                  <span
                    className="absolute right-1/4 top-2 inline-flex size-4 items-center justify-center rounded-full bg-brand font-mono text-[9px] text-white"
                    aria-label={`${unreadCount} unread notifications`}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
