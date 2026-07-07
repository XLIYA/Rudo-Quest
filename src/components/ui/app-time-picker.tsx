import { AppInput, type AppInputProps } from "./app-input";

/**
 * Purpose: Render a native time input wrapper.
 * Inputs: AppInput props.
 * Output: Time input.
 * Side effects: None.
 */
export function AppTimePicker(props: AppInputProps) {
  return <AppInput type="time" {...props} />;
}
