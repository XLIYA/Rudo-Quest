import { describe, expect, it } from "vitest";
import {
  createTaskLinkAttachmentSchema,
  taskAttachmentUploadMetadataSchema,
} from "./tasks";

describe("task attachment validation", () => {
  it("accepts only http and https links", () => {
    expect(
      createTaskLinkAttachmentSchema.parse({
        label: "Design reference",
        url: "https://example.com/design",
      }),
    ).toEqual({ label: "Design reference", url: "https://example.com/design" });
    expect(() =>
      createTaskLinkAttachmentSchema.parse({
        label: "Unsafe",
        url: "javascript:alert(1)",
      }),
    ).toThrow();
  });

  it("rejects a permitted extension paired with the wrong MIME type", () => {
    expect(() =>
      taskAttachmentUploadMetadataSchema.parse({
        fileName: "report.pdf",
        contentType: "image/png",
        size: 512,
      }),
    ).toThrow();
  });

  it("rejects files larger than ten MiB", () => {
    expect(() =>
      taskAttachmentUploadMetadataSchema.parse({
        fileName: "report.pdf",
        contentType: "application/pdf",
        size: 10 * 1024 * 1024 + 1,
      }),
    ).toThrow();
  });
});
