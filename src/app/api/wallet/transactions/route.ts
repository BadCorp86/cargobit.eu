// ============================================
// CARGOBIT WALLET TRANSACTIONS API
// GET /api/wallet/transactions - List transactions
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================
// GET /api/wallet/transactions
// Query params: page, limit, type
// ============================================
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const type = searchParams.get('type'); // Filter by transaction type
    const offset = (page - 1) * limit;

    // Get wallet
    const wallet = await db.wallet.findFirst({
      where: { ownerUserId: userId },
    });

    if (!wallet) {
      return NextResponse.json({
        transactions: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Build where clause
    const where: any = { walletId: wallet.id };
    if (type && ['DEPOSIT', 'PAYOUT', 'FEE', 'COMMISSION', 'PAYMENT_IN', 'PAYMENT_OUT', 'REFUND'].includes(type)) {
      where.type = type;
    }

    // Get transactions
    const [transactions, total] = await Promise.all([
      db.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      db.walletTransaction.count({ where }),
    ]);

    // Format transactions
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      amountCents: Math.round(tx.amount * 100),
      currency: tx.currency,
      description: tx.description,
      reference: tx.reference,
      status: tx.processedAt ? 'succeeded' : (tx.failedAt ? 'failed' : 'pending'),
      processedAt: tx.processedAt,
      failedAt: tx.failedAt,
      failureReason: tx.failureReason,
      relatedTransportId: tx.relatedTransportId,
      createdAt: tx.createdAt,
    }));

    return NextResponse.json({
      success: true,
      transactions: formattedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalDeposits: wallet.totalDeposited,
        totalWithdrawals: wallet.totalWithdrawn,
        currentBalance: wallet.balance,
      },
    });
  } catch (error) {
    console.error('Transactions fetch error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler beim Abrufen der Transaktionen',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}
