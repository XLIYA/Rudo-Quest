import * as Sentry from "@sentry/nextjs";
import { Redis } from "@upstash/redis";
import { AppError } from "@/lib/api/errors";
import { getRedisRestCredentials, getServerEnv } from "@/lib/env/server";

let redis: Redis | null = null;
const localLocks = new Set<string>();

/**
 * Purpose: Run one job instance across concurrent serverless invocations.
 * Inputs: Stable lock name, expiry in seconds, and protected operation.
 * Output: Operation result, or null when another invocation owns the lock.
 * Side effects: Acquires and conditionally releases an Upstash Redis lock.
 */
export async function withDistributedLock<T>(
  name: string,
  ttlSeconds: number,
  operation: () => Promise<T>,
): Promise<T | null> {
  const env = getServerEnv();
  const credentials = getRedisRestCredentials(env);
  const key = `rudo:lock:${name}`;

  if (!credentials) {
    if (env.NODE_ENV === "production") {
      throw new AppError(
        "INTEGRATION_NOT_CONFIGURED",
        503,
        "Upstash Redis is required for scheduled jobs.",
      );
    }
    if (localLocks.has(key)) return null;
    localLocks.add(key);
    try {
      return await operation();
    } finally {
      localLocks.delete(key);
    }
  }

  redis ??= new Redis({ url: credentials.url, token: credentials.token });
  const token = crypto.randomUUID();
  const acquired = await redis.set(key, token, { nx: true, ex: ttlSeconds });
  if (acquired !== "OK") return null;

  try {
    return await operation();
  } finally {
    try {
      await redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        [key],
        [token],
      );
    } catch (error) {
      Sentry.captureException(error, { tags: { lock: name, phase: "release" } });
    }
  }
}
