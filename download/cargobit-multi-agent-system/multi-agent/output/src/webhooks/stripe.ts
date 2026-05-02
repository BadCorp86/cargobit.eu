/**
 * Stripe Webhook Handler
 * CargoBit Payment System
 * 
 * Secure webhook endpoint with signature verification,
 * idempotency via StripeEvent table, and comprehensive error handling.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { processStripeEvent } from '@/services/stripeEvents';
import { createAuditEntry } from '@/services/auditLog';

// =============================================================================
// CONFIGURATION
// =============================================================================

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const PROCESSING_TIMEOUT_MS = 25000;

const SUPPORTED_EVENTS = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.succeeded',
  'charge.refunded',
  'charge.dispute.created',
  'customer.created',
  'payout.created',
  'payout.paid',
  'payout.failed',
] as const;

// =============================================================================
// WEBHOOK VERIFICATION
// =============================================================================

/**
 * Verify Stripe webhook signature
 */
function verifySignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    const error = err as Error;
    console.error('Signature verification failed:', error.message);
    throw new Error(`Invalid signature: ${error.message}`);
  }
}

// =============================================================================
// IDEMPOTENCY
// =============================================================================

/**
 * Record webhook event for idempotency
 */
async function recordStripeEvent(
  event: Stripe.Event,
  signature: string
): Promise<{ isNew: boolean; record: any }> {
  const existing = await prisma.stripeEvent.findUnique({
    where: { id: event.id }
  });

  if (existing) {
    return { isNew: false, record: existing };
  }

  const record = await prisma.stripeEvent.create({
    data: {
      id: event.id,
      type: event.type,
      payload: event.data as any,
    }
  });

  return { isNew: true, record };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let eventId: string | undefined;

  try {
    // Get raw body
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Verify signature
    let event: Stripe.Event;
    try {
      event = verifySignature(rawBody, signature, WEBHOOK_SECRET);
    } catch {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    eventId = event.id;
    console.log(`Received Stripe webhook: ${event.type} [${event.id}]`);

    // Check idempotency
    const { isNew } = await recordStripeEvent(event, signature);
    
    if (!isNew) {
      console.log(`Duplicate event: ${event.id}`);
      return NextResponse.json(
        { received: true, note: 'Duplicate event' },
        { status: 200 }
      );
    }

    // Create audit entry
    await createAuditEntry({
      actor: 'stripe',
      action: 'WEBHOOK_RECEIVED',
      entity: 'StripeEvent',
      entityId: event.id,
      metadata: { type: event.type },
    });

    // Process with timeout
    const processingPromise = processStripeEvent(event);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Processing timeout')), PROCESSING_TIMEOUT_MS);
    });

    await Promise.race([processingPromise, timeoutPromise]);

    // Log success
    const duration = Date.now() - startTime;
    console.log(`Webhook processed: ${event.id} in ${duration}ms`);

    // Audit success
    await createAuditEntry({
      actor: 'system',
      action: 'WEBHOOK_PROCESSED',
      entity: 'StripeEvent',
      entityId: event.id,
      metadata: { duration, type: event.type },
    });

    return NextResponse.json(
      { received: true, eventId: event.id, duration },
      { status: 200 }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`Webhook failed [${eventId || 'unknown'}]:`, errorMessage);

    // Audit failure
    await createAuditEntry({
      actor: 'system',
      action: 'WEBHOOK_ERROR',
      entity: 'StripeEvent',
      entityId: eventId || 'unknown',
      metadata: { error: errorMessage, duration },
    });

    // Determine if retryable
    const isRetryable = 
      errorMessage.includes('timeout') || 
      errorMessage.includes('connection');

    return NextResponse.json(
      { 
        error: 'Processing failed', 
        eventId,
        retryable: isRetryable 
      },
      { status: isRetryable ? 500 : 200 }
    );
  }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

/**
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    endpoint: '/api/webhooks/stripe',
    supportedEvents: SUPPORTED_EVENTS.length,
  });
}
