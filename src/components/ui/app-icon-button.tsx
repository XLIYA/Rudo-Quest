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
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border-2 border-border bg-surface text-text-secondary shadow-[0_2px_0_var(--ink)] transition-[background-color,border-color,color,transform,box-shadow] duration-150 hover:bg-quest-soft hover:text-quest active:translate-y-[2px] active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-quest",
        className,
      )}
      {...props}
    />
  ),
);
AppIconButton.displayName = "AppIconButton";
