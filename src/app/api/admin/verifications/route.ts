/**
 * CargoBit Admin Verification Queue
 *
 * GET /api/admin/verifications
 *
 * Lists KYC/KYB/driver/vehicle verification records for Admin and Support review.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const query = searchParams.get('query')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '80', 10), 150);

    const where: any = {};

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    if (type && type !== 'all') {
      where.type = type.toUpperCase();
    }

    if (query) {
      where.user = {
        OR: [
          { email: { contains: query } },
          { firstName: { contains: query } },
          { lastName: { contains: query } },
        ],
      };
    }

    try {
      const [verifications, summary] = await Promise.all([
        prisma.verification.findMany({
          where,
          orderBy: [
            { status: 'desc' },
            { createdAt: 'desc' },
          ],
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true,
                roles: {
                  include: {
                    role: true,
                  },
                },
                companyUsers: {
                  take: 1,
                  include: {
                    company: true,
                  },
                },
              },
            },
          },
        }),
        prisma.verification.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
      ]);

      const tickets = await prisma.supportTicket.findMany({
        where: {
          userId: { in: [...new Set(verifications.map((item) => item.userId))] },
          category: 'VERIFICATION',
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      const latestTicketByUser = new Map<string, (typeof tickets)[number]>();
      for (const ticket of tickets) {
        if (!latestTicketByUser.has(ticket.userId)) {
          latestTicketByUser.set(ticket.userId, ticket);
        }
      }

      return NextResponse.json({
        items: verifications.map((verification) => {
          const ticket = latestTicketByUser.get(verification.userId);
          const company = verification.user.companyUsers[0]?.company;
          const role = verification.user.roles[0]?.role.name || 'SHIPPER_PRIVATE';

          return {
            id: verification.id,
            userId: verification.userId,
            userName: userName(verification.user),
            userEmail: verification.user.email,
            userStatus: verification.user.status,
            role,
            companyName: company?.name,
            companyCountry: company?.country,
            companyVatNumber: company?.vatNumber,
            type: verification.type,
            status: verification.status,
            documentType: verification.documentType,
            documentUrl: verification.documentUrl,
            reviewData: parseReviewData(verification.reviewData),
            reviewReason: verification.rejectionReason,
            reviewedAt: verification.reviewedAt,
            reviewedBy: verification.reviewedBy,
            createdAt: verification.createdAt,
            updatedAt: verification.updatedAt,
            supportTicket: ticket ? {
              id: ticket.id,
              subject: ticket.subject,
              priority: ticket.priority,
              status: ticket.status,
              description: ticket.description,
              lastMessage: ticket.messages[0]?.message,
            } : null,
          };
        }),
        summary: {
          total: summary.reduce((sum, item) => sum + item._count.id, 0),
          pending: summary.find((item) => item.status === 'PENDING')?._count.id || 0,
          approved: summary.find((item) => item.status === 'APPROVED')?._count.id || 0,
          rejected: summary.find((item) => item.status === 'REJECTED')?._count.id || 0,
        },
      });
    } catch (error) {
      console.error('[AdminVerifications] List failed:', error);
      return NextResponse.json(
        {
          error: 'VERIFICATION_QUEUE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to load verification queue',
        },
        { status: 500 },
      );
    }
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}

function userName(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
}

function parseReviewData(value: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
