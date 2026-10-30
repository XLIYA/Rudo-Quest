import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type AppEmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

/**
 * Purpose: Render the application's shared logo in compact empty and error states.
 * Inputs: Optional size and styling classes.
 * Output: Decorative image using the transparent variant of the topbar logo.
 * Side effects: None.
 */
export function AppStateLogo({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/branding/rudo-logo-transparent.png"
      alt=""
      width={size}
      height={size}
      loading="eager"
      className={cn(
        "shrink-0 drop-shadow-[0_0_1px_var(--brand)] dark:drop-shadow-none",
        className,
      )}
    />
  );
}

/**
 * Purpose: Render a friendly empty state with the application logo.
 * Inputs: Title, description, and optional action.
 * Output: Empty state panel.
 * Side effects: None.
 */
export function AppEmptyState({ title, description, action }: AppEmptyStateProps) {
  return (
    <section className="rounded-lg border border-dashed border-border bg-surface p-6 text-center">
      <AppStateLogo size={96} className="mx-auto" />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
