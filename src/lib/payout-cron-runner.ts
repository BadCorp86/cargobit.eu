import { NextResponse } from 'next/server';
import { payoutScheduler } from '@/services/payout-scheduler.service';

export async function runPayoutCronJob() {
  const result = await payoutScheduler.runScheduledPayouts();
  const hasIssues = result.diffs.length > 0;

  return NextResponse.json({
    success: true,
    timestamp: result.timestamp,
    duration: result.duration,
    summary: {
      pendingProcessed: result.pendingPayouts,
      successful: result.processedPayouts,
      failed: result.failedPayouts,
      reconciled: result.reconciledPayouts,
      autoReleased: result.autoReleasedPayouts,
    },
    warnings: hasIssues ? result.diffs : undefined,
  }, {
    status: 200,
    headers: {
      'X-Scheduler-Run': result.timestamp.toISOString(),
      'X-Duration-Ms': result.duration.toString(),
      'X-Has-Issues': hasIssues ? 'true' : 'false',
    },
  });
}
