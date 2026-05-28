import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';
import { createInsuranceReferralQuote } from '@/lib/insurance/referral';
import { parseDisputeMetadata } from '@/lib/disputes/evidence-workflow';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> | { disputeId: string } }
) {
  return withAdminAuth(request, async (admin) => {
    const { disputeId } = await params;
    const body = await readBody(request);

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        attachments: true,
        auditEvents: {
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    const existingInsuranceEvent = dispute.auditEvents.find(
      (event) => event.eventType === 'insurance_handoff_created'
    );
    const existingMetadata = parseDisputeMetadata(existingInsuranceEvent?.metadata);

    if (existingMetadata?.leadId) {
      const existingLead = await (prisma as any).insuranceReferralLead.findUnique({
        where: { id: existingMetadata.leadId },
      });

      if (existingLead) {
        return NextResponse.json({
          ok: true,
          alreadyExists: true,
          lead: existingLead,
          referralUrl: existingLead.referralUrl,
          message: 'Für diesen Streitfall existiert bereits ein Versicherungs-Lead.',
        });
      }
    }

    const [payment, transport] = await Promise.all([
      prisma.payment.findFirst({
        where: { jobId: dispute.jobId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transport.findUnique({
        where: { id: dispute.jobId },
        include: {
          pickupAddress: true,
          deliveryAddress: true,
          transportDetail: true,
        },
      }).catch(() => null),
    ]);

    const detailSnapshot = parseJson(transport?.transportDetail?.detailsJson);
    const cargoValueEur =
      toPositiveNumber(body.cargoValueEur) ||
      centsToEur(dispute.disputedAmountCents) ||
      centsToEur(payment?.amountCents) ||
      toPositiveNumber(transport?.agreedPrice) ||
      toPositiveNumber(transport?.shipperBudget) ||
      10_000;
    const cargoDescription =
      stringOrNull(body.cargoDescription) ||
      [dispute.reason, dispute.subject, dispute.description].filter(Boolean).join(' - ') ||
      detailSnapshot?.description ||
      transport?.description ||
      'Schadenmeldung aus CargoBit Streitfall';
    const weightKg =
      toPositiveNumber(body.weightKg) ||
      toPositiveNumber(transport?.transportDetail?.weightKg) ||
      toPositiveNumber(detailSnapshot?.weightKg);

    const referral = await createInsuranceReferralQuote({
      transportId: dispute.jobId,
      requestedByUserId: dispute.createdById,
      requestedByRole: 'ADMIN',
      source: 'ADMIN',
      cargoDescription,
      cargoValueEur,
      weightKg,
      pickupCity: stringOrNull(body.pickupCity) || transport?.pickupAddress?.city || null,
      pickupCountry: stringOrNull(body.pickupCountry) || transport?.pickupAddress?.country || null,
      deliveryCity: stringOrNull(body.deliveryCity) || transport?.deliveryAddress?.city || null,
      deliveryCountry: stringOrNull(body.deliveryCountry) || transport?.deliveryAddress?.country || null,
      consentAccepted: Boolean(body.consentAccepted),
      persistLead: true,
      markRedirected: body.markRedirected !== false,
    });

    const auditMetadata = {
      leadId: referral.leadId,
      provider: referral.provider,
      product: referral.product,
      referralUrl: referral.referralUrl,
      premiumEstimateEur: referral.premiumEstimateEur,
      coverageEstimateEur: referral.coverageEstimateEur,
      commissionEstimateEur: referral.commission.estimateEur,
      cargoValueEur,
      consentAccepted: Boolean(body.consentAccepted),
      note: stringOrNull(body.note) || 'Versicherungs-Partner-Lead durch Admin aus Streitfall vorbereitet.',
      complianceNotice: referral.complianceNotice,
    };

    await prisma.disputeAuditEvent.create({
      data: {
        disputeId,
        eventType: 'insurance_handoff_created',
        oldStatus: dispute.status,
        newStatus: dispute.status,
        adminId: admin.id,
        metadata: JSON.stringify(auditMetadata),
      },
    });

    const supportTicket = await prisma.supportTicket.findFirst({
      where: {
        userId: dispute.createdById,
        transportId: dispute.jobId,
        category: 'DISPUTE_EVIDENCE',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (supportTicket) {
      await prisma.supportMessage.create({
        data: {
          ticketId: supportTicket.id,
          senderId: admin.id,
          senderRole: 'ADMIN',
          message: `Versicherungs-Lead vorbereitet: ${referral.provider}, Lead ${referral.leadId}. Abschluss und Schadenbearbeitung erfolgen extern beim lizenzierten Partner.`,
          isInternal: true,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      mode: 'partner_lead',
      referral,
      referralUrl: referral.referralUrl,
      audit: auditMetadata,
    }, { status: 201 });
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}

async function readBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function centsToEur(value?: number | null) {
  if (!value || value <= 0) return null;
  return Math.round(value) / 100;
}

function toPositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseJson(value?: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
