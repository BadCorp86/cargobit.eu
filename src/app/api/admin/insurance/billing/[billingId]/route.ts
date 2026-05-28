import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';
import {
  InsuranceBillingStatus,
  updateInsurancePartnerBilling,
} from '@/lib/insurance/billing';

export const dynamic = 'force-dynamic';

const BILLING_STATUSES: InsuranceBillingStatus[] = ['OPEN', 'PAID', 'OVERDUE', 'CANCELLED'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ billingId: string }> | { billingId: string } }
) {
  return withAdminAuth(request, async (admin) => {
    const { billingId } = await params;
    const body = await readBody(request);
    const status = String(body.status || '').trim().toUpperCase() as InsuranceBillingStatus;

    if (!BILLING_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: 'Valid billing status is required: OPEN, PAID, OVERDUE, CANCELLED' },
        { status: 400 }
      );
    }

    const billing = await updateInsurancePartnerBilling({
      billingId,
      status,
      adminId: admin.id,
      paymentMethod: typeof body.paymentMethod === 'string' ? body.paymentMethod.trim() : null,
      paymentReference: typeof body.paymentReference === 'string' ? body.paymentReference.trim() : null,
      invoiceUrl: typeof body.invoiceUrl === 'string' ? body.invoiceUrl.trim() : null,
      note: typeof body.note === 'string' ? body.note.trim() : null,
    });

    if (!billing) {
      return NextResponse.json({ error: 'Insurance billing not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, billing });
  }, [AdminRole.ADMIN, AdminRole.FINANCE]);
}

async function readBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
