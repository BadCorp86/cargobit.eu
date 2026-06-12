// ============================================
// CARGOBIT CRON API - PAYOUTS SCHEDULER
// Called by Vercel Cron or external scheduler
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { runPayoutCronJob } from '@/lib/payout-cron-runner';
import { payoutScheduler } from '@/services/payout-scheduler.service';
import { getAutomaticPayoutReleaseQueue } from '@/services/order-payout-release.service';

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

    const [healthResult, autoReleaseQueue] = await Promise.all([
      payoutScheduler.healthCheck()
        .then((health) => ({ available: true, health }))
        .catch((error) => ({
          available: false,
          error: error instanceof Error ? error.message : 'Health check failed',
        })),
      getAutomaticPayoutReleaseQueue({ limit: 25 }),
    ]);
    const stats = payoutScheduler.getStats();
    const health = healthResult.available ? healthResult.health : null;

    return NextResponse.json({
      healthy: Boolean(health?.healthy) && autoReleaseQueue.available !== false,
      lastRun: health?.lastRun || null,
      nextRun: stats.nextRun,
      stats: {
        totalRuns: stats.totalRuns,
        successfulRuns: stats.successfulRuns,
        failedRuns: stats.failedRuns,
      },
      queue: {
        pendingPayouts: health?.pendingPayouts || 0,
        failedPayouts: health?.failedPayouts || 0,
        autoRelease: {
          available: autoReleaseQueue.available,
          total: autoReleaseQueue.total,
          ready: autoReleaseQueue.ready,
          blocked: autoReleaseQueue.blocked,
          released: autoReleaseQueue.released,
          error: autoReleaseQueue.error,
        },
      },
      healthError: healthResult.available ? undefined : healthResult.error,
      lock: health?.lockStatus || null,
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      healthy: false,
      error: 'Health check failed',
    }, { status: 500 });
  }
}
