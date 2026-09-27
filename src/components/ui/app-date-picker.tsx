"use client";

import { useRef, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { AppInput, type AppInputProps } from "./app-input";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type Props = Omit<AppInputProps, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * Purpose: Combine editable ISO dates with the shadcn calendar and popover.
 * Inputs: Controlled date, change callback, and labeled input props.
 * Output: Date picker usable by typing or keyboard calendar navigation.
 * Side effects: Emits complete valid dates only; invalid drafts block submission.
 */
export function AppDatePicker({
  value,
  onValueChange,
  label,
  disabled,
  ...props
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  if (value !== previousValue) {
    setPreviousValue(value);
    setDraft(value);
  }
  const selected = value && isValid(parseISO(value)) ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <AppInput
        {...props}
        ref={input}
        label={label}
        disabled={disabled}
        type="text"
        placeholder="YYYY-MM-DD"
        pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
        value={draft}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setDraft(next);
          const date = parseISO(next);
          const valid =
            /^\d{4}-\d{2}-\d{2}$/.test(next) &&
            isValid(date) &&
            format(date, "yyyy-MM-dd") === next;
          event.currentTarget.setCustomValidity(
            next && !valid ? "Enter a valid date (YYYY-MM-DD)." : "",
          );
          if (!next || valid) onValueChange(next);
        }}
        endAdornment={
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Open ${label ?? props["aria-label"] ?? "date"} calendar`}
              className="flex size-11 items-center justify-center rounded-md text-text-secondary hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
            >
              <CalendarDays className="size-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        }
      />
      <PopoverContent align="end">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          startMonth={new Date(1900, 0)}
          endMonth={new Date(2100, 11)}
          onSelect={(date) => {
            if (!date) return;
            const next = format(date, "yyyy-MM-dd");
            input.current?.setCustomValidity("");
            setDraft(next);
            onValueChange(next);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
