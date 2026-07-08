"use client";

import * as Progress from "@radix-ui/react-progress";
import { cn } from "@/lib/utils/cn";

export type AppProgressProps = {
  value: number;
  label?: string;
  className?: string;
  indicatorClassName?: string;
};

/**
 * Purpose: Render a compact tokenized progress bar over Radix Progress.
 * Inputs: Percent value, optional label, and class overrides.
 * Output: Accessible progress bar.
 * Side effects: None.
 */
export function AppProgress({
  value,
  label,
  className,
  indicatorClassName,
}: AppProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <Progress.Root
      value={clamped}
      aria-label={label}
      className={cn("h-2 overflow-hidden rounded-full bg-surface-muted", className)}
    >
      <Progress.Indicator
        className={cn(
          "h-full rounded-full bg-brand transition-transform",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </Progress.Root>
  );
}
