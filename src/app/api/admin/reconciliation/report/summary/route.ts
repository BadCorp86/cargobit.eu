import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/admin/reconciliation/report/summary
 * Get aggregated summary statistics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build date filter
    let dateFilter = '';
    const params: any[] = [];

    if (dateFrom && dateTo) {
      dateFilter = `AND created_at BETWEEN $1 AND $2`;
      params.push(new Date(dateFrom), new Date(dateTo));
    } else if (dateFrom) {
      dateFilter = `AND created_at >= $1`;
      params.push(new Date(dateFrom));
    } else if (dateTo) {
      dateFilter = `AND created_at <= $1`;
      params.push(new Date(dateTo));
    }

    // Get total payouts and amounts
    const statsResult = await db.$queryRawUnsafe(
      `
      SELECT
        COUNT(*) as total_payouts,
        COALESCE(SUM(amount_cents), 0) as total_amount,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (processed_at - created_at))
        ), 0) as avg_processing_time
      FROM payouts
      WHERE 1=1 ${dateFilter}
      `,
      ...params
    );

    // Get counts by status
    const statusResult = await db.$queryRawUnsafe(
      `
      SELECT status, COUNT(*) as count
      FROM payouts
      WHERE 1=1 ${dateFilter}
      GROUP BY status
      `,
      ...params
    );

    const stats = (statsResult as any[])[0] || {};
    const byStatus: Record<string, number> = {};

    for (const row of statusResult as any[]) {
      byStatus[row.status] = Number(row.count);
    }

    return NextResponse.json({
      totalPayouts: Number(stats.total_payouts || 0),
      totalAmount: Number(stats.total_amount || 0),
      byStatus,
      avgProcessingTime: Number(stats.avg_processing_time || 0),
    });
  } catch (error) {
    console.error('Error getting summary:', error);
    return NextResponse.json(
      { error: 'Failed to get summary' },
      { status: 500 }
    );
  }
}
