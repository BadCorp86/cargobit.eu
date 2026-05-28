// ============================================
// CARGOBIT CRON API - PAYOUTS SCHEDULER
// Called by Vercel Cron or external scheduler
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { runPayoutCronJob } from '@/lib/payout-cron-runner';
import { payoutScheduler } from '@/services/payout-scheduler.service';

// ============================================
// POST /api/cron/payouts
// 
// Triggered by:
// - Vercel Cron: Add to vercel.json
// - External: cron-job.org, EasyCron
// - Manual: Admin Dashboard
// ============================================

export async function POST(request: NextRequest) {
  try {
    const authError = verifyCronRequest(request);
    if (authError) return authError;

    return runPayoutCronJob();
  } catch (error) {
    console.error('Cron payouts error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Scheduler run failed',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}

// ============================================
// GET /api/cron/payouts - Health Check
// ============================================

export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronRequest(request);
    if (authError) return authError;

    const health = await payoutScheduler.healthCheck();
    const stats = payoutScheduler.getStats();

    return NextResponse.json({
      healthy: health.healthy,
      lastRun: health.lastRun,
      nextRun: stats.nextRun,
      stats: {
        totalRuns: stats.totalRuns,
        successfulRuns: stats.successfulRuns,
        failedRuns: stats.failedRuns,
      },
      queue: {
        pendingPayouts: health.pendingPayouts,
        failedPayouts: health.failedPayouts,
      },
      lock: health.lockStatus,
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      healthy: false,
      error: 'Health check failed',
    }, { status: 500 });
  }
}
