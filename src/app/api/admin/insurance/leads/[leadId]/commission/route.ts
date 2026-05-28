import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';
import {
  normalizeInsuranceReferralCommissionStatus,
  updateInsuranceReferralCommissionStatus,
} from '@/lib/insurance/referral';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> | { leadId: string } }
) {
  return withAdminAuth(request, async (admin) => {
    const { leadId } = await params;
    const body = await readBody(request);
    const commissionStatus = normalizeInsuranceReferralCommissionStatus(body.commissionStatus || body.status);

    if (!commissionStatus) {
      return NextResponse.json(
        { error: 'Valid commission status is required: PENDING, EARNED, INVOICED, PAID, VOID' },
        { status: 400 }
      );
    }

    const db = prisma as any;
    const previousLead = await db.insuranceReferralLead.findUnique({
      where: { id: leadId },
    });

    if (!previousLead) {
      return NextResponse.json({ error: 'Insurance lead not found' }, { status: 404 });
    }

    const lead = await updateInsuranceReferralCommissionStatus(leadId, {
      commissionStatus,
      invoiceReference: typeof body.invoiceReference === 'string' ? body.invoiceReference.trim() : null,
      actorType: 'ADMIN',
      actorId: admin.id,
      note: typeof body.note === 'string' ? body.note.trim() : null,
    });

    await db.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'INSURANCE_COMMISSION_STATUS_UPDATED',
        entityType: 'insurance_referral_lead',
        entityId: leadId,
        dataBefore: JSON.stringify({
          commissionStatus: previousLead.commissionStatus,
          commissionInvoiceReference: previousLead.commissionInvoiceReference,
          commissionSettledAt: previousLead.commissionSettledAt,
        }),
        dataAfter: JSON.stringify({
          commissionStatus: lead.commissionStatus,
          commissionInvoiceReference: lead.commissionInvoiceReference,
          commissionSettledAt: lead.commissionSettledAt,
          note: typeof body.note === 'string' ? body.note.trim() : null,
        }),
      },
    });

    return NextResponse.json({ ok: true, lead });
  }, [AdminRole.ADMIN, AdminRole.FINANCE]);
}

async function readBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
