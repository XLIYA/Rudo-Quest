import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;

/**
 * Purpose: Parse a single dotenv value without adding a runtime dependency.
 * Inputs: Raw value text from a dotenv assignment.
 * Output: Unquoted environment value.
 * Side effects: None.
 */
function parseEnvValue(rawValue) {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Purpose: Load a dotenv file into process.env for local database commands.
 * Inputs: Absolute dotenv file path.
 * Output: None.
 * Side effects: Mutates process.env for keys not already present.
 */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = parseEnvValue(trimmed.slice(equalsIndex + 1));
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Purpose: Load project-local env files for migration commands.
 * Inputs: Current working directory.
 * Output: None.
 * Side effects: Reads `.env.local` and `.env` when present.
 */
function loadLocalEnv() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env"));
}

/**
 * Purpose: Read a required environment variable with a clear setup error.
 * Inputs: Environment variable name.
 * Output: Non-empty string value.
 * Side effects: None.
 */
function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Configure it in .env.local before running npm run db:migrate.`,
    );
  }
  return value;
}

/**
 * Purpose: Create a PostgreSQL pool matching the app's Drizzle connection behavior.
 * Inputs: Database URL.
 * Output: pg Pool.
 * Side effects: Opens database sockets lazily.
 */
function createPool(databaseUrl) {
  return new Pool({
    connectionString: databaseUrl,
    ssl:
      databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
  });
}

/**
 * Purpose: Calculate a stable checksum for migration drift detection.
 * Inputs: Migration SQL text.
 * Output: Hex SHA-256 checksum.
 * Side effects: None.
 */
function checksum(sql) {
  return crypto.createHash("sha256").update(sql).digest("hex");
}

/**
 * Purpose: Read SQL migrations in deterministic order.
 * Inputs: Current working directory.
 * Output: Migration descriptors.
 * Side effects: Reads migration files.
 */
function readMigrations() {
  const migrationsDir = path.join(process.cwd(), "src/db/migrations");
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migration directory not found: ${migrationsDir}`);
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => {
      const id = file;
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      return { id, sql, checksum: checksum(sql) };
    });
}

/**
 * Purpose: Apply pending SQL migrations with an app-owned migration ledger.
 * Inputs: PostgreSQL client and migration descriptors.
 * Output: Applied and skipped counts.
 * Side effects: Creates tables, policies, indexes, and migration ledger rows.
 */
async function applyMigrations(client, migrations) {
  await client.query(`
    create table if not exists public.__app_migrations (
      id text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);

  const appliedRows = await client.query(
    "select id, checksum from public.__app_migrations",
  );
  const applied = new Map(appliedRows.rows.map((row) => [row.id, row.checksum]));
  let appliedCount = 0;
  let skippedCount = 0;

  for (const migration of migrations) {
    const previousChecksum = applied.get(migration.id);
    if (previousChecksum === migration.checksum) {
      skippedCount += 1;
      process.stdout.write(`Skipped ${migration.id}\n`);
      continue;
    }
    if (previousChecksum) {
      throw new Error(
        `Migration ${migration.id} changed after it was applied. Create a new migration instead.`,
      );
    }

    await client.query("begin");
    try {
      await client.query(migration.sql);
      await client.query(
        "insert into public.__app_migrations (id, checksum) values ($1, $2)",
        [migration.id, migration.checksum],
      );
      await client.query("commit");
      appliedCount += 1;
      process.stdout.write(`Applied ${migration.id}\n`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  return { appliedCount, skippedCount };
}

async function main() {
  loadLocalEnv();

  const databaseUrl = readRequiredEnv("DATABASE_URL");
  const migrations = readMigrations();
  const pool = createPool(databaseUrl);
  const client = await pool.connect();

  try {
    const result = await applyMigrations(client, migrations);
    process.stdout.write(
      `Migrations complete. Applied: ${result.appliedCount}. Skipped: ${result.skippedCount}.\n`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown migration failure.";
  process.stderr.write(`Migration failed: ${message}\n`);
  process.exitCode = 1;
});
