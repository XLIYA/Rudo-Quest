"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type TaskCheckboxProps = {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: () => void;
};

/**
 * Purpose: Render the task completion checkbox with accessible label.
 * Inputs: Checked state, label, disabled state, and change handler.
 * Output: Button checkbox control.
 * Side effects: Calls onChange when activated.
 */
export function TaskCheckbox({ checked, label, disabled, onChange }: TaskCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-sm border border-border-strong",
        checked ? "border-brand bg-brand text-white" : "bg-surface",
      )}
    >
      {checked ? <Check className="size-4" aria-hidden="true" /> : null}
    </button>
  );
}
