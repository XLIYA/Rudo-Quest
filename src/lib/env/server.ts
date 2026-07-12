import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWKS_URL: z.url().optional().or(z.literal("")),
  DATABASE_URL: z.string().optional(),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_SLUG: z.string().optional(),
  GITHUB_APP_CLIENT_ID: z.string().optional(),
  GITHUB_APP_CLIENT_SECRET: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.url().optional().or(z.literal("")),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  KV_REST_API_URL: z.url().optional().or(z.literal("")),
  KV_REST_API_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.url().optional().or(z.literal("")),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

/**
 * Purpose: Parse process environment into a typed server configuration object.
 * Inputs: process.env from the current runtime.
 * Output: Validated environment values with optional integrations represented as missing.
 * Side effects: Caches the parsed result for the process lifetime.
 * Failure behavior: Throws when an environment value has an invalid shape.
 */
export function getServerEnv(): ServerEnv {
  if (cachedEnv && cachedEnv.NODE_ENV !== "test") return cachedEnv;
  const parsed = serverEnvSchema.parse(process.env);
  if (parsed.NODE_ENV !== "test") cachedEnv = parsed;
  return parsed;
}

/**
 * Purpose: Determine whether Supabase-backed authentication and data access can run.
 * Inputs: Parsed server environment.
 * Output: Boolean readiness flag.
 * Side effects: None.
 */
export function hasSupabaseEnv(env: ServerEnv = getServerEnv()): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && getSupabasePublicKey(env));
}

/**
 * Purpose: Read the browser-safe Supabase key, supporting current and legacy names.
 * Inputs: Parsed server environment.
 * Output: Publishable or legacy anon key.
 * Side effects: None.
 */
export function getSupabasePublicKey(
  env: ServerEnv = getServerEnv(),
): string | undefined {
  return env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/**
 * Purpose: Read the server-only Supabase admin key, supporting current and legacy names.
 * Inputs: Parsed server environment.
 * Output: Secret or legacy service role key.
 * Side effects: None.
 */
export function getSupabaseAdminKey(env: ServerEnv = getServerEnv()): string | undefined {
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Purpose: Determine whether the database can accept Drizzle queries.
 * Inputs: Parsed server environment.
 * Output: Boolean readiness flag.
 * Side effects: None.
 */
export function hasDatabaseEnv(env: ServerEnv = getServerEnv()): boolean {
  return Boolean(env.DATABASE_URL);
}

/**
 * Purpose: Determine whether the GitHub App integration is configured.
 * Inputs: Parsed server environment.
 * Output: Boolean readiness flag.
 * Side effects: None.
 */
export function hasGitHubEnv(env: ServerEnv = getServerEnv()): boolean {
  return Boolean(
    env.GITHUB_APP_ID &&
    env.GITHUB_APP_SLUG &&
    env.GITHUB_APP_CLIENT_ID &&
    env.GITHUB_APP_CLIENT_SECRET &&
    env.GITHUB_APP_PRIVATE_KEY &&
    env.GITHUB_WEBHOOK_SECRET,
  );
}

/**
 * Purpose: Determine whether web push delivery is configured.
 * Inputs: Parsed server environment.
 * Output: Boolean readiness flag.
 * Side effects: None.
 */
export function hasPushEnv(env: ServerEnv = getServerEnv()): boolean {
  return Boolean(
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT,
  );
}

/**
 * Purpose: Read Upstash REST credentials from direct or Vercel Marketplace names.
 * Inputs: Parsed server environment.
 * Output: A complete credential pair, preferring direct Upstash names, or null.
 * Side effects: None.
 */
export function getRedisRestCredentials(
  env: ServerEnv = getServerEnv(),
): { url: string; token: string } | null {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    };
  }
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    return { url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN };
  }
  return null;
}

/**
 * Purpose: Verify the non-optional production runtime configuration at process startup.
 * Inputs: Parsed server environment, normally from process.env.
 * Output: Void when the application can safely start.
 * Side effects: None.
 * Failure behavior: Throws a descriptive startup error for missing base infrastructure.
 */
export function assertProductionEnv(env: ServerEnv = getServerEnv()): void {
  if (env.NODE_ENV !== "production") return;
  const missing = [
    ["NEXT_PUBLIC_APP_URL", env.NEXT_PUBLIC_APP_URL],
    ["NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL],
    [
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      getSupabasePublicKey(env),
    ],
    ["SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY", getSupabaseAdminKey(env)],
    ["DATABASE_URL", env.DATABASE_URL],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`,
    );
  }
}

/**
 * Purpose: Read a required integration value at runtime.
 * Inputs: Integration name and candidate value.
 * Output: The candidate value when present.
 * Side effects: None.
 * Failure behavior: Throws an integration error consumed by API handlers.
 */
export function requireIntegrationValue(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`INTEGRATION_NOT_CONFIGURED:${name}`);
  }
  return value;
}
