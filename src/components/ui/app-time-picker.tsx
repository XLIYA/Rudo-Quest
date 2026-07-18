"use client";

import { AppSelect, type AppSelectOption } from "./app-select";

export type AppTimePickerProps = {
  label: string;
  value: string | null;
  onValueChange: (value: string | null) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

const emptyValue = "__no_time__";

const quarterHourOptions: AppSelectOption[] = Array.from(
  { length: 24 * 4 },
  (_, index) => {
    const hour = Math.floor(index / 4);
    const minute = (index % 4) * 15;
    const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const period = hour < 12 ? "AM" : "PM";
    const displayHour = hour % 12 || 12;
    return {
      value,
      label: `${displayHour}:${String(minute).padStart(2, "0")} ${period}`,
    };
  },
);

/**
 * Purpose: Render a consistent, keyboard-operable time selector.
 * Inputs: Controlled time value, label, optional empty state, and change handler.
 * Output: Radix-backed time picker with quarter-hour choices.
 * Side effects: Invokes the controlled change callback.
 */
export function AppTimePicker({
  label,
  value,
  onValueChange,
  disabled,
  allowEmpty = false,
  emptyLabel = "No time",
}: AppTimePickerProps) {
  const normalizedValue = value?.slice(0, 5) ?? "";
  const customOption =
    normalizedValue &&
    !quarterHourOptions.some((option) => option.value === normalizedValue)
      ? [{ value: normalizedValue, label: normalizedValue }]
      : [];
  const options = [
    ...(allowEmpty ? [{ value: emptyValue, label: emptyLabel }] : []),
    ...customOption,
    ...quarterHourOptions,
  ];

  return (
    <AppSelect
      label={label}
      value={normalizedValue || (allowEmpty ? emptyValue : "00:00")}
      onValueChange={(nextValue) =>
        onValueChange(nextValue === emptyValue ? null : nextValue)
      }
      options={options}
      disabled={disabled}
    />
  );
}
