/**
 * CargoBit Admin Platform User Detail API
 *
 * PATCH /api/admin/users/{userId} - Update platform user status
 *
 * RBAC: ADMIN role only
 */

import { NextRequest, NextResponse } from 'next/server';
import { SecurityFlagSeverity, SecurityFlagType, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';

function parseUserStatus(value?: string) {
  if (!value) return null;
  const normalized = value.toUpperCase();
  if (normalized === 'ACTIVE') return UserStatus.ACTIVE;
  if (normalized === 'PENDING') return UserStatus.PENDING;
  if (normalized === 'BLOCKED') return UserStatus.BLOCKED;
  if (normalized === 'SUSPENDED') return UserStatus.SUSPENDED;
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withAdminAuth(request, async (admin) => {
    const { userId } = await params;

    let body: {
      status?: string;
      reason?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const status = parseUserStatus(body.status);

    if (!status) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: ACTIVE, PENDING, BLOCKED, or SUSPENDED' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { status },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          updatedAt: true,
        },
      });

      if (status === UserStatus.BLOCKED || status === UserStatus.SUSPENDED) {
        await tx.securityFlag.create({
          data: {
            userId,
            type: SecurityFlagType.SUSPICIOUS_ACTIVITY,
            severity: status === UserStatus.BLOCKED ? SecurityFlagSeverity.HIGH : SecurityFlagSeverity.MEDIUM,
            active: true,
            notes: body.reason || `Admin ${admin.email} changed user status from ${existing.status} to ${status}`,
          },
        });
      }

      if (status === UserStatus.ACTIVE) {
        await tx.securityFlag.updateMany({
          where: {
            userId,
            active: true,
            type: SecurityFlagType.SUSPICIOUS_ACTIVITY,
          },
          data: {
            active: false,
            resolvedAt: new Date(),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'STATUS_CHANGE',
          entityType: 'user',
          entityId: userId,
          dataBefore: JSON.stringify({ status: existing.status }),
          dataAfter: JSON.stringify({
            status,
            reason: body.reason || null,
            adminId: admin.id,
            adminEmail: admin.email,
          }),
        },
      });

      return user;
    });

    return NextResponse.json({
      status: 'updated',
      user: updated,
    });
  }, [AdminRole.ADMIN]);
}
