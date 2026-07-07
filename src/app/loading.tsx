import { AppSkeleton } from "@/components/ui/app-skeleton";

/**
 * Purpose: Render route loading feedback.
 * Inputs: None.
 * Output: Skeleton layout.
 * Side effects: None.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-background p-6">
      <AppSkeleton className="h-12 w-48" />
      <div className="mt-6 grid gap-3">
        <AppSkeleton className="h-24 w-full" />
        <AppSkeleton className="h-24 w-full" />
        <AppSkeleton className="h-24 w-full" />
      </div>
    </main>
  );
}
