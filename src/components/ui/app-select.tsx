"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

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
export function AppSelect({ label, value, onValueChange, options, disabled, placeholder }: AppSelectProps) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <Select.Trigger className="inline-flex min-h-11 items-center justify-between rounded-md border border-border bg-surface px-3 text-sm">
          {value ? <Select.Value /> : <span className="text-text-tertiary">{placeholder ?? "Select..."}</span>}
          <Select.Icon>
            <ChevronDown className="size-4" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="z-50 rounded-md border border-border bg-surface p-1 shadow-[var(--shadow-raised)]">
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm outline-none data-[highlighted]:bg-surface-muted">
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
    </label>
  );
}
