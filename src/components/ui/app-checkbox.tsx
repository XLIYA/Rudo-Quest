"use client";

import * as Checkbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type AppCheckboxProps = Checkbox.CheckboxProps & {
  label: string;
};

/**
 * Purpose: Render an accessible checkbox with visible label.
 * Inputs: Radix checkbox props and label.
 * Output: Token-styled checkbox control.
 * Side effects: None.
 */
export function AppCheckbox({ label, className, ...props }: AppCheckboxProps) {
  return (
    <label className="inline-flex min-h-11 items-center gap-3 text-sm">
      <Checkbox.Root
        aria-label={label}
        className={cn(
          "group flex size-11 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-55",
          className,
        )}
        {...props}
      >
        <span className="flex size-5 items-center justify-center rounded-sm border border-border-strong bg-surface text-white group-data-[state=checked]:border-brand group-data-[state=checked]:bg-brand">
          <Checkbox.Indicator>
            <Check className="size-4" aria-hidden="true" />
          </Checkbox.Indicator>
        </span>
      </Checkbox.Root>
      <span>{label}</span>
    </label>
  );
}
