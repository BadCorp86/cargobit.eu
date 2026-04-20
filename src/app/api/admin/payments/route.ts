/**
 * CargoBit Admin Payments API
 * 
 * GET /api/admin/payments - List all payments with filters
 * 
 * RBAC: Requires admin or finance role
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, checkPermission, AdminRole } from '@/lib/admin-rbac';

// ============================================
// HELPER: CENTS TO EUROS
// ============================================

function centsToEuros(cents: number): number {
  return cents / 100;
}

// ============================================
// GET: LIST PAYMENTS
// ============================================

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (admin) => {
    // Check permission
    if (!checkPermission(admin, 'payments:read')) {
      return NextResponse.json(
        { error: 'Forbidden - No permission to view payments' },
        { status: 403 }
      );
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const shipperId = searchParams.get('shipperId');
    const jobId = searchParams.get('jobId');
    const paymentIntentId = searchParams.get('paymentIntentId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Build filter
    const where: any = {};
    
    if (status) {
      where.status = status.toUpperCase();
    }
    
    if (shipperId) {
      where.shipperId = shipperId;
    }
    
    if (jobId) {
      where.jobId = jobId;
    }
    
    if (paymentIntentId) {
      where.paymentIntentId = paymentIntentId;
    }
    
    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(from);
      }
      if (to) {
        where.createdAt.lte = new Date(to);
      }
    }
    
    // Query payments
    const payments = await prisma.payment.findMany({
      where,
      include: {
        job: {
          select: {
            id: true,
            shipperUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    
    // Get transporter names
    const transporterIds = [...new Set(payments.map(p => p.transporterId))];
    const transporters = await prisma.user.findMany({
      where: { id: { in: transporterIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const transporterMap = new Map(transporters.map(t => [t.id, t]));
    
    // Format response
    const items = payments.map(p => ({
      id: p.id,
      paymentIntentId: p.paymentIntentId,
      chargeId: p.chargeId,
      jobId: p.jobId,
      bidId: p.bidId,
      shipperId: p.shipperId,
      shipperName: `${p.job.shipperUser.firstName || ''} ${p.job.shipperUser.lastName || ''}`.trim() || 'N/A',
      shipperEmail: p.job.shipperUser.email,
      transporterId: p.transporterId,
      transporterName: transporterMap.get(p.transporterId)
        ? `${transporterMap.get(p.transporterId)!.firstName || ''} ${transporterMap.get(p.transporterId)!.lastName || ''}`.trim() || 'N/A'
        : 'N/A',
      amountCents: p.amountCents,
      amountEur: centsToEuros(p.amountCents),
      currency: p.currency,
      platformFeeCents: p.platformFeeCents,
      transporterAmountCents: p.transporterAmountCents,
      refundedCents: p.refundedCents,
      status: p.status,
      paymentType: p.paymentType,
      createdAt: p.createdAt,
      succeededAt: p.succeededAt,
    }));
    
    // Get total count
    const total = await prisma.payment.count({ where });
    
    return NextResponse.json({
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    });
  }, [AdminRole.ADMIN, AdminRole.FINANCE]); // Only admin and finance
}
