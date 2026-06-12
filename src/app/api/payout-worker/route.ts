import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { runPayoutCronJob } from '@/lib/payout-cron-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  return runPayoutCronJob();
}

export async function GET(request: NextRequest) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  return NextResponse.json({
    status: 'ok',
    message:
      'Legacy payout worker route is available for compatibility and now delegates to the settlement scheduler.',
    canonicalEndpoint: '/api/cron/payouts',
  });
}
