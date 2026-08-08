import { describe, expect, it } from "vitest";
import { isTaskAttachmentContentValid } from "./task-attachments";

describe("task attachment byte validation", () => {
  it("accepts a PDF signature and rejects spoofed PDF bytes", async () => {
    await expect(
      isTaskAttachmentContentValid(Buffer.from("%PDF-1.7\nbody"), "application/pdf"),
    ).resolves.toBe(true);
    await expect(
      isTaskAttachmentContentValid(
        Buffer.from("<html>payload</html>"),
        "application/pdf",
      ),
    ).resolves.toBe(false);
  });

  it("requires valid JSON content", async () => {
    await expect(
      isTaskAttachmentContentValid(Buffer.from('{"safe":true}'), "application/json"),
    ).resolves.toBe(true);
    await expect(
      isTaskAttachmentContentValid(Buffer.from("not-json"), "application/json"),
    ).resolves.toBe(false);
  });
});
