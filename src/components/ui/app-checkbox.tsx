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
        className={cn(
          "flex size-5 items-center justify-center rounded-sm border border-border-strong bg-surface text-white data-[state=checked]:border-brand data-[state=checked]:bg-brand",
          className,
        )}
        {...props}
      >
        <Checkbox.Indicator>
          <Check className="size-4" aria-hidden="true" />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <span>{label}</span>
    </label>
  );
}
