/**
 * Rate Limiting Middleware
 * CargoBit Payment System
 * 
 * Express/Next.js middleware for distributed rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  createRateLimiter, 
  RATE_LIMIT_PRESETS,
  extractClientIp,
  RateLimitConfig 
} from '../lib/rateLimit';
import { getRedisClient } from '../lib/redis';

// =============================================================================
// TYPES
// =============================================================================

interface RateLimitMiddlewareOptions extends Partial<RateLimitConfig> {
  preset?: keyof typeof RATE_LIMIT_PRESETS;
  excludePaths?: string[];
  trustProxy?: boolean;
  onLimitReached?: (req: NextRequest, identifier: string) => void;
}

// =============================================================================
// MIDDLEWARE FACTORY
// =============================================================================

/**
 * Create rate limiting middleware
 */
export function rateLimitMiddleware(options: RateLimitMiddlewareOptions = {}) {
  const {
    preset,
    excludePaths = ['/health', '/metrics', '/favicon.ico'],
    trustProxy = true,
    onLimitReached,
    ...configOverrides
  } = options;

  const config: RateLimitConfig = preset
    ? { ...RATE_LIMIT_PRESETS[preset], ...configOverrides }
    : { limit: 100, windowMs: 60000, ...configOverrides };

  return async function middleware(req: NextRequest): Promise<NextResponse | null> {
    const pathname = req.nextUrl.pathname;
    
    // Skip excluded paths
    if (excludePaths.some(path => pathname.startsWith(path))) {
      return null;
    }

    try {
      const redis = getRedisClient();
      const limiter = createRateLimiter(redis, config);

      // Build identifier
      const ip = trustProxy 
        ? req.headers.get('x-forwarded-for')?.split(',')[0].trim() 
          || req.headers.get('x-real-ip') 
          || 'unknown'
        : 'unknown';

      const identifier = `${ip}:${pathname}`;
      
      // Check limit
      const result = await limiter.checkLimit(identifier);

      // Build headers
      const headers = new Headers();
      headers.set('X-RateLimit-Limit', String(config.limit));
      headers.set('X-RateLimit-Remaining', String(result.remaining));
      headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)));

      if (!result.allowed) {
        headers.set('Retry-After', String(result.retryAfter || 60));
        
        if (onLimitReached) {
          onLimitReached(req, identifier);
        }

        return NextResponse.json(
          {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: result.retryAfter
          },
          { status: 429, headers }
        );
      }

      // Continue - attach headers to response later
      return null;

    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open
      return null;
    }
  };
}

// =============================================================================
// PRECONFIGURED MIDDLEWARES
// =============================================================================

/**
 * Public API rate limiting (100 req/min)
 */
export const publicApiRateLimit = rateLimitMiddleware({
  preset: 'publicApi',
  onLimitReached: (req, identifier) => {
    console.warn(`Rate limit exceeded: ${identifier} on ${req.nextUrl.pathname}`);
  }
});

/**
 * Payment rate limiting (10 req/min - sensitive)
 */
export const paymentRateLimit = rateLimitMiddleware({
  preset: 'paymentCreate',
  excludePaths: ['/api/payments/success', '/api/payments/cancel']
});

/**
 * Auth attempts rate limiting (5 req/min)
 */
export const authRateLimit = rateLimitMiddleware({
  preset: 'authAttempts'
});

/**
 * Webhook rate limiting (500 req/min)
 */
export const webhookRateLimit = rateLimitMiddleware({
  preset: 'webhooks'
});

// =============================================================================
// COMBINED MIDDLEWARE
// =============================================================================

/**
 * Apply appropriate rate limiting based on route
 */
export async function applyRateLimit(req: NextRequest): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith('/api/webhooks/')) {
    return webhookRateLimit(req);
  }

  if (pathname.startsWith('/api/payments/') && req.method === 'POST') {
    return paymentRateLimit(req);
  }

  if (pathname.startsWith('/api/auth/')) {
    return authRateLimit(req);
  }

  if (pathname.startsWith('/api/')) {
    return publicApiRateLimit(req);
  }

  return null;
}
