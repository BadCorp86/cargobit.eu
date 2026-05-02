/**
 * Rate Limiting Middleware for Express
 * 
 * Provides per-endpoint rate limiting with configurable limits.
 * Supports IP-based, user-based, and custom key-based limiting.
 */

import { Request, Response, NextFunction } from "express";
import { rateLimit, RateLimitConfig, RateLimitResult, closeRedis } from "../lib/rateLimit";

// ============================================
// Rate Limit Configuration
// ============================================

export interface EndpointRateLimit {
  limit: number;
  windowSec: number;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  handler?: (req: Request, res: Response, result: RateLimitResult) => void;
}

// Default rate limits per endpoint pattern
export const DEFAULT_RATE_LIMITS: Record<string, EndpointRateLimit> = {
  // Public API - moderate limits
  "GET /api/public/*": { limit: 100, windowSec: 60 },
  "POST /api/public/*": { limit: 20, windowSec: 60 },

  // Authentication - strict limits (prevent brute force)
  "POST /api/auth/login": { limit: 5, windowSec: 300 },     // 5 per 5 min
  "POST /api/auth/register": { limit: 3, windowSec: 3600 }, // 3 per hour
  "POST /api/auth/forgot-password": { limit: 3, windowSec: 3600 },
  "POST /api/auth/reset-password": { limit: 5, windowSec: 3600 },

  // User API - standard limits
  "GET /api/users/*": { limit: 100, windowSec: 60 },
  "GET /api/payments/*": { limit: 100, windowSec: 60 },
  "POST /api/payments": { limit: 20, windowSec: 60 },

  // Admin API - very strict limits for destructive operations
  "DELETE /api/admin/*": { limit: 10, windowSec: 60 },
  "POST /api/admin/*": { limit: 30, windowSec: 60 },

  // Webhooks - high limits (from trusted sources)
  "POST /api/webhooks/*": { limit: 1000, windowSec: 60 },

  // Exports - resource intensive
  "POST /api/exports": { limit: 5, windowSec: 300 },
  "GET /api/exports/*": { limit: 30, windowSec: 60 },
};

// ============================================
// Key Generators
// ============================================

/**
 * Default key generator: IP + Path
 */
export function defaultKeyGenerator(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const path = req.path;
  return `${ip}:${path}`;
}

/**
 * User-based key generator: User ID (requires authentication)
 */
export function userKeyGenerator(req: Request): string {
  const userId = (req as any).user?.id;
  if (!userId) {
    // Fall back to IP if not authenticated
    return defaultKeyGenerator(req);
  }
  return `user:${userId}:${req.path}`;
}

/**
 * Combined key generator: IP + User ID (if available)
 */
export function combinedKeyGenerator(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const userId = (req as any).user?.id;
  if (userId) {
    return `combined:${ip}:user:${userId}:${req.path}`;
  }
  return `combined:${ip}:${req.path}`;
}

// ============================================
// Middleware Factory
// ============================================

/**
 * Create rate limiting middleware with custom configuration
 */
export function createRateLimitMiddleware(config: EndpointRateLimit) {
  const {
    limit,
    windowSec,
    keyGenerator = defaultKeyGenerator,
    skip,
    handler,
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if condition is met
    if (skip?.(req)) {
      return next();
    }

    // Generate key
    const key = keyGenerator(req);

    try {
      const result = await rateLimit(key, { limit, windowSec });

      // Set standard rate limit headers
      res.setHeader("X-RateLimit-Limit", limit.toString());
      res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
      res.setHeader("X-RateLimit-Reset", result.resetAt.toString());

      if (!result.allowed) {
        res.setHeader("Retry-After", result.retryAfter.toString());

        if (handler) {
          handler(req, res, result);
        } else {
          res.status(429).json({
            error: "Too Many Requests",
            message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
            retryAfter: result.retryAfter,
          });
        }
        return;
      }

      next();
    } catch (error) {
      console.error("[RateLimit] Error:", error);

      // Fail open: allow request if rate limiting fails
      // Change to fail closed for security-critical applications
      if (process.env.RATE_LIMIT_FAIL_STRATEGY === "closed") {
        res.status(503).json({
          error: "Service Unavailable",
          message: "Rate limiting service unavailable",
        });
        return;
      }

      next();
    }
  };
}

/**
 * Pre-configured rate limit middleware for common patterns
 */
export const rateLimiters = {
  // Strict limiter for auth endpoints
  auth: createRateLimitMiddleware({
    limit: 5,
    windowSec: 300,
    keyGenerator: (req) => {
      const ip = req.ip || "unknown";
      const email = req.body?.email || "";
      return `auth:${ip}:${email.toLowerCase()}`;
    },
  }),

  // Standard API limiter
  api: createRateLimitMiddleware({
    limit: 100,
    windowSec: 60,
    keyGenerator: userKeyGenerator,
  }),

  // Public endpoint limiter (IP-based)
  public: createRateLimitMiddleware({
    limit: 60,
    windowSec: 60,
    keyGenerator: defaultKeyGenerator,
  }),

  // Admin limiter (strict)
  admin: createRateLimitMiddleware({
    limit: 30,
    windowSec: 60,
    keyGenerator: userKeyGenerator,
  }),

  // Webhook limiter (high throughput)
  webhook: createRateLimitMiddleware({
    limit: 1000,
    windowSec: 60,
    keyGenerator: (req) => {
      // For Stripe webhooks, use source IP validation instead
      return `webhook:${req.path}`;
    },
    skip: (req) => {
      // Skip rate limiting for webhooks from trusted IPs
      const trustedIPs = process.env.WEBHOOK_TRUSTED_IPS?.split(",") || [];
      const ip = req.ip || "";
      return trustedIPs.includes(ip);
    },
  }),

  // Export limiter (resource-intensive)
  export: createRateLimitMiddleware({
    limit: 5,
    windowSec: 300,
    keyGenerator: userKeyGenerator,
  }),
};

// ============================================
// Dynamic Rate Limiting
// ============================================

/**
 * Apply rate limiting based on route pattern
 */
export function dynamicRateLimitMiddleware(
  limits: Record<string, EndpointRateLimit> = DEFAULT_RATE_LIMITS
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const method = req.method;
    const path = req.path;

    // Find matching rate limit config
    let matchedConfig: EndpointRateLimit | null = null;

    for (const [pattern, config] of Object.entries(limits)) {
      const [configMethod, configPath] = pattern.split(" ");

      // Check method match
      if (configMethod !== method && configMethod !== "*") {
        continue;
      }

      // Check path match (simple glob support)
      if (configPath.includes("*")) {
        const regex = new RegExp("^" + configPath.replace(/\*/g, ".*") + "$");
        if (regex.test(path)) {
          matchedConfig = config;
          break;
        }
      } else if (configPath === path) {
        matchedConfig = config;
        break;
      }
    }

    if (matchedConfig) {
      const middleware = createRateLimitMiddleware(matchedConfig);
      return middleware(req, res, next);
    }

    // No matching config - use default
    const defaultMiddleware = createRateLimitMiddleware({
      limit: 100,
      windowSec: 60,
    });
    return defaultMiddleware(req, res, next);
  };
}

// ============================================
// Graceful Shutdown
// ============================================

process.on("SIGTERM", async () => {
  console.log("[RateLimit] Closing Redis connection...");
  await closeRedis();
});

process.on("SIGINT", async () => {
  console.log("[RateLimit] Closing Redis connection...");
  await closeRedis();
});
