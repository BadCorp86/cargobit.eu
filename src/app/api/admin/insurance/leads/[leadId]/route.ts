import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';
import {
  normalizeInsuranceReferralLeadStatus,
  updateInsuranceReferralLeadStatus,
} from '@/lib/insurance/referral';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> | { leadId: string } }
) {
  return withAdminAuth(request, async (admin) => {
    const { leadId } = await params;
    const body = await readBody(request);
    const status = normalizeInsuranceReferralLeadStatus(body.status);

    if (!status) {
      return NextResponse.json(
        { error: 'Valid status is required: LEAD_CREATED, REDIRECTED, CONVERTED, DECLINED, EXPIRED' },
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

    const lead = await updateInsuranceReferralLeadStatus(leadId, {
      status,
      externalReference: typeof body.externalReference === 'string' ? body.externalReference.trim() : null,
      premiumEur: toOptionalNumber(body.premiumEur),
      commissionEur: toOptionalNumber(body.commissionEur),
      convertedAt: body.convertedAt,
      actorType: 'ADMIN',
      actorId: admin.id,
      metadata: {
        note: typeof body.note === 'string' ? body.note.trim() : null,
        source: 'admin_dashboard',
      },
    });

    await db.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'INSURANCE_LEAD_STATUS_UPDATED',
        entityType: 'insurance_referral_lead',
        entityId: leadId,
        dataBefore: JSON.stringify({
          status: previousLead.status,
          externalReference: previousLead.externalReference,
          premiumEstimateEur: previousLead.premiumEstimateEur,
          commissionEstimateEur: previousLead.commissionEstimateEur,
        }),
        dataAfter: JSON.stringify({
          status,
          externalReference: lead.externalReference,
          premiumEstimateEur: lead.premiumEstimateEur,
          commissionEstimateEur: lead.commissionEstimateEur,
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

function toOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
