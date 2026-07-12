import { describe, expect, it } from "vitest";
import { hasProjectRole, toggleCompletionState } from "./project-policy";

describe("project permissions", () => {
  it("ranks roles according to the permission matrix", () => {
    expect(hasProjectRole("OWNER", "ADMIN")).toBe(true);
    expect(hasProjectRole("ADMIN", "MEMBER")).toBe(true);
    expect(hasProjectRole("MEMBER", "ADMIN")).toBe(false);
    expect(hasProjectRole("VIEWER", "MEMBER")).toBe(false);
  });
});

describe("task transitions", () => {
  it("completes active tasks and stores previous status", () => {
    const next = toggleCompletionState(
      "IN_PROGRESS",
      null,
      new Date("2026-07-07T00:00:00Z"),
    );
    expect(next.status).toBe("DONE");
    expect(next.previousStatus).toBe("IN_PROGRESS");
    expect(next.completedAt).toBeInstanceOf(Date);
  });

  it("reopens completed tasks to previous non-done status", () => {
    const next = toggleCompletionState("DONE", "TODO", new Date("2026-07-07T00:00:00Z"));
    expect(next.status).toBe("TODO");
    expect(next.previousStatus).toBeNull();
    expect(next.completedAt).toBeNull();
  });
});
