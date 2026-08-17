import type { ReactNode } from "react";

export type BoundedCardListProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

/**
 * Purpose: Keep a dashboard collection inside its card while preserving keyboard scrolling.
 * Inputs: Accessible region label, collection content, and optional layout classes.
 * Output: A named, focusable, bounded scroll region.
 * Side effects: None.
 */
export function BoundedCardList({
  label,
  children,
  className = "",
}: BoundedCardListProps) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={`grid max-h-[30rem] min-h-0 min-w-0 gap-3 overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable] focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${className}`}
    >
      {children}
    </div>
  );
}
