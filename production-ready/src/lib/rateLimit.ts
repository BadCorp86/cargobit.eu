/**
 * Redis-based Token Bucket Rate Limiting
 * 
 * Uses sliding window algorithm for accurate rate limiting.
 * Supports multiple endpoints with configurable limits.
 */

import { Redis } from "ioredis";

// Redis client singleton
let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is not set");
    }
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    redis.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });
  }
  return redis;
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  limit: number;
  /** Time window in seconds */
  windowSec: number;
  /** Key prefix for Redis (default: 'rl') */
  prefix?: string;
  /** Whether to use sliding window (more accurate but slightly slower) */
  slidingWindow?: boolean;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in current window */
  remaining: number;
  /** Unix timestamp when the limit resets */
  resetAt: number;
  /** Time in seconds until reset */
  retryAfter: number;
}

/**
 * Token Bucket Rate Limiter using Redis
 * 
 * @example
 * const result = await rateLimit("user:123:api", { limit: 100, windowSec: 60 });
 * if (!result.allowed) {
 *   return res.status(429).json({ error: "Rate limit exceeded" });
 * }
 */
export async function rateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const client = getRedisClient();
  const { limit, windowSec, prefix = "rl", slidingWindow = true } = config;

  const fullKey = `${prefix}:${key}`;
  const now = Date.now();
  const windowStart = now - windowSec * 1000;

  if (slidingWindow) {
    // Sliding window: more accurate, removes expired entries
    const results = await client
      .multi()
      .zremrangebyscore(fullKey, 0, windowStart) // Remove expired entries
      .zadd(fullKey, now, `${now}-${Math.random().toString(36).slice(2)}`) // Add new entry
      .zcard(fullKey) // Count current entries
      .pexpire(fullKey, windowSec * 1000) // Set TTL
      .exec();

    // Extract count from zcard result
    const count = results?.[2]?.[1] as number ?? 0;
    const remaining = Math.max(0, limit - count);
    const resetAt = now + windowSec * 1000;

    return {
      allowed: count <= limit,
      remaining,
      resetAt,
      retryAfter: count > limit ? Math.ceil(windowSec) : 0,
    };
  } else {
    // Fixed window: simpler but allows burst at boundary
    const results = await client
      .multi()
      .incr(fullKey)
      .pttl(fullKey)
      .exec();

    let count = results?.[0]?.[1] as number ?? 1;
    let ttl = results?.[1]?.[1] as number ?? -1;

    // If key is new, set expiry
    if (ttl === -1) {
      await client.pexpire(fullKey, windowSec * 1000);
      ttl = windowSec * 1000;
    }

    // Handle case where INCR returns string
    if (typeof count === "string") {
      count = parseInt(count, 10);
    }

    const remaining = Math.max(0, limit - count);
    const resetAt = now + ttl;

    return {
      allowed: count <= limit,
      remaining,
      resetAt,
      retryAfter: count > limit ? Math.ceil(ttl / 1000) : 0,
    };
  }
}

/**
 * Reset rate limit for a specific key
 */
export async function resetRateLimit(key: string, prefix = "rl"): Promise<void> {
  const client = getRedisClient();
  await client.del(`${prefix}:${key}`);
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  key: string,
  config: RateLimitConfig
): Promise<{ count: number; remaining: number; resetAt: number }> {
  const client = getRedisClient();
  const { limit, windowSec, prefix = "rl" } = config;

  const fullKey = `${prefix}:${key}`;
  const now = Date.now();
  const windowStart = now - windowSec * 1000;

  // Remove expired and count
  await client.zremrangebyscore(fullKey, 0, windowStart);
  const count = await client.zcard(fullKey);
  const ttl = await client.pttl(fullKey);

  return {
    count,
    remaining: Math.max(0, limit - count),
    resetAt: ttl > 0 ? now + ttl : now + windowSec * 1000,
  };
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<{
  status: "healthy" | "unhealthy";
  latency?: number;
  error?: string;
}> {
  try {
    const client = getRedisClient();
    const start = Date.now();
    await client.ping();
    return {
      status: "healthy",
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
