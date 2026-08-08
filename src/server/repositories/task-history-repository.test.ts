import { describe, expect, it } from "vitest";
import {
  decodeTaskHistoryCursor,
  encodeTaskHistoryCursor,
} from "./task-history-repository";

const taskId = "00000000-0000-4000-8000-000000000001";

describe("task history cursor", () => {
  it("round-trips the strict ordering tuple", () => {
    expect(
      decodeTaskHistoryCursor(encodeTaskHistoryCursor("2026-08-07", taskId)),
    ).toEqual({ sortValue: "2026-08-07", id: taskId });
  });

  it("rejects malformed and forged cursor shapes", () => {
    expect(() => decodeTaskHistoryCursor("not-a-cursor")).toThrowError(
      /cursor is invalid/i,
    );
    expect(() =>
      decodeTaskHistoryCursor(
        Buffer.from(JSON.stringify({ sortValue: "2026-08-07", id: "nope" })).toString(
          "base64url",
        ),
      ),
    ).toThrowError(/cursor is invalid/i);
  });
});
