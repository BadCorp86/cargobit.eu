import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyCronRequest } from '@/lib/cron-auth';
import { PayoutStatus, TransactionType } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PayoutReconciliationFinding {
  payoutId: string;
  status: PayoutStatus;
  severity: 'info' | 'warning' | 'critical';
  code: string;
  message: string;
  action: 'none' | 'recorded' | 'auto_marked_paid';
}

const PAID_EVENTS = new Set(['transfer.paid', 'payout.paid']);
const FAILED_EVENTS = new Set(['transfer.failed', 'payout.failed']);

export async function GET(request: NextRequest) {
  return runPayoutReconciliation(request, false);
}

export async function POST(request: NextRequest) {
  return runPayoutReconciliation(request, true);
}

async function runPayoutReconciliation(request: NextRequest, applyDefault: boolean) {
  const start = Date.now();
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') || 100), 500);
  const apply = searchParams.get('apply') === 'true' || applyDefault;
  const staleHours = Number(searchParams.get('staleHours') || 72);
  const staleBefore = new Date(Date.now() - staleHours * 60 * 60 * 1000);

  try {
    const payouts = await db.payout.findMany({
      where: {
        status: {
          in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING, PayoutStatus.FAILED],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        events: {
          orderBy: { receivedAt: 'desc' },
          take: 10,
        },
        walletTransactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const findings: PayoutReconciliationFinding[] = [];

    for (const payout of payouts) {
      const payoutFindings: PayoutReconciliationFinding[] = [];
      const paidEvent = payout.events.find((event) => PAID_EVENTS.has(event.type) && event.processed);
      const failedEvent = payout.events.find((event) => FAILED_EVENTS.has(event.type) && event.processed);
      const payoutWalletTx = payout.walletTransactions.find((tx) => tx.type === TransactionType.PAYOUT);
      const refundTx = payout.walletTransactions.find((tx) => tx.type === TransactionType.REFUND);

      if (payout.status === PayoutStatus.PROCESSING && !payout.stripeTransferId) {
        payoutFindings.push({
          payoutId: payout.id,
          status: payout.status,
          severity: 'critical',
          code: 'MISSING_TRANSFER_ID',
          message: 'Payout ist PROCESSING, hat aber keine Stripe Transfer-ID.',
          action: 'none',
        });
      }

      if (payout.status === PayoutStatus.PROCESSING && payout.createdAt < staleBefore) {
        payoutFindings.push({
          payoutId: payout.id,
          status: payout.status,
          severity: 'warning',
          code: 'STALE_PROCESSING',
          message: `Payout ist laenger als ${staleHours} Stunden in PROCESSING.`,
          action: 'none',
        });
      }

      if (payout.status === PayoutStatus.FAILED && payoutWalletTx && !refundTx) {
        payoutFindings.push({
          payoutId: payout.id,
          status: payout.status,
          severity: 'critical',
          code: 'FAILED_WITHOUT_REFUND',
          message: 'Payout ist FAILED, aber es gibt keine Wallet-Rueckbuchung.',
          action: 'none',
        });
      }

      if (paidEvent && payout.status !== PayoutStatus.PAID) {
        if (apply) {
          await db.payout.update({
            where: { id: payout.id },
            data: {
              status: PayoutStatus.PAID,
              processedAt: payout.processedAt || new Date(),
            },
          });
        }

        payoutFindings.push({
          payoutId: payout.id,
          status: payout.status,
          severity: 'warning',
          code: 'PAID_EVENT_STATUS_MISMATCH',
          message: 'Es liegt ein verarbeitetes Paid-Event vor, lokaler Status war aber nicht PAID.',
          action: apply ? 'auto_marked_paid' : 'none',
        });
      }

      if (failedEvent && payout.status !== PayoutStatus.FAILED && payout.status !== PayoutStatus.PAID) {
        payoutFindings.push({
          payoutId: payout.id,
          status: payout.status,
          severity: 'critical',
          code: 'FAILED_EVENT_STATUS_MISMATCH',
          message: 'Es liegt ein verarbeitetes Failed-Event vor, lokaler Status ist aber nicht FAILED.',
          action: 'none',
        });
      }

      if (apply) {
        await recordFindings(payout.id, payoutFindings);
      }

      findings.push(...payoutFindings.map((finding) => ({
        ...finding,
        action: apply && finding.action === 'none' ? 'recorded' as const : finding.action,
      })));
    }

    const critical = findings.filter((finding) => finding.severity === 'critical').length;
    const warnings = findings.filter((finding) => finding.severity === 'warning').length;
    const autoResolved = findings.filter((finding) => finding.action === 'auto_marked_paid').length;

    return NextResponse.json({
      success: true,
      mode: apply ? 'apply' : 'dry-run',
      checked: payouts.length,
      findings,
      summary: {
        totalFindings: findings.length,
        critical,
        warnings,
        autoResolved,
      },
      durationMs: Date.now() - start,
    });
  } catch (error) {
    console.error('[PayoutReconciliationCron] Failed:', error);

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        success: true,
        mode: apply ? 'apply' : 'dry-run',
        checked: 0,
        findings: [],
        summary: {
          totalFindings: 0,
          critical: 0,
          warnings: 0,
          autoResolved: 0,
        },
        durationMs: Date.now() - start,
        source: 'fallback',
        warning: error instanceof Error ? error.message : 'Database unavailable',
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Payout reconciliation failed',
        durationMs: Date.now() - start,
      },
      { status: 500 },
    );
  }
}

async function recordFindings(payoutId: string, findings: PayoutReconciliationFinding[]) {
  if (!findings.length) return;

  await Promise.all(findings.map((finding, index) => db.payoutEvent.create({
    data: {
      id: `recon_${payoutId}_${Date.now()}_${index}`,
      payoutId,
      type: `reconciliation.${finding.code.toLowerCase()}`,
      payload: JSON.stringify(finding),
      processed: true,
      processedAt: new Date(),
    },
  }).catch((error) => {
    console.error('[PayoutReconciliationCron] Failed to record finding:', error);
  })));
}
