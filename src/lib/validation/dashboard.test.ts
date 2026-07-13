import { describe, expect, it } from "vitest";
import { dashboardQuerySchema } from "./dashboard";

describe("dashboardQuerySchema", () => {
  it("accepts an inclusive 32-day dashboard window", () => {
    expect(
      dashboardQuerySchema.safeParse({ from: "2026-07-01", to: "2026-08-01" }).success,
    ).toBe(true);
  });

  it("rejects reversed dashboard windows", () => {
    const result = dashboardQuerySchema.safeParse({
      from: "2026-07-02",
      to: "2026-07-01",
    });

    expect(result.success).toBe(false);
  });

  it("rejects dashboard windows longer than 32 calendar days", () => {
    const result = dashboardQuerySchema.safeParse({
      from: "2026-07-01",
      to: "2026-08-02",
    });

    expect(result.success).toBe(false);
  });
});
