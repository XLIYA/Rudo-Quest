"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { useId } from "react";

export type AppSelectOption = { value: string; label: string };
export type AppSelectProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: AppSelectOption[];
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Purpose: Render a local select wrapper over Radix Select.
 * Inputs: Label, controlled value, change handler, and options.
 * Output: Accessible select control.
 * Side effects: None.
 */
export function AppSelect({
  label,
  value,
  onValueChange,
  options,
  disabled,
  placeholder,
}: AppSelectProps) {
  const labelId = useId();
  return (
    <div className="grid gap-1.5 text-sm font-medium">
      <span id={labelId}>{label}</span>
      <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <Select.Trigger
          aria-labelledby={labelId}
          className="inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 hover:border-border-strong focus:border-quest focus:shadow-[0_0_0_3px_var(--quest-soft)]"
        >
          {value ? (
            <Select.Value />
          ) : (
            <span className="text-text-tertiary">{placeholder ?? "Select..."}</span>
          )}
          <Select.Icon>
            <ChevronDown className="size-4" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-[var(--shadow-raised)]"
          >
            <Select.Viewport className="max-h-64 overflow-y-auto">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 text-sm outline-none data-[highlighted]:bg-quest-soft data-[highlighted]:text-quest"
                >
                  <Select.ItemIndicator>
                    <Check className="size-4" />
                  </Select.ItemIndicator>
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
