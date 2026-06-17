// ============================================
// CARGOBIT WALLET API - Main Endpoints
// GET /wallet - Get current wallet balance
// POST /wallet/topup - Create Stripe PaymentIntent
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { requireRequestUser, type RequestUser } from '@/lib/request-user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================
// GET /api/wallet - Get wallet balance
// ============================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;
    const user = auth.user as RequestUser;
    const userId = user.id;
    const payoutLimits = await getPayoutLimits();
    
    // Get or create wallet for user
    let wallet = await db.wallet.findFirst({
      where: { ownerUserId: userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        payoutMethods: true,
      },
    });

    // Create wallet if not exists
    if (!wallet) {
      wallet = await db.wallet.create({
        data: {
          ownerUserId: userId,
          balance: 0,
          reservedBalance: 0,
          currency: 'EUR',
          status: 'ACTIVE',
          totalDeposited: 0,
          totalWithdrawn: 0,
        },
        include: {
          transactions: true,
          payoutMethods: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        balanceCents: Math.round(wallet.balance * 100),
        reservedBalance: wallet.reservedBalance || 0,
        reservedBalanceCents: Math.round((wallet.reservedBalance || 0) * 100),
        availableBalance: wallet.balance - (wallet.reservedBalance || 0),
        availableBalanceCents: Math.round((wallet.balance - (wallet.reservedBalance || 0)) * 100),
        currency: wallet.currency,
        status: wallet.status,
        totalDeposited: wallet.totalDeposited,
        totalWithdrawn: wallet.totalWithdrawn,
        recentTransactions: wallet.transactions.slice(0, 5),
        payoutMethods: wallet.payoutMethods,
        payoutLimits,
      },
    });
  } catch (error) {
    console.error('Wallet fetch error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler beim Abrufen der Zahlungsdaten',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}

// ============================================
// POST /api/wallet/topup - Create topup
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amountCents, simulateCredit, returnTo } = body;
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;
    const user = auth.user as RequestUser;
    const userId = user.id;
    const shouldSimulateCredit = simulateCredit === true
      && process.env.NODE_ENV !== 'production'
      && process.env.ENABLE_LOCAL_WALLET_SIMULATION === 'true';

    // Validate amount
    if (!amountCents || amountCents < 100) {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Mindestbetrag ist 1,00 €',
        code: 'INVALID_AMOUNT',
      }, { status: 400 });
    }

    // Max amount check (100,000 €)
    if (amountCents > 10000000) {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Höchstbetrag ist 100.000 €',
        code: 'AMOUNT_TOO_HIGH',
      }, { status: 400 });
    }

    // Get or create wallet
    let wallet = await db.wallet.findFirst({
      where: { ownerUserId: userId },
    });

    if (!wallet) {
      wallet = await db.wallet.create({
        data: {
          ownerUserId: userId,
          balance: 0,
          reservedBalance: 0,
          currency: 'EUR',
          status: 'ACTIVE',
        },
      });
    }

    // Check wallet status
    if (wallet.status !== 'ACTIVE') {
      return NextResponse.json({
        error: 'WalletError',
        message: 'Zahlungsschutz ist nicht aktiv',
        code: 'WALLET_INACTIVE',
      }, { status: 403 });
    }

    const amount = amountCents / 100;
    const paymentReference = shouldSimulateCredit
      ? `pi_mock_${Date.now()}`
      : null;

    if (!shouldSimulateCredit) {
      const stripeKey = process.env.STRIPE_SECRET_KEY;

      if (!stripeKey) {
        return NextResponse.json({
          error: 'StripeNotConfigured',
          message: 'Stripe ist noch nicht für Zahlungsschutz-Aufladungen konfiguriert.',
          code: 'STRIPE_NOT_CONFIGURED',
        }, { status: 503 });
      }

      const stripe = new Stripe(stripeKey, {
        apiVersion: '2026-02-25.clover' as any,
      });
      const appUrl = getAppUrl(request);
      const safeReturnTo = typeof returnTo === 'string' && returnTo.startsWith('/') ? returnTo : null;
      const returnParam = safeReturnTo ? `&returnTo=${encodeURIComponent(safeReturnTo)}` : '';
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: userId,
        customer_email: user.email || undefined,
        line_items: [
          {
            price_data: {
              currency: 'eur',
              unit_amount: amountCents,
              product_data: {
                name: 'CargoBit Zahlungsschutz-Aufladung',
                description: 'Guthaben für auftragsbezogene Transportzahlungen vorbereiten.',
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          type: 'wallet_topup',
          userId,
          walletId: wallet.id,
          amountCents: String(amountCents),
          currency: 'EUR',
        },
        success_url: `${appUrl}/shipper/wallet?checkout=success&amount=${amount}${returnParam}`,
        cancel_url: `${appUrl}/shipper/wallet?checkout=cancel&amount=${amount}${returnParam}`,
      });

      const transaction = await db.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          amount,
          currency: 'EUR',
          description: 'Zahlungsschutz-Aufladung via Stripe Checkout',
          reference: session.id,
          processedAt: null,
        },
      });

      return NextResponse.json({
        success: true,
        checkoutUrl: session.url,
        checkoutSessionId: session.id,
        transactionId: transaction.id,
        amount,
        currency: 'EUR',
        provider: 'stripe_checkout',
        simulatedCredit: false,
      });
    }

    const transaction = await db.$transaction(async (tx) => {
      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          amount,
          currency: 'EUR',
          description: 'Lokale Zahlungsschutz-Testgutschrift',
          reference: paymentReference!,
          processedAt: new Date(),
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: amount },
          totalDeposited: { increment: amount },
        },
      });

      return walletTransaction;
    });

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentReference,
      transactionId: transaction.id,
      amount,
      currency: 'EUR',
      provider: 'local_demo',
      simulatedCredit: true,
    });
  } catch (error) {
    console.error('Topup error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler beim Aufladen',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}

function getAppUrl(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, '');

  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

async function getPayoutLimits() {
  const settings = await db.systemSetting.findMany({
    where: { key: { in: ['min_payout_amount', 'max_payout_amount', 'payout_processing_days'] } },
  });
  const valueFor = (key: string, fallback: number) => {
    const value = Number(settings.find((setting) => setting.key === key)?.value);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  return {
    minAmount: valueFor('min_payout_amount', 50),
    maxAmount: valueFor('max_payout_amount', 25000),
    processingDays: valueFor('payout_processing_days', 3),
    currency: 'EUR',
  };
}
