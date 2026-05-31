import { NextRequest, NextResponse } from 'next/server';
import { createOrderPayoutRelease } from '@/lib/order-payout';
import {
  getOrderPayoutReadiness,
  releaseOrderPayout,
} from '@/services/order-payout-release.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const fallbackAmount = Number(searchParams.get('amount') || 850);

  try {
    const readiness = await getOrderPayoutReadiness({
      orderId: id,
      amount: fallbackAmount,
    });

    if (!readiness && !isDemoOrderId(id)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Transport not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(readiness || createFallbackRelease(id, fallbackAmount));
  } catch (error) {
    console.error('[OrderPayoutReleaseAPI] GET failed:', error);
    return NextResponse.json(createFallbackRelease(id, fallbackAmount, 'Database unavailable, using payout readiness fallback'));
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const fallbackAmount = Number(body.amount || 850);
  const role = request.headers.get('x-user-role');
  const actorId = request.headers.get('x-user-id');

  if (!isPayoutAdminRole(role)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Manual payout release requires ADMIN or FINANCE role.' },
      { status: 403 },
    );
  }

  if (!body.reason || String(body.reason).trim().length < 8) {
    return NextResponse.json(
      { error: 'REASON_REQUIRED', message: 'Manual payout release requires an audit reason.' },
      { status: 400 },
    );
  }

  try {
    const result = await releaseOrderPayout({
      orderId: id,
      amount: fallbackAmount,
      riskLevel: body.riskLevel || 'green',
      force: true,
      actorId,
      reason: String(body.reason),
    });

    if (!result && !isDemoOrderId(id)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Transport not found' },
        { status: 404 },
      );
    }

    if (!result) {
      return NextResponse.json(createFallbackRelease(id, fallbackAmount));
    }

    return NextResponse.json(result, { status: result.success ? 200 : 409 });
  } catch (error) {
    console.error('[OrderPayoutReleaseAPI] POST failed:', error);
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

function isPayoutAdminRole(role: string | null) {
  return role === 'ADMIN' || role === 'FINANCE';
}

function formatMoney(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(value);
}
