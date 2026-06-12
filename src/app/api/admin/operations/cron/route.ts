import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOperationsReadiness } from '@/lib/operations-readiness';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';
import { payoutScheduler } from '@/services/payout-scheduler.service';
import { getAutomaticPayoutReleaseQueue } from '@/services/order-payout-release.service';
import { ReconciliationScheduler } from '@/reconciliation/schedulers/reconciliation.scheduler';
import { ReconciliationService } from '@/reconciliation/services/reconciliation.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OperationAction = 'payout-health' | 'payout-processing' | 'payment-reconciliation';

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const operations = getOperationsReadiness();
    const payoutHealth = await getPayoutHealth();

    return NextResponse.json({
      operations,
      payoutHealth,
    });
  }, [AdminRole.ADMIN]);
}

export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (admin) => {
    const body = await request.json().catch(() => ({}));
    const action = body.action as OperationAction | undefined;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action', code: 'ACTION_REQUIRED' },
        { status: 400 },
      );
    }

    if (action === 'payout-health') {
      const result = await getPayoutHealth();
      await recordOperationAudit(request, admin.id, admin.email, action, true, result);

      return NextResponse.json({
        success: true,
        action,
        actor: admin.email,
        result,
      });
    }

    if (action === 'payout-processing') {
      if (body.confirmation !== 'RUN_PAYOUTS') {
        return NextResponse.json(
          {
            error: 'Payout processing requires explicit confirmation',
            code: 'CONFIRMATION_REQUIRED',
            requiredConfirmation: 'RUN_PAYOUTS',
          },
          { status: 409 },
        );
      }

      const result = await payoutScheduler.runScheduledPayouts();
      const autoReleaseQueue = await getAutomaticPayoutReleaseQueue({ limit: 25 });
      const response = {
        timestamp: result.timestamp,
        duration: result.duration,
        pendingProcessed: result.pendingPayouts,
        successful: result.processedPayouts,
        failed: result.failedPayouts,
        reconciled: result.reconciledPayouts,
        autoReleased: result.autoReleasedPayouts,
        autoReleaseQueue,
        warnings: result.diffs,
      };
      await recordOperationAudit(request, admin.id, admin.email, action, true, response);

      return NextResponse.json({
        success: true,
        action,
        actor: admin.email,
        result: response,
      });
    }

    if (action === 'payment-reconciliation') {
      const service = new ReconciliationService();
      const scheduler = new ReconciliationScheduler(service);
      const result = await scheduler.triggerManually();
      await recordOperationAudit(request, admin.id, admin.email, action, result.success, result.result || { error: result.error });

      return NextResponse.json(
        {
          success: result.success,
          action,
          actor: admin.email,
          result: result.result,
          error: result.error,
        },
        { status: result.success ? 200 : 500 },
      );
    }

    return NextResponse.json(
      { error: 'Unsupported action', code: 'ACTION_UNSUPPORTED' },
      { status: 400 },
    );
  }, [AdminRole.ADMIN]);
}

async function getPayoutHealth() {
  const stats = payoutScheduler.getStats();
  const [healthResult, autoReleaseQueue] = await Promise.all([
    payoutScheduler.healthCheck()
      .then((health) => ({ available: true, health }))
      .catch((error) => ({
        available: false,
        error: error instanceof Error ? error.message : 'Payout health check failed',
      })),
    getAutomaticPayoutReleaseQueue({ limit: 25 }),
  ]);

  return {
    available: healthResult.available && autoReleaseQueue.available !== false,
    health: healthResult.available ? healthResult.health : null,
    healthError: healthResult.available ? undefined : healthResult.error,
    stats,
    autoReleaseQueue,
  };
}

async function recordOperationAudit(
  request: NextRequest,
  adminId: string,
  adminEmail: string,
  action: OperationAction,
  success: boolean,
  result: unknown,
) {
  await db.auditLog.create({
    data: {
      userId: null,
      action: 'UPDATE',
      entityType: 'admin_operation',
      entityId: action,
      dataAfter: JSON.stringify({
        adminId,
        adminEmail,
        action,
        success,
        result: summarizeResult(result),
      }),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    },
  }).catch((error) => {
    console.error('[AdminOperations] Failed to record audit log:', error);
  });
}

function summarizeResult(result: unknown) {
  if (!result || typeof result !== 'object') return result;
  const value = result as Record<string, unknown>;
  const autoReleaseQueue = value.autoReleaseQueue as Record<string, unknown> | undefined;

  return {
    available: value.available,
    timestamp: value.timestamp,
    duration: value.duration,
    pendingProcessed: value.pendingProcessed,
    successful: value.successful,
    failed: value.failed,
    reconciled: value.reconciled,
    autoReleased: value.autoReleased,
    autoReleaseReady: autoReleaseQueue?.ready,
    autoReleaseBlocked: autoReleaseQueue?.blocked,
    autoReleaseReleased: autoReleaseQueue?.released,
    processed: value.processed,
    diffs: Array.isArray(value.diffs) ? value.diffs.length : undefined,
    errors: Array.isArray(value.errors) ? value.errors.length : undefined,
    warnings: Array.isArray(value.warnings) ? value.warnings.length : undefined,
    error: value.error,
  };
}
