import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiGet,
  apiMutation,
  normalizeApiClientError,
  type ApiClientError,
} from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeApiClientError", () => {
  it("returns already-normalized API client errors unchanged", () => {
    const error: ApiClientError = {
      code: "VALIDATION_ERROR",
      message: "Validation failed.",
      requestId: "request-1",
      status: 400,
      fieldErrors: { title: ["Required"] },
    };

    expect(normalizeApiClientError(error)).toBe(error);
  });

  it("unwraps successful API envelopes and sends a request ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { title: "Trail plan" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiGet<{ title: string }>("/api/projects")).resolves.toEqual({
      title: "Trail plan",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        headers: expect.objectContaining({ "x-request-id": expect.any(String) }),
      }),
    );
  });

  it("normalizes structured HTTP failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "Validation failed.",
              fieldErrors: { title: ["Required"] },
            },
            requestId: "server-request",
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(apiMutation("post", "/api/projects", {})).rejects.toEqual({
      code: "VALIDATION_ERROR",
      message: "Validation failed.",
      fieldErrors: { title: ["Required"] },
      requestId: "server-request",
      status: 400,
    });
  });
});
