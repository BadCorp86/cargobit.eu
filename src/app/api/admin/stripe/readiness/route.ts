import { NextRequest, NextResponse } from 'next/server';
import { getStripeReadiness } from '@/lib/stripe-readiness';
import { getDatabaseReadiness } from '@/lib/database-readiness';
import { getOperationsReadiness } from '@/lib/operations-readiness';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const stripe = getStripeReadiness();
    const database = await getDatabaseReadiness();
    const operations = getOperationsReadiness();

    return NextResponse.json({
      ...stripe,
      database,
      operations,
      productionReady: stripe.ready && database.ready && operations.ready,
    });
  }, [AdminRole.ADMIN, AdminRole.FINANCE]);
}
