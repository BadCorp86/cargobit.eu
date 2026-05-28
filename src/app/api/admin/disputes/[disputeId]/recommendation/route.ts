import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';
import {
  createDisputeDecisionRecommendation,
  type DisputeDecisionInput,
} from '@/lib/disputes/dispute-decision-engine';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> | { disputeId: string } }
) {
  return withAdminAuth(request, async (admin) => {
    const { disputeId } = await params;

    try {
      const input = await loadDisputeDecisionInput(disputeId);
      const recommendation = createDisputeDecisionRecommendation(input);

      await recordRecommendationAudit(disputeId, admin.id, recommendation);

      return NextResponse.json({
        disputeId,
        source: 'live',
        recommendation,
      });
    } catch (error) {
      const fallback = createFallbackDecisionInput(disputeId);
      const recommendation = createDisputeDecisionRecommendation(fallback);

      return NextResponse.json({
        disputeId,
        source: 'fallback',
        warning: getSafeFallbackWarning(error),
        recommendation,
      });
    }
  }, [AdminRole.ADMIN, AdminRole.SUPPORT, AdminRole.FINANCE]);
}

function getSafeFallbackWarning(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('URL must start with the protocol') || message.includes('datasource')) {
    return 'Live dispute data is unavailable because the local database connection is not configured for PostgreSQL.';
  }

  if (message.includes('does not exist') || message.includes('not found')) {
    return 'Live dispute data is unavailable for this dispute id.';
  }

  return 'Live dispute data is unavailable. Using a safe preview recommendation.';
}

async function loadDisputeDecisionInput(disputeId: string): Promise<DisputeDecisionInput> {
  const db = prisma as any;

  if (!db.dispute?.findUnique) {
    throw new Error('Dispute model is not available in the current Prisma client');
  }

  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      attachments: true,
    },
  });

  if (!dispute) {
    throw new Error('Dispute not found');
  }

  const payment = db.payment?.findFirst
    ? await db.payment.findFirst({
        where: { jobId: dispute.jobId, status: 'SUCCEEDED' },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  let alreadyRefundedCents = 0;
  if (payment?.id && db.refund?.aggregate) {
    const refunds = await db.refund.aggregate({
      where: { paymentId: payment.id, status: { in: ['SUCCEEDED', 'PROCESSED'] } },
      _sum: { amountCents: true },
    });
    alreadyRefundedCents = refunds?._sum?.amountCents || 0;
  }

  const paymentAmountCents = payment?.amountCents || dispute.disputedAmountCents || dispute.refundAmountCents || 0;
  const refundableAmountCents = Math.max(0, paymentAmountCents - alreadyRefundedCents);

  return {
    id: dispute.id,
    jobId: dispute.jobId,
    status: dispute.status,
    reason: dispute.reason,
    subject: dispute.subject,
    description: dispute.description,
    disputedAmountCents: dispute.disputedAmountCents,
    paymentAmountCents,
    refundableAmountCents,
    currency: payment?.currency || dispute.currency || 'EUR',
    createdAt: dispute.createdAt,
    messages: (dispute.messages || []).map((message: any) => ({
      message: message.message,
      senderType: message.senderType,
      createdAt: message.createdAt,
    })),
    attachments: (dispute.attachments || []).map((attachment: any) => ({
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      createdAt: attachment.createdAt,
    })),
  };
}

async function recordRecommendationAudit(
  disputeId: string,
  adminId: string,
  recommendation: ReturnType<typeof createDisputeDecisionRecommendation>
) {
  const db = prisma as any;

  if (!db.disputeAuditEvent?.create) {
    return;
  }

  try {
    await db.disputeAuditEvent.create({
      data: {
        disputeId,
        eventType: 'recommendation_generated',
        adminId,
        metadata: JSON.stringify({
          action: recommendation.action,
          confidence: recommendation.confidence,
          riskLevel: recommendation.riskLevel,
          priority: recommendation.priority,
          suggestedRefundAmountCents: recommendation.suggestedRefundAmountCents,
        }),
      },
    });
  } catch (error) {
    console.warn('[DisputeRecommendation] Audit event skipped:', error);
  }
}

function createFallbackDecisionInput(disputeId: string): DisputeDecisionInput {
  return {
    id: disputeId,
    jobId: 'job_preview',
    reason: 'Waren beschaedigt angekommen',
    description:
      'Die Ware wurde in beschaedigtem Zustand geliefert. Fotos und Lieferschein sollen vom Support geprueft werden.',
    disputedAmountCents: 25_000,
    paymentAmountCents: 25_000,
    refundableAmountCents: 25_000,
    currency: 'EUR',
    createdAt: new Date().toISOString(),
    messages: [
      {
        senderType: 'USER',
        message: 'Ich moechte eine Erstattung, da die Ware beschaedigt ist. Fotos liegen vor.',
        createdAt: new Date().toISOString(),
      },
      {
        senderType: 'USER',
        message: 'Die Ware wurde beim Laden kontrolliert. Bitte POD/CMR pruefen.',
        createdAt: new Date().toISOString(),
      },
    ],
    attachments: [{ fileName: 'damage-photo.jpg', fileType: 'image/jpeg' }],
  };
}
