import process from "node:process";
import pg from "pg";

const { Pool } = pg;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function upsertVaultSecret(client, name, value, description) {
  const existing = await client.query(
    "select id from vault.secrets where name = $1 order by updated_at desc limit 1",
    [name],
  );
  const id = existing.rows[0]?.id;
  if (id) {
    await client.query("select vault.update_secret($1::uuid, $2, $3, $4)", [
      id,
      value,
      name,
      description,
    ]);
    return;
  }
  await client.query("select vault.create_secret($1, $2, $3)", [
    value,
    name,
    description,
  ]);
}

async function main() {
  const databaseUrl = required("DATABASE_URL");
  const appUrl = new URL(required("NEXT_PUBLIC_APP_URL"));
  if (appUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS for the hosted Cron target.");
  }
  const cronSecret = required("CRON_SECRET");
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: true },
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await upsertVaultSecret(
      client,
      "rudo_quest_app_url",
      appUrl.origin,
      "Canonical Rudo Quest URL used by Supabase Cron",
    );
    await upsertVaultSecret(
      client,
      "rudo_quest_cron_secret",
      cronSecret,
      "Bearer credential used by the Rudo Quest notification job",
    );
    await client.query("commit");
    process.stdout.write("Supabase Cron Vault settings configured.\n");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown configuration failure.";
  process.stderr.write(`Supabase Cron configuration failed: ${message}\n`);
  process.exitCode = 1;
});
