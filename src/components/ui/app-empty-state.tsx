import Image from "next/image";
import RudoEmpty from "@/assets/brand/rudo-empty-state.svg";
import type { ReactNode } from "react";

export type AppEmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

/**
 * Purpose: Render a friendly empty state with the Rudo mascot.
 * Inputs: Title, description, and optional action.
 * Output: Empty state panel.
 * Side effects: None.
 */
export function AppEmptyState({ title, description, action }: AppEmptyStateProps) {
  return (
    <section className="rounded-lg border border-dashed border-border bg-surface p-6 text-center">
      <Image src={RudoEmpty} alt="" width={160} height={120} className="mx-auto" />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
