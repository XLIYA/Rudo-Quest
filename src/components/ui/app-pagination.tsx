import { AppButton } from "./app-button";

export type AppPaginationProps = {
  hasNext: boolean;
  onNext: () => void;
};

/**
 * Purpose: Render a simple cursor pagination action.
 * Inputs: Whether next page exists and handler.
 * Output: Load-more control.
 * Side effects: Invokes callback when pressed.
 */
export function AppPagination({ hasNext, onNext }: AppPaginationProps) {
  if (!hasNext) return null;
  return (
    <div className="flex justify-center py-4">
      <AppButton variant="secondary" onClick={onNext}>
        Load more
      </AppButton>
    </div>
  );
}
