import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppCheckbox } from "./app-checkbox";

describe("AppCheckbox", () => {
  it("provides an accessible 44px control and toggles from its visible label", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <AppCheckbox
        label="Daily reminders"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Daily reminders" });
    expect(checkbox).toHaveClass("size-11");
    await user.click(screen.getByText("Daily reminders"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
