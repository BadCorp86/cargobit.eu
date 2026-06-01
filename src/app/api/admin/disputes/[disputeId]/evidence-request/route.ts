import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';

export const dynamic = 'force-dynamic';

interface EvidenceRequestBody {
  message?: string;
  missingEvidence?: string[];
  createTicket?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> | { disputeId: string } }
) {
  return withAdminAuth(request, async (admin) => {
    const { disputeId } = await params;
    const body = await readBody(request);
    const missingEvidence = normalizeEvidence(body.missingEvidence);
    const message = body.message?.trim() || buildEvidenceRequestMessage(missingEvidence);
    const shouldCreateTicket = body.createTicket !== false;

    try {
      const result = await createEvidenceRequestWorkflow({
        disputeId,
        adminId: admin.id,
        adminEmail: admin.email,
        message,
        missingEvidence,
        shouldCreateTicket,
      });

      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({
        mode: 'preview',
        disputeId,
        message: 'Evidence request workflow simulated because live dispute data is unavailable.',
        safeWarning: getSafeEvidenceWarning(error),
        requestedEvidence: missingEvidence,
        supportTicket: shouldCreateTicket
          ? {
              id: `preview_ticket_${disputeId}`,
              status: 'OPEN',
              priority: missingEvidence.length > 0 ? 'HIGH' : 'NORMAL',
            }
          : null,
      });
    }
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}

async function readBody(request: NextRequest): Promise<EvidenceRequestBody> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function normalizeEvidence(items?: string[]) {
  const fallback = ['Fotos, POD/CMR, Lieferschein oder andere belastbare Nachweise fehlen.'];
  const values = Array.isArray(items)
    ? items.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return values.length > 0 ? [...new Set(values)] : fallback;
}

function buildEvidenceRequestMessage(missingEvidence: string[]) {
  return [
    'Bitte reichen Sie die fehlenden Nachweise für den Streitfall nach.',
    '',
    ...missingEvidence.map((item) => `- ${item}`),
    '',
    'Ohne belastbare Nachweise bleibt der Fall in manueller Prüfung und es wird keine automatische Auszahlung oder Erstattung ausgelöst.',
  ].join('\n');
}

async function createEvidenceRequestWorkflow(input: {
  disputeId: string;
  adminId: string;
  adminEmail: string;
  message: string;
  missingEvidence: string[];
  shouldCreateTicket: boolean;
}) {
  const db = prisma as any;

  if (!db.dispute?.findUnique) {
    throw new Error('Dispute model is not available');
  }

  const dispute = await db.dispute.findUnique({
    where: { id: input.disputeId },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 5 },
      attachments: true,
    },
  });

  if (!dispute) {
    throw new Error('Dispute not found');
  }

  const priority = resolveTicketPriority(dispute.disputedAmountCents || dispute.refundAmountCents || 0, input.missingEvidence.length);

  const result = await db.$transaction(async (tx: any) => {
    const disputeMessage = await tx.disputeMessage.create({
      data: {
        disputeId: input.disputeId,
        senderId: input.adminId,
        senderType: 'ADMIN',
        message: input.message,
        isInternal: false,
      },
    });

    if (['OPEN', 'IN_PROGRESS', 'IN_REVIEW'].includes(dispute.status)) {
      await tx.dispute.update({
        where: { id: input.disputeId },
        data: { status: 'AWAITING_INFO' },
      });
    }

    await tx.notification.create({
      data: {
        userId: dispute.createdById,
        type: 'DISPUTE_EVIDENCE_REQUEST',
        title: 'Nachweise zum Streitfall erforderlich',
        message: 'CargoBit Support hat weitere Nachweise für Ihren Streitfall angefordert.',
        data: JSON.stringify({
          disputeId: input.disputeId,
          jobId: dispute.jobId,
          missingEvidence: input.missingEvidence,
        }),
      },
    });

    let supportTicket = null;
    if (input.shouldCreateTicket) {
      supportTicket = await findOrCreateSupportTicket(tx, {
        disputeId: input.disputeId,
        jobId: dispute.jobId,
        createdById: dispute.createdById,
        adminId: input.adminId,
        priority,
        missingEvidence: input.missingEvidence,
      });
    }

    await tx.disputeAuditEvent.create({
      data: {
        disputeId: input.disputeId,
        eventType: 'evidence_requested',
        oldStatus: dispute.status,
        newStatus: ['OPEN', 'IN_PROGRESS', 'IN_REVIEW'].includes(dispute.status) ? 'AWAITING_INFO' : dispute.status,
        adminId: input.adminId,
        metadata: JSON.stringify({
          missingEvidence: input.missingEvidence,
          messageId: disputeMessage.id,
          supportTicketId: supportTicket?.id || null,
        }),
      },
    });

    if (tx.adminAuditLog?.create) {
      await tx.adminAuditLog.create({
        data: {
          adminId: input.adminId,
          action: 'dispute_evidence_requested',
          entityType: 'dispute',
          entityId: input.disputeId,
          dataAfter: JSON.stringify({
            missingEvidence: input.missingEvidence,
            supportTicketId: supportTicket?.id || null,
          }),
        },
      });
    }

    return { disputeMessage, supportTicket };
  });

  return {
    mode: 'live',
    disputeId: input.disputeId,
    status: 'AWAITING_INFO',
    requestedEvidence: input.missingEvidence,
    message: {
      id: result.disputeMessage.id,
      createdAt: result.disputeMessage.createdAt,
    },
    supportTicket: result.supportTicket
      ? {
          id: result.supportTicket.id,
          status: result.supportTicket.status,
          priority: result.supportTicket.priority,
        }
      : null,
  };
}

async function findOrCreateSupportTicket(
  tx: any,
  input: {
    disputeId: string;
    jobId: string;
    createdById: string;
    adminId: string;
    priority: string;
    missingEvidence: string[];
  }
) {
  const existing = await tx.supportTicket.findFirst({
    where: {
      userId: input.createdById,
      transportId: input.jobId,
      category: 'DISPUTE_EVIDENCE',
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    await tx.supportMessage.create({
      data: {
        ticketId: existing.id,
        senderId: input.adminId,
        senderRole: 'ADMIN',
        message: buildSupportTicketMessage(input),
        isInternal: true,
      },
    });

    return existing;
  }

  const ticket = await tx.supportTicket.create({
    data: {
      userId: input.createdById,
      transportId: input.jobId,
      subject: `Nachweise für Streitfall ${input.disputeId}`,
      description: buildSupportTicketMessage(input),
      priority: input.priority,
      status: 'OPEN',
      category: 'DISPUTE_EVIDENCE',
      assignedTo: input.adminId,
    },
  });

  await tx.supportMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: input.adminId,
      senderRole: 'ADMIN',
      message: buildSupportTicketMessage(input),
      isInternal: true,
    },
  });

  return ticket;
}

function buildSupportTicketMessage(input: { disputeId: string; jobId: string; missingEvidence: string[] }) {
  return [
    `Streitfall ${input.disputeId} für Auftrag ${input.jobId} benötigt weitere Nachweise.`,
    '',
    'Fehlend:',
    ...input.missingEvidence.map((item) => `- ${item}`),
    '',
    'Support soll den Nutzer kontaktieren, Frist setzen und den Fall anschließend erneut prüfen.',
  ].join('\n');
}

function resolveTicketPriority(amountCents: number, missingEvidenceCount: number) {
  if (amountCents >= 100_000) return 'URGENT';
  if (amountCents >= 25_000 || missingEvidenceCount >= 2) return 'HIGH';
  return 'NORMAL';
}

function getSafeEvidenceWarning(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('URL must start with the protocol') || message.includes('datasource')) {
    return 'Local database is not configured for PostgreSQL.';
  }

  if (message.includes('not found')) {
    return 'Dispute was not found in the live database.';
  }

  return 'Live evidence workflow is unavailable.';
}
