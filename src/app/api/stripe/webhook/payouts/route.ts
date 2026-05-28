import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { PayoutStatus } from '@prisma/client';
import { getPayoutWebhookSecret } from '@/lib/stripe-readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: StripeObject;
  };
  created?: number;
}

interface StripeObject {
  id: string;
  object?: string;
  amount?: number;
  currency?: string;
  destination?: string;
  transfer?: string;
  status?: string;
  failure_message?: string;
  failure_code?: string;
  metadata?: Record<string, string>;
}

interface HandlerResult {
  success: boolean;
  message: string;
  action: string;
  payoutId?: string;
  status?: PayoutStatus;
}

const ACCEPTED_EVENTS = [
  'transfer.created',
  'transfer.paid',
  'transfer.failed',
  'transfer.reversed',
  'payout.created',
  'payout.paid',
  'payout.failed',
  'payout.canceled',
];

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/stripe/webhook/payouts',
    purpose: 'Stripe payout and transfer webhook receiver',
    stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecretConfigured: Boolean(getPayoutWebhookSecret()),
    webhookSecretEnv: process.env.STRIPE_PAYOUT_WEBHOOK_SECRET
      ? 'STRIPE_PAYOUT_WEBHOOK_SECRET'
      : 'STRIPE_WEBHOOK_SECRET',
    acceptedEvents: ACCEPTED_EVENTS,
    localFallback: process.env.NODE_ENV !== 'production',
  });
}

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') || '';
  const verification = verifyStripeEvent(payload, signature);

  if (!verification.valid || !verification.event) {
    return NextResponse.json(
      {
        error: 'SignatureVerificationError',
        message: verification.error || 'Invalid Stripe webhook signature',
      },
      { status: 400 },
    );
  }

  const event = verification.event;

  try {
    const existingEvent = await db.payoutEvent.findUnique({
      where: { id: event.id },
    });

    if (existingEvent) {
      return NextResponse.json({
        received: true,
        duplicate: true,
        processed: existingEvent.processed,
        payoutId: existingEvent.payoutId,
      });
    }

    const result = await handleStripeEvent(event);

    await db.payoutEvent.create({
      data: {
        id: event.id,
        payoutId: result.payoutId,
        type: event.type,
        payload: JSON.stringify({
          id: event.id,
          type: event.type,
          created: event.created,
          object: event.data.object,
          result,
        }),
        processed: result.success,
        processedAt: result.success ? new Date() : null,
      },
    });

    return NextResponse.json({
      received: true,
      processed: result.success,
      action: result.action,
      message: result.message,
      payoutId: result.payoutId,
      status: result.status,
      source: 'database',
    });
  } catch (error) {
    console.error('[StripePayoutWebhook] Processing failed:', error);

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(createDevelopmentFallback(event, error));
    }

    return NextResponse.json(
      {
        error: 'InternalServerError',
        message: 'Webhook processing failed. Stripe should retry this event.',
      },
      { status: 500 },
    );
  }
}

function verifyStripeEvent(payload: string, signature: string): {
  valid: boolean;
  event?: StripeWebhookEvent;
  error?: string;
} {
  const webhookSecret = getPayoutWebhookSecret();

  if (webhookSecret) {
    if (!signature) {
      return { valid: false, error: 'Missing stripe-signature header' };
    }

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_signature_verification_only');
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return { valid: true, event: normalizeStripeEvent(event) };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Stripe signature verification failed',
      };
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return { valid: false, error: 'STRIPE_PAYOUT_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET is required in production' };
  }

  try {
    const event = JSON.parse(payload) as StripeWebhookEvent;
    if (!event.id || !event.type || !event.data?.object?.id) {
      return { valid: false, error: 'Invalid Stripe event shape' };
    }
    return { valid: true, event };
  } catch {
    return { valid: false, error: 'Invalid JSON payload' };
  }
}

function normalizeStripeEvent(event: Stripe.Event): StripeWebhookEvent {
  return {
    id: event.id,
    type: event.type,
    created: event.created,
    data: {
      object: event.data.object as StripeObject,
    },
  };
}

async function handleStripeEvent(event: StripeWebhookEvent): Promise<HandlerResult> {
  switch (event.type) {
    case 'transfer.created':
    case 'payout.created':
      return markPayoutProcessing(event);

    case 'transfer.paid':
    case 'payout.paid':
      return markPayoutPaid(event);

    case 'transfer.failed':
    case 'payout.failed':
      return markPayoutFailed(event);

    case 'transfer.reversed':
    case 'payout.canceled':
      return markPayoutCancelled(event);

    default:
      return {
        success: true,
        action: 'ignored',
        message: `Unhandled Stripe event type: ${event.type}`,
      };
  }
}

async function markPayoutProcessing(event: StripeWebhookEvent): Promise<HandlerResult> {
  const stripeObject = event.data.object;
  const payout = await findPayoutForStripeObject(stripeObject);

  if (!payout) {
    return {
      success: true,
      action: 'orphan_recorded',
      message: `No local payout found for ${event.type} ${stripeObject.id}`,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.payout.update({
      where: { id: payout.id },
      data: {
        status: payout.status === PayoutStatus.PAID ? PayoutStatus.PAID : PayoutStatus.PROCESSING,
        stripeTransferId: stripeObject.object === 'transfer' ? stripeObject.id : payout.stripeTransferId,
        processedAt: payout.processedAt || new Date(),
      },
    });

    await tx.payoutAttempt.create({
      data: {
        payoutId: payout.id,
        status: `${event.type}_received`,
        stripeResponse: JSON.stringify(stripeObject),
      },
    });
  });

  return {
    success: true,
    action: 'processing',
    message: 'Payout marked as processing',
    payoutId: payout.id,
    status: PayoutStatus.PROCESSING,
  };
}

async function markPayoutPaid(event: StripeWebhookEvent): Promise<HandlerResult> {
  const stripeObject = event.data.object;
  const payout = await findPayoutForStripeObject(stripeObject);

  if (!payout) {
    return {
      success: true,
      action: 'orphan_recorded',
      message: `No local payout found for ${event.type} ${stripeObject.id}`,
    };
  }

  if (payout.status === PayoutStatus.PAID) {
    return {
      success: true,
      action: 'duplicate_paid',
      message: 'Payout already marked as paid',
      payoutId: payout.id,
      status: PayoutStatus.PAID,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.payout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.PAID,
        stripeTransferId: stripeObject.object === 'transfer' ? stripeObject.id : payout.stripeTransferId,
        processedAt: new Date(),
      },
    });

    await tx.payoutAttempt.create({
      data: {
        payoutId: payout.id,
        status: `${event.type}_confirmed`,
        stripeResponse: JSON.stringify(stripeObject),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: payout.userId,
        action: 'PAYOUT',
        entityType: 'payout',
        entityId: payout.id,
        dataBefore: JSON.stringify({ status: payout.status }),
        dataAfter: JSON.stringify({
          status: PayoutStatus.PAID,
          stripeObjectId: stripeObject.id,
          eventId: event.id,
        }),
      },
    });

    await tx.notification.create({
      data: {
        userId: payout.userId,
        type: 'PAYOUT_COMPLETED',
        title: 'Auszahlung abgeschlossen',
        message: `Ihre Auszahlung ueber ${formatMoney(payout.amountCents / 100, payout.currency)} wurde erfolgreich verarbeitet.`,
        data: JSON.stringify({
          payoutId: payout.id,
          stripeObjectId: stripeObject.id,
          eventId: event.id,
        }),
      },
    });
  });

  return {
    success: true,
    action: 'paid',
    message: 'Payout marked as paid',
    payoutId: payout.id,
    status: PayoutStatus.PAID,
  };
}

async function markPayoutFailed(event: StripeWebhookEvent): Promise<HandlerResult> {
  const stripeObject = event.data.object;
  const payout = await findPayoutForStripeObject(stripeObject);

  if (!payout) {
    return {
      success: true,
      action: 'orphan_recorded',
      message: `No local payout found for ${event.type} ${stripeObject.id}`,
    };
  }

  if (payout.status === PayoutStatus.FAILED) {
    return {
      success: true,
      action: 'duplicate_failed',
      message: 'Payout already marked as failed',
      payoutId: payout.id,
      status: PayoutStatus.FAILED,
    };
  }

  const failureReason = stripeObject.failure_message || stripeObject.failure_code || 'Stripe payout failed';
  const payoutWalletTransaction = await db.walletTransaction.findFirst({
    where: {
      payoutId: payout.id,
      type: 'PAYOUT',
    },
    orderBy: { createdAt: 'desc' },
  });
  const refundReference = `payout_failed_${payout.id}`;
  const existingRefund = payoutWalletTransaction
    ? await db.walletTransaction.findFirst({
        where: {
          walletId: payoutWalletTransaction.walletId,
          reference: refundReference,
        },
      })
    : null;

  await db.$transaction(async (tx) => {
    await tx.payout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.FAILED,
        failureReason,
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
      },
    });

    if (payoutWalletTransaction && !existingRefund) {
      const refundAmount = Math.abs(payoutWalletTransaction.amount);

      await tx.walletTransaction.create({
        data: {
          walletId: payoutWalletTransaction.walletId,
          type: 'REFUND',
          amount: refundAmount,
          currency: payoutWalletTransaction.currency,
          payoutId: payout.id,
          reference: refundReference,
          description: `Rueckbuchung fehlgeschlagene Auszahlung ${payout.id}`,
          processedAt: new Date(),
        },
      });

      await tx.wallet.update({
        where: { id: payoutWalletTransaction.walletId },
        data: {
          balance: { increment: refundAmount },
          totalWithdrawn: { decrement: refundAmount },
        },
      });
    }

    await tx.payoutAttempt.create({
      data: {
        payoutId: payout.id,
        status: `${event.type}_failed`,
        error: failureReason,
        stripeResponse: JSON.stringify(stripeObject),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: payout.userId,
        action: 'PAYOUT',
        entityType: 'payout',
        entityId: payout.id,
        dataBefore: JSON.stringify({ status: payout.status }),
        dataAfter: JSON.stringify({
          status: PayoutStatus.FAILED,
          failureReason,
          walletRefunded: Boolean(payoutWalletTransaction && !existingRefund),
          eventId: event.id,
        }),
      },
    });

    await tx.notification.create({
      data: {
        userId: payout.userId,
        type: 'PAYOUT_FAILED',
        title: 'Auszahlung fehlgeschlagen',
        message: `Ihre Auszahlung konnte nicht verarbeitet werden. ${payoutWalletTransaction && !existingRefund ? 'Der Betrag wurde Ihrem Wallet gutgeschrieben.' : 'Bitte pruefen Sie die Auszahlungsmethode.'}`,
        data: JSON.stringify({
          payoutId: payout.id,
          failureReason,
          eventId: event.id,
        }),
      },
    });
  });

  return {
    success: true,
    action: 'failed_reversed',
    message: payoutWalletTransaction && !existingRefund
      ? 'Payout marked as failed and wallet debit reversed'
      : 'Payout marked as failed',
    payoutId: payout.id,
    status: PayoutStatus.FAILED,
  };
}

async function markPayoutCancelled(event: StripeWebhookEvent): Promise<HandlerResult> {
  const stripeObject = event.data.object;
  const payout = await findPayoutForStripeObject(stripeObject);

  if (!payout) {
    return {
      success: true,
      action: 'orphan_recorded',
      message: `No local payout found for ${event.type} ${stripeObject.id}`,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.payout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.CANCELLED,
        failureReason: stripeObject.failure_message || 'Stripe payout cancelled',
        lastRetryAt: new Date(),
      },
    });

    await tx.payoutAttempt.create({
      data: {
        payoutId: payout.id,
        status: `${event.type}_cancelled`,
        stripeResponse: JSON.stringify(stripeObject),
      },
    });

    await tx.notification.create({
      data: {
        userId: payout.userId,
        type: 'PAYOUT_CANCELLED',
        title: 'Auszahlung storniert',
        message: 'Ihre Auszahlung wurde storniert und muss neu geprueft werden.',
        data: JSON.stringify({
          payoutId: payout.id,
          eventId: event.id,
        }),
      },
    });
  });

  return {
    success: true,
    action: 'cancelled',
    message: 'Payout marked as cancelled',
    payoutId: payout.id,
    status: PayoutStatus.CANCELLED,
  };
}

async function findPayoutForStripeObject(stripeObject: StripeObject) {
  const metadata = stripeObject.metadata || {};
  const payoutId = metadata.payout_id || metadata.payoutId || metadata.payout;
  const idempotencyKey = metadata.idempotency_key || metadata.idempotencyKey;

  if (payoutId) {
    const payout = await db.payout.findUnique({
      where: { id: payoutId },
    });
    if (payout) return payout;
  }

  if (idempotencyKey) {
    const payout = await db.payout.findUnique({
      where: { idempotencyKey },
    });
    if (payout) return payout;
  }

  if (stripeObject.id) {
    const payout = await db.payout.findFirst({
      where: {
        OR: [
          { stripeTransferId: stripeObject.id },
          { idempotencyKey: stripeObject.id },
        ],
      },
    });
    if (payout) return payout;
  }

  if (stripeObject.transfer) {
    return db.payout.findFirst({
      where: { stripeTransferId: stripeObject.transfer },
    });
  }

  return null;
}

function createDevelopmentFallback(event: StripeWebhookEvent, error: unknown) {
  return {
    received: true,
    processed: true,
    action: 'development_fallback',
    message: 'Database unavailable in local development; webhook shape accepted.',
    event: {
      id: event.id,
      type: event.type,
      objectId: event.data.object.id,
    },
    source: 'fallback',
    warning: error instanceof Error ? error.message : 'Database unavailable',
  };
}

function formatMoney(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(value);
}
