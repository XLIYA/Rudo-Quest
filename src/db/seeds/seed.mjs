import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Pool } = pg;

const DEFAULTS = {
  email: "xilyag@gmail.com",
  displayName: "Rudo Admin",
  handle: "xilyag",
  timeZone: "UTC",
};

const STORAGE_BUCKET = "profile-assets";

/**
 * Purpose: Parse a single dotenv value without adding a runtime dependency.
 * Inputs: Raw value text from a dotenv assignment.
 * Output: Unquoted environment value.
 * Side effects: None.
 */
function parseEnvValue(rawValue) {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Purpose: Load a dotenv file into process.env for local seed runs.
 * Inputs: Absolute dotenv file path.
 * Output: None.
 * Side effects: Mutates process.env for keys not already present.
 * Failure behavior: Missing files are ignored so CI can provide env directly.
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
 * Purpose: Load project-local env files in the same order expected for dev seeding.
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
 * Purpose: Read a required environment variable with a clear operator-facing error.
 * Inputs: Environment variable name.
 * Output: Non-empty string value.
 * Side effects: None.
 * Failure behavior: Throws when the value is missing.
 */
function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Configure Supabase local or hosted credentials in .env.local before running npm run db:seed.`,
    );
  }
  return value;
}

/**
 * Purpose: Read a seed-specific optional environment value with a default.
 * Inputs: Environment variable name and default value.
 * Output: Non-empty seed configuration value.
 * Side effects: None.
 */
function readSeedEnv(name, defaultValue) {
  return process.env[name]?.trim() || defaultValue;
}

/**
 * Purpose: Build a server-only Supabase admin client for auth and storage bootstrap.
 * Inputs: Public Supabase URL and service role key.
 * Output: Supabase client with session persistence disabled.
 * Side effects: None.
 * Business rule: The service role key must never be exposed to browser code.
 */
function createSupabaseAdmin(url, serviceRoleKey) {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Purpose: Find an existing Supabase Auth user by email.
 * Inputs: Supabase admin client and lowercase email.
 * Output: Auth user or null.
 * Side effects: Calls Supabase Auth Admin listUsers.
 * Failure behavior: Throws the Supabase Admin error when listing fails.
 */
async function findAuthUserByEmail(supabase, email) {
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

/**
 * Purpose: Create or update the configured verified development admin auth user.
 * Inputs: Supabase admin client, email, password, and display name.
 * Output: Supabase Auth user.
 * Side effects: Creates or updates an auth user through Supabase Admin APIs.
 * Failure behavior: Throws when the user cannot be created or located.
 */
async function ensureAuthUser(supabase, { email, password, displayName }) {
  const normalizedEmail = email.toLowerCase();
  const { data, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { name: displayName },
  });

  if (!error && data.user) return data.user;

  const existing = await findAuthUserByEmail(supabase, normalizedEmail);
  if (!existing) throw error;

  const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(
    existing.id,
    {
      password,
      email_confirm: true,
      user_metadata: { ...existing.user_metadata, name: displayName },
    },
  );
  if (updateError) throw updateError;
  return updated.user ?? existing;
}

/**
 * Purpose: Pick a unique profile handle for a newly seeded user.
 * Inputs: PostgreSQL pool, desired handle, and auth user ID.
 * Output: Existing or unique handle.
 * Side effects: Reads the profiles table.
 * Business rule: Handles are lowercase and unique.
 */
async function resolveProfileHandle(pool, desiredHandle, userId) {
  const normalized = desiredHandle.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 30);
  const existingProfile = await pool.query("select handle from profiles where id = $1", [userId]);
  if (existingProfile.rows[0]?.handle) return existingProfile.rows[0].handle;

  const handleRows = await pool.query("select id from profiles where handle = $1", [normalized]);
  if (!handleRows.rows.length || handleRows.rows[0].id === userId) return normalized;

  return `${normalized.slice(0, 23)}-${userId.slice(0, 6).toLowerCase()}`;
}

/**
 * Purpose: Upsert the app profile corresponding to a Supabase Auth user.
 * Inputs: PostgreSQL pool and profile fields.
 * Output: Persisted profile row.
 * Side effects: Inserts or updates the profiles table.
 * Failure behavior: Throws if migrations have not run or the profile write fails.
 */
async function upsertProfile(pool, { userId, email, displayName, handle, timeZone }) {
  const resolvedHandle = await resolveProfileHandle(pool, handle, userId);
  const result = await pool.query(
    `
      insert into profiles (
        id,
        email,
        handle,
        display_name,
        time_zone,
        theme_preference,
        notifications_enabled,
        daily_reminder_enabled,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, 'system', true, true, now(), now())
      on conflict (id) do update
      set
        email = excluded.email,
        display_name = excluded.display_name,
        time_zone = excluded.time_zone,
        updated_at = now()
      returning id, email, handle, display_name
    `,
    [userId, email.toLowerCase(), resolvedHandle, displayName, timeZone],
  );
  return result.rows[0];
}

/**
 * Purpose: Ensure the private Supabase Storage bucket used by profile assets exists.
 * Inputs: Supabase admin client.
 * Output: Bucket status string for operator feedback.
 * Side effects: Lists and may create a storage bucket.
 * Failure behavior: Throws only when Supabase Storage rejects a non-duplicate create.
 */
async function ensureProfileAssetsBucket(supabase) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;
  if (buckets.some((bucket) => bucket.name === STORAGE_BUCKET)) return "exists";

  const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: 4_000_000,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error && !/already exists/i.test(error.message)) throw error;
  return error ? "exists" : "created";
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
    ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
  });
}

/**
 * Purpose: Seed the requested local development admin account.
 * Inputs: Environment variables loaded from shell, `.env.local`, or `.env`.
 * Output: None.
 * Side effects: Creates or updates Supabase Auth user, profile row, and storage bucket.
 * Failure behavior: Exits non-zero with a concise setup error.
 */
async function main() {
  loadLocalEnv();

  const supabaseUrl = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const databaseUrl = readRequiredEnv("DATABASE_URL");
  const email = readSeedEnv("SEED_ADMIN_EMAIL", DEFAULTS.email);
  const password = readRequiredEnv("SEED_ADMIN_PASSWORD");
  const displayName = readSeedEnv("SEED_ADMIN_DISPLAY_NAME", DEFAULTS.displayName);
  const handle = readSeedEnv("SEED_ADMIN_HANDLE", DEFAULTS.handle);
  const timeZone = readSeedEnv("SEED_ADMIN_TIME_ZONE", DEFAULTS.timeZone);

  const supabase = createSupabaseAdmin(supabaseUrl, serviceRoleKey);
  const pool = createPool(databaseUrl);

  try {
    const user = await ensureAuthUser(supabase, { email, password, displayName });
    const profile = await upsertProfile(pool, {
      userId: user.id,
      email,
      displayName,
      handle,
      timeZone,
    });
    const bucketStatus = await ensureProfileAssetsBucket(supabase);

    process.stdout.write(`Seeded admin auth user: ${email}\n`);
    process.stdout.write(`Profile handle: ${profile.handle}\n`);
    process.stdout.write(`Storage bucket "${STORAGE_BUCKET}": ${bucketStatus}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown seed failure.";
  process.stderr.write(`Seed failed: ${message}\n`);
  process.exitCode = 1;
});
