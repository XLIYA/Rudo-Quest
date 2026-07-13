import { describe, expect, it } from "vitest";
import { requestIdFrom } from "./response";

describe("requestIdFrom", () => {
  it("preserves a safe caller-provided request ID", () => {
    expect(requestIdFrom("web.abc-123:_trace")).toBe("web.abc-123:_trace");
  });

  it.each(["contains a space", "line\nbreak", "x".repeat(121)])(
    "replaces unsafe request ID %j",
    (incoming) => {
      const requestId = requestIdFrom(incoming);

      expect(requestId).not.toBe(incoming);
      expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    },
  );
});
