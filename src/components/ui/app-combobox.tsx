"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { AppInput } from "./app-input";

export type AppComboboxProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options?: { value: string; label: string }[];
  onOptionSelect?: (option: { value: string; label: string }) => void;
  placeholder?: string;
  disabled?: boolean;
};

/**
 * Purpose: Provide a typed search input wrapper for async suggestion lists.
 * Inputs: Label, value, change handler, and placeholder.
 * Output: Search input with icon.
 * Side effects: None.
 */
export function AppCombobox({
  label,
  value,
  onChange,
  options = [],
  onOptionSelect,
  placeholder,
  disabled,
}: AppComboboxProps) {
  const listboxId = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-options`;
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const selectOption = (index: number) => {
    const option = options[index];
    if (option) onOptionSelect?.(option);
  };
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-9 size-4 text-text-tertiary" />
      <AppInput
        label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        className="pl-9"
        disabled={disabled}
        role="combobox"
        aria-controls={options.length ? listboxId : undefined}
        aria-expanded={options.length > 0}
        aria-activedescendant={
          options.length ? `${listboxId}-${highlightedIndex}` : undefined
        }
        onKeyDown={(event) => {
          if (!options.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((index) => (index + 1) % options.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((index) => (index - 1 + options.length) % options.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            selectOption(Math.min(highlightedIndex, options.length - 1));
          } else if (event.key === "Escape") {
            event.preventDefault();
            onChange("");
          }
        }}
      />
      {options.length ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-surface p-1 shadow-[var(--shadow-raised)]"
        >
          {options.map((option, index) => (
            <li
              id={`${listboxId}-${index}`}
              key={option.value}
              role="option"
              aria-selected={index === highlightedIndex}
            >
              <button
                type="button"
                className="flex min-h-11 w-full items-center rounded-sm px-3 text-left text-sm hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
                onClick={() => selectOption(index)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
