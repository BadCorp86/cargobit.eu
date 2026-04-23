import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/admin/reconciliation/report/exports
 * List recent export jobs
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const size = parseInt(searchParams.get('size') || '20', 10);
    const status = searchParams.get('status');

    // Build where clause
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause = `WHERE status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Get jobs with pagination
    const offset = (page - 1) * size;
    const jobs = await db.$queryRawUnsafe(
      `
      SELECT id, status, result_url, error, rows_exported, file_size, created_at, completed_at
      FROM export_jobs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      ...params,
      size,
      offset
    );

    // Get total count
    const countResult = await db.$queryRawUnsafe(
      `
      SELECT COUNT(*) as total FROM export_jobs ${whereClause}
      `,
      ...params
    );
    const total = Number((countResult as any[])[0]?.total || 0);

    return NextResponse.json({
      items: jobs,
      total,
      page,
      size,
    });
  } catch (error) {
    console.error('Error listing export jobs:', error);
    return NextResponse.json(
      { error: 'Failed to list export jobs' },
      { status: 500 }
    );
  }
}
