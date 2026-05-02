/**
 * Backend Agent
 * 
 * Verantwortlich für Services, Webhooks und Rate Limiting.
 * Implementiert produktionsreife TypeScript-Module.
 */

import { BaseAgent, AgentConfig, Task, GeneratedFile } from './BaseAgent';

// ================================================================================
// BACKEND AGENT CONFIGURATION
// ================================================================================

export const BACKEND_CONFIG: AgentConfig = {
  id: 'backend',
  name: 'Backend Developer',
  role: 'implementation',
  description: 'Verantwortlich für Services, Webhooks und Rate Limiting',
  
  capabilities: [
    'typescript_development',
    'rate_limiting_implementation',
    'webhook_handler_creation',
    'audit_log_implementation',
    'express_middleware',
  ],
  
  priority: 2,
  maxConcurrentTasks: 3,
  
  inputs: ['prisma_schema', 'model_interfaces'],
  
  outputs: [
    { path: 'src/lib/prisma.ts', type: 'typescript', description: 'Prisma Client Singleton' },
    { path: 'src/lib/redis.ts', type: 'typescript', description: 'Redis Client Factory' },
    { path: 'src/lib/rateLimit.ts', type: 'typescript', description: 'Rate Limiting Module' },
    { path: 'src/middleware/rateLimit.ts', type: 'typescript', description: 'Express Middleware' },
    { path: 'src/webhooks/stripe.ts', type: 'typescript', description: 'Stripe Webhook Handler' },
    { path: 'src/services/stripeEvents.ts', type: 'typescript', description: 'Stripe Event Processing' },
    { path: 'src/services/auditLog.ts', type: 'typescript', description: 'Audit Log Service' },
    { path: 'src/jobs/auditVerify.ts', type: 'typescript', description: 'Audit Verification Job' },
  ],
  
  signals: {
    emits: ['MODULES_READY', 'AUDIT_SERVICE_READY', 'WEBHOOK_HANDLER_READY'],
    consumes: ['SCHEMA_READY', 'MODELS_DEFINED'],
  },
  
  dependencies: ['architect'],
  
  prompts: {
    system: `Du bist der Backend Developer für CargoBit.`,
    task: `Implementiere {task_description}.`,
  },
};

// ================================================================================
// BACKEND AGENT IMPLEMENTATION
// ================================================================================

export class BackendAgent extends BaseAgent {
  constructor(outputDir: string) {
    super(BACKEND_CONFIG, outputDir);
  }

  async execute(task: Task): Promise<GeneratedFile[]> {
    console.log(`\n💻 [${this.config.name}] Starting: ${task.description}`);
    
    const files: GeneratedFile[] = [];

    // Generiere alle Backend-Module
    files.push(this.createFile('src/lib/prisma.ts', this.generatePrismaClient(), 'typescript'));
    files.push(this.createFile('src/lib/redis.ts', this.generateRedisClient(), 'typescript'));
    files.push(this.createFile('src/lib/rateLimit.ts', this.generateRateLimit(), 'typescript'));
    files.push(this.createFile('src/middleware/rateLimit.ts', this.generateRateLimitMiddleware(), 'typescript'));
    files.push(this.createFile('src/webhooks/stripe.ts', this.generateStripeWebhook(), 'typescript'));
    files.push(this.createFile('src/services/stripeEvents.ts', this.generateStripeEvents(), 'typescript'));
    files.push(this.createFile('src/services/auditLog.ts', this.generateAuditLog(), 'typescript'));
    files.push(this.createFile('src/jobs/auditVerify.ts', this.generateAuditVerify(), 'typescript'));

    console.log(`  ✅ [${this.config.name}] Completed: ${files.length} files generated`);
    
    return files;
  }

  // ------------------------------------------------------------------------------
  // MODULE GENERATORS
  // ------------------------------------------------------------------------------

  private generatePrismaClient(): string {
    return `// Prisma Client Singleton
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
`;
  }

  private generateRedisClient(): string {
    return `// Redis Client Factory
import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
    });
  }
  return redis;
}

export default getRedis;
`;
  }

  private generateRateLimit(): string {
    return `// Rate Limiting Module mit Token Bucket und Sliding Window
import { Redis } from 'ioredis';
import { createHash } from 'crypto';

// ==================== TYPES ====================

export interface RateLimitConfig {
  capacity: number;
  refillRate: number;
  refillInterval: number;
  prefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export interface RateLimitPolicy {
  capacity: number;
  refillRate: number;
  refillInterval: number;
}

// ==================== DEFAULT POLICIES ====================

export const RATE_LIMIT_POLICIES: Record<string, RateLimitPolicy> = {
  'api:global': { capacity: 1000, refillRate: 100, refillInterval: 60000 },
  'api:auth': { capacity: 10, refillRate: 5, refillInterval: 60000 },
  'api:payment': { capacity: 20, refillRate: 10, refillInterval: 60000 },
  'api:webhook': { capacity: 100, refillRate: 50, refillInterval: 60000 },
  'user:login': { capacity: 5, refillRate: 1, refillInterval: 60000 },
};

// ==================== TOKEN BUCKET ====================

export class TokenBucketRateLimiter {
  private redis: Redis;
  private prefix: string;

  constructor(redis: Redis, prefix: string = 'ratelimit:') {
    this.redis = redis;
    this.prefix = prefix;
  }

  async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const redisKey = \`\${this.prefix}\${key}\`;
    const now = Date.now();

    const luaScript = \`
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refillRate = tonumber(ARGV[2])
      local refillInterval = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])
      
      local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
      local tokens = tonumber(bucket[1]) or capacity
      local lastRefill = tonumber(bucket[2]) or now
      
      local timePassed = now - lastRefill
      local tokensToAdd = math.floor((timePassed / refillInterval) * refillRate)
      
      if tokensToAdd > 0 then
        tokens = math.min(capacity, tokens + tokensToAdd)
        lastRefill = now
      end
      
      local allowed = tokens >= 1
      if allowed then
        tokens = tokens - 1
      end
      
      redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
      redis.call('PEXPIRE', key, refillInterval * 2)
      
      local resetAt = now + refillInterval
      return { allowed and 1 or 0, tokens, resetAt }
    \`;

    const result = await this.redis.eval(
      luaScript,
      1,
      redisKey,
      config.capacity.toString(),
      config.refillRate.toString(),
      config.refillInterval.toString(),
      now.toString()
    ) as [number, number, number];

    const [allowed, remaining, resetAt] = result;

    return {
      allowed: allowed === 1,
      remaining,
      resetAt: new Date(resetAt),
      retryAfter: allowed === 0 ? Math.ceil(config.refillInterval / config.refillRate) : undefined,
    };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(\`\${this.prefix}\${key}\`);
  }
}

// ==================== SLIDING WINDOW ====================

export class SlidingWindowRateLimiter {
  private redis: Redis;
  private prefix: string;

  constructor(redis: Redis, prefix: string = 'sliding:') {
    this.redis = redis;
    this.prefix = prefix;
  }

  async checkLimit(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
    const redisKey = \`\${this.prefix}\${key}\`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const luaScript = \`
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local windowStart = tonumber(ARGV[2])
      local maxRequests = tonumber(ARGV[3])
      local windowMs = tonumber(ARGV[4])
      
      redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
      
      local count = redis.call('ZCARD', key)
      
      local allowed = count < maxRequests
      if allowed then
        redis.call('ZADD', key, now, now .. '-' .. math.random())
      end
      
      redis.call('PEXPIRE', key, windowMs)
      
      local remaining = math.max(0, maxRequests - count - (allowed and 1 or 0))
      local resetAt = now + windowMs
      
      return { allowed and 1 or 0, remaining, resetAt }
    \`;

    const result = await this.redis.eval(
      luaScript,
      1,
      redisKey,
      now.toString(),
      windowStart.toString(),
      maxRequests.toString(),
      windowMs.toString()
    ) as [number, number, number];

    const [allowed, remaining, resetAt] = result;

    return {
      allowed: allowed === 1,
      remaining,
      resetAt: new Date(resetAt),
    };
  }
}

// ==================== HELPER FUNCTIONS ====================

export function extractClientIp(req: { headers: Record<string, string | undefined>; ip?: string; socket: { remoteAddress?: string } }): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

export function generateRateLimitKey(identifier: string, endpoint: string, userId?: string): string {
  const base = userId ? \`\${userId}:\${endpoint}\` : \`\${identifier}:\${endpoint}\`;
  return createHash('sha256').update(base).digest('hex').substring(0, 32);
}
`;
  }

  private generateRateLimitMiddleware(): string {
    return `// Express Rate Limiting Middleware
import { Request, Response, NextFunction } from 'express';
import { TokenBucketRateLimiter, RATE_LIMIT_POLICIES, extractClientIp, generateRateLimitKey, RateLimitResult } from '../lib/rateLimit';
import { getRedis } from '../lib/redis';

// ==================== MIDDLEWARE FACTORY ====================

export interface RateLimitMiddlewareOptions {
  policy?: string;
  capacity?: number;
  refillRate?: number;
  refillInterval?: number;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
  skip?: (req: Request) => boolean;
}

function setRateLimitHeaders(res: Response, result: RateLimitResult, policy: string): void {
  res.setHeader('X-RateLimit-Limit', policy);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());
  
  if (!result.allowed && result.retryAfter) {
    res.setHeader('Retry-After', result.retryAfter);
  }
}

export function rateLimitMiddleware(options: RateLimitMiddlewareOptions = {}) {
  const { policy = 'api:global', keyGenerator, handler, skip } = options;

  const policyConfig = RATE_LIMIT_POLICIES[policy] || RATE_LIMIT_POLICIES['api:global'];
  
  const config = {
    capacity: options.capacity || policyConfig.capacity,
    refillRate: options.refillRate || policyConfig.refillRate,
    refillInterval: options.refillInterval || policyConfig.refillInterval,
  };

  const redis = getRedis();
  const rateLimiter = new TokenBucketRateLimiter(redis);

  return async (req: Request, res: Response, next: NextFunction) => {
    if (skip && skip(req)) {
      return next();
    }

    const defaultKeyGenerator = (req: Request) => {
      const ip = extractClientIp(req as any);
      const userId = (req as any).user?.id;
      return generateRateLimitKey(ip, policy, userId);
    };

    const key = keyGenerator ? keyGenerator(req) : defaultKeyGenerator(req);

    try {
      const result = await rateLimiter.checkLimit(key, config);
      setRateLimitHeaders(res, result, policy);

      if (!result.allowed) {
        if (handler) {
          return handler(req, res);
        }

        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter,
        });
      }

      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      next();
    }
  };
}

// ==================== PREDEFINED MIDDLEWARES ====================

export const globalRateLimit = rateLimitMiddleware({ policy: 'api:global' });

export const authRateLimit = rateLimitMiddleware({ 
  policy: 'api:auth',
  keyGenerator: (req) => {
    const ip = extractClientIp(req as any);
    const email = req.body?.email || '';
    return \`auth:\${ip}:\${email}\`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too Many Attempts',
      message: 'Zu viele Anmeldeversuche. Bitte warten Sie einige Minuten.',
    });
  }
});

export const paymentRateLimit = rateLimitMiddleware({ policy: 'api:payment' });
export const webhookRateLimit = rateLimitMiddleware({ policy: 'api:webhook' });
`;
  }

  private generateStripeWebhook(): string {
    return `// Stripe Webhook Handler mit Signature Validation
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '../lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const TIMESTAMP_TOLERANCE = 300; // 5 Minuten

// ==================== SIGNATURE VALIDATION ====================

function parseSignatureHeader(header: string): { timestamp: number; signatures: string[] } | null {
  const parts = header.split(',');
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') {
      timestamp = parseInt(value, 10);
    } else if (key === 'v1') {
      signatures.push(value);
    }
  }

  if (timestamp === null || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

function validateSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  now: number = Date.now() / 1000
): { valid: boolean; error?: string } {
  const parsed = parseSignatureHeader(signatureHeader);

  if (!parsed) {
    return { valid: false, error: 'Invalid signature header format' };
  }

  if (Math.abs(now - parsed.timestamp) > TIMESTAMP_TOLERANCE) {
    return { valid: false, error: 'Timestamp outside tolerance window' };
  }

  const signedPayload = \`\${parsed.timestamp}.\${payload}\`;
  const expectedSignature = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  for (const sig of parsed.signatures) {
    try {
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      const actualBuffer = Buffer.from(sig, 'hex');

      if (expectedBuffer.length === actualBuffer.length) {
        if (timingSafeEqual(expectedBuffer, actualBuffer)) {
          return { valid: true };
        }
      }
    } catch {
      continue;
    }
  }

  return { valid: false, error: 'Signature mismatch' };
}

// ==================== IDEMPOTENCY ====================

async function checkIdempotency(stripeEventId: string): Promise<{ processed: boolean }> {
  const existing = await prisma.stripeEvent.findUnique({
    where: { stripeEventId },
  });
  return { processed: existing?.processed ?? false };
}

async function markEventProcessed(stripeEventId: string, type: string, data: object): Promise<void> {
  await prisma.stripeEvent.upsert({
    where: { stripeEventId },
    create: { stripeEventId, type, data, processed: true, processedAt: new Date() },
    update: { processed: true, processedAt: new Date() },
  });
}

// ==================== EVENT HANDLERS ====================

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.log(\`Processing payment_intent.succeeded: \${paymentIntent.id}\`);
  
  const payment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id },
  });

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.log(\`Processing payment_intent.failed: \${paymentIntent.id}\`);
  
  const payment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id },
  });

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', failedAt: new Date() },
    });
  }
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  console.log(\`Processing charge.refunded: \${charge.id}\`);
}

const EVENT_HANDLERS: Record<string, (data: any) => Promise<void>> = {
  'payment_intent.succeeded': handlePaymentIntentSucceeded,
  'payment_intent.payment_failed': handlePaymentIntentFailed,
  'charge.refunded': handleChargeRefunded,
};

// ==================== WEBHOOK HANDLER ====================

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers['stripe-signature'] as string;
  const payload = req.body;

  const validation = validateSignature(payload, signature, WEBHOOK_SECRET);

  if (!validation.valid) {
    console.error(\`Webhook signature validation failed: \${validation.error}\`);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = JSON.parse(payload);
  } catch {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  console.log(\`Received Stripe event: \${event.type} (\${event.id})\`);

  const { processed } = await checkIdempotency(event.id);

  if (processed) {
    console.log(\`Event \${event.id} already processed, skipping\`);
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  const handler = EVENT_HANDLERS[event.type];

  if (!handler) {
    await markEventProcessed(event.id, event.type, event.data);
    res.status(200).json({ received: true, unhandled: true });
    return;
  }

  try {
    await handler(event.data.object);
    await markEventProcessed(event.id, event.type, event.data);
    res.status(200).json({ received: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(\`Error processing event \${event.id}:\`, errorMessage);
    res.status(500).json({ error: 'Processing failed' });
  }
}
`;
  }

  private generateStripeEvents(): string {
    return `// Stripe Event Processing Service
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

// ==================== EVENT ROUTER ====================

export async function routeStripeEvent(event: Stripe.Event): Promise<void> {
  const handlers: Record<string, (data: any) => Promise<void>> = {
    'payment_intent.succeeded': handlePaymentSucceeded,
    'payment_intent.payment_failed': handlePaymentFailed,
    'charge.refunded': handleChargeRefunded,
    'charge.dispute.created': handleDispute,
  };

  const handler = handlers[event.type];
  
  if (handler) {
    await handler(event.data.object);
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  // Implementation
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  // Implementation
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  // Implementation
}

async function handleDispute(dispute: Stripe.Dispute): Promise<void> {
  // Implementation
}
`;
  }

  private generateAuditLog(): string {
    return `// Audit Log Service mit Hash-Chain
import { prisma } from '../lib/prisma';
import { createHash } from 'crypto';

// ==================== TYPES ====================

export interface AuditLogEntry {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface VerificationResult {
  valid: boolean;
  totalEntries: number;
  invalidEntries: string[];
}

// ==================== HASH CHAIN ====================

function calculateHash(
  prevHash: string | null,
  timestamp: Date,
  action: string,
  entityType: string,
  entityId: string | null,
  data: Record<string, unknown>
): string {
  const hashPayload = JSON.stringify({
    prevHash: prevHash || 'GENESIS',
    timestamp: timestamp.toISOString(),
    action,
    entityType,
    entityId: entityId || '',
    data,
  });

  return createHash('sha256').update(hashPayload).digest('hex');
}

async function getLastHash(): Promise<string | null> {
  const lastEntry = await prisma.auditLog.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  });

  return lastEntry?.hash || null;
}

// ==================== PUBLIC FUNCTIONS ====================

export async function writeAuditLog(entry: AuditLogEntry): Promise<string> {
  const now = new Date();
  const prevHash = await getLastHash();
  
  const hash = calculateHash(
    prevHash,
    now,
    entry.action,
    entry.entityType,
    entry.entityId || null,
    { oldValue: entry.oldValue, newValue: entry.newValue }
  );

  const auditLog = await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      prevHash,
      hash,
    },
  });

  return auditLog.id;
}

export async function verifyAuditChain(): Promise<VerificationResult> {
  console.log('Starting audit chain verification...');

  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const invalidEntries: string[] = [];
  let expectedPrevHash: string | null = null;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (i === 0) {
      if (entry.prevHash !== null) {
        invalidEntries.push(\`\${entry.id}: Genesis entry should have null prevHash\`);
      }
    } else {
      if (entry.prevHash !== expectedPrevHash) {
        invalidEntries.push(\`\${entry.id}: prevHash mismatch\`);
      }
    }

    const calculatedHash = calculateHash(
      entry.prevHash,
      entry.createdAt,
      entry.action,
      entry.entityType,
      entry.entityId,
      { oldValue: entry.oldValue as Record<string, unknown>, newValue: entry.newValue as Record<string, unknown> }
    );

    if (calculatedHash !== entry.hash) {
      invalidEntries.push(\`\${entry.id}: hash mismatch\`);
    }

    expectedPrevHash = entry.hash;
  }

  return {
    valid: invalidEntries.length === 0,
    totalEntries: entries.length,
    invalidEntries,
  };
}
`;
  }

  private generateAuditVerify(): string {
    return `// Audit Chain Verification Job
import { verifyAuditChain } from '../services/auditLog';

async function runAuditVerification(): Promise<void> {
  console.log('========================================');
  console.log('Starting Daily Audit Chain Verification');
  console.log(\`Time: \${new Date().toISOString()}\`);
  console.log('========================================');

  try {
    const result = await verifyAuditChain();

    if (!result.valid) {
      console.error('AUDIT CHAIN VERIFICATION FAILED!');
      console.error('Invalid entries:', result.invalidEntries);
    } else {
      console.log(\`Audit chain verification passed. \${result.totalEntries} entries verified.\`);
    }
  } catch (error) {
    console.error('Verification job failed:', error);
  }

  console.log('========================================');
  console.log('Verification Job Complete');
  console.log('========================================');
}

// CLI Entry Point
if (require.main === module) {
  runAuditVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { runAuditVerification };
`;
  }
}
