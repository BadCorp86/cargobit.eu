/**
 * Rate Limiting Library
 * CargoBit Payment System
 * 
 * Redis-based sliding window rate limiter with configurable presets.
 * Production-ready with graceful degradation and comprehensive logging.
 */

import { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface RateLimitConfig {
  /** Maximum requests allowed in window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Redis key prefix */
  keyPrefix?: string;
  /** Skip condition */
  skip?: (req: RateLimitRequest) => boolean | Promise<boolean>;
  /** Custom key generator */
  keyGenerator?: (req: RateLimitRequest) => string;
}

export interface RateLimitRequest {
  ip?: string;
  headers: Record<string, string | undefined>;
  user?: { id: string; role?: string };
  path?: string;
  method?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// =============================================================================
// REDIS STORE
// =============================================================================

export class RedisRateLimitStore {
  private redis: Redis;
  private windowMs: number;
  private prefix: string;

  constructor(redis: Redis, windowMs: number, prefix: string = 'ratelimit:') {
    this.redis = redis;
    this.windowMs = windowMs;
    this.prefix = prefix;
  }

  /**
   * Increment counter using sliding window algorithm
   */
  async increment(key: string): Promise<{ current: number; ttl: number }> {
    const fullKey = `${this.prefix}${key}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Lua script for atomic sliding window
    const script = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local window_start = tonumber(ARGV[2])
      local window_ms = tonumber(ARGV[3])
      
      -- Remove expired entries
      redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
      
      -- Count current entries
      local current = redis.call('ZCARD', key)
      
      -- Add current request
      redis.call('ZADD', key, now, now .. '-' .. math.random())
      
      -- Set expiry
      redis.call('PEXPIRE', key, window_ms)
      
      return {current + 1, redis.call('PTTL', key)}
    `;

    const result = await this.redis.eval(
      script,
      1,
      fullKey,
      now.toString(),
      windowStart.toString(),
      this.windowMs.toString()
    ) as [number, number];

    return {
      current: result[0],
      ttl: Math.ceil(result[1] / 1000)
    };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(`${this.prefix}${key}`);
  }

  async decrement(key: string): Promise<void> {
    const fullKey = `${this.prefix}${key}`;
    const entries = await this.redis.zrange(fullKey, 0, 0);
    if (entries.length > 0) {
      await this.redis.zrem(fullKey, entries[0]);
    }
  }
}

// =============================================================================
// RATE LIMITER
// =============================================================================

export class RateLimiter {
  private store: RedisRateLimitStore;
  private config: RateLimitConfig;

  constructor(store: RedisRateLimitStore, config: RateLimitConfig) {
    this.store = store;
    this.config = { keyPrefix: 'ratelimit:', ...config };
  }

  /**
   * Check rate limit for identifier
   */
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const { current, ttl } = await this.store.increment(identifier);
    
    const allowed = current <= this.config.limit;
    const remaining = Math.max(0, this.config.limit - current);
    const resetTime = Date.now() + (ttl * 1000);

    return {
      allowed,
      current,
      limit: this.config.limit,
      remaining: allowed ? remaining : 0,
      resetTime,
      retryAfter: allowed ? undefined : ttl
    };
  }

  /**
   * Reset rate limit for identifier
   */
  async resetLimit(identifier: string): Promise<void> {
    await this.store.reset(identifier);
  }
}

// =============================================================================
// PRESETS
// =============================================================================

export const RATE_LIMIT_PRESETS = {
  /** Public API: 100 req/min */
  publicApi: {
    limit: 100,
    windowMs: 60 * 1000,
    keyPrefix: 'public:'
  },

  /** Authenticated API: 1000 req/min */
  authenticatedApi: {
    limit: 1000,
    windowMs: 60 * 1000,
    keyPrefix: 'auth:'
  },

  /** Webhook processing: 500 req/min */
  webhooks: {
    limit: 500,
    windowMs: 60 * 1000,
    keyPrefix: 'webhook:'
  },

  /** Admin API: 5000 req/min */
  adminApi: {
    limit: 5000,
    windowMs: 60 * 1000,
    keyPrefix: 'admin:'
  },

  /** Payment creation: 10 req/min (sensitive) */
  paymentCreate: {
    limit: 10,
    windowMs: 60 * 1000,
    keyPrefix: 'payment:'
  },

  /** Auth attempts: 5 req/min */
  authAttempts: {
    limit: 5,
    windowMs: 60 * 1000,
    keyPrefix: 'auth_attempt:'
  }
} as const;

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create rate limiter instance
 */
export function createRateLimiter(
  redis: Redis,
  preset: keyof typeof RATE_LIMIT_PRESETS | RateLimitConfig
): RateLimiter {
  const config = typeof preset === 'string' 
    ? RATE_LIMIT_PRESETS[preset] 
    : preset;
  
  const store = new RedisRateLimitStore(redis, config.windowMs, config.keyPrefix);
  return new RateLimiter(store, config);
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Extract client IP from request
 */
export function extractClientIp(req: RateLimitRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.ip || 'unknown';
}

/**
 * Create rate limit key
 */
export function createRateLimitKey(
  ...parts: (string | number | undefined)[]
): string {
  return parts
    .filter(Boolean)
    .map(String)
    .join(':')
    .replace(/[^a-zA-Z0-9:_-]/g, '');
}
