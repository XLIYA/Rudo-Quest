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
    expect(region).toHaveClass(
      "flex-1",
      "min-h-0",
      "overflow-y-auto",
      "overscroll-contain",
    );
  });

  it("accepts layout overrides such as a maximum height bound", () => {
    render(
      <BoundedCardList label="Projects" className="max-h-[24rem] lg:max-h-none">
        <div>Project card</div>
      </BoundedCardList>,
    );

    const region = screen.getByRole("region", { name: "Projects" });
    expect(region).toHaveClass("max-h-[24rem]", "lg:max-h-none");
  });
});
