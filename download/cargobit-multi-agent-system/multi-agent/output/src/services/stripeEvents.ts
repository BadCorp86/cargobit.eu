/**
 * Stripe Event Processing Service
 * CargoBit Payment System
 * 
 * Processes all Stripe webhook events with proper error handling
 * and updates Payment, Payout, Wallet, and Transaction models.
 */

import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { createAuditEntry } from './auditLog';

// =============================================================================
// PAYMENT INTENT HANDLERS
// =============================================================================

/**
 * Handle payment_intent.succeeded
 */
async function handlePaymentIntentSucceeded(
  event: Stripe.PaymentIntentSucceededEvent
): Promise<void> {
  const pi = event.data.object;
  console.log(`Processing successful payment: ${pi.id}`);

  // Find existing payment by stripeId
  const payment = await prisma.payment.findFirst({
    where: { stripeId: pi.id }
  });

  if (!payment) {
    console.warn(`Payment not found for PaymentIntent: ${pi.id}`);
    return;
  }

  // Update payment status
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'SUCCEEDED',
      metadata: {
        ...(payment.metadata as object || {}),
        stripeAmount: pi.amount,
        stripeCurrency: pi.currency,
        processedAt: new Date().toISOString(),
      }
    }
  });

  // Credit wallet
  const wallet = await prisma.wallet.findFirst({
    where: { userId: payment.userId, currency: payment.currency }
  });

  if (wallet) {
    // Create transaction
    await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        amount: payment.amount,
        type: 'CREDIT',
        referenceId: payment.id,
        metadata: { paymentId: payment.id, stripeId: pi.id }
      }
    });

    // Update balance
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: payment.amount } }
    });
  }

  // Audit
  await createAuditEntry({
    actor: payment.userId,
    action: 'PAYMENT_SUCCEEDED',
    entity: 'Payment',
    entityId: payment.id,
    metadata: { amount: payment.amount, currency: payment.currency },
  });
}

/**
 * Handle payment_intent.payment_failed
 */
async function handlePaymentIntentFailed(
  event: Stripe.PaymentIntentPaymentFailedEvent
): Promise<void> {
  const pi = event.data.object;
  const error = pi.last_payment_error;

  console.log(`Processing failed payment: ${pi.id}`);

  const payment = await prisma.payment.findFirst({
    where: { stripeId: pi.id }
  });

  if (!payment) {
    console.warn(`Payment not found for PaymentIntent: ${pi.id}`);
    return;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'FAILED',
      metadata: {
        ...(payment.metadata as object || {}),
        failureCode: error?.code,
        failureMessage: error?.message,
        failedAt: new Date().toISOString(),
      }
    }
  });

  await createAuditEntry({
    actor: payment.userId,
    action: 'PAYMENT_FAILED',
    entity: 'Payment',
    entityId: payment.id,
    metadata: { error: error?.message },
  });
}

// =============================================================================
// CHARGE HANDLERS
// =============================================================================

/**
 * Handle charge.succeeded
 */
async function handleChargeSucceeded(
  event: Stripe.ChargeSucceededEvent
): Promise<void> {
  const charge = event.data.object;
  console.log(`Processing charge: ${charge.id}`);

  await createAuditEntry({
    actor: 'stripe',
    action: 'CHARGE_SUCCEEDED',
    entity: 'Charge',
    entityId: charge.id,
    metadata: {
      amount: charge.amount,
      currency: charge.currency,
      paid: charge.paid,
    }
  });
}

/**
 * Handle charge.refunded
 */
async function handleChargeRefunded(
  event: Stripe.ChargeRefundedEvent
): Promise<void> {
  const charge = event.data.object;
  const refunds = charge.refunds;

  console.log(`Processing refund for charge: ${charge.id}`);

  // Find payment by stripe charge ID
  const payment = await prisma.payment.findFirst({
    where: { stripeId: charge.payment_intent as string }
  });

  if (payment) {
    const refundAmount = refunds.data.reduce((sum, r) => sum + r.amount, 0);

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REFUNDED',
        metadata: {
          ...(payment.metadata as object || {}),
          refundAmount,
          refundedAt: new Date().toISOString(),
        }
      }
    });

    // Debit wallet if there was a credit
    const wallet = await prisma.wallet.findFirst({
      where: { userId: payment.userId, currency: payment.currency }
    });

    if (wallet) {
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amount: -refundAmount,
          type: 'DEBIT',
          referenceId: payment.id,
          metadata: { type: 'refund', paymentId: payment.id }
        }
      });

      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: refundAmount } }
      });
    }

    await createAuditEntry({
      actor: payment.userId,
      action: 'PAYMENT_REFUNDED',
      entity: 'Payment',
      entityId: payment.id,
      metadata: { refundAmount },
    });
  }
}

/**
 * Handle charge.dispute.created
 */
async function handleDisputeCreated(
  event: Stripe.ChargeDisputeCreatedEvent
): Promise<void> {
  const dispute = event.data.object;

  console.warn(`Dispute created for charge: ${dispute.charge}`);

  await createAuditEntry({
    actor: 'stripe',
    action: 'DISPUTE_CREATED',
    entity: 'Dispute',
    entityId: dispute.id,
    metadata: {
      chargeId: dispute.charge,
      amount: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
    }
  });
}

// =============================================================================
// PAYOUT HANDLERS
// =============================================================================

/**
 * Handle payout.created
 */
async function handlePayoutCreated(
  event: Stripe.PayoutCreatedEvent
): Promise<void> {
  const payout = event.data.object;
  console.log(`Processing payout created: ${payout.id}`);

  // Find existing payout by reference
  const existingPayout = await prisma.payout.findFirst({
    where: { reference: payout.id }
  });

  if (existingPayout) {
    await prisma.payout.update({
      where: { id: existingPayout.id },
      data: {
        status: 'PROCESSING',
        metadata: {
          ...(existingPayout.metadata as object || {}),
          stripeStatus: payout.status,
          arrivalDate: payout.arrival_date,
        }
      }
    });
  }

  await createAuditEntry({
    actor: 'stripe',
    action: 'PAYOUT_CREATED',
    entity: 'Payout',
    entityId: payout.id,
    metadata: { amount: payout.amount, currency: payout.currency }
  });
}

/**
 * Handle payout.paid
 */
async function handlePayoutPaid(
  event: Stripe.PayoutPaidEvent
): Promise<void> {
  const payout = event.data.object;
  console.log(`Processing payout paid: ${payout.id}`);

  const existingPayout = await prisma.payout.findFirst({
    where: { reference: payout.id }
  });

  if (existingPayout) {
    await prisma.payout.update({
      where: { id: existingPayout.id },
      data: {
        status: 'COMPLETED',
        metadata: {
          ...(existingPayout.metadata as object || {}),
          completedAt: new Date().toISOString(),
        }
      }
    });

    await createAuditEntry({
      actor: existingPayout.userId,
      action: 'PAYOUT_COMPLETED',
      entity: 'Payout',
      entityId: existingPayout.id,
      metadata: { amount: existingPayout.amount }
    });
  }
}

/**
 * Handle payout.failed
 */
async function handlePayoutFailed(
  event: Stripe.PayoutFailedEvent
): Promise<void> {
  const payout = event.data.object;
  console.log(`Processing payout failed: ${payout.id}`);

  const existingPayout = await prisma.payout.findFirst({
    where: { reference: payout.id }
  });

  if (existingPayout) {
    await prisma.payout.update({
      where: { id: existingPayout.id },
      data: {
        status: 'FAILED',
        metadata: {
          ...(existingPayout.metadata as object || {}),
          failureCode: payout.failure_code,
          failureMessage: payout.failure_message,
        }
      }
    });

    await createAuditEntry({
      actor: existingPayout.userId,
      action: 'PAYOUT_FAILED',
      entity: 'Payout',
      entityId: existingPayout.id,
      metadata: { error: payout.failure_message }
    });
  }
}

// =============================================================================
// CUSTOMER HANDLERS
// =============================================================================

/**
 * Handle customer.created
 */
async function handleCustomerCreated(
  event: Stripe.CustomerCreatedEvent
): Promise<void> {
  const customer = event.data.object;
  console.log(`Processing customer created: ${customer.id}`);

  if (customer.email) {
    const user = await prisma.user.findUnique({
      where: { email: customer.email }
    });

    if (user) {
      // Store Stripe customer ID in user metadata or separate table
      // This depends on your schema extension
      await createAuditEntry({
        actor: user.id,
        action: 'CUSTOMER_CREATED',
        entity: 'User',
        entityId: user.id,
        metadata: { stripeCustomerId: customer.id }
      });
    }
  }
}

// =============================================================================
// EVENT ROUTER
// =============================================================================

const EVENT_HANDLERS: Record<string, (event: Stripe.Event) => Promise<void>> = {
  'payment_intent.succeeded': handlePaymentIntentSucceeded,
  'payment_intent.payment_failed': handlePaymentIntentFailed,
  'charge.succeeded': handleChargeSucceeded,
  'charge.refunded': handleChargeRefunded,
  'charge.dispute.created': handleDisputeCreated,
  'payout.created': handlePayoutCreated,
  'payout.paid': handlePayoutPaid,
  'payout.failed': handlePayoutFailed,
  'customer.created': handleCustomerCreated,
};

/**
 * Process a Stripe event
 */
export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  const handler = EVENT_HANDLERS[event.type];

  if (!handler) {
    console.log(`No handler for event type: ${event.type}`);
    return;
  }

  try {
    await handler(event);
    console.log(`Processed event: ${event.type} [${event.id}]`);
  } catch (error) {
    console.error(`Error processing ${event.type} [${event.id}]:`, error);
    throw error;
  }
}

/**
 * Check if event has been processed
 */
export async function isEventProcessed(stripeEventId: string): Promise<boolean> {
  const event = await prisma.stripeEvent.findUnique({
    where: { id: stripeEventId }
  });
  return event !== null;
}

/**
 * Get unprocessed events for retry
 */
export async function getUnprocessedEvents(limit: number = 100): Promise<any[]> {
  // StripeEvent table tracks all events
  // This could be extended with a 'processed' flag
  return prisma.stripeEvent.findMany({
    orderBy: { createdAt: 'asc' },
    take: limit
  });
}
