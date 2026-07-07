import { cn } from "@/lib/utils/cn";

export type AppSkeletonProps = {
  className?: string;
};

/**
 * Purpose: Render a tokenized loading skeleton.
 * Inputs: Optional className for dimensions.
 * Output: Animated skeleton block.
 * Side effects: None.
 */
export function AppSkeleton({ className }: AppSkeletonProps) {
  return <div className={cn("animate-pulse rounded-md bg-surface-muted", className)} />;
}
