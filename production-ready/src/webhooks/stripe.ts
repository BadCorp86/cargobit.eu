/**
 * Stripe Webhook Handler
 * 
 * Production-ready webhook handling with:
 * - Signature verification
 * - Idempotency (replay protection)
 * - Event routing
 * - Error handling
 */

import Stripe from "stripe";
import express, { Request, Response } from "express";
import { handlePaymentSucceeded, handlePaymentFailed, handleRefundCreated } from "../services/stripeEvents";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
  typescript: true,
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

if (!WEBHOOK_SECRET) {
  console.warn("[Stripe] WARNING: STRIPE_WEBHOOK_SECRET is not set!");
}

// ============================================
// Webhook Router
// ============================================

const router = express.Router();

// Raw body parser is CRITICAL for signature verification
// This MUST be set before the webhook handler
router.use(
  express.raw({
    type: "application/json",
    limit: "10mb", // Stripe webhooks can be large
  })
);

/**
 * POST /api/webhooks/stripe
 * 
 * Main webhook endpoint for all Stripe events
 */
router.post("/", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    console.error("[Stripe] Missing stripe-signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  if (!WEBHOOK_SECRET) {
    console.error("[Stripe] Webhook secret not configured");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  let event: Stripe.Event;

  // ============================================
  // Step 1: Verify Signature (CRITICAL!)
  // ============================================
  try {
    // req.body MUST be raw buffer, not parsed JSON
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig as string,
      WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error("[Stripe] Signature verification failed:", err.message);
    return res.status(400).json({
      error: "Webhook signature verification failed",
      message: err.message,
    });
  }

  console.log(`[Stripe] Received event: ${event.type} (${event.id})`);

  // ============================================
  // Step 2: Idempotency Check
  // ============================================
  try {
    // Check if event was already processed
    const existingEvent = await checkEventProcessed(event.id);

    if (existingEvent) {
      console.log(`[Stripe] Event ${event.id} already processed, skipping`);
      return res.json({ received: true, duplicate: true });
    }
  } catch (err) {
    console.error("[Stripe] Failed to check event idempotency:", err);
    // Continue processing - better to risk duplicate than lose event
  }

  // ============================================
  // Step 3: Process Event
  // ============================================
  try {
    await processEvent(event);

    // Mark as processed
    await markEventProcessed(event);

    console.log(`[Stripe] Event ${event.id} processed successfully`);
    return res.json({ received: true, eventId: event.id });
  } catch (err: any) {
    console.error(`[Stripe] Event processing failed:`, err);

    // Return 5xx to trigger Stripe retry
    // Return 4xx to prevent retry (for known permanent failures)
    const isPermanent = err.isPermanent === true;

    if (isPermanent) {
      return res.status(400).json({
        error: "Event processing failed (permanent)",
        message: err.message,
        eventId: event.id,
      });
    }

    return res.status(500).json({
      error: "Event processing failed",
      message: err.message,
      eventId: event.id,
    });
  }
});

// ============================================
// Event Processing
// ============================================

interface ProcessedEvent {
  id: string;
  type: string;
  processedAt: Date;
}

// In-memory cache for quick duplicate detection (use Redis in production)
const processedEventsCache = new Map<string, ProcessedEvent>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if event was already processed
 */
async function checkEventProcessed(eventId: string): Promise<boolean> {
  // Check cache first
  if (processedEventsCache.has(eventId)) {
    return true;
  }

  // Check database (implement based on your Prisma setup)
  // const existing = await prisma.stripeEvent.findUnique({
  //   where: { id: eventId },
  // });
  // return !!existing;

  return false;
}

/**
 * Mark event as processed
 */
async function markEventProcessed(event: Stripe.Event): Promise<void> {
  // Add to cache
  processedEventsCache.set(event.id, {
    id: event.id,
    type: event.type,
    processedAt: new Date(),
  });

  // Clean up old entries
  const now = Date.now();
  for (const [id, record] of processedEventsCache.entries()) {
    if (now - record.processedAt.getTime() > CACHE_TTL) {
      processedEventsCache.delete(id);
    }
  }

  // Persist to database
  // await prisma.stripeEvent.create({
  //   data: {
  //     id: event.id,
  //     type: event.type,
  //     payload: event.data,
  //     processed: true,
  //     processedAt: new Date(),
  //   },
  // });
}

/**
 * Process event based on type
 */
async function processEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // Payment Events
    case "payment_intent.succeeded":
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;

    case "payment_intent.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      break;

    case "payment_intent.canceled":
      console.log(`[Stripe] Payment canceled: ${(event.data.object as Stripe.PaymentIntent).id}`);
      break;

    // Charge Events
    case "charge.succeeded":
      console.log(`[Stripe] Charge succeeded: ${(event.data.object as Stripe.Charge).id}`);
      break;

    case "charge.refunded":
      await handleRefundCreated(event.data.object as Stripe.Charge);
      break;

    case "charge.failed":
      console.log(`[Stripe] Charge failed: ${(event.data.object as Stripe.Charge).id}`);
      break;

    // Dispute Events
    case "charge.dispute.created":
      console.warn(`[Stripe] Dispute created: ${(event.data.object as Stripe.Dispute).id}`);
      // TODO: Alert team, update payment status
      break;

    case "charge.dispute.closed":
      console.log(`[Stripe] Dispute closed: ${(event.data.object as Stripe.Dispute).id}`);
      break;

    // Customer Events
    case "customer.created":
      console.log(`[Stripe] Customer created: ${(event.data.object as Stripe.Customer).id}`);
      break;

    case "customer.updated":
      console.log(`[Stripe] Customer updated: ${(event.data.object as Stripe.Customer).id}`);
      break;

    case "customer.deleted":
      console.log(`[Stripe] Customer deleted: ${(event.data.object as Stripe.Customer).id}`);
      break;

    // Invoice Events
    case "invoice.paid":
      console.log(`[Stripe] Invoice paid: ${(event.data.object as Stripe.Invoice).id}`);
      break;

    case "invoice.payment_failed":
      console.warn(`[Stripe] Invoice payment failed: ${(event.data.object as Stripe.Invoice).id}`);
      break;

    // Checkout Events
    case "checkout.session.completed":
      console.log(`[Stripe] Checkout completed: ${(event.data.object as Stripe.Checkout.Session).id}`);
      break;

    // Subscription Events (if using subscriptions)
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      console.log(`[Stripe] Subscription event: ${event.type}`);
      break;

    // Payout Events
    case "payout.created":
      console.log(`[Stripe] Payout created: ${(event.data.object as Stripe.Payout).id}`);
      break;

    case "payout.paid":
      console.log(`[Stripe] Payout paid: ${(event.data.object as Stripe.Payout).id}`);
      break;

    case "payout.failed":
      console.error(`[Stripe] Payout failed: ${(event.data.object as Stripe.Payout).id}`);
      break;

    // Account Events (for Stripe Connect)
    case "account.updated":
      console.log(`[Stripe] Account updated: ${(event.data.object as Stripe.Account).id}`);
      break;

    default:
      console.log(`[Stripe] Unhandled event type: ${event.type}`);
      // Don't throw - we want to acknowledge receipt even for unhandled types
  }
}

// ============================================
// Stripe CLI Testing Helper
// ============================================

/**
 * Test webhook locally with Stripe CLI:
 * 
 * 1. Install: brew install stripe/stripe-cli/stripe
 * 2. Login: stripe login
 * 3. Forward: stripe listen --forward-to localhost:3000/api/webhooks/stripe
 * 4. Trigger: stripe trigger payment_intent.succeeded
 */

export default router;
