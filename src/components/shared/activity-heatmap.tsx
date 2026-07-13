"use client";

import { format, parseISO, subDays } from "date-fns";
import { AppTooltip } from "@/components/ui/app-tooltip";

export type ActivityHeatmapProps = {
  days: { date: string; count: number }[];
  endDate?: string;
};

/**
 * Purpose: Render Rudo Quest's compact 91-day completion heatmap.
 * Inputs: Sparse date/count completion data and optional timezone-aligned final date.
 * Output: Keyboard-accessible 13-week grid with non-color tooltip labels.
 * Side effects: None.
 */
export function ActivityHeatmap({ days, endDate }: ActivityHeatmapProps) {
  const counts = new Map(days.map((day) => [day.date, day.count]));
  const lastVisibleDate = endDate ? parseISO(endDate) : new Date();
  const visibleDays = Array.from({ length: 91 }, (_, index) => {
    const date = format(subDays(lastVisibleDate, 90 - index), "yyyy-MM-dd");
    return { date, count: counts.get(date) ?? 0 };
  });

  return (
    <div
      className="grid grid-flow-col grid-rows-7 gap-1 [grid-auto-columns:minmax(0,1fr)]"
      aria-label="Last 13 weeks task completion heatmap"
    >
      {visibleDays.map((day) => (
        <AppTooltip key={day.date} label={heatmapLabel(day.date, day.count)}>
          <span
            tabIndex={0}
            aria-label={heatmapLabel(day.date, day.count)}
            className="aspect-square min-h-2 w-full rounded-[3px] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-3"
            style={{ background: heatmapColor(day.count) }}
          />
        </AppTooltip>
      ))}
    </div>
  );
}

/**
 * Purpose: Describe one heatmap day without relying on color.
 * Inputs: ISO date and completed task count.
 * Output: Human-readable accessible label.
 * Side effects: None.
 */
function heatmapLabel(date: string, count: number): string {
  if (count === 0) return `${date}: no completed tasks`;
  return `${date}: ${count} completed task${count === 1 ? "" : "s"}`;
}

/**
 * Purpose: Map completion counts to the established six-level brand-orange scale.
 * Inputs: Non-negative completion count.
 * Output: Token-based CSS color.
 * Side effects: None.
 */
function heatmapColor(count: number): string {
  const colors = [
    "var(--surface-muted)",
    "var(--brand-soft)",
    "color-mix(in srgb, var(--brand) 28%, var(--surface))",
    "color-mix(in srgb, var(--brand) 48%, var(--surface))",
    "color-mix(in srgb, var(--brand) 72%, var(--surface))",
    "var(--brand)",
  ];
  return colors[Math.min(count, colors.length - 1)] ?? "var(--surface-muted)";
}
