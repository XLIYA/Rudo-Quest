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
 * Output: Native checkbox control styled to match the design system.
 * Side effects: Calls onChange when activated.
 */
export function TaskCheckbox({ checked, label, disabled, onChange }: TaskCheckboxProps) {
  return (
    <label
      className={cn(
        "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
      )}
      title={label}
    >
      <input
        type="checkbox"
        role="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          event.stopPropagation();
          onChange();
        }}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex size-6 items-center justify-center rounded-sm border border-border-strong transition-colors duration-150",
          checked
            ? "border-brand bg-brand text-white"
            : "border-border-strong bg-surface hover:bg-surface-muted",
        )}
        style={{ pointerEvents: "none" }}
      >
        {checked ? <Check className="size-4" /> : null}
      </span>
    </label>
  );
}
