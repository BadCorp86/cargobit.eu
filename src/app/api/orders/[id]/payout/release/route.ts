import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createOrderPayoutRelease } from '@/lib/order-payout';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const fallbackAmount = Number(body.amount || 850);

  try {
    const transport = await prisma.transport.findUnique({
      where: { id },
      include: {
        shipperUser: true,
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

    if (!transport && !isDemoOrderId(id)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Transport not found' },
        { status: 404 },
      );
    }

    if (!transport) {
      return NextResponse.json(createFallbackRelease(id, fallbackAmount));
    }

    const driverUserId = transport.assignment?.driver.userId;
    const amount = transport.agreedPrice || transport.shipperBudget || fallbackAmount;
    const invoiceIssued = transport.documents.some((document) => document.type === 'rechnung');
    const hasPod = Boolean(
      transport.deliveredAt ||
      transport.completedAt ||
      transport.status === 'DELIVERY_DONE' ||
      transport.status === 'COMPLETED' ||
      transport.documents.some((document) => ['pod', 'lieferschein', 'foto_delivery'].includes(document.type)),
    );
    const walletReady = Boolean(driverUserId);
    const draft = createOrderPayoutRelease({
      orderId: id,
      amount,
      currency: transport.currency,
      planKey: transport.commissions[0]?.plan,
      hasPod,
      invoiceIssued,
      walletReady,
      riskLevel: body.riskLevel || 'green',
    });

    if (!driverUserId || draft.status === 'blocked') {
      return NextResponse.json(
        {
          success: false,
          release: draft,
          source: 'database',
          message: 'Payout release blocked by settlement gates',
        },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findFirst({
        where: { ownerUserId: driverUserId },
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            ownerUserId: driverUserId,
            balance: 0,
            currency: transport.currency,
            status: 'ACTIVE',
          },
        });
      }

      const existingTransaction = await tx.walletTransaction.findFirst({
        where: {
          walletId: wallet.id,
          reference: draft.walletTransaction.reference,
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

      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PAYMENT_IN',
          amount: draft.walletTransaction.amount,
          currency: draft.currency,
          relatedTransportId: id,
          description: draft.walletTransaction.description,
          reference: draft.walletTransaction.reference,
          processedAt: new Date(),
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: draft.walletTransaction.amount },
          totalDeposited: { increment: draft.walletTransaction.amount },
        },
      });

      const notification = await tx.notification.create({
        data: {
          userId: driverUserId,
          type: 'PAYOUT_RELEASED',
          title: 'Auszahlung ins Wallet freigegeben',
          message: `${formatMoney(draft.walletTransaction.amount, draft.currency)} fuer Auftrag ${id} wurde ins Wallet gebucht.`,
          data: JSON.stringify({
            orderId: id,
            releaseId: draft.releaseId,
            walletTransactionId: walletTransaction.id,
            walletBalance: updatedWallet.balance,
            amount: draft.walletTransaction.amount,
            currency: draft.currency,
          }),
        },
      });

      return {
        wallet: updatedWallet,
        walletTransaction,
        notification,
        duplicate: false,
      };
    });

    return NextResponse.json({
      success: true,
      release: {
        ...draft,
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
      source: 'database',
    });
  } catch (error) {
    console.error('[OrderPayoutReleaseAPI] Failed:', error);
    return NextResponse.json(createFallbackRelease(id, fallbackAmount, 'Database unavailable, using payout release fallback'));
  }
}

function createFallbackRelease(orderId: string, amount: number, warning?: string) {
  const release = createOrderPayoutRelease({
    orderId,
    amount,
    currency: 'EUR',
    planKey: 'STARTER',
    hasPod: true,
    invoiceIssued: true,
    walletReady: true,
    riskLevel: 'green',
    status: 'released',
    releasedAt: new Date(),
  });

  return {
    success: true,
    release,
    wallet: {
      id: `demo-wallet-${orderId}`,
      balance: release.settlement.carrierWalletCredit,
      currency: release.currency,
    },
    walletTransaction: {
      id: `demo-wallet-transaction-${release.releaseId}`,
      ...release.walletTransaction,
      currency: release.currency,
      relatedTransportId: orderId,
      processedAt: release.releasedAt,
    },
    notification: {
      id: `demo-notification-${release.releaseId}`,
      type: 'PAYOUT_RELEASED',
      title: 'Auszahlung ins Wallet freigegeben',
      message: `${formatMoney(release.walletTransaction.amount, release.currency)} wurde ins Wallet gebucht.`,
    },
    duplicate: false,
    source: 'fallback',
    warning,
  };
}

function isDemoOrderId(orderId: string) {
  return orderId.startsWith('mission_demo') || orderId.startsWith('demo') || orderId.startsWith('TR-');
}

function formatMoney(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(value);
}
