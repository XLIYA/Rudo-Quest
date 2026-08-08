import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeeklyProgress } from "./weekly-progress";

describe("WeeklyProgress", () => {
  it("shows the rounded percentage and exposes the exact ratio accessibly", () => {
    render(<WeeklyProgress completed={2} total={3} />);

    expect(screen.getByText("67%")).toBeVisible();
    expect(
      screen.getByRole("progressbar", { name: "2 of 3 tasks completed" }),
    ).toHaveAttribute("aria-valuenow", "67");
  });

  it("does not render misleading progress for an empty day", () => {
    const { container } = render(<WeeklyProgress completed={0} total={0} />);

    expect(container).toBeEmptyDOMElement();
  });
});
