import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type AppTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

/**
 * Purpose: Render a labeled textarea with consistent validation styling.
 * Inputs: Native textarea props, optional label, and error message.
 * Output: Accessible textarea.
 * Side effects: None.
 */
export const AppTextarea = forwardRef<HTMLTextAreaElement, AppTextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <label className="grid gap-1.5 text-sm font-medium text-text-primary">
        {label ? <span>{label}</span> : null}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn(
            "min-h-28 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-brand",
            error ? "border-error" : null,
            className,
          )}
          {...props}
        />
        {error && inputId ? (
          <span className="text-xs font-medium text-error">{error}</span>
        ) : null}
      </label>
    );
  },
);
AppTextarea.displayName = "AppTextarea";
