/** Purpose: Hash normalized SQL. Inputs: SQL text. Output: Digest. Side effects: None. */
export function migrationChecksum(sql: string): string;
/** Purpose: Check canonical/legacy digests. Inputs: SQL and digest. Output: Match flag. Side effects: None. */
export function matchesMigrationChecksum(sql: string, stored: string): boolean;
