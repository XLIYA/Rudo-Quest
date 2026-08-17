import type { ReactNode } from "react";

export type BoundedCardListProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

/**
 * Purpose:
 * Keep a dashboard collection inside the available
 * widget height while preserving keyboard scrolling.
 *
 * Behaviour:
 * - Uses the remaining available height of its parent.
 * - Scrolls internally when content exceeds that height.
 * - Does not force the parent widget to grow.
 * - Preserves accessible keyboard scrolling.
 *
 * Inputs:
 * Accessible region label, collection content,
 * and optional layout classes.
 *
 * Output:
 * A named, focusable and bounded scroll region.
 *
 * Side effects:
 * None.
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
      className={[
        "grid",
        "min-h-0",
        "min-w-0",
        "flex-1",
        "auto-rows-max",
        "content-start",
        "gap-3",
        "overflow-x-hidden",
        "overflow-y-auto",
        "overscroll-contain",
        "pr-2",
        "[scrollbar-gutter:stable]",
        "focus-visible:rounded-md",
        "focus-visible:outline",
        "focus-visible:outline-2",
        "focus-visible:outline-offset-2",
        "focus-visible:outline-brand",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
