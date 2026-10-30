"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Circle,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  Sun,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { OfflineStatusToast } from "@/components/shared/offline-status-toast";
import { BidiText } from "@/components/shared/bidi-text";
import { AppToast } from "@/components/ui/app-toast";
import { AppAvatar } from "@/components/ui/app-avatar";
import { AppIconButton } from "@/components/ui/app-icon-button";
import { useOnline } from "@/hooks/use-online";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { clearUserQueryCache } from "@/lib/pwa/query-persistence";
import { unsubscribeCurrentBrowserFromPush } from "@/lib/pwa/push";
import { getProjectColor } from "@/lib/theme/project-colors";
import { cn } from "@/lib/utils/cn";
import {
  useNotifications,
  useReadNotifications,
} from "@/features/notifications/notification-hooks";
import { NotificationPreview } from "@/features/notifications/notification-preview";
import { useAssignedTasks } from "@/features/tasks/task-hooks";
import type {
  NotificationPageDto,
  ProjectColorKey,
  ProfileDto,
  TaskDto,
} from "@/types/domain";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    mobileLabel: "Dashboard",
    icon: LayoutDashboard,
  },
  { href: "/weekly", label: "Weekly", mobileLabel: "Weekly", icon: CalendarDays },
  { href: "/projects", label: "Projects", mobileLabel: "Projects", icon: FolderKanban },
] as const;

const mobileNavItems = [
  ...navItems,
  {
    href: "/notifications",
    label: "Notifications",
    mobileLabel: "Notifications",
    icon: Bell,
  },
  { href: "/profile", label: "Profile", mobileLabel: "Profile", icon: User },
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
 * Purpose: Render the protected application shell with topbar and assigned-task navigation.
 * Inputs: Protected route children and optional server-verified shell data.
 * Output: Responsive topbar, collapsible task sidebar, and route content.
 * Side effects: Reads profile, notifications, and assigned tasks; can sign out or persist theme preferences.
 * Failure behavior: Keeps navigation usable when profile, notification, or task data is unavailable.
 */
export function AppShell({
  children,
  initialProfile,
  initialNotifications,
}: {
  children: React.ReactNode;
  initialProfile?: NavProfile;
  initialNotifications?: NotificationPageDto;
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
  const [collapsed, setCollapsed] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const firstAccountItemRef = useRef<HTMLAnchorElement>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const profile = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<NavProfile>("/api/me", signal),
    staleTime: 60_000,
    ...(initialProfile ? { initialData: initialProfile } : undefined),
  });
  const displayedProfile = hydrated ? profile.data : initialProfile;
  const notifications = useNotifications(initialNotifications);
  const readNotifications = useReadNotifications();
  const assignedTasks = useAssignedTasks();
  const unreadCount = notifications.data?.pages[0]?.unreadCount ?? 0;
  const notificationItems = notifications.data?.pages[0]?.items.slice(0, 5) ?? [];
  const assignedTaskGroups = useMemo(
    () => groupAssignedTasks(assignedTasks.data ?? []),
    [assignedTasks.data],
  );
  const showQuickAdd =
    pathname.startsWith("/dashboard") || pathname.startsWith("/weekly");
  const lockContentScroll = pathname.startsWith("/dashboard");
  const sidebarExpanded = !collapsed || mobileSidebarOpen;

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
      const previousTheme = profile.data?.themePreference ?? "dark";
      setTheme(nextTheme);
      return { previousTheme };
    },
    onSuccess: (data) => queryClient.setQueryData(queryKeys.me, data),
    onError: (error, _nextTheme, context) => {
      setTheme(context?.previousTheme ?? "dark");
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

  /**
   * Purpose: Toggle the notification preview and refresh its first page on open.
   * Inputs: None.
   * Output: Void.
   * Side effects: Opens the notification preview and starts a network refresh.
   */
  const toggleNotificationPreview = () => {
    setNotificationOpen((open) => {
      if (!open) void notifications.refetch();
      return !open;
    });
  };

  /**
   * Purpose: Toggle desktop sidebar width or the mobile task drawer.
   * Inputs: None.
   * Output: Void.
   * Side effects: Updates responsive navigation state.
   */
  const toggleMobileSidebar = () => {
    setMobileSidebarOpen((value) => !value);
  };

  useEffect(() => {
    if (profile.data?.themePreference) setTheme(profile.data.themePreference);
  }, [profile.data?.themePreference, setTheme]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeMobileSidebar = () => {
      if (desktop.matches) setMobileSidebarOpen(false);
    };
    desktop.addEventListener("change", closeMobileSidebar);
    return () => desktop.removeEventListener("change", closeMobileSidebar);
  }, []);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (!notificationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationOpen(false);
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !notificationPanelRef.current?.contains(event.target)
      ) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [notificationOpen]);

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
     * Purpose: Cycle menuitem focus with arrow keys per menu keyboard convention.
     * Inputs: Keyboard event.
     * Output: Void.
     * Side effects: Moves focus between focusable menu items.
     */
    const moveMenuFocus = (event: KeyboardEvent) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const menu = accountMenuRef.current;
      if (!menu) return;
      const items = Array.from(
        menu.querySelectorAll<HTMLElement>("[role='menuitem'], [role='menuitemradio']"),
      ).filter((item) => !item.hasAttribute("disabled"));
      if (!items.length) return;
      event.preventDefault();
      const currentIndex = items.findIndex((item) => item === document.activeElement);
      const nextIndex =
        event.key === "ArrowDown"
          ? (currentIndex + 1 + items.length) % items.length
          : (currentIndex - 1 + items.length) % items.length;
      items[nextIndex]?.focus();
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
    document.addEventListener("keydown", moveMenuFocus);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("keydown", moveMenuFocus);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [accountOpen]);

  return (
    <div
      data-shell-hydrated={hydrated ? "true" : undefined}
      className={cn(
        "grid h-dvh min-h-0 min-w-0 grid-rows-[calc(4.25rem+env(safe-area-inset-top))_minmax(0,1fr)] overflow-clip bg-background text-text-primary md:transition-[grid-template-columns] md:duration-300 md:ease-out",
        collapsed
          ? "md:grid-cols-[4.5rem_minmax(0,1fr)]"
          : "md:grid-cols-[21rem_minmax(0,1fr)]",
      )}
    >
      <OfflineStatusToast />
      <header className="relative z-50 col-span-full flex min-w-0 items-center justify-between gap-3 border-b-2 border-border bg-surface ps-[calc(0.75rem+env(safe-area-inset-left))] pe-[calc(0.75rem+env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] pb-2 sm:ps-5 sm:pe-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <AppIconButton
            label={mobileSidebarOpen ? "Close task sidebar" : "Open task sidebar"}
            aria-expanded={mobileSidebarOpen}
            aria-controls="assigned-task-sidebar"
            className="md:hidden"
            onClick={toggleMobileSidebar}
          >
            {mobileSidebarOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </AppIconButton>
          <Link
            href="/dashboard"
            aria-label="Rudo Quest dashboard"
            className="inline-flex min-h-11 min-w-0 shrink-0 items-center gap-2 rounded-lg"
          >
            <Image
              src="/branding/rudo-logo.png"
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0 rounded-md"
              priority
            />
            <span className="truncate font-display text-lg font-medium sm:text-xl">
              Rudo Quest
            </span>
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div ref={notificationPanelRef} className="relative">
            <button
              type="button"
              aria-label={
                unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
              }
              aria-expanded={notificationOpen}
              aria-controls="notification-preview"
              onClick={toggleNotificationPreview}
              className="relative inline-flex size-11 items-center justify-center rounded-md border-2 border-transparent text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Bell className="size-5" aria-hidden="true" />
              {unreadCount > 0 ? (
                <span className="absolute end-0 top-0 inline-flex min-w-4 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-brand px-1 font-mono text-[9px] text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>
            {notificationOpen ? (
              <NotificationPreview
                items={notificationItems}
                unreadCount={unreadCount}
                loading={notifications.isLoading || notifications.isFetching}
                error={notifications.isError}
                online={online}
                reading={readNotifications.isPending}
                onRetry={() => void notifications.refetch()}
                onRead={(id) => readNotifications.mutate({ id })}
                onClose={() => setNotificationOpen(false)}
              />
            ) : null}
          </div>
          <div ref={accountMenuRef} className="relative">
            <button
              ref={accountTriggerRef}
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              aria-controls="account-menu"
              aria-label="Open account menu"
              className="flex min-h-11 items-center gap-2 rounded-md border-2 border-border bg-surface px-2 text-start transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-brand sm:px-3"
            >
              <AppAvatar
                name={displayedProfile?.displayName ?? "Rudo user"}
                src={displayedProfile?.avatarPath}
                className="size-8"
              />
              <span className="hidden max-w-36 sm:block">
                <BidiText className="block truncate text-sm font-semibold">
                  {displayedProfile?.displayName ?? "Account"}
                </BidiText>
                {displayedProfile?.handle ? (
                  <BidiText
                    className="block truncate font-mono text-[10px] text-text-tertiary"
                    direction="ltr"
                  >
                    @{displayedProfile.handle}
                  </BidiText>
                ) : null}
              </span>
              <ChevronDown className="hidden size-4 sm:block" aria-hidden="true" />
            </button>
            {accountOpen ? (
              <div
                id="account-menu"
                role="menu"
                aria-label="Account"
                className="app-enter absolute end-0 top-full z-50 mt-2 grid min-w-60 gap-1 rounded-xl border-2 border-border bg-surface p-2 shadow-[var(--shadow-overlay)]"
              >
                <Link
                  ref={firstAccountItemRef}
                  role="menuitem"
                  href="/profile"
                  className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-muted hover:text-text-primary"
                  onClick={() => setAccountOpen(false)}
                >
                  <User className="size-4" aria-hidden="true" /> Profile
                </Link>
                <Link
                  role="menuitem"
                  href="/settings"
                  className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-muted hover:text-text-primary"
                  onClick={() => setAccountOpen(false)}
                >
                  <Settings2 className="size-4" aria-hidden="true" /> Settings
                </Link>
                <div className="grid grid-cols-3 gap-1 border-t-2 border-border pt-1">
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
                    <Monitor className="size-4" aria-hidden="true" />
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
                  className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-start text-sm text-error hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-error"
                  disabled={signOut.isPending}
                  onClick={() => signOut.mutate()}
                >
                  <LogOut className="size-4" aria-hidden="true" /> Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {mobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close task sidebar"
          className="fixed inset-x-0 top-[calc(4.25rem+env(safe-area-inset-top))] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 bg-black/55 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}
      <aside
        id="assigned-task-sidebar"
        aria-label="Task and primary navigation"
        className={cn(
          "min-h-0 flex-col border-e-2 border-border bg-surface p-3 md:flex md:h-full md:overflow-hidden",
          mobileSidebarOpen
            ? "fixed start-0 top-[calc(4.25rem+env(safe-area-inset-top))] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex w-[min(21rem,88vw)] overflow-y-auto shadow-[var(--shadow-overlay)] md:static md:inset-auto md:w-auto md:shadow-none"
            : "hidden",
          collapsed && !mobileSidebarOpen ? "md:w-[4.5rem]" : "md:w-[21rem]",
        )}
      >
        <div
          className={cn(
            "mb-3 hidden min-h-11 items-center md:flex",
            collapsed ? "justify-center" : "justify-between px-1",
          )}
        >
          {!collapsed ? (
            <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">
              Navigation
            </span>
          ) : null}
          <AppIconButton
            label={collapsed ? "Expand task sidebar" : "Collapse task sidebar"}
            aria-expanded={!collapsed}
            aria-controls="assigned-task-sidebar"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-5" aria-hidden="true" />
            )}
          </AppIconButton>
        </div>
        <nav className="grid shrink-0 gap-1" aria-label="Primary">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                aria-current={active ? "page" : undefined}
                title={!sidebarExpanded ? item.label : undefined}
                onClick={() => setMobileSidebarOpen(false)}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 rounded-md border-2 border-transparent px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  !sidebarExpanded ? "justify-center px-0" : null,
                  active ? "border-border bg-surface-muted text-brand" : null,
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                {sidebarExpanded ? item.label : null}
              </Link>
            );
          })}
        </nav>
        {sidebarExpanded ? (
          <section
            className="mt-5 flex min-h-0 flex-1 flex-col"
            aria-label="Assigned tasks"
          >
            <header className="mb-2 flex items-center justify-between gap-2 px-2">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
                <ListTodo className="size-4" aria-hidden="true" />
                Assigned to me
              </h2>
              <span className="rounded-full border-2 border-border bg-surface-muted px-2 py-0.5 font-mono text-[10px] text-text-secondary">
                {assignedTasks.data?.length ?? 0}
              </span>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1 pb-2 [scrollbar-gutter:stable]">
              {assignedTasks.isLoading ? (
                <p className="px-2 py-3 text-xs text-text-tertiary">
                  Loading assigned tasks…
                </p>
              ) : null}
              {assignedTasks.isError ? (
                <div className="rounded-lg border-2 border-error bg-error-soft p-3">
                  <p className="text-xs text-text-primary">
                    Assigned tasks could not be loaded.
                  </p>
                  <button
                    type="button"
                    className="mt-2 min-h-11 text-xs font-semibold text-error underline"
                    onClick={() => void assignedTasks.refetch()}
                  >
                    Try again
                  </button>
                </div>
              ) : null}
              {!assignedTasks.isLoading &&
              !assignedTasks.isError &&
              assignedTaskGroups.length === 0 ? (
                <p className="rounded-lg border-2 border-border bg-surface-muted p-3 text-xs text-text-secondary">
                  No incomplete tasks assigned to you.
                </p>
              ) : null}
              {assignedTaskGroups.map((group) => (
                <section key={group.key} aria-label={`${group.title} tasks`}>
                  <h3 className="mb-1 flex items-center gap-1.5 px-2 pt-2 text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
                    <Circle
                      className="size-2.5 fill-current"
                      style={
                        group.colorKey
                          ? { color: getProjectColor(group.colorKey).main }
                          : undefined
                      }
                      aria-hidden="true"
                    />
                    <BidiText className="truncate">{group.title}</BidiText>
                    <span className="ms-auto font-mono">{group.tasks.length}</span>
                  </h3>
                  <div className="grid gap-1.5">
                    {group.tasks.map((task) => (
                      <SidebarAssignedTask
                        key={task.id}
                        task={task}
                        onNavigate={() => setMobileSidebarOpen(false)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        ) : null}
      </aside>
      <div
        data-app-content
        className={cn(
          "h-full min-h-0 min-w-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] ps-[env(safe-area-inset-left)] pe-[env(safe-area-inset-right)] md:pb-0 md:ps-0 md:pe-0",
          lockContentScroll
            ? "overflow-y-auto lg:overflow-hidden"
            : "overflow-y-auto [scrollbar-gutter:stable]",
        )}
      >
        {children}
        {showQuickAdd ? (
          <Link
            href="/weekly?quickAdd=1"
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] end-[calc(1.25rem+env(safe-area-inset-right))] z-30 inline-flex size-14 items-center justify-center rounded-lg border-2 border-brand-hover bg-brand text-white shadow-[var(--shadow-raised)] md:hidden"
            aria-label="Add task"
          >
            <Plus className="size-6" aria-hidden="true" />
          </Link>
        ) : null}
        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t-2 border-border bg-surface pb-[env(safe-area-inset-bottom)] ps-[calc(0.25rem+env(safe-area-inset-left))] pe-[calc(0.25rem+env(safe-area-inset-right))] md:hidden"
          aria-label="Mobile primary"
        >
          {mobileNavItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                aria-current={
                  item.href === "/notifications" && notificationOpen
                    ? "page"
                    : active
                      ? "page"
                      : undefined
                }
                aria-label={
                  item.href === "/notifications" && unreadCount > 0
                    ? `Notifications, ${unreadCount} unread`
                    : undefined
                }
                onClick={(event) => {
                  setMobileSidebarOpen(false);
                  if (item.href === "/notifications") {
                    event.preventDefault();
                    toggleNotificationPreview();
                  } else if (item.href === "/profile") {
                    event.preventDefault();
                    setAccountOpen(true);
                  }
                }}
                className={cn(
                  "relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-0 text-[10px] font-semibold text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand",
                  active || (item.href === "/notifications" && notificationOpen)
                    ? "text-brand"
                    : null,
                )}
              >
                <span
                  data-nav-icon
                  className={cn(
                    "relative flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-200",
                    active || (item.href === "/notifications" && notificationOpen)
                      ? "bg-brand-soft text-brand"
                      : "text-text-secondary",
                  )}
                >
                  <item.icon
                    className="size-[19px]"
                    strokeWidth={active ? 2.2 : 1.7}
                    aria-hidden="true"
                  />
                  {item.href === "/notifications" && unreadCount > 0 ? (
                    <span className="absolute end-1 top-0 inline-flex min-w-3.5 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-brand px-1 font-mono text-[8px] text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </span>
                <span className="block max-w-full break-all text-center text-[8px] leading-3 tracking-[-0.04em] min-[360px]:text-[9px] min-[430px]:text-[10px]">
                  {item.mobileLabel}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/**
 * Purpose: Render an assigned task with its project context in the global sidebar.
 * Inputs: Task DTO and navigation callback.
 * Output: Link to the task detail sheet with status, due date, and project.
 * Side effects: Closes the mobile drawer when followed.
 */
function SidebarAssignedTask({
  task,
  onNavigate,
}: {
  task: TaskDto;
  onNavigate: () => void;
}) {
  const href =
    `/weekly?date=${encodeURIComponent(task.scheduledDate)}&task=${encodeURIComponent(task.id)}` as Route;
  const statusLabel =
    task.status === "IN_PROGRESS"
      ? "Doing"
      : task.status === "PENDING_REVIEW"
        ? "Review"
        : "To do";
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={`Open ${task.title}, ${task.project?.title ?? "Personal task"}, ${statusLabel}`}
      className="flex min-h-12 items-center gap-2 rounded-md border border-border bg-surface-muted px-2.5 py-2 transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="min-w-0 flex-1">
        <BidiText className="block truncate text-sm font-semibold text-text-primary">
          {task.title}
        </BidiText>
        <span className="mt-0.5 block truncate font-mono text-[10px] text-text-tertiary">
          {task.scheduledDate}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-1 text-[9px] font-bold uppercase",
          task.status === "TODO"
            ? "bg-surface text-text-secondary"
            : task.status === "IN_PROGRESS"
              ? "bg-brand-soft text-brand"
              : "bg-warning-soft text-warning",
        )}
      >
        {statusLabel}
      </span>
    </Link>
  );
}

type AssignedTaskGroup = {
  key: string;
  title: string;
  colorKey: ProjectColorKey | null;
  tasks: TaskDto[];
};

/**
 * Purpose: Organize assigned tasks into project-specific sidebar sections.
 * Inputs: Incomplete assigned task DTOs.
 * Output: Alphabetized project groups followed by personal tasks.
 * Side effects: None.
 */
function groupAssignedTasks(tasks: TaskDto[]): AssignedTaskGroup[] {
  const groups = new Map<string, AssignedTaskGroup>();
  for (const task of tasks) {
    const key = task.project?.id ?? "personal";
    const group = groups.get(key) ?? {
      key,
      title: task.project?.title ?? "Personal",
      colorKey: task.project?.colorKey ?? null,
      tasks: [],
    };
    group.tasks.push(task);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => {
    if (left.key === "personal") return 1;
    if (right.key === "personal") return -1;
    return left.title.localeCompare(right.title);
  });
}
