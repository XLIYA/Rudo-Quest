import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppEmptyState } from "./app-empty-state";

describe("AppEmptyState", () => {
  it("uses the topbar logo for empty and error states", () => {
    render(
      <AppEmptyState
        title="Week unavailable"
        description="The task list could not be loaded."
      />,
    );

    expect(screen.getByRole("heading", { name: "Week unavailable" })).toBeVisible();
    expect(screen.getByRole("presentation")).toHaveAttribute(
      "srcset",
      expect.stringContaining(encodeURIComponent("/branding/rudo-logo-transparent.png")),
    );
  });
});
