import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type AppInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

/**
 * Purpose: Render a labeled text input with consistent token styling.
 * Inputs: Native input props, optional label, and error message.
 * Output: Accessible input control.
 * Side effects: None.
 */
export const AppInput = forwardRef<HTMLInputElement, AppInputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? props.name ?? generatedId;
    return (
      <label
        htmlFor={inputId}
        className="grid gap-1.5 text-sm font-medium text-text-primary"
      >
        {label ? <span>{label}</span> : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            "min-h-11 rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-brand",
            error ? "border-error" : null,
            className,
          )}
          {...props}
        />
        {error ? (
          <span id={`${inputId}-error`} className="text-xs font-medium text-error">
            {error}
          </span>
        ) : null}
      </label>
    );
  },
);
AppInput.displayName = "AppInput";
