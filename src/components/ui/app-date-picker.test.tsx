import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { AppDatePicker } from "./app-date-picker";

it("keeps incomplete and impossible dates out of the controlled form value", () => {
  const changed = vi.fn();
  render(<AppDatePicker label="Date" value="2026-09-27" onValueChange={changed} />);
  const input = screen.getByLabelText("Date");
  fireEvent.change(input, { target: { value: "2026-02-31" } });
  expect(changed).not.toHaveBeenCalled();
  expect(input).toBeInvalid();
  fireEvent.change(input, { target: { value: "2026-02-28" } });
  expect(changed).toHaveBeenCalledWith("2026-02-28");
  expect(input).toBeValid();
});

it("selects calendar dates, clears draft errors and returns focus to its trigger", async () => {
  function Field() {
    const [value, setValue] = useState("2026-09-27");
    return <AppDatePicker label="Date" value={value} onValueChange={setValue} />;
  }
  render(<Field />);
  const user = userEvent.setup();
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "invalid" } });
  await user.click(screen.getByRole("button", { name: "Open Date calendar" }));
  await user.click(screen.getByRole("button", { name: /September 28th, 2026/ }));
  expect(screen.getByLabelText("Date")).toHaveValue("2026-09-28");
  expect(screen.getByLabelText("Date")).toBeValid();
  expect(screen.getByRole("button", { name: "Open Date calendar" })).toHaveFocus();
});
