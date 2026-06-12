import { NextRequest, NextResponse } from 'next/server';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';
import { getTrackingReadiness } from '@/lib/tracking-readiness';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    return NextResponse.json(getTrackingReadiness());
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}
