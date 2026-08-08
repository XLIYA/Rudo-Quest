import { AppProgress } from "@/components/ui/app-progress";

export type WeeklyProgressProps = {
  completed: number;
  total: number;
};

/**
 * Purpose: Pair a day's task completion ratio with a visible percentage.
 * Inputs: Completed and total task counts.
 * Output: Accessible progress summary, or nothing for an empty day.
 * Side effects: None.
 */
export function WeeklyProgress({ completed, total }: WeeklyProgressProps) {
  if (total === 0) return null;

  const value = Math.round((completed / total) * 100);
  const label = `${completed} of ${total} tasks completed`;

  return (
    <span className="flex items-center gap-2">
      <AppProgress value={value} label={label} className="w-12" />
      <span className="min-w-8 text-right font-mono text-xs font-semibold text-text-secondary">
        {value}%
      </span>
    </span>
  );
}
