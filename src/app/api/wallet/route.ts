// ============================================
// CARGOBIT WALLET API - Main Endpoints
// GET /wallet - Get current wallet balance
// POST /wallet/topup - Create Stripe PaymentIntent
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Mock Stripe for development - in production use real Stripe SDK
const mockStripe = {
  paymentIntents: {
    create: async (params: any) => ({
      id: `pi_mock_${Date.now()}`,
      client_secret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`,
      amount: params.amount,
      currency: params.currency,
      metadata: params.metadata,
      status: 'requires_payment_method',
    }),
  },
};

// ============================================
// GET /api/wallet - Get wallet balance
// ============================================
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    
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
        currency: wallet.currency,
        status: wallet.status,
        totalDeposited: wallet.totalDeposited,
        totalWithdrawn: wallet.totalWithdrawn,
        recentTransactions: wallet.transactions.slice(0, 5),
        payoutMethods: wallet.payoutMethods,
      },
    });
  } catch (error) {
    console.error('Wallet fetch error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler beim Abrufen der Wallet',
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
    const { amountCents } = body;
    const userId = request.headers.get('x-user-id') || 'demo-user';

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
          currency: 'EUR',
          status: 'ACTIVE',
        },
      });
    }

    // Check wallet status
    if (wallet.status !== 'ACTIVE') {
      return NextResponse.json({
        error: 'WalletError',
        message: 'Wallet ist nicht aktiv',
        code: 'WALLET_INACTIVE',
      }, { status: 403 });
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await mockStripe.paymentIntents.create({
      amount: amountCents,
      currency: 'eur',
      metadata: {
        userId: userId,
        walletId: wallet.id,
        type: 'wallet_topup',
      },
    });

    // Create pending transaction
    const transaction = await db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount: amountCents / 100,
        currency: 'EUR',
        description: 'Guthaben aufladen',
        reference: paymentIntent.id,
        processedAt: null, // Will be set on webhook success
      },
    });

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      transactionId: transaction.id,
      amount: amountCents / 100,
      currency: 'EUR',
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
