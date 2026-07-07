"use client";

import { Search } from "lucide-react";
import { AppInput } from "./app-input";

export type AppComboboxProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/**
 * Purpose: Provide a typed search input wrapper for async suggestion lists.
 * Inputs: Label, value, change handler, and placeholder.
 * Output: Search input with icon.
 * Side effects: None.
 */
export function AppCombobox({ label, value, onChange, placeholder }: AppComboboxProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-9 size-4 text-text-tertiary" />
      <AppInput
        label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}
