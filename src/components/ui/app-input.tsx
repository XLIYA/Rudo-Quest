import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type AppInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  endAdornment?: ReactNode;
};

/**
 * Purpose: Render a labeled text input with consistent token styling.
 * Inputs: Native input props, optional label, and error message.
 * Output: Accessible input control.
 * Side effects: None.
 */
export const AppInput = forwardRef<HTMLInputElement, AppInputProps>(
  ({ label, error, endAdornment, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? props.name ?? generatedId;
    return (
      <div className="grid gap-1.5">
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        ) : null}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn(
              "neo-input min-h-11 w-full bg-surface px-3 text-sm text-text-primary outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-text-tertiary focus:border-quest focus:shadow-[0_3px_0_var(--ink)]",
              endAdornment ? "pe-12" : null,
              error ? "border-error" : null,
              className,
            )}
            {...props}
            dir={
              props.dir ??
              (props.type === "email" ||
              props.type === "url" ||
              props.type === "tel" ||
              props.type === "number"
                ? "ltr"
                : "auto")
            }
            suppressHydrationWarning
          />
          {endAdornment ? (
            <div className="absolute inset-y-0 end-0 flex items-center">
              {endAdornment}
            </div>
          ) : null}
        </div>
        {error ? (
          <span id={`${inputId}-error`} className="text-xs font-medium text-error">
            {error}
          </span>
        ) : null}
      </div>
    );
  },
);
AppInput.displayName = "AppInput";
