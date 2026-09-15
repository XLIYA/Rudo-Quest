type StructuredLogValue = string | number | boolean | null;
type StructuredLogLevel = "info" | "error";

/**
 * Purpose: Emit a single machine-readable operational event without request payloads or secrets.
 * Inputs: Stable event name, explicitly safe scalar metadata, and optional level (default "info").
 * Output: Void.
 * Side effects: Writes one JSON record to the server log stream.
 */
export function writeStructuredLog(
  event: string,
  metadata: Record<string, StructuredLogValue> = {},
  level: StructuredLogLevel = "info",
): void {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...metadata,
    }),
  );
}
