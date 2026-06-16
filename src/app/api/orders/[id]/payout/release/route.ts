import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-rbac';
import { getOptionalAdmin } from '@/lib/request-admin-auth';
import { getOptionalRequestUser } from '@/lib/request-user-auth';
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

    if (!readiness && !canUseDemoFallback(id)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Transport not found' },
        { status: 404 },
      );
    }

    if (readiness) {
      const authResult = await canReadPayoutReadiness(request, readiness);
      if (!authResult.allowed) {
        return NextResponse.json(
          { error: authResult.error, message: authResult.message },
          { status: authResult.status },
        );
      }

      return NextResponse.json(redactReadinessForAudience(readiness, authResult.audience));
    }

    return NextResponse.json(createFallbackRelease(id, fallbackAmount));
  } catch (error) {
    console.error('[OrderPayoutReleaseAPI] GET failed:', error);
    if (canUseDemoFallback(id)) {
      return NextResponse.json(createFallbackRelease(id, fallbackAmount, 'Database unavailable, using local payout readiness fallback'));
    }

    return NextResponse.json(
      { error: 'SETTLEMENT_READINESS_UNAVAILABLE', message: 'Payout readiness could not be loaded.' },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(request, async (admin) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const fallbackAmount = Number(body.amount || 850);

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
        actorId: admin.id,
        reason: String(body.reason),
      });

      if (!result && !isDemoOrderId(id)) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Transport not found' },
          { status: 404 },
        );
      }

      if (!result && canUseDemoFallback(id)) {
        return NextResponse.json(createFallbackRelease(id, fallbackAmount));
      }

      if (!result) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Transport not found' },
          { status: 404 },
        );
      }

      return NextResponse.json(result, { status: result.success ? 200 : 409 });
    } catch (error) {
      console.error('[OrderPayoutReleaseAPI] POST failed:', error);
      if (canUseDemoFallback(id)) {
        return NextResponse.json(createFallbackRelease(id, fallbackAmount, 'Database unavailable, using local payout release fallback'));
      }

      return NextResponse.json(
        { error: 'SETTLEMENT_RELEASE_FAILED', message: 'Manual payout release failed.' },
        { status: 503 },
      );
    }
  }, ['ADMIN', 'FINANCE']);
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

function canUseDemoFallback(orderId: string) {
  return process.env.NODE_ENV !== 'production' && isDemoOrderId(orderId);
}

async function canReadPayoutReadiness(
  request: NextRequest,
  readiness: Awaited<ReturnType<typeof getOrderPayoutReadiness>>,
) {
  if (!readiness) {
    return {
      allowed: false,
      status: 404,
      error: 'NOT_FOUND',
      message: 'Transport not found',
    };
  }

  const admin = await getOptionalAdmin(request);
  if (admin && ['ADMIN', 'SUPPORT', 'FINANCE'].includes(admin.role)) {
    return { allowed: true, audience: 'internal' as const, status: 200, error: null, message: null };
  }

  const requestUser = await getOptionalRequestUser(request);
  const userId = requestUser?.id;
  if (!userId) {
    return {
      allowed: false,
      status: 401,
      error: 'AUTH_REQUIRED',
      message: 'Authentifizierung erforderlich',
    };
  }

  if (userId === readiness.shipperUserId || userId === readiness.driverUserId) {
    return {
      allowed: true,
      audience: userId === readiness.driverUserId ? 'carrier' as const : 'shipper' as const,
      status: 200,
      error: null,
      message: null,
    };
  }

  return {
    allowed: false,
    status: 403,
    error: 'FORBIDDEN',
    message: 'Keine Berechtigung für Settlement-Daten dieses Auftrags',
  };
}

function redactReadinessForAudience(
  readiness: Awaited<ReturnType<typeof getOrderPayoutReadiness>>,
  audience?: 'internal' | 'shipper' | 'carrier',
) {
  if (!readiness || audience === 'internal') return readiness;

  const release = readiness.release;
  const isCarrier = audience === 'carrier';
  const isShipper = audience === 'shipper';

  return {
    ...readiness,
    shipperUserId: undefined,
    driverUserId: undefined,
    release: {
      ...release,
      settlement: {
        ...release.settlement,
        carrierWalletCredit: isCarrier ? release.settlement.carrierWalletCredit : 0,
        platformRevenueNet: 0,
        shipperChargeGross: isShipper ? release.settlement.shipperChargeGross : 0,
      },
      walletTransaction: {
        ...release.walletTransaction,
        reference: 'hidden',
      },
      nextStep: {
        label: isCarrier ? 'Wallet' : 'Zahlungsschutz',
        description: isCarrier
          ? 'Freigegebene Beträge können im eigenen Wallet-Bereich ausgezahlt werden.'
          : 'Die Zahlungsfreigabe wird nach POD, Rechnung und Prüfung automatisch gesteuert.',
      },
    },
  };
}

function formatMoney(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(value);
}
