import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/admin/reconciliation/report/export/[id]
 * Get status of an export job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    const jobs = await db.$queryRaw<any[]>`
      SELECT id, status, result_url, error, rows_exported, file_size, duration_ms, created_at, completed_at
      FROM export_jobs
      WHERE id = ${jobId}
    `;

    if (!jobs || jobs.length === 0) {
      return NextResponse.json(
        { error: 'Export job not found' },
        { status: 404 }
      );
    }

    const job = jobs[0];

    // Calculate progress
    let progress = 0;
    if (job.status === 'running') {
      progress = 50;
    } else if (job.status === 'done') {
      progress = 100;
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      resultUrl: job.result_url,
      error: job.error,
      progress,
      rowsExported: job.rows_exported,
      fileSize: job.file_size,
      durationMs: job.duration_ms,
      createdAt: job.created_at,
      completedAt: job.completed_at,
    });
  } catch (error) {
    console.error('Error getting export job status:', error);
    return NextResponse.json(
      { error: 'Failed to get export job status' },
      { status: 500 }
    );
  }
}
