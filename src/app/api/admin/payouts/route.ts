// ============================================
// CARGOBIT ADMIN PAYOUTS API
// Task 3.1 Payouts - Create / List
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/permissions';
import { PayoutStatus } from '@prisma/client';

// ============================================
// INTERFACES
// ============================================

interface PayoutSummaryResponse {
  id: string;
  userId: string;
  userName?: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: Date;
  stripeTransferId?: string;
  ibanLast4?: string;
}

// ============================================
// GET /api/admin/payouts - List Payouts
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Auth check - require admin or finance role
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return NextResponse.json({
        error: 'UnauthorizedError',
        message: 'Authentifizierung erforderlich',
        code: 'AUTH_REQUIRED',
      }, { status: 401 });
    }

    const hasRole = authContext.roles.some(role => 
      ['ADMIN', 'SUPPORT'].includes(role)
    );

    if (!hasRole) {
      return NextResponse.json({
        error: 'ForbiddenError',
        message: 'Admin oder Support-Rolle erforderlich',
        code: 'INSUFFICIENT_ROLE',
      }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as PayoutStatus | null;
    const userId = searchParams.get('userId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query
    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (userId) {
      where.userId = userId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Execute query
    const [payouts, total] = await Promise.all([
      db.payout.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.payout.count({ where }),
    ]);

    // Format response
    const response: PayoutSummaryResponse[] = payouts.map(p => ({
      id: p.id,
      userId: p.userId,
      userName: p.user.firstName && p.user.lastName 
        ? `${p.user.firstName} ${p.user.lastName}` 
        : p.user.email,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
      stripeTransferId: p.stripeTransferId || undefined,
      ibanLast4: p.ibanLast4 || undefined,
    }));

    return NextResponse.json({
      success: true,
      data: response,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });

  } catch (error) {
    console.error('List payouts error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler beim Abrufen der Auszahlungen',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}

// ============================================
// POST /api/admin/payouts - Create Payout
// ============================================

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return NextResponse.json({
        error: 'UnauthorizedError',
        message: 'Authentifizierung erforderlich',
        code: 'AUTH_REQUIRED',
      }, { status: 401 });
    }

    const hasRole = authContext.roles.some(role =>
      ['ADMIN', 'FINANCE'].includes(role)
    );

    if (!hasRole) {
      return NextResponse.json({
        error: 'ForbiddenError',
        message: 'Admin oder Finance-Rolle erforderlich',
        code: 'INSUFFICIENT_ROLE',
      }, { status: 403 });
    }

    return NextResponse.json({
      error: 'ADMIN_CREATE_PAYOUT_DISABLED',
      message:
        'Admin-erstellte Bankauszahlungen sind deaktiviert. Nutzer starten Auszahlungen selbst im eigenen Wallet-Bereich; Admin/Finance kann Auszahlungen prüfen, stornieren oder fehlgeschlagene Vorgänge bearbeiten.',
      walletPayoutEndpoint: '/api/wallet/payout',
    }, { status: 410 });

  } catch (error) {
    console.error('Create payout error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler beim Erstellen der Auszahlung',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}
