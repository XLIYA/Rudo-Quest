import { AppSkeleton } from "@/components/ui/app-skeleton";

/**
 * Purpose: Render route loading feedback.
 * Inputs: None.
 * Output: Skeleton layout.
 * Side effects: None.
 */
export default function Loading() {
  return (
    <main
      className="mx-auto grid max-w-7xl gap-5 bg-background p-5 md:p-8"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="grid gap-2">
        <AppSkeleton className="h-10 w-56" />
        <AppSkeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <AppSkeleton className="h-64 lg:col-span-7" />
        <AppSkeleton className="h-64 lg:col-span-5" />
        <AppSkeleton className="h-72 lg:col-span-5" />
        <AppSkeleton className="h-72 lg:col-span-7" />
      </div>
    </main>
  );
}
