import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { migrationChecksum, matchesMigrationChecksum } from "./migration-checksum.mjs";

it("accepts historical Windows digests after an LF checkout without changing the ledger", () => {
  const sql = "CREATE TABLE example (id integer);\n-- A migration\n";
  const windows = sql.replace(/\n/g, "\r\n");
  const legacy = createHash("sha256").update(windows).digest("hex");
  expect(migrationChecksum(sql)).toBe(migrationChecksum(windows));
  expect(matchesMigrationChecksum(sql, legacy)).toBe(true);
  expect(matchesMigrationChecksum(windows, migrationChecksum(sql))).toBe(true);
  expect(matchesMigrationChecksum(sql.replace("integer", "text"), legacy)).toBe(false);
  expect(matchesMigrationChecksum(sql + "-- edited\n", migrationChecksum(sql))).toBe(
    false,
  );
});
