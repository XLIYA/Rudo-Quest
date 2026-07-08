"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  Plus,
  User,
} from "lucide-react";
import RudoMark from "@/assets/brand/rudo-mark.svg";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/weekly", label: "Weekly", icon: CalendarDays },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/profile", label: "Profile", icon: User },
] as const;

/**
 * Purpose: Render responsive app navigation around protected content.
 * Inputs: React children.
 * Output: Desktop sidebar, mobile bottom nav, and content region.
 * Side effects: None.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh bg-background text-text-primary md:grid md:grid-cols-[15rem_1fr]">
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
              aria-current={pathname.startsWith(item.href) ? "page" : undefined}
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
      </aside>
      <div className="min-w-0 pb-[calc(6rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] md:pb-0 md:pl-0 md:pr-0 md:pt-0">
        {children}
        <Link
          href="/weekly?quickAdd=1"
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-30 inline-flex size-14 items-center justify-center rounded-lg bg-brand text-white shadow-[var(--shadow-raised)] md:hidden"
          aria-label="Add task"
        >
          <Plus className="size-6" />
        </Link>
        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] pl-[calc(0.25rem+env(safe-area-inset-left))] pr-[calc(0.25rem+env(safe-area-inset-right))] backdrop-blur md:hidden"
          aria-label="Mobile primary"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary",
                pathname.startsWith(item.href) ? "text-brand" : null,
              )}
            >
              <item.icon className="size-5" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
