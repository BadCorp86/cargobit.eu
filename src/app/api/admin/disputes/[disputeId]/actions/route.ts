import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';
import { buildEvidenceWorkflowSummary } from '@/lib/disputes/evidence-workflow';

export const dynamic = 'force-dynamic';

type DisputeAdminAction =
  | 'MARK_EVIDENCE_REVIEWED'
  | 'EXTEND_EVIDENCE_DEADLINE'
  | 'CLOSE_SUPPORT_TICKET'
  | 'BLOCK_AUTO_RESOLUTION'
  | 'APPROVE_AUTO_RESOLUTION';

interface DisputeActionBody {
  action?: DisputeAdminAction;
  dueAt?: string;
  note?: string;
  ticketId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> | { disputeId: string } }
) {
  return withAdminAuth(request, async (admin) => {
    const { disputeId } = await params;
    const body = await readBody(request);
    const action = body.action;
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    if (action === 'APPROVE_AUTO_RESOLUTION' && admin.role !== AdminRole.ADMIN) {
      return NextResponse.json({ error: 'Only admins can approve automatic resolution' }, { status: 403 });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        auditEvents: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    const supportTicket = await findSupportTicket(dispute.createdById, dispute.jobId, body.ticketId);
    const result = await prisma.$transaction(async (tx) => {
      if (action === 'MARK_EVIDENCE_REVIEWED') {
        const oldStatus = dispute.status;
        const newStatus = isTerminalDisputeStatus(dispute.status) ? dispute.status : 'IN_REVIEW';

        if (newStatus !== oldStatus) {
          await tx.dispute.update({
            where: { id: disputeId },
            data: { status: newStatus },
          });
        }

        if (supportTicket && supportTicket.status === 'OPEN') {
          await tx.supportTicket.update({
            where: { id: supportTicket.id },
            data: { status: 'IN_PROGRESS' },
          });
        }

        await tx.disputeAuditEvent.create({
          data: {
            disputeId,
            eventType: 'evidence_reviewed',
            oldStatus,
            newStatus,
            adminId: admin.id,
            metadata: JSON.stringify({ note: note || 'Nachweise wurden durch Admin/Support geprüft.' }),
          },
        });

        return { status: newStatus, supportTicketId: supportTicket?.id || null };
      }

      if (action === 'EXTEND_EVIDENCE_DEADLINE') {
        const dueAt = parseFutureDate(body.dueAt);
        if (!dueAt) {
          return { error: 'A future dueAt date is required', statusCode: 400 };
        }

        const evidenceRequest = buildEvidenceWorkflowSummary(dispute.auditEvents);
        if (!evidenceRequest) {
          return { error: 'Evidence request does not exist yet', statusCode: 400 };
        }

        await tx.disputeAuditEvent.create({
          data: {
            disputeId,
            eventType: 'evidence_deadline_extended',
            oldStatus: dispute.status,
            newStatus: dispute.status,
            adminId: admin.id,
            metadata: JSON.stringify({
              previousDueAt: evidenceRequest.dueAt.toISOString(),
              dueAt: dueAt.toISOString(),
              note: note || 'Nachweisfrist wurde verlängert.',
            }),
          },
        });

        if (supportTicket) {
          await tx.supportMessage.create({
            data: {
              ticketId: supportTicket.id,
              senderId: admin.id,
              senderRole: 'ADMIN',
              message: `Nachweisfrist verlaengert bis ${dueAt.toLocaleString('de-DE')}.${note ? ` Grund: ${note}` : ''}`,
              isInternal: true,
            },
          });
        }

        return { status: dispute.status, dueAt: dueAt.toISOString(), supportTicketId: supportTicket?.id || null };
      }

      if (action === 'CLOSE_SUPPORT_TICKET') {
        if (!supportTicket) {
          return { error: 'Support ticket not found', statusCode: 404 };
        }

        await tx.supportTicket.update({
          where: { id: supportTicket.id },
          data: {
            status: 'CLOSED',
            resolvedAt: new Date(),
            closedAt: new Date(),
          },
        });

        await tx.supportMessage.create({
          data: {
            ticketId: supportTicket.id,
            senderId: admin.id,
            senderRole: 'ADMIN',
            message: note || 'Ticket wurde nach Admin-Prüfung geschlossen.',
            isInternal: true,
          },
        });

        await tx.disputeAuditEvent.create({
          data: {
            disputeId,
            eventType: 'support_ticket_closed',
            oldStatus: dispute.status,
            newStatus: dispute.status,
            adminId: admin.id,
            metadata: JSON.stringify({ supportTicketId: supportTicket.id, note }),
          },
        });

        return { status: dispute.status, supportTicketId: supportTicket.id };
      }

      if (action === 'BLOCK_AUTO_RESOLUTION' || action === 'APPROVE_AUTO_RESOLUTION') {
        const eventType = action === 'BLOCK_AUTO_RESOLUTION'
          ? 'auto_resolution_blocked'
          : 'auto_resolution_approved';

        await tx.disputeAuditEvent.create({
          data: {
            disputeId,
            eventType,
            oldStatus: dispute.status,
            newStatus: dispute.status,
            adminId: admin.id,
            metadata: JSON.stringify({
              note: note || (action === 'BLOCK_AUTO_RESOLUTION'
                ? 'Automatische Entscheidung wurde für diesen Fall gesperrt.'
                : 'Automatische Entscheidung wurde durch Admin freigegeben.'),
            }),
          },
        });

        return { status: dispute.status, autoResolution: action === 'BLOCK_AUTO_RESOLUTION' ? 'blocked' : 'approved' };
      }

      return { error: 'Unsupported action', statusCode: 400 };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }

    return NextResponse.json({
      ok: true,
      action,
      disputeId,
      ...result,
    });
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}

async function readBody(request: NextRequest): Promise<DisputeActionBody> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function findSupportTicket(userId: string, transportId: string, ticketId?: string) {
  if (ticketId) {
    return prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId,
        transportId,
        category: 'DISPUTE_EVIDENCE',
      },
    });
  }

  return prisma.supportTicket.findFirst({
    where: {
      userId,
      transportId,
      category: 'DISPUTE_EVIDENCE',
    },
    orderBy: { createdAt: 'desc' },
  });
}

function parseFutureDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);

  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    return null;
  }

  return date;
}

function isTerminalDisputeStatus(status: string) {
  return ['RESOLVED', 'CLOSED', 'REJECTED', 'REFUNDED'].includes(status);
}
