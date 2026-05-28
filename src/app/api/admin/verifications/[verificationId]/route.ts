/**
 * CargoBit Admin Verification Review Action
 *
 * PATCH /api/admin/verifications/:verificationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';

type ReviewAction = 'approve' | 'reject' | 'manual_review';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { verificationId: string } },
) {
  return withAdminAuth(request, async (admin) => {
    let body: { action?: ReviewAction; reason?: string };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'INVALID_JSON', message: 'Invalid request body' },
        { status: 400 },
      );
    }

    const action = body.action;
    const reason = body.reason?.trim();

    if (!action || !['approve', 'reject', 'manual_review'].includes(action)) {
      return NextResponse.json(
        { error: 'INVALID_ACTION', message: 'action must be approve, reject, or manual_review' },
        { status: 400 },
      );
    }

    if ((action === 'reject' || action === 'manual_review') && !reason) {
      return NextResponse.json(
        { error: 'REASON_REQUIRED', message: 'reason is required for reject/manual_review' },
        { status: 400 },
      );
    }

    try {
      const current = await prisma.verification.findUnique({
        where: { id: params.verificationId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!current) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Verification not found' },
          { status: 404 },
        );
      }

      const nextStatus = action === 'approve'
        ? 'APPROVED'
        : action === 'reject'
          ? 'REJECTED'
          : 'PENDING';

      const updated = await prisma.verification.update({
        where: { id: params.verificationId },
        data: {
          status: nextStatus,
          rejectionReason: action === 'approve' ? null : reason,
          reviewedAt: action === 'manual_review' ? null : new Date(),
          reviewedBy: admin.id,
        },
      });

      const openTicket = await prisma.supportTicket.findFirst({
        where: {
          userId: current.userId,
          category: 'VERIFICATION',
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (openTicket) {
        await prisma.supportMessage.create({
          data: {
            ticketId: openTicket.id,
            senderId: admin.id,
            senderRole: admin.role,
            isInternal: true,
            message: buildReviewMessage(action, reason),
          },
        });

        if (action === 'approve' || action === 'reject') {
          await prisma.supportTicket.update({
            where: { id: openTicket.id },
            data: {
              status: action === 'approve' ? 'RESOLVED' : 'IN_PROGRESS',
              resolvedAt: action === 'approve' ? new Date() : undefined,
            },
          });
        }
      }

      await prisma.notification.create({
        data: {
          userId: current.userId,
          type: action === 'approve'
            ? 'VERIFICATION_APPROVED'
            : action === 'reject'
              ? 'VERIFICATION_REJECTED'
              : 'VERIFICATION_MANUAL_REVIEW',
          title: action === 'approve'
            ? 'Verifizierung freigegeben'
            : action === 'reject'
              ? 'Verifizierung abgelehnt'
              : 'Verifizierung wird weiter geprüft',
          message: action === 'approve'
            ? 'Ihre Verifizierung wurde durch CargoBit freigegeben.'
            : reason || 'Ihre Verifizierung wird weiter durch unser Team geprüft.',
          data: JSON.stringify({
            verificationId: current.id,
            action,
            reviewedBy: admin.id,
          }),
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: current.userId,
          action: 'STATUS_CHANGE',
          entityType: 'verification',
          entityId: current.id,
          dataBefore: JSON.stringify({
            status: current.status,
            rejectionReason: current.rejectionReason,
          }),
          dataAfter: JSON.stringify({
            status: updated.status,
            rejectionReason: updated.rejectionReason,
            reviewedBy: admin.id,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        verification: updated,
      });
    } catch (error) {
      console.error('[AdminVerifications] Review failed:', error);
      return NextResponse.json(
        {
          error: 'VERIFICATION_REVIEW_FAILED',
          message: error instanceof Error ? error.message : 'Verification review failed',
        },
        { status: 500 },
      );
    }
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}

function buildReviewMessage(action: ReviewAction, reason?: string) {
  switch (action) {
    case 'approve':
      return 'Verifizierung wurde manuell freigegeben.';
    case 'reject':
      return `Verifizierung wurde abgelehnt.${reason ? ` Grund: ${reason}` : ''}`;
    case 'manual_review':
    default:
      return `Verifizierung bleibt in manueller Prüfung.${reason ? ` Hinweis: ${reason}` : ''}`;
  }
}
