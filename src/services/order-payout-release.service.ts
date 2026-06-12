import { prisma } from '@/lib/db';
import { calculatePayoutReleaseEligibleAt } from '@/lib/business-day-deadline';
import { createOrderPayoutRelease, type OrderPayoutRelease } from '@/lib/order-payout';

const OPEN_DISPUTE_STATUSES = ['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'AWAITING_INFO'];
const OPEN_TICKET_STATUSES = ['OPEN', 'IN_PROGRESS'];

export interface OrderPayoutReadiness {
  orderId: string;
  shipperUserId?: string;
  driverUserId?: string;
  release: OrderPayoutRelease;
  releaseEligibleAt?: string;
  deliveredAt?: string;
  blockers: string[];
  openDisputes: number;
  openTickets: number;
  source: 'database';
}

export interface OrderPayoutReleaseResult extends OrderPayoutReadiness {
  success: boolean;
  message?: string;
  wallet?: {
    id: string;
    balance: number;
    currency: string;
  };
  walletTransaction?: any;
  notification?: any;
  duplicate?: boolean;
}

export async function getOrderPayoutReadiness(input: {
  orderId: string;
  amount?: number;
  riskLevel?: 'green' | 'yellow' | 'red';
  now?: Date;
  force?: boolean;
}): Promise<OrderPayoutReadiness | null> {
  const now = input.now || new Date();
  const transport = await prisma.transport.findUnique({
    where: { id: input.orderId },
    include: {
      documents: true,
      commissions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      assignment: {
        include: {
          driver: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  if (!transport) return null;

  const driverUserId = transport.assignment?.driver.userId;
  const amount = transport.agreedPrice || transport.shipperBudget || input.amount || 850;
  const invoiceIssued = transport.documents.some((document) => document.type === 'rechnung');
  const hasPod = Boolean(
    transport.deliveredAt ||
    transport.completedAt ||
    transport.status === 'DELIVERY_DONE' ||
    transport.status === 'COMPLETED' ||
    transport.documents.some((document) => ['pod', 'lieferschein', 'foto_delivery'].includes(document.type)),
  );
  const deliveredAt = transport.completedAt || transport.deliveredAt;
  const [openDisputes, openTickets] = await Promise.all([
    prisma.dispute.count({
      where: {
        jobId: input.orderId,
        status: { in: OPEN_DISPUTE_STATUSES as any },
      },
    }),
    prisma.supportTicket.count({
      where: {
        transportId: input.orderId,
        status: { in: OPEN_TICKET_STATUSES as any },
      },
    }),
  ]);
  const releaseEligibleAt = deliveredAt
    ? calculatePayoutReleaseEligibleAt(deliveredAt)
    : undefined;
  const blockers: string[] = [];

  if (!input.force) {
    if (!deliveredAt) {
      blockers.push('Lieferzeitpunkt fehlt. Die 24h-Frist kann noch nicht starten.');
    }

    if (releaseEligibleAt && now.getTime() < releaseEligibleAt.getTime()) {
      blockers.push(`Automatische Freigabe ist erst ab ${releaseEligibleAt.toISOString()} möglich.`);
    }

    if (openDisputes > 0 || openTickets > 0) {
      blockers.push('Offene Disputes oder Support-Tickets blockieren die Auszahlung.');
    }
  }

  const draft = createOrderPayoutRelease({
    orderId: input.orderId,
    amount,
    currency: transport.currency,
    planKey: transport.commissions[0]?.plan,
    hasPod,
    invoiceIssued,
    walletReady: Boolean(driverUserId),
    riskLevel: input.riskLevel || 'green',
  });
  const release = blockers.length
    ? {
        ...draft,
        status: 'blocked' as const,
        blockedReasons: [...draft.blockedReasons, ...blockers],
      }
    : draft;

  return {
    orderId: input.orderId,
    shipperUserId: transport.shipperUserId,
    driverUserId,
    release,
    releaseEligibleAt: releaseEligibleAt?.toISOString(),
    deliveredAt: deliveredAt?.toISOString(),
    blockers,
    openDisputes,
    openTickets,
    source: 'database',
  };
}

export async function releaseOrderPayout(input: {
  orderId: string;
  amount?: number;
  riskLevel?: 'green' | 'yellow' | 'red';
  now?: Date;
  force?: boolean;
  actorId?: string | null;
  reason?: string;
}): Promise<OrderPayoutReleaseResult | null> {
  const readiness = await getOrderPayoutReadiness(input);

  if (!readiness) return null;

  if (!readiness.driverUserId || readiness.release.status === 'blocked') {
    return {
      ...readiness,
      success: false,
      message: 'Payout release blocked by settlement gates',
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    let wallet = await tx.wallet.findFirst({
      where: { ownerUserId: readiness.driverUserId },
    });

    if (!wallet) {
      wallet = await tx.wallet.create({
        data: {
          ownerUserId: readiness.driverUserId,
          balance: 0,
          reservedBalance: 0,
          currency: readiness.release.currency,
          status: 'ACTIVE',
        },
      });
    }

    const existingTransaction = await tx.walletTransaction.findFirst({
      where: {
        walletId: wallet.id,
        reference: readiness.release.walletTransaction.reference,
      },
    });

    if (existingTransaction) {
      return {
        wallet,
        walletTransaction: existingTransaction,
        notification: null,
        duplicate: true,
      };
    }

    const legacyImmediateCredit = await tx.walletTransaction.findFirst({
      where: {
        walletId: wallet.id,
        relatedTransportId: input.orderId,
        type: 'PAYMENT_IN',
        amount: { gt: 0 },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (legacyImmediateCredit) {
      return {
        wallet,
        walletTransaction: legacyImmediateCredit,
        notification: null,
        duplicate: true,
      };
    }

    const walletTransaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'PAYMENT_IN',
        amount: readiness.release.walletTransaction.amount,
        currency: readiness.release.currency,
        relatedTransportId: input.orderId,
        description: readiness.release.walletTransaction.description,
        reference: readiness.release.walletTransaction.reference,
        processedAt: new Date(),
      },
    });

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: readiness.release.walletTransaction.amount },
        totalDeposited: { increment: readiness.release.walletTransaction.amount },
      },
    });

    const notification = await tx.notification.create({
      data: {
        userId: readiness.driverUserId!,
        type: 'PAYOUT_RELEASED',
        title: 'Auszahlung ins Wallet freigegeben',
        message: `${formatMoney(readiness.release.walletTransaction.amount, readiness.release.currency)} für Auftrag ${input.orderId} wurde ins Wallet gebucht.`,
        data: JSON.stringify({
          orderId: input.orderId,
          releaseId: readiness.release.releaseId,
          walletTransactionId: walletTransaction.id,
          walletBalance: updatedWallet.balance,
          amount: readiness.release.walletTransaction.amount,
          currency: readiness.release.currency,
          mode: input.force ? 'manual' : 'automatic',
        }),
      },
    });

    if (input.force && input.actorId) {
      await tx.auditLog.create({
        data: {
          userId: input.actorId,
          action: 'PAYOUT',
          entityType: 'transport',
          entityId: input.orderId,
          dataAfter: JSON.stringify({
            reason: input.reason,
            releaseId: readiness.release.releaseId,
            walletTransactionId: walletTransaction.id,
          }),
        },
      });
    }

    return {
      wallet: updatedWallet,
      walletTransaction,
      notification,
      duplicate: false,
    };
  });

  return {
    ...readiness,
    success: true,
    release: {
      ...readiness.release,
      status: 'released',
      releasedAt: new Date().toISOString(),
    },
    wallet: {
      id: result.wallet.id,
      balance: result.wallet.balance,
      currency: result.wallet.currency,
    },
    walletTransaction: result.walletTransaction,
    notification: result.notification,
    duplicate: result.duplicate,
  };
}

export async function runAutomaticPayoutReleases(input: { now?: Date; limit?: number } = {}) {
  const now = input.now || new Date();
  const candidates = await prisma.transport.findMany({
    where: {
      status: { in: ['DELIVERY_DONE', 'COMPLETED'] },
      OR: [
        { deliveredAt: { not: null } },
        { completedAt: { not: null } },
      ],
    },
    include: {
      documents: true,
    },
    take: input.limit || 100,
    orderBy: { updatedAt: 'asc' },
  });
  const results: Array<{
    orderId: string;
    status: 'released' | 'blocked';
    blockers: string[];
  }> = [];

  for (const transport of candidates) {
    const hasPod = transport.documents.some((document) => ['pod', 'lieferschein', 'foto_delivery'].includes(document.type));
    if (!hasPod) continue;

    const existingRelease = await prisma.walletTransaction.findFirst({
      where: {
        relatedTransportId: transport.id,
        reference: `settlement_release_${transport.id}`,
      },
    });
    if (existingRelease) continue;

    const readiness = await getOrderPayoutReadiness({ orderId: transport.id, now });
    if (!readiness || readiness.release.status === 'blocked') {
      results.push({
        orderId: transport.id,
        status: 'blocked',
        blockers: readiness?.release.blockedReasons || ['not_ready'],
      });
      continue;
    }

    const released = await releaseOrderPayout({ orderId: transport.id, now });
    results.push({
      orderId: transport.id,
      status: released?.success ? 'released' : 'blocked',
      blockers: released?.release.blockedReasons || [],
    });
  }

  return {
    processed: results.length,
    released: results.filter((result) => result.status === 'released').length,
    blocked: results.filter((result) => result.status === 'blocked').length,
    results,
  };
}

export async function getAutomaticPayoutReleaseQueue(input: { now?: Date; limit?: number } = {}) {
  const now = input.now || new Date();
  try {
    const candidates = await prisma.transport.findMany({
      where: {
        status: { in: ['DELIVERY_DONE', 'COMPLETED'] },
        OR: [
          { deliveredAt: { not: null } },
          { completedAt: { not: null } },
        ],
      },
      include: {
        documents: true,
        assignment: {
          include: {
            driver: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      take: input.limit || 100,
      orderBy: { updatedAt: 'asc' },
    });

    const rows = await Promise.all(candidates.map(async (transport) => {
      const hasPod = transport.documents.some((document) => ['pod', 'lieferschein', 'foto_delivery'].includes(document.type));
      const existingRelease = await prisma.walletTransaction.findFirst({
        where: {
          relatedTransportId: transport.id,
          reference: `settlement_release_${transport.id}`,
        },
        orderBy: { createdAt: 'desc' },
      });
      const readiness = await getOrderPayoutReadiness({ orderId: transport.id, now });

      return {
        orderId: transport.id,
        status: existingRelease ? 'released' : readiness?.release.status || 'blocked',
        amount: readiness?.release.settlement.carrierWalletCredit || transport.agreedPrice || transport.shipperBudget || 0,
        currency: readiness?.release.currency || transport.currency,
        deliveredAt: readiness?.deliveredAt || null,
        releaseEligibleAt: readiness?.releaseEligibleAt || null,
        hasPod,
        openDisputes: readiness?.openDisputes || 0,
        openTickets: readiness?.openTickets || 0,
        blockers: existingRelease ? [] : readiness?.release.blockedReasons || ['Payout readiness unavailable'],
        driverUserId: readiness?.driverUserId || transport.assignment?.driver.userId || null,
        driverEmail: transport.assignment?.driver.user.email || null,
        releasedAt: existingRelease?.processedAt?.toISOString() || existingRelease?.createdAt.toISOString() || null,
      };
    }));

    return {
      available: true,
      now: now.toISOString(),
      total: rows.length,
      ready: rows.filter((row) => row.status === 'ready').length,
      blocked: rows.filter((row) => row.status === 'blocked').length,
      released: rows.filter((row) => row.status === 'released').length,
      rows,
    };
  } catch (error) {
    console.error('[OrderPayoutRelease] Queue preview failed:', error);
    return {
      available: false,
      now: now.toISOString(),
      total: 0,
      ready: 0,
      blocked: 0,
      released: 0,
      rows: [],
      error: error instanceof Error ? error.message : 'Auto-release queue unavailable',
    };
  }
}

function formatMoney(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(value);
}
