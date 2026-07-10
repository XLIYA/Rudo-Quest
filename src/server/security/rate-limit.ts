import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { AppError } from "@/lib/api/errors";
import { getRedisRestCredentials, getServerEnv } from "@/lib/env/server";

type LocalHit = { count: number; resetAt: number };
const localHits = new Map<string, LocalHit>();
let sharedRedis: Redis | null = null;
const sharedLimiters = new Map<string, Ratelimit>();

function limiterCacheKey(key: string, limit: number, windowSeconds: number): string {
  return `${key}:${limit}:${windowSeconds}`;
}

/**
 * Purpose: Rate-limit sensitive routes with Upstash in production and a bounded local fallback in development.
 * Inputs: Limit key, request identity, count, and time window in seconds.
 * Output: Resolves when the caller may continue.
 * Side effects: Writes rate-limit counters to Upstash or process memory.
 * Failure behavior: Throws RATE_LIMITED or integration error when production Redis is absent.
 */
export async function assertRateLimit(
  key: string,
  identity: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const env = getServerEnv();
  const redisCredentials = getRedisRestCredentials(env);
  if (redisCredentials) {
    sharedRedis ??= new Redis({
      url: redisCredentials.url,
      token: redisCredentials.token,
    });
    const cacheKey = limiterCacheKey(key, limit, windowSeconds);
    let limiter = sharedLimiters.get(cacheKey);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: sharedRedis,
        limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
        analytics: false,
        prefix: "rudo",
      });
      sharedLimiters.set(cacheKey, limiter);
    }
    const result = await limiter.limit(`${key}:${identity}`);
    if (!result.success) {
      throw new AppError("RATE_LIMITED", 429, "Too many requests.");
    }
    return;
  }
  if (env.NODE_ENV === "production") {
    throw new AppError(
      "INTEGRATION_NOT_CONFIGURED",
      503,
      "Upstash Redis is required for production rate limiting.",
    );
  }
  const now = Date.now();
  const hitKey = `${key}:${identity}`;
  const hit = localHits.get(hitKey);
  if (!hit || hit.resetAt < now) {
    localHits.set(hitKey, { count: 1, resetAt: now + windowSeconds * 1000 });
    return;
  }
  hit.count += 1;
  if (hit.count > limit) {
    throw new AppError("RATE_LIMITED", 429, "Too many requests.");
  }
}
