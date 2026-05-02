/**
 * Rate Limiting Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { rateLimit, resetRateLimit, getRateLimitStatus } from "../src/lib/rateLimit";

describe("Rate Limiting", () => {
  const testKey = "test:user:123:api";

  beforeAll(async () => {
    // Reset any existing rate limit for test key
    try {
      await resetRateLimit(testKey);
    } catch (error) {
      // Ignore if Redis not available
    }
  });

  afterAll(async () => {
    // Cleanup
    try {
      await resetRateLimit(testKey);
    } catch (error) {
      // Ignore
    }
  });

  describe("rateLimit()", () => {
    it("should allow requests within limit", async () => {
      const result = await rateLimit(testKey, {
        limit: 10,
        windowSec: 60,
        prefix: "test",
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it("should block requests exceeding limit", async () => {
      const key = `test:limit:${Date.now()}`;
      const limit = 3;

      // Make 3 requests (should all succeed)
      for (let i = 0; i < limit; i++) {
        const result = await rateLimit(key, {
          limit,
          windowSec: 60,
          prefix: "test",
        });
        expect(result.allowed).toBe(true);
      }

      // 4th request should fail
      const result = await rateLimit(key, {
        limit,
        windowSec: 60,
        prefix: "test",
      });
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);

      // Cleanup
      await resetRateLimit(key, "test");
    });

    it("should set correct retryAfter", async () => {
      const key = `test:retry:${Date.now()}`;
      const windowSec = 60;

      const result = await rateLimit(key, {
        limit: 1,
        windowSec,
        prefix: "test",
      });

      expect(result.retryAfter).toBeGreaterThanOrEqual(0);
      expect(result.retryAfter).toBeLessThanOrEqual(windowSec);

      await resetRateLimit(key, "test");
    });
  });

  describe("getRateLimitStatus()", () => {
    it("should return current status without incrementing", async () => {
      const key = `test:status:${Date.now()}`;

      // Make a request
      await rateLimit(key, { limit: 10, windowSec: 60, prefix: "test" });

      // Check status
      const status = await getRateLimitStatus(key, {
        limit: 10,
        windowSec: 60,
        prefix: "test",
      });

      expect(status.count).toBeGreaterThanOrEqual(1);
      expect(status.remaining).toBeLessThan(10);

      await resetRateLimit(key, "test");
    });
  });
});
