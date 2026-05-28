import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseReadiness } from '@/lib/database-readiness';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => (
    NextResponse.json(await getDatabaseReadiness())
  ), [AdminRole.ADMIN, AdminRole.FINANCE]);
}
