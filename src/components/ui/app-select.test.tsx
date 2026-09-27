import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { AppSelect } from "./app-select";

it("supports an empty all-items option without passing an empty Radix item value", async () => {
  function Field() {
    const [value, setValue] = useState("DONE");
    return (
      <>
        <AppSelect
          label="Status"
          value={value}
          onValueChange={setValue}
          options={[
            { value: "", label: "All statuses" },
            { value: "DONE", label: "Done" },
          ]}
        />
        <output aria-label="Selected status">{value || "all"}</output>
      </>
    );
  }
  render(<Field />);
  const user = userEvent.setup();
  // jsdom has no layout/scroll API; selection behavior itself remains real Radix.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  await user.tab();
  await user.keyboard("{Enter}{Home}{Enter}");
  expect(screen.getByLabelText("Selected status")).toHaveTextContent("all");
  expect(screen.getByRole("combobox", { name: "Status" })).toHaveTextContent(
    "All statuses",
  );
});
