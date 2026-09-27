import { describe, expect, it } from "vitest";
import { storyRollupTransition } from "./task-repository";

describe("storyRollupTransition", () => {
  it("completes the Story only when every active subtask is done", () => {
    expect(storyRollupTransition("TODO", { total: 3, completed: 3 })).toBe("completed");
    expect(storyRollupTransition("IN_PROGRESS", { total: 3, completed: 3 })).toBe(
      "completed",
    );
    expect(storyRollupTransition("PENDING_REVIEW", { total: 1, completed: 1 })).toBe(
      "completed",
    );
  });

  it("never completes the Story while any active subtask is open", () => {
    expect(storyRollupTransition("TODO", { total: 3, completed: 1 })).toBeNull();
    expect(storyRollupTransition("TODO", { total: 2, completed: 1 })).toBeNull();
    expect(storyRollupTransition("IN_PROGRESS", { total: 5, completed: 4 })).toBeNull();
  });

  it("does not re-complete an already DONE Story", () => {
    expect(storyRollupTransition("DONE", { total: 3, completed: 3 })).toBeNull();
  });

  it("reopens a DONE Story only when subtasks are incomplete", () => {
    expect(storyRollupTransition("DONE", { total: 3, completed: 2 })).toBe("reopened");
    expect(storyRollupTransition("DONE", { total: 3, completed: 0 })).toBe("reopened");
  });

  it("keeps an open Story unchanged when it has no active subtasks", () => {
    expect(storyRollupTransition("TODO", { total: 0, completed: 0 })).toBeNull();
    expect(storyRollupTransition("IN_PROGRESS", { total: 0, completed: 0 })).toBeNull();
  });

  it("does not reopen a non-DONE Story when progress regresses", () => {
    expect(storyRollupTransition("TODO", { total: 3, completed: 2 })).toBeNull();
  });
});
