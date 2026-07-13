"use client";

import { useId } from "react";
import type { ComponentProps } from "react";
import { AppInput } from "./app-input";

const supportedTimeZones =
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

export type AppTimeZoneInputProps = Omit<
  ComponentProps<typeof AppInput>,
  "label" | "list"
> & {
  label?: string;
};

/**
 * Purpose: Provide a validated-IANA-friendly timezone field with native suggestions.
 * Inputs: Standard AppInput props and an optional label.
 * Output: Text input connected to the runtime's supported timezone list.
 * Side effects: None.
 */
export function AppTimeZoneInput({
  label = "Timezone",
  ...props
}: AppTimeZoneInputProps) {
  const listId = useId();
  return (
    <>
      <AppInput label={label} list={listId} autoComplete="off" {...props} />
      <datalist id={listId}>
        {supportedTimeZones.map((timeZone) => (
          <option key={timeZone} value={timeZone} />
        ))}
      </datalist>
    </>
  );
}
