import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import { TaskDifficulty, TaskDifficultyPicker } from "./task-difficulty";

it("exposes the numeric difficulty independently of colored bars", () => {
  render(<TaskDifficulty value={4} />);
  expect(screen.getByLabelText("Difficulty 4 of 5: Hard")).toBeVisible();
});

it("supports native arrow-key selection without submitting the form", async () => {
  function Field() {
    const [value, setValue] = useState(1);
    return <TaskDifficultyPicker value={value} onChange={setValue} />;
  }
  render(<Field />);
  const user = userEvent.setup();
  await user.tab();
  expect(screen.getByRole("radio", { name: "1 — Easy" })).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("radio", { name: "2 — Light" })).toBeChecked();
});
