import { AppButton } from "./app-button";

export type AppPaginationProps = {
  hasNext: boolean;
  onNext: () => void;
  pending?: boolean;
  label?: string;
  pendingLabel?: string;
};

/**
 * Purpose: Render a simple cursor pagination action.
 * Inputs: Whether a next page exists, loading state, labels, and handler.
 * Output: Load-more control.
 * Side effects: Invokes callback when pressed.
 */
export function AppPagination({
  hasNext,
  onNext,
  pending = false,
  label = "Load more",
  pendingLabel = "Loading…",
}: AppPaginationProps) {
  if (!hasNext) return null;
  return (
    <div className="flex justify-center py-4">
      <AppButton variant="secondary" onClick={onNext} disabled={pending}>
        {pending ? pendingLabel : label}
      </AppButton>
    </div>
  );
}
