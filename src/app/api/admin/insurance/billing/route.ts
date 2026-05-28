import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';
import {
  generateInsurancePartnerBillings,
  listInsurancePartnerBillings,
} from '@/lib/insurance/billing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const { searchParams } = new URL(request.url);
    const result = await listInsurancePartnerBillings({
      month: searchParams.get('month'),
      status: searchParams.get('status'),
      partnerId: searchParams.get('partnerId'),
    });

    return NextResponse.json(result);
  }, [AdminRole.ADMIN, AdminRole.FINANCE]);
}

export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (admin) => {
    const body = await readBody(request);
    const result = await generateInsurancePartnerBillings({
      month: typeof body.month === 'string' ? body.month : null,
      partnerId: typeof body.partnerId === 'string' ? body.partnerId : null,
      vatRate: typeof body.vatRate === 'number' ? body.vatRate : undefined,
      force: Boolean(body.force),
      adminId: admin.id,
    });

    return NextResponse.json(result, { status: 201 });
  }, [AdminRole.ADMIN, AdminRole.FINANCE]);
}

async function readBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
