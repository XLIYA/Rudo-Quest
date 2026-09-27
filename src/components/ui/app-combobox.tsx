"use client";

import { Search } from "lucide-react";
import { useId, useState } from "react";
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
  const generatedId = useId().replaceAll(":", "");
  const listboxId = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${generatedId}-options`;
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const expanded = !disabled && !dismissed && options.length > 0;
  const activeIndex = Math.min(highlightedIndex, options.length - 1);
  /**
   * Purpose: Commit the highlighted or clicked suggestion.
   * Inputs: Option index in the current result set.
   * Output: Void.
   * Side effects: Invokes the controlled selection callback.
   */
  const selectOption = (index: number) => {
    const option = options[index];
    if (option) onOptionSelect?.(option);
    setDismissed(true);
  };
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-9 size-4 text-text-tertiary" />
      <AppInput
        label={label}
        value={value}
        onChange={(event) => {
          setDismissed(false);
          setHighlightedIndex(0);
          onChange(event.currentTarget.value);
        }}
        onFocus={() => setDismissed(false)}
        onBlur={() => setDismissed(true)}
        placeholder={placeholder}
        className="pl-9"
        disabled={disabled}
        role="combobox"
        aria-controls={expanded ? listboxId : undefined}
        aria-expanded={expanded}
        aria-activedescendant={expanded ? `${listboxId}-${activeIndex}` : undefined}
        onKeyDown={(event) => {
          if (!options.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setDismissed(false);
            setHighlightedIndex(expanded ? (activeIndex + 1) % options.length : 0);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setDismissed(false);
            setHighlightedIndex(
              expanded
                ? (activeIndex - 1 + options.length) % options.length
                : options.length - 1,
            );
          } else if (event.key === "Enter" && expanded) {
            event.preventDefault();
            selectOption(Math.min(highlightedIndex, options.length - 1));
          } else if (event.key === "Escape" && expanded) {
            event.preventDefault();
            event.stopPropagation();
            setHighlightedIndex(0);
            setDismissed(true);
          }
        }}
      />
      {expanded ? (
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
              aria-selected={index === activeIndex}
              className="flex min-h-11 cursor-pointer items-center rounded-sm px-3 text-left text-sm hover:bg-surface-muted aria-selected:bg-surface-muted"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(index)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
