import { NextResponse } from 'next/server';
import { getOperationsReadiness, withoutMaskedOperationsValues } from '@/lib/operations-readiness';
import { getStripeReadiness, withoutMaskedStripeValues } from '@/lib/stripe-readiness';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ...withoutMaskedStripeValues(getStripeReadiness()),
    operations: withoutMaskedOperationsValues(getOperationsReadiness()),
  });
}
