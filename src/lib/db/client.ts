import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { AppError } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env/server";

let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

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
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  db = drizzle(pool, { schema });
  return db;
}

/**
 * Purpose: Close the shared pg pool during tests and scripted shutdowns.
 * Inputs: None.
 * Output: Promise that resolves after pool shutdown.
 * Side effects: Ends open database sockets and clears cached clients.
 */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
  db = null;
}
