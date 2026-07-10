import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppButton } from "./app-button";

describe("AppButton", () => {
  it("defaults to type button while preserving explicit submit buttons", () => {
    render(
      <form>
        <AppButton>Plain action</AppButton>
        <AppButton type="submit">Submit action</AppButton>
      </form>,
    );

    expect(screen.getByRole("button", { name: "Plain action" })).toHaveAttribute(
      "type",
      "button",
    );
    expect(screen.getByRole("button", { name: "Submit action" })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});
