/**
 * CargoBit Admin Payment Detail API
 * 
 * GET /api/admin/payments/{id} - Get payment details with refund history, wallet transactions, audit trail
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
// GET: PAYMENT DETAIL
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAdminAuth(request, async (admin) => {
    // Check permission
    if (!checkPermission(admin, 'payments:read')) {
      return NextResponse.json(
        { error: 'Forbidden - No permission to view payments' },
        { status: 403 }
      );
    }
    
    const paymentId = params.id;
    
    // Get payment with relations
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        job: {
          select: {
            id: true,
            status: true,
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
        refunds: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }
    
    // Get transporter
    const transporter = await prisma.user.findUnique({
      where: { id: payment.transporterId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    
    // Get wallet transactions for this payment
    const walletTransactions = await prisma.walletTransaction.findMany({
      where: {
        OR: [
          { reference: payment.id },
          { reference: payment.paymentIntentId },
          { reference: payment.chargeId || '' },
          { relatedTransportId: payment.jobId },
        ],
      },
      include: {
        wallet: {
          select: {
            ownerUserId: true,
            ownerCompanyId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Get audit trail
    const auditTrail = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'payment', entityId: payment.id },
          { entityType: 'refund', entityId: { in: payment.refunds.map(r => r.id) } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    
    // Format response
    const result = {
      // Basic info
      id: payment.id,
      paymentIntentId: payment.paymentIntentId,
      chargeId: payment.chargeId,
      jobId: payment.jobId,
      bidId: payment.bidId,
      currency: payment.currency,
      paymentType: payment.paymentType,
      status: payment.status,
      stripeCustomerId: payment.stripeCustomerId,
      
      // Amounts
      amountCents: payment.amountCents,
      amountEur: centsToEuros(payment.amountCents),
      platformFeeCents: payment.platformFeeCents,
      platformFeeEur: centsToEuros(payment.platformFeeCents),
      transporterAmountCents: payment.transporterAmountCents,
      transporterAmountEur: centsToEuros(payment.transporterAmountCents),
      refundedCents: payment.refundedCents,
      refundedEur: centsToEuros(payment.refundedCents),
      
      // People
      shipper: {
        id: payment.shipperId,
        name: `${payment.job.shipperUser.firstName || ''} ${payment.job.shipperUser.lastName || ''}`.trim() || 'N/A',
        email: payment.job.shipperUser.email,
      },
      transporter: transporter ? {
        id: transporter.id,
        name: `${transporter.firstName || ''} ${transporter.lastName || ''}`.trim() || 'N/A',
        email: transporter.email,
      } : null,
      
      // Job status
      jobStatus: payment.job.status,
      
      // Timestamps
      createdAt: payment.createdAt,
      succeededAt: payment.succeededAt,
      failedAt: payment.failedAt,
      failedReason: payment.failedReason,
      
      // Refunds
      refunds: payment.refunds.map(r => ({
        id: r.id,
        refundId: r.refundId,
        amountCents: r.amountCents,
        amountEur: centsToEuros(r.amountCents),
        shipperRefundCents: r.shipperRefundCents,
        shipperRefundEur: centsToEuros(r.shipperRefundCents),
        platformFeeRefundCents: r.platformFeeRefundCents,
        platformFeeRefundEur: centsToEuros(r.platformFeeRefundCents),
        transporterDebitCents: r.transporterDebitCents,
        transporterDebitEur: centsToEuros(r.transporterDebitCents),
        refundType: r.refundType,
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt,
        processedAt: r.processedAt,
      })),
      
      // Wallet transactions
      walletTransactions: walletTransactions.map(wt => {
        let ownerType: 'platform' | 'transporter' | 'shipper' | 'company' = 'shipper';
        if (wt.wallet.ownerUserId === 'PLATFORM') {
          ownerType = 'platform';
        } else if (wt.wallet.ownerUserId === payment.transporterId) {
          ownerType = 'transporter';
        } else if (wt.wallet.ownerUserId === payment.shipperId) {
          ownerType = 'shipper';
        } else if (wt.wallet.ownerCompanyId) {
          ownerType = 'company';
        }
        
        return {
          id: wt.id,
          walletOwnerType: ownerType,
          walletOwnerId: wt.wallet.ownerUserId || wt.wallet.ownerCompanyId,
          type: wt.type,
          amount: wt.amount,
          currency: wt.currency,
          description: wt.description,
          createdAt: wt.createdAt,
        };
      }),
      
      // Audit trail
      auditTrail: auditTrail.map(a => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        dataAfter: a.dataAfter ? JSON.parse(a.dataAfter) : null,
        createdAt: a.createdAt,
      })),
    };
    
    return NextResponse.json(result);
  }, [AdminRole.ADMIN, AdminRole.FINANCE]);
}
