import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

/**
 * POST /api/admin/reconciliation/report/export
 * Enqueue an export job for background processing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { format = 'csv', filter = {} } = body;

    // Validate format
    if (!['csv', 'json'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be "csv" or "json"' },
        { status: 400 }
      );
    }

    // Create export job
    const jobId = randomUUID();

    await db.$executeRaw`
      INSERT INTO export_jobs (id, payload, status, created_at, updated_at)
      VALUES (${jobId}, ${JSON.stringify({ format, filter })}, 'queued', NOW(), NOW())
    `;

    console.log(`Export job ${jobId} enqueued with format ${format}`);

    return NextResponse.json(
      {
        jobId,
        status: 'queued',
        message: 'Export job has been queued for processing',
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('Error creating export job:', error);
    return NextResponse.json(
      { error: 'Failed to create export job' },
      { status: 500 }
    );
  }
}
