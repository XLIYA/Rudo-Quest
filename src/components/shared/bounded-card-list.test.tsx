import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoundedCardList } from "./bounded-card-list";

describe("BoundedCardList", () => {
  it("contains long card content in a keyboard-scrollable named region", () => {
    render(
      <BoundedCardList label="Today's tasks">
        <div>Task row</div>
      </BoundedCardList>,
    );

    const region = screen.getByRole("region", { name: "Today's tasks" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveClass("max-h-[30rem]", "overflow-y-auto", "overscroll-contain");
  });
});
