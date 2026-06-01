import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';

export const dynamic = 'force-dynamic';

const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS'] as const;

function parseLimit(value: string | null) {
  const limit = Number(value || 50);
  return Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
}

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

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search')?.trim();
    const limit = parseLimit(searchParams.get('limit'));
    const offset = Number(searchParams.get('offset') || 0);

    const where: any = {
      category: 'PRODUCT_FEEDBACK',
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    if (priority) {
      where.priority = priority.toUpperCase();
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [tickets, total, openCount, inProgressCount, resolvedCount, highPriorityCount] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
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
        orderBy: [
          { status: 'asc' },
          { updatedAt: 'desc' },
        ],
        take: limit,
        skip: Number.isFinite(offset) && offset > 0 ? offset : 0,
      }),
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.count({ where: { category: 'PRODUCT_FEEDBACK', status: 'OPEN' } }),
      prisma.supportTicket.count({ where: { category: 'PRODUCT_FEEDBACK', status: 'IN_PROGRESS' } }),
      prisma.supportTicket.count({ where: { category: 'PRODUCT_FEEDBACK', status: { in: ['RESOLVED', 'CLOSED'] as any } } }),
      prisma.supportTicket.count({
        where: {
          category: 'PRODUCT_FEEDBACK',
          status: { in: OPEN_STATUSES as any },
          priority: { in: ['HIGH', 'URGENT', 'CRITICAL'] },
        },
      }),
    ]);

    return NextResponse.json({
      items: tickets.map(formatFeedbackTicket),
      summary: {
        total,
        open: openCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        highPriority: highPriorityCount,
      },
      total,
      limit,
      offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    });
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}
