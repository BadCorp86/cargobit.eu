// ============================================
// CARGOBIT PAYOUT SERVICE - STRIPE CONNECT
// POST /api/wallet/payout-stripe
// Connect-based payout to transporter's Stripe account
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================
// MOCK STRIPE (Replace with real SDK in production)
// ============================================
const mockStripe = {
  transfers: {
    create: async (params: any) => ({
      id: `tr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      object: 'transfer',
      amount: params.amount,
      currency: params.currency,
      destination: params.destination,
      metadata: params.metadata,
      created: Math.floor(Date.now() / 1000),
    }),
  },
  payouts: {
    create: async (params: any) => ({
      id: `po_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      object: 'payout',
      amount: params.amount,
      currency: params.currency,
      status: 'pending',
      arrival_date: Math.floor(Date.now() / 1000) + 86400 * 2, // 2 days
    }),
  },
};

// ============================================
// GET TRANSPORTER BY USER
// ============================================
async function getTransporterByUser(userId: string) {
  const driver = await db.driver.findFirst({
    where: { userId },
    include: {
      company: true,
      user: true,
    },
  });

  if (!driver) {
    throw new Error('Transporter profile not found');
  }

  return driver;
}

// ============================================
// GET WALLET BY USER
// ============================================
async function getWalletByUser(userId: string) {
  const wallet = await db.wallet.findFirst({
    where: { ownerUserId: userId },
  });

  if (!wallet) {
    throw new Error('Wallet not found');
  }

  return wallet;
}

// ============================================
// DEBIT WALLET (Atomic Transaction)
// ============================================
async function debitWallet(
  walletId: string, 
  userId: string, 
  amountCents: number, 
  type: string, 
  reference: string
) {
  return await db.$transaction(async (tx) => {
    // Get current wallet with lock
    const wallet = await tx.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet || wallet.balance * 100 < amountCents) {
      throw new Error('Insufficient funds');
    }

    // Create transaction record
    const transaction = await tx.walletTransaction.create({
      data: {
        walletId,
        type: type as any,
        amount: -amountCents / 100,
        currency: 'EUR',
        reference,
        description: `Stripe Payout - ${type}`,
        processedAt: new Date(),
      },
    });

    // Update wallet balance
    await tx.wallet.update({
      where: { id: walletId },
      data: {
        balance: { decrement: amountCents / 100 },
        totalWithdrawn: { increment: amountCents / 100 },
      },
    });

    return transaction;
  });
}

// ============================================
// CREATE PAYOUT FOR TRANSPORTER
// ============================================
async function createPayoutForTransporter(
  userId: string, 
  amountCents: number,
  stripeAccountId: string
) {
  // Get wallet
  const wallet = await getWalletByUser(userId);
  
  if (wallet.balance * 100 < amountCents) {
    throw new Error('Insufficient funds');
  }

  // Create Stripe Transfer (Connect)
  const transfer = await mockStripe.transfers.create({
    amount: amountCents,
    currency: 'eur',
    destination: stripeAccountId,
    metadata: {
      user_id: userId,
      wallet_id: wallet.id,
      type: 'transporter_payout',
    },
  });

  // Debit wallet atomically
  await debitWallet(wallet.id, userId, amountCents, 'PAYOUT', transfer.id);

  // Create notification
  await db.notification.create({
    data: {
      userId,
      type: 'PAYOUT_INITIATED',
      title: 'Auszahlung gestartet',
      message: `Ihre Auszahlung von ${(amountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} wurde initiiert.`,
      data: JSON.stringify({ 
        amount: amountCents, 
        transferId: transfer.id,
        estimatedArrival: new Date(Date.now() + 86400 * 2 * 1000),
      }),
    },
  });

  return transfer.id;
}

// ============================================
// POST /api/wallet/payout-stripe
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amountCents, stripeAccountId } = body;
    const userId = request.headers.get('x-user-id') || 'demo-user';

    // Validation
    if (!amountCents || amountCents < 100) {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Mindestbetrag ist 1,00 €',
      }, { status: 400 });
    }

    if (!stripeAccountId) {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Stripe Account ID erforderlich',
        hint: 'Der Transporteur muss zunächst ein Stripe Connect Konto verknüpfen',
      }, { status: 400 });
    }

    // Get transporter profile
    const transporter = await getTransporterByUser(userId);

    // Create payout
    const payoutId = await createPayoutForTransporter(userId, amountCents, stripeAccountId);

    // Audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'PAYOUT',
        entityType: 'wallet',
        dataAfter: JSON.stringify({
          amountCents,
          stripeAccountId,
          payoutId,
          transporterId: transporter.id,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      payoutId,
      amount: amountCents / 100,
      currency: 'EUR',
      status: 'pending',
      estimatedArrival: new Date(Date.now() + 86400 * 2 * 1000).toISOString(),
      message: 'Auszahlung erfolgreich initiiert',
    });

  } catch (error: any) {
    console.error('[PAYOUT] Error:', error);
    
    if (error.message === 'Insufficient funds') {
      return NextResponse.json({
        error: 'InsufficientFunds',
        message: 'Unzureichendes Guthaben',
      }, { status: 400 });
    }

    if (error.message === 'Transporter profile not found') {
      return NextResponse.json({
        error: 'NotFound',
        message: 'Kein Transporteur-Profil gefunden',
      }, { status: 404 });
    }

    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler bei der Auszahlung',
    }, { status: 500 });
  }
}
