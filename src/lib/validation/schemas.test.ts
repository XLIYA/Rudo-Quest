import { describe, expect, it } from "vitest";
import { createProjectSchema } from "@/lib/validation/projects";
import { createTaskSchema } from "@/lib/validation/tasks";

describe("validation schemas", () => {
  it("rejects owner invitations", () => {
    const result = createProjectSchema.safeParse({
      title: "Launch",
      iconKey: "Compass",
      colorKey: "orange",
      timeZone: "UTC",
      invitations: [{ userId: crypto.randomUUID(), role: "OWNER" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid personal task payload", () => {
    const result = createTaskSchema.safeParse({
      title: "Ship task",
      scheduledDate: "2026-07-07",
      scheduledTimeZone: "UTC",
    });
    expect(result.success).toBe(true);
  });
});
