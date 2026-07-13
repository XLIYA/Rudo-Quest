type StructuredLogValue = string | number | boolean | null;

/**
 * Purpose: Emit a single machine-readable operational event without request payloads or secrets.
 * Inputs: Stable event name and explicitly safe scalar metadata.
 * Output: Void.
 * Side effects: Writes one JSON record to the server log stream.
 */
export function writeStructuredLog(
  event: string,
  metadata: Record<string, StructuredLogValue> = {},
): void {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event,
      ...metadata,
    }),
  );
}
