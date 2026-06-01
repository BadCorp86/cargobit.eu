import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
const ALLOWED_PRIORITIES = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

function formatFeedbackTicket(ticket: any) {
  const firstPublicMessage = ticket.messages?.find((message: any) => !message.isInternal) || ticket.messages?.[0] || null;

  return {
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    priority: ticket.priority,
    status: ticket.status,
    category: ticket.category,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
    closedAt: ticket.closedAt,
    user: ticket.user
      ? {
          id: ticket.user.id,
          email: ticket.user.email,
          name: [ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(' ') || ticket.user.email,
        }
      : null,
    message: firstPublicMessage
      ? {
          id: firstPublicMessage.id,
          message: firstPublicMessage.message,
          senderRole: firstPublicMessage.senderRole,
          createdAt: firstPublicMessage.createdAt,
        }
      : null,
    messages: (ticket.messages || []).map((message: any) => ({
      id: message.id,
      message: message.message,
      senderRole: message.senderRole,
      isInternal: message.isInternal,
      createdAt: message.createdAt,
    })),
  };
}

function normalizeStatus(value: unknown) {
  const status = String(value || '').toUpperCase();
  return ALLOWED_STATUSES.has(status) ? status : null;
}

function normalizePriority(value: unknown) {
  const priority = String(value || '').toUpperCase();
  return ALLOWED_PRIORITIES.has(priority) ? priority : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  return withAdminAuth(request, async (admin) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const nextStatus = body.status ? normalizeStatus(body.status) : null;
    const nextPriority = body.priority ? normalizePriority(body.priority) : null;
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';

    if (body.status && !nextStatus) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    if (body.priority && !nextPriority) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }

    if (!nextStatus && !nextPriority && !note) {
      return NextResponse.json({ error: 'status, priority or note is required' }, { status: 400 });
    }

    const existing = await prisma.supportTicket.findFirst({
      where: {
        id,
        category: 'PRODUCT_FEEDBACK',
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Feedback ticket not found' }, { status: 404 });
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const data: any = {};
      const changes: string[] = [];

      if (nextStatus && nextStatus !== existing.status) {
        data.status = nextStatus;
        changes.push(`Status: ${existing.status} -> ${nextStatus}`);

        if (nextStatus === 'RESOLVED') {
          data.resolvedAt = now;
          data.closedAt = existing.closedAt;
        }

        if (nextStatus === 'CLOSED') {
          data.closedAt = now;
          data.resolvedAt = existing.resolvedAt || now;
        }

        if (nextStatus === 'OPEN' || nextStatus === 'IN_PROGRESS') {
          data.resolvedAt = null;
          data.closedAt = null;
        }
      }

      if (nextPriority && nextPriority !== existing.priority) {
        data.priority = nextPriority;
        changes.push(`Priorität: ${existing.priority} -> ${nextPriority}`);
      }

      if (!changes.length && note) {
        data.updatedAt = now;
      }

      const ticket = await tx.supportTicket.update({
        where: { id },
        data,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 8,
          },
        },
      });

      if (changes.length || note) {
        await tx.supportMessage.create({
          data: {
            ticketId: id,
            senderId: admin.id,
            senderRole: 'ADMIN',
            message: [
              'Produkt-Feedback aktualisiert.',
              changes.length ? changes.join('\n') : null,
              note ? `Notiz: ${note}` : null,
            ].filter(Boolean).join('\n'),
            isInternal: true,
          },
        });
      }

      return tx.supportTicket.findUniqueOrThrow({
        where: { id: ticket.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 12,
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      ticket: formatFeedbackTicket(updated),
    });
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}
