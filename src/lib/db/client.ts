import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { AppError } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env/server";

let db: NodePgDatabase<typeof schema> | null = null;

export type DbExecutor = Pick<
  NodePgDatabase<typeof schema>,
  "select" | "insert" | "update" | "delete"
>;

/**
 * Purpose: Choose pg SSL settings from the database connection URL.
 * Inputs: PostgreSQL connection URL.
 * Output: SSL disabled for local loopback databases and certificate-verified SSL for hosted databases.
 * Side effects: None.
 */
export function getPgSslConfig(
  databaseUrl: string,
): false | { rejectUnauthorized: true } {
  try {
    const url = new URL(databaseUrl);
    const sslMode = url.searchParams.get("sslmode");
    if (sslMode === "disable") return false;
    if (sslMode === "no-verify") {
      throw new Error(
        "sslmode=no-verify is not permitted for application database connections.",
      );
    }
    if (sslMode === "require") return { rejectUnauthorized: true };
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    if (["localhost", "127.0.0.1", "::1"].includes(hostname)) return false;
  } catch {
    if (databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1"))
      return false;
  }
  return { rejectUnauthorized: true };
}

/**
 * Purpose: Return the process-wide Drizzle database client.
 * Inputs: DATABASE_URL from validated environment.
 * Output: Drizzle PostgreSQL database bound to the application schema.
 * Side effects: Lazily opens a pg connection pool.
 * Failure behavior: Throws INTEGRATION_NOT_CONFIGURED when DATABASE_URL is missing.
 */
export function getDb(): NodePgDatabase<typeof schema> {
  if (db) return db;
  const databaseUrl = getServerEnv().DATABASE_URL;
  if (!databaseUrl) {
    throw new AppError("INTEGRATION_NOT_CONFIGURED", 503, "Database is not configured.");
  }
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: getPgSslConfig(databaseUrl),
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  });
  db = drizzle(pool, { schema });
  return db;
}

/**
 * Purpose: Execute related repository writes in one PostgreSQL transaction.
 * Inputs: Callback receiving a transaction-scoped Drizzle executor.
 * Output: The callback result after commit.
 * Side effects: Opens, commits, or rolls back a database transaction.
 * Failure behavior: Propagates callback or database errors after rollback.
 */
export async function runDbTransaction<T>(
  operation: (tx: DbExecutor) => Promise<T>,
): Promise<T> {
  return getDb().transaction((tx) => operation(tx));
}
