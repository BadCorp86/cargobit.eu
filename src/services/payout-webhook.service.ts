/**
 * CargoBit Payout Webhook Service
 * 
 * Handles Stripe webhook events for payouts:
 * - transfer.paid → Mark payout as PAID
 * - transfer.failed → Mark payout as FAILED, reverse wallet
 * - payout.paid → Alternative payout event
 * 
 * All operations are idempotent with full audit trail.
 */

import { prisma } from '@/lib/db';
import { PayoutStatus } from '@prisma/client';
import { getOrCreateWallet, centsToEuros } from './wallet.service';

// ============================================
// TYPES
// ============================================

export interface StripeTransferData {
  id: string;
  object: 'transfer';
  amount: number;
  currency: string;
  destination: string;
  destination_payment?: string;
  created: number;
  metadata?: Record<string, string>;
  status?: string;
  failure_message?: string;
  failure_code?: string;
}

export interface StripePayoutData {
  id: string;
  object: 'payout';
  amount: number;
  currency: string;
  arrival_date?: number;
  status: string;
  failure_message?: string;
  failure_code?: string;
  metadata?: Record<string, string>;
}

export interface PayoutWebhookResult {
  success: boolean;
  error?: string;
  duplicate?: boolean;
  payoutId?: string;
}

// ============================================
// HELPER: GET OR CREATE WALLET (if not exists)
// ============================================

async function ensureWallet(userId: string) {
  return getOrCreateWallet(userId);
}

// ============================================
// HELPER: CREATE AUDIT EVENT
// ============================================

async function createPayoutAuditEvent(
  payoutId: string,
  eventType: string,
  oldStatus: PayoutStatus | null,
  newStatus: PayoutStatus,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.payoutAuditEvent.create({
    data: {
      payoutId,
      eventType,
      oldStatus,
      newStatus,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  }).catch(err => console.error('[PAYOUT-WEBHOOK] Failed to create audit event:', err));
}

// ============================================
// HANDLER: transfer.paid
// ============================================

/**
 * Handle transfer.paid event from Stripe.
 * This is called when a transfer to a connected account succeeds.
 * 
 * Flow:
 * 1. Find payout by stripe_transfer_id
 * 2. Check idempotency (already PAID?)
 * 3. Update status to PAID
 * 4. Create audit event
 */
export async function handleTransferPaid(
  transfer: StripeTransferData,
  stripeEventId: string
): Promise<PayoutWebhookResult> {
  console.log('[PAYOUT-WEBHOOK] Processing transfer.paid:', {
    transferId: transfer.id,
    amount: transfer.amount,
    currency: transfer.currency,
    destination: transfer.destination,
    stripeEventId,
  });

  try {
    // Find payout by Stripe transfer ID
    const payout = await prisma.payout.findUnique({
      where: { stripeTransferId: transfer.id },
    });

    if (!payout) {
      // Check metadata for payout reference
      const payoutId = transfer.metadata?.payout_id;
      if (payoutId) {
        const payoutByMeta = await prisma.payout.findUnique({
          where: { id: payoutId },
        });
        if (payoutByMeta && !payoutByMeta.stripeTransferId) {
          // Link transfer to payout
          await prisma.payout.update({
            where: { id: payoutId },
            data: { stripeTransferId: transfer.id },
          });
          console.log('[PAYOUT-WEBHOOK] Linked transfer to payout:', payoutId);
          // Now process with the linked payout
          return handleTransferPaidForPayout(payoutByMeta, transfer, stripeEventId);
        }
      }

      console.warn('[PAYOUT-WEBHOOK] No payout found for transfer:', transfer.id);
      await createAuditLog('orphaned_transfer_paid', {
        transfer_id: transfer.id,
        amount_cents: transfer.amount,
        destination: transfer.destination,
        stripe_event_id: stripeEventId,
      });
      return { success: true }; // Return success to prevent retries
    }

    return handleTransferPaidForPayout(payout, transfer, stripeEventId);
  } catch (error: any) {
    console.error('[PAYOUT-WEBHOOK] Error processing transfer.paid:', error);
    return { success: false, error: error.message };
  }
}

async function handleTransferPaidForPayout(
  payout: any,
  transfer: StripeTransferData,
  stripeEventId: string
): Promise<PayoutWebhookResult> {
  // Check idempotency
  if (payout.status === PayoutStatus.PAID) {
    console.log('[PAYOUT-WEBHOOK] Payout already marked as PAID:', payout.id);
    return { success: true, duplicate: true, payoutId: payout.id };
  }

  // Update payout status
  await prisma.$transaction(async (tx) => {
    await tx.payout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.PAID,
        processedAt: new Date(),
      },
    });

    // Create audit event
    await tx.payoutAuditEvent.create({
      data: {
        payoutId: payout.id,
        eventType: 'paid',
        oldStatus: payout.status,
        newStatus: PayoutStatus.PAID,
        metadata: JSON.stringify({
          transfer_id: transfer.id,
          destination: transfer.destination,
          stripe_event_id: stripeEventId,
        }),
      },
    });
  });

  // Create notification for user
  await prisma.notification.create({
    data: {
      userId: payout.userId,
      type: 'PAYOUT_SUCCEEDED',
      title: 'Auszahlung erfolgreich',
      message: `Ihre Auszahlung über ${(payout.amountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: payout.currency })} wurde verarbeitet.`,
      data: JSON.stringify({
        payoutId: payout.id,
        amountCents: payout.amountCents,
      }),
    },
  }).catch(err => console.error('[PAYOUT-WEBHOOK] Failed to create notification:', err));

  console.log('[PAYOUT-WEBHOOK] Payout marked as PAID:', {
    payoutId: payout.id,
    transferId: transfer.id,
    amountCents: payout.amountCents,
  });

  return { success: true, payoutId: payout.id };
}

// ============================================
// HANDLER: transfer.failed
// ============================================

/**
 * Handle transfer.failed event from Stripe.
 * This is called when a transfer to a connected account fails.
 * 
 * Flow:
 * 1. Find payout by stripe_transfer_id
 * 2. Check idempotency (already FAILED?)
 * 3. Update status to FAILED
 * 4. Reverse wallet debit (credit back)
 * 5. Create audit event
 */
export async function handleTransferFailed(
  transfer: StripeTransferData,
  stripeEventId: string
): Promise<PayoutWebhookResult> {
  console.log('[PAYOUT-WEBHOOK] Processing transfer.failed:', {
    transferId: transfer.id,
    failureCode: transfer.failure_code,
    failureMessage: transfer.failure_message,
    stripeEventId,
  });

  try {
    // Find payout by Stripe transfer ID
    const payout = await prisma.payout.findUnique({
      where: { stripeTransferId: transfer.id },
    });

    if (!payout) {
      console.warn('[PAYOUT-WEBHOOK] No payout found for failed transfer:', transfer.id);
      await createAuditLog('orphaned_transfer_failed', {
        transfer_id: transfer.id,
        failure_code: transfer.failure_code,
        failure_message: transfer.failure_message,
        stripe_event_id: stripeEventId,
      });
      return { success: true }; // Return success to prevent retries
    }

    // Check idempotency
    if (payout.status === PayoutStatus.FAILED) {
      console.log('[PAYOUT-WEBHOOK] Payout already marked as FAILED:', payout.id);
      return { success: true, duplicate: true, payoutId: payout.id };
    }

    // Update payout and reverse wallet
    await prisma.$transaction(async (tx) => {
      // 1. Update payout status
      await tx.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.FAILED,
          failureReason: transfer.failure_message,
          failureCode: transfer.failure_code,
          failedAt: new Date(),
        },
      });

      // 2. Reverse wallet debit
      const wallet = await ensureWallet(payout.userId);
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'REFUND',
          amount: centsToEuros(payout.amountCents), // Positive = credit back
          currency: payout.currency,
          reference: `payout_failed_${payout.id}`,
          description: `Auszahlung fehlgeschlagen - Rückbuchung: ${transfer.failure_message || 'Unknown error'}`,
          processedAt: new Date(),
          payoutId: payout.id,
        },
      });

      // 3. Update wallet balance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: centsToEuros(payout.amountCents) },
          totalWithdrawn: { decrement: centsToEuros(payout.amountCents) },
        },
      });

      // 4. Create audit event
      await tx.payoutAuditEvent.create({
        data: {
          payoutId: payout.id,
          eventType: 'failed',
          oldStatus: payout.status,
          newStatus: PayoutStatus.FAILED,
          metadata: JSON.stringify({
            transfer_id: transfer.id,
            failure_code: transfer.failure_code,
            failure_message: transfer.failure_message,
            stripe_event_id: stripeEventId,
          }),
        },
      });
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: payout.userId,
        type: 'PAYOUT_FAILED',
        title: 'Auszahlung fehlgeschlagen',
        message: `Ihre Auszahlung konnte nicht verarbeitet werden. Der Betrag wurde Ihrem Guthaben gutgeschrieben.`,
        data: JSON.stringify({
          payoutId: payout.id,
          amountCents: payout.amountCents,
          failureReason: transfer.failure_message,
        }),
      },
    }).catch(err => console.error('[PAYOUT-WEBHOOK] Failed to create notification:', err));

    console.log('[PAYOUT-WEBHOOK] Payout marked as FAILED and wallet reversed:', {
      payoutId: payout.id,
      transferId: transfer.id,
      failureReason: transfer.failure_message,
    });

    return { success: true, payoutId: payout.id };
  } catch (error: any) {
    console.error('[PAYOUT-WEBHOOK] Error processing transfer.failed:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// HANDLER: payout.paid (Stripe Standard Payouts)
// ============================================

/**
 * Handle payout.paid event from Stripe.
 * This is for standard Stripe payouts (not Connect transfers).
 */
export async function handlePayoutPaid(
  payout: StripePayoutData,
  stripeEventId: string
): Promise<PayoutWebhookResult> {
  console.log('[PAYOUT-WEBHOOK] Processing payout.paid:', {
    payoutId: payout.id,
    amount: payout.amount,
    status: payout.status,
    stripeEventId,
  });

  // Similar logic to transfer.paid but using payout metadata
  const internalPayoutId = payout.metadata?.payout_id;

  if (!internalPayoutId) {
    console.warn('[PAYOUT-WEBHOOK] No internal payout_id in metadata');
    return { success: true };
  }

  const internalPayout = await prisma.payout.findUnique({
    where: { id: internalPayoutId },
  });

  if (!internalPayout) {
    console.warn('[PAYOUT-WEBHOOK] Internal payout not found:', internalPayoutId);
    return { success: true };
  }

  if (internalPayout.status === PayoutStatus.PAID) {
    return { success: true, duplicate: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payout.update({
      where: { id: internalPayoutId },
      data: {
        status: PayoutStatus.PAID,
        stripeTransferId: payout.id,
        processedAt: new Date(),
      },
    });

    await tx.payoutAuditEvent.create({
      data: {
        payoutId: internalPayoutId,
        eventType: 'paid',
        oldStatus: internalPayout.status,
        newStatus: PayoutStatus.PAID,
        metadata: JSON.stringify({
          stripe_payout_id: payout.id,
          stripe_event_id: stripeEventId,
        }),
      },
    });
  });

  return { success: true, payoutId: internalPayoutId };
}

// ============================================
// HELPER: CREATE AUDIT LOG
// ============================================

async function createAuditLog(
  eventType: string,
  payload: Record<string, any>
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: 'CREATE',
      entityType: 'payout_webhook',
      entityId: payload.stripe_event_id || '',
      dataAfter: JSON.stringify({ event_type: eventType, ...payload }),
    },
  }).catch(err => console.error('[PAYOUT-WEBHOOK] Failed to create audit log:', err));
}

// ============================================
// MAIN: DISPATCH PAYOUT EVENT
// ============================================

/**
 * Main dispatcher for payout-related Stripe events.
 * Should be called from the main webhook handler.
 */
export async function dispatchPayoutWebhookEvent(event: {
  id: string;
  type: string;
  data: { object: any };
}): Promise<PayoutWebhookResult> {
  console.log('[PAYOUT-WEBHOOK] Dispatching event:', event.type, '| ID:', event.id);

  switch (event.type) {
    case 'transfer.paid':
      return handleTransferPaid(event.data.object, event.id);

    case 'transfer.failed':
      return handleTransferFailed(event.data.object, event.id);

    case 'payout.paid':
      return handlePayoutPaid(event.data.object, event.id);

    case 'payout.failed':
      // Handle similarly to transfer.failed
      return handleTransferFailed(event.data.object, event.id);

    default:
      console.log('[PAYOUT-WEBHOOK] Unhandled payout event type:', event.type);
      return { success: true };
  }
}

// ============================================
// EXPORT: INTEGRATION HELPER
// ============================================

/**
 * Add payout event handlers to existing Stripe webhook dispatcher.
 * 
 * Usage in stripe-webhook.service.ts:
 * 
 * import { dispatchPayoutWebhookEvent } from './payout-webhook.service';
 * 
 * // In dispatchStripeEvent, add before default case:
 * if (event.type.startsWith('transfer.') || event.type.startsWith('payout.')) {
 *   return dispatchPayoutWebhookEvent(event);
 * }
 */
export const PayoutWebhookEventTypes = [
  'transfer.paid',
  'transfer.failed',
  'payout.paid',
  'payout.failed',
  'payout.canceled',
];
