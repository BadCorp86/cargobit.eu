import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/admin/reconciliation/report
 * List reconciliation reports with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const size = Math.min(parseInt(searchParams.get('size') || '50', 10), 500);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build where clause
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) {
        where.created_at.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.created_at.lte = new Date(dateTo);
      }
    }

    // Query payouts (adjust model name as needed)
    const [items, total] = await Promise.all([
      db.payout.findMany({
        where,
        take: size,
        skip: (page - 1) * size,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          user_id: true,
          amount_cents: true,
          status: true,
          created_at: true,
          processed_at: true,
          reference: true,
        },
      }),
      db.payout.count({ where }),
    ]);

    // Calculate summary
    const summary = await db.payout.aggregate({
      where,
      _sum: { amount_cents: true },
      _avg: { amount_cents: true },
    });

    return NextResponse.json({
      total,
      page,
      size,
      items,
      summary: {
        totalAmount: summary._sum.amount_cents || 0,
        avgAmount: summary._avg.amount_cents || 0,
      },
    });
  } catch (error) {
    console.error('Error listing reports:', error);
    return NextResponse.json(
      { error: 'Failed to list reports' },
      { status: 500 }
    );
  }
}
