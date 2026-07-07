"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, FolderKanban, LayoutDashboard, Plus, Settings, User } from "lucide-react";
import { useTheme } from "next-themes";
import RudoMark from "@/assets/brand/rudo-mark.svg";
import { AppIconButton } from "@/components/ui/app-icon-button";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/weekly", label: "Weekly", icon: CalendarDays },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
] as const;

/**
 * Purpose: Render responsive app navigation around protected content.
 * Inputs: React children.
 * Output: Desktop sidebar, mobile bottom nav, and content region.
 * Side effects: Toggles theme through next-themes.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  return (
    <div className="min-h-screen bg-background text-text-primary md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-border bg-surface p-4 md:block">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image src={RudoMark} alt="" width={36} height={36} />
          <span className="font-display text-2xl">Rudo Quest</span>
        </Link>
        <nav className="mt-8 grid gap-1" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary",
                pathname.startsWith(item.href) ? "bg-brand-soft text-brand" : null,
              )}
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-4 right-4 grid gap-2">
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="min-h-11 rounded-md border border-border text-sm font-semibold"
          >
            {resolvedTheme === "dark" ? "Light" : "Dark"} mode
          </button>
          <Link href="/settings" className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-text-secondary hover:bg-surface-muted">
            <Settings className="size-4" />
            Settings
          </Link>
        </div>
      </aside>
      <div className="min-w-0 pb-24 md:pb-0">
        {children}
        <Link
          href="/weekly?quickAdd=1"
          className="fixed bottom-20 right-5 z-30 inline-flex size-14 items-center justify-center rounded-lg bg-brand text-white shadow-[var(--shadow-raised)] md:hidden"
          aria-label="Add task"
        >
          <Plus className="size-6" />
        </Link>
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Mobile primary">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold text-text-secondary",
                pathname.startsWith(item.href) ? "text-brand" : null,
              )}
            >
              <item.icon className="size-5" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="fixed right-4 top-4 z-30 hidden md:block">
          <AppIconButton label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            <Settings className="size-5" />
          </AppIconButton>
        </div>
      </div>
    </div>
  );
}
