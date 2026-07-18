import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type AppIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

/**
 * Purpose: Render an accessible icon-only button with a visible focus state.
 * Inputs: Native button props and required aria label.
 * Output: 44px touch target icon button.
 * Side effects: None.
 */
export const AppIconButton = forwardRef<HTMLButtonElement, AppIconButtonProps>(
  ({ className, label, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-transparent text-text-secondary transition-colors duration-150 hover:bg-quest-soft hover:text-quest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-quest",
        className,
      )}
      {...props}
    />
  ),
);
AppIconButton.displayName = "AppIconButton";
