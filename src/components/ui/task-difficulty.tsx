"use client";

import { useId } from "react";
import { cn } from "@/lib/utils/cn";

const labels = ["Easy", "Light", "Moderate", "Hard", "Very hard"];

/**
 * Purpose: Show task effort without relying on color alone.
 * Inputs: Difficulty from one through five.
 * Output: Five bars and an accessible numeric label.
 * Side effects: None.
 */
export function TaskDifficulty({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-text-secondary"
      aria-label={`Difficulty ${value} of 5: ${labels[value - 1]}`}
      title={labels[value - 1]}
    >
      <span className="flex h-3 items-end gap-0.5" aria-hidden="true">
        {labels.map((label, index) => (
          <span
            key={label}
            className={cn("w-1 rounded-sm", index < value ? "bg-brand" : "bg-border")}
            style={{ height: `${40 + index * 15}%` }}
          />
        ))}
      </span>
      <span aria-hidden="true" className="font-mono text-[10px]">
        {value}/5
      </span>
    </span>
  );
}

/**
 * Purpose: Choose a task difficulty using native, keyboard accessible radio buttons.
 * Inputs: Controlled value, change callback and disabled state.
 * Output: A compact five-step fieldset.
 * Side effects: Invokes the change callback.
 */
export function TaskDifficultyPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset disabled={disabled} className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">
        Difficulty{" "}
        <span className="font-normal text-text-secondary">· {labels[value - 1]}</span>
      </legend>
      <div className="grid grid-cols-5 gap-1.5">
        {labels.map((label, index) => (
          <label
            key={label}
            className={cn(
              "relative flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand",
              value === index + 1
                ? "border-brand bg-brand-soft text-brand"
                : "border-border bg-surface text-text-secondary",
              disabled && "cursor-default opacity-60",
            )}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === index + 1}
              onChange={() => onChange(index + 1)}
              aria-label={`${index + 1} — ${label}`}
            />
            {index + 1}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
