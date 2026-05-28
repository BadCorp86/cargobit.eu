import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { runPayoutCronJob } from '@/lib/payout-cron-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronRequest(request);
    if (authError) return authError;

    return runPayoutCronJob();
  } catch (error) {
    console.error('Payout cron run error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Scheduler run failed',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}

export const POST = GET;
