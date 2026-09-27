import crypto from "node:crypto";

/** Purpose: Hash SQL consistently across Windows/Linux checkouts. Inputs: SQL text. Output: SHA-256 digest. Side effects: None. */
export function migrationChecksum(sql) {
  return crypto.createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
}

/** Purpose: Accept canonical or historical CRLF digests without accepting SQL edits. Inputs: SQL and stored digest. Output: Match flag. Side effects: None; existing ledger rows remain unchanged. */
export function matchesMigrationChecksum(sql, stored) {
  if (migrationChecksum(sql) === stored) return true;
  const windowsSql = sql.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
  return crypto.createHash("sha256").update(windowsSql).digest("hex") === stored;
}
