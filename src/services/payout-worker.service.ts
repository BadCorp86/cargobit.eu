// ============================================
// CARGOBIT PAYOUT WORKER SERVICE
// Async Stripe Transfer Processing
// ============================================

import { db } from '@/lib/db';
import { Payout, PayoutStatus, TransactionType } from '@prisma/client';

// ============================================
// INTERFACES
// ============================================

interface PayoutJob {
  payoutId: string;
  attemptNumber: number;
}

interface PayoutJobResult {
  success: boolean;
  payoutId: string;
  transferId?: string;
  error?: string;
}

// ============================================
// PAYOUT WORKER
// ============================================

/**
 * Payout Worker Service
 * 
 * In production, this would be backed by BullMQ/Redis.
 * For Next.js, we process synchronously but log attempts.
 * 
 * To enable async processing:
 * 1. Install bullmq: npm install bullmq
 * 2. Set up Redis connection
 * 3. Create a separate worker process
 */

export class PayoutWorkerService {
  private static instance: PayoutWorkerService;
  private processing: Set<string> = new Set();

  private constructor() {}

  static getInstance(): PayoutWorkerService {
    if (!PayoutWorkerService.instance) {
      PayoutWorkerService.instance = new PayoutWorkerService();
    }
    return PayoutWorkerService.instance;
  }

  /**
   * Process a payout job
   */
  async processJob(job: PayoutJob): Promise<PayoutJobResult> {
    const { payoutId } = job;

    // Prevent double processing
    if (this.processing.has(payoutId)) {
      return {
        success: false,
        payoutId,
        error: 'Payout already being processed',
      };
    }

    this.processing.add(payoutId);

    try {
      // Get payout
      const payout = await db.payout.findUnique({
        where: { id: payoutId },
        include: {
          user: {
            include: {
              wallet: true,
            },
          },
        },
      });

      if (!payout) {
        await this.logAttempt(payoutId, 'failed', null, 'Payout not found');
        return { success: false, payoutId, error: 'Payout not found' };
      }

      // Check if already paid
      if (payout.status === 'PAID') {
        await this.logAttempt(payoutId, 'skipped', null, 'Already paid');
        return { success: true, payoutId, transferId: payout.stripeTransferId || undefined };
      }

      if (payout.status === 'CANCELLED') {
        await this.logAttempt(payoutId, 'skipped', null, 'Payout was cancelled');
        return { success: false, payoutId, error: 'Payout was cancelled' };
      }

      const providerReadiness = getPayoutProviderReadiness(payout);
      if (!providerReadiness.ready) {
        const errorMessage = providerReadiness.blockers.join('; ');
        await db.payout.update({
          where: { id: payoutId },
          data: {
            failureReason: errorMessage,
            lastRetryAt: new Date(),
          },
        });
        await this.logAttempt(payoutId, 'blocked_provider_not_configured', providerReadiness, errorMessage);

        return {
          success: false,
          payoutId,
          error: errorMessage,
        };
      }

      // Update status to processing
      await db.payout.update({
        where: { id: payoutId },
        data: { status: PayoutStatus.PROCESSING },
      });

      // Generate idempotency key
      const idempotencyKey = payout.idempotencyKey || 
        `payout_user_${payout.userId}_payout_${payout.id}_v${payout.retryCount + 1}`;

      // Get Stripe account for user
      const stripeAccountId = providerReadiness.destinationAccountId;

      try {
        const transfer = await createPayoutTransfer({
          amountCents: payout.amountCents,
          currency: payout.currency,
          destinationAccountId: stripeAccountId!,
          payoutId: payout.id,
          userId: payout.userId,
          idempotencyKey,
          mode: providerReadiness.mode,
        });

        // Update payout with transfer ID
        await db.payout.update({
          where: { id: payoutId },
          data: {
            stripeTransferId: transfer.id,
            stripeAccountId,
            status: PayoutStatus.PAID,
            processedAt: new Date(),
          },
        });

        // Log successful attempt
        await this.logAttempt(payoutId, 'transfer_created', transfer, null);

        // Create notification
        await db.notification.create({
          data: {
            userId: payout.userId,
            type: 'PAYOUT_COMPLETED',
            title: 'Auszahlung abgeschlossen',
            message: `Ihre Auszahlung von ${(payout.amountCents / 100).toLocaleString('de-DE')} ${payout.currency} wurde erfolgreich verarbeitet.`,
            data: JSON.stringify({
              payoutId,
              transferId: transfer.id,
              amount: payout.amountCents,
            }),
          },
        });

        return {
          success: true,
          payoutId,
          transferId: transfer.id,
        };

      } catch (stripeError: any) {
        // Handle Stripe error
        const errorMessage = stripeError.message || 'Unknown Stripe error';

        // Update payout as failed
        await db.payout.update({
          where: { id: payoutId },
          data: {
            status: PayoutStatus.FAILED,
            failureReason: errorMessage,
            retryCount: { increment: 1 },
            lastRetryAt: new Date(),
          },
        });

        // Log failed attempt
        await this.logAttempt(payoutId, 'transfer_failed', null, errorMessage);

        // Reverse wallet debit
        await this.reverseWalletDebitIfNeeded(payoutId);

        // Create notification
        await db.notification.create({
          data: {
            userId: payout.userId,
            type: 'PAYOUT_FAILED',
            title: 'Auszahlung fehlgeschlagen',
            message: `Ihre Auszahlung über ${(payout.amountCents / 100).toLocaleString('de-DE')} ${payout.currency} konnte nicht verarbeitet werden. Bitte kontaktieren Sie den Support.`,
            data: JSON.stringify({
              payoutId,
              error: errorMessage,
            }),
          },
        });

        return {
          success: false,
          payoutId,
          error: errorMessage,
        };
      }

    } finally {
      this.processing.delete(payoutId);
    }
  }

  /**
   * Log a payout attempt
   */
  private async logAttempt(
    payoutId: string,
    status: string,
    stripeResponse: any,
    error: string | null
  ): Promise<void> {
    try {
      await db.payoutAttempt.create({
        data: {
          payoutId,
          status,
          stripeResponse: stripeResponse ? JSON.stringify(stripeResponse) : null,
          error,
        },
      });
    } catch (logError) {
      console.error('Failed to log payout attempt:', logError);
    }
  }

  /**
   * Process pending payouts (called by scheduler)
   */
  async processPendingPayouts(limit: number = 100): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    const pendingPayouts = await db.payout.findMany({
      where: {
        status: PayoutStatus.PENDING,
        OR: [
          { delayedUntil: null },
          { delayedUntil: { lte: new Date() } },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    let processed = 0;
    let successful = 0;
    let failed = 0;

    for (const payout of pendingPayouts) {
      const result = await this.processJob({ payoutId: payout.id, attemptNumber: 1 });
      processed++;
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return { processed, successful, failed };
  }

  /**
   * Retry failed payouts (called by scheduler)
   */
  async retryFailedPayouts(limit: number = 50): Promise<{
    retried: number;
    successful: number;
    failed: number;
  }> {
    const failedPayouts = await db.payout.findMany({
      where: {
        status: PayoutStatus.FAILED,
        retryCount: { lt: 3 }, // Max 3 retries
      },
      take: limit,
      orderBy: { lastRetryAt: 'asc' },
    });

    let retried = 0;
    let successful = 0;
    let failed = 0;

    for (const payout of failedPayouts) {
      const result = await this.processJob({ 
        payoutId: payout.id, 
        attemptNumber: payout.retryCount + 1 
      });
      retried++;
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return { retried, successful, failed };
  }

  private async reverseWalletDebitIfNeeded(payoutId: string): Promise<void> {
    const walletTx = await db.walletTransaction.findFirst({
      where: { payoutId, type: TransactionType.PAYOUT },
    });

    if (!walletTx) return;

    const existingReversal = await db.walletTransaction.findFirst({
      where: { payoutId, type: TransactionType.REFUND },
    });

    if (existingReversal) return;

    await db.walletTransaction.create({
      data: {
        walletId: walletTx.walletId,
        type: TransactionType.REFUND,
        amount: Math.abs(walletTx.amount),
        currency: walletTx.currency,
        payoutId,
        description: `Rückbuchung fehlgeschlagene Auszahlung ${payoutId}`,
        processedAt: new Date(),
      },
    });

    await db.wallet.update({
      where: { id: walletTx.walletId },
      data: {
        balance: { increment: Math.abs(walletTx.amount) },
      },
    });
  }
}

// Export singleton
export const payoutWorker = PayoutWorkerService.getInstance();

export type PayoutProviderMode = 'stripe' | 'local_simulation';

export function getPayoutProviderReadiness(payout?: Pick<Payout, 'stripeAccountId'> | null): {
  ready: boolean;
  mode: PayoutProviderMode;
  blockers: string[];
  warnings: string[];
  destinationAccountId?: string;
} {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';
  const payoutsEnabled = process.env.STRIPE_PAYOUTS_ENABLED === 'true';
  const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
  const destinationAccountId = payout?.stripeAccountId || process.env.DEFAULT_STRIPE_ACCOUNT_ID || '';

  if (!isProduction && !payoutsEnabled) {
    return {
      ready: true,
      mode: 'local_simulation',
      blockers,
      warnings: ['Lokale Auszahlungssimulation aktiv. Keine echte Bankauszahlung.'],
      destinationAccountId: destinationAccountId || 'acct_local_simulation',
    };
  }

  if (!payoutsEnabled) {
    blockers.push('STRIPE_PAYOUTS_ENABLED muss für echte Bankauszahlungen auf true gesetzt sein.');
  }

  if (!stripeSecret.startsWith('sk_')) {
    blockers.push('STRIPE_SECRET_KEY fehlt oder ist kein Stripe Secret Key.');
  }

  if (!destinationAccountId.startsWith('acct_')) {
    blockers.push('Stripe Connect Zielkonto fehlt. DEFAULT_STRIPE_ACCOUNT_ID oder payout.stripeAccountId muss gesetzt sein.');
  }

  return {
    ready: blockers.length === 0,
    mode: 'stripe',
    blockers,
    warnings,
    destinationAccountId: destinationAccountId || undefined,
  };
}

async function createPayoutTransfer(input: {
  amountCents: number;
  currency: string;
  destinationAccountId: string;
  payoutId: string;
  userId: string;
  idempotencyKey: string;
  mode: PayoutProviderMode;
}): Promise<{ id: string }> {
  if (input.mode === 'local_simulation') {
    return {
      id: `tr_simulated_${input.payoutId}_${Date.now()}`,
    };
  }

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover' as any,
  });

  return stripe.transfers.create({
    amount: input.amountCents,
    currency: input.currency.toLowerCase(),
    destination: input.destinationAccountId,
    metadata: {
      payout_id: input.payoutId,
      user_id: input.userId,
    },
  }, {
    idempotencyKey: input.idempotencyKey,
  });
}
