import { AppSkeleton } from "@/components/ui/app-skeleton";

/**
 * Purpose: Render skeleton feedback while auth-guarded app routes resolve.
 * Inputs: None.
 * Output: Skeleton layout shown during session verification and data fetch.
 * Side effects: None.
 */
export default function AppLoading() {
  return (
    <main
      className="mx-auto grid min-w-0 max-w-7xl gap-5 p-5 md:p-8"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="grid gap-2">
        <AppSkeleton className="h-10 w-56" />
        <AppSkeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-12">
        <AppSkeleton className="h-64 lg:col-span-7" />
        <AppSkeleton className="h-64 lg:col-span-5" />
      </div>
    </main>
  );
}
