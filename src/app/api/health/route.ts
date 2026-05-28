import { NextResponse } from 'next/server';
import { getDatabaseReadiness } from '@/lib/database-readiness';
import { getOperationsReadiness } from '@/lib/operations-readiness';
import { getStripeReadiness } from '@/lib/stripe-readiness';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  const database = await getDatabaseReadiness();
  const stripe = getStripeReadiness();
  const operations = getOperationsReadiness();
  const latency = Date.now() - startTime;
  const databaseHealthy = database.ready;
  const stripeHealthy = stripe.ready;
  const operationsHealthy = operations.ready;
  const status = databaseHealthy && stripeHealthy && operationsHealthy
    ? 'ok'
    : databaseHealthy
      ? 'degraded'
      : 'error';

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: {
          status: databaseHealthy ? 'ok' : 'error',
          score: database.score,
          missingCount: database.missing.length,
          warningCount: database.warnings.length,
          migrationCommand: database.ready ? undefined : database.migrationCommand,
        },
        stripe: {
          status: stripeHealthy ? 'ok' : 'warning',
          score: stripe.score,
          missingCount: stripe.missing.length,
          warningCount: stripe.warnings.length,
        },
        operations: {
          status: operationsHealthy ? 'ok' : 'warning',
          score: operations.score,
          missingCount: operations.missing.length,
          warningCount: operations.warnings.length,
          cronJobCount: operations.cronJobs.length,
        },
      },
      latency,
    },
    {
      status: databaseHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
