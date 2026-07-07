import { AppInput, type AppInputProps } from "./app-input";

/**
 * Purpose: Render a native date input wrapper.
 * Inputs: AppInput props.
 * Output: Date input.
 * Side effects: None.
 */
export function AppDatePicker(props: AppInputProps) {
  return <AppInput type="date" {...props} />;
}
