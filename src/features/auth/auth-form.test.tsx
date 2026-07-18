import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthForm, getSafePostLoginPath } from "./auth-form";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe("getSafePostLoginPath", () => {
  it("allows internal app paths with search and hash", () => {
    expect(getSafePostLoginPath("/projects/123?tab=tasks#today")).toBe(
      "/projects/123?tab=tasks#today",
    );
  });

  it("rejects external and non-path redirects", () => {
    expect(getSafePostLoginPath("https://evil.example")).toBe("/dashboard");
    expect(getSafePostLoginPath("//evil.example/path")).toBe("/dashboard");
    expect(getSafePostLoginPath("javascript:alert(1)")).toBe("/dashboard");
    expect(getSafePostLoginPath(null)).toBe("/dashboard");
  });
});

describe("AuthForm", () => {
  it("toggles password visibility with an accessible control", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("places password recovery below verification resend", () => {
    render(<AuthForm mode="login" />);

    const resend = screen.getByRole("button", { name: "Resend verification email" });
    const forgot = screen.getByRole("button", { name: "Forgot password?" });
    expect(
      resend.compareDocumentPosition(forgot) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
