import { NextRequest, NextResponse } from 'next/server';
import { DisputeStatus, PayoutStatus, TicketStatus, TransportStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';

export const dynamic = 'force-dynamic';

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function centsToCurrency(cents?: number | null) {
  return (cents || 0) / 100;
}

function sumBy<T>(items: T[], value: (item: T) => number | null | undefined) {
  return items.reduce((sum, item) => sum + (value(item) || 0), 0);
}

function statusCount<T extends string>(items: Array<{ status: T; _count: { id: number } }>, status: T) {
  return items.find((item) => item.status === status)?._count.id || 0;
}

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultFrom = startOfMonth(addMonths(now, -5));
    const from = parseDate(searchParams.get('from'), defaultFrom);
    const to = parseDate(searchParams.get('to'), now);

    const [transports, transportStatus, commissions, walletTransactions, invoices, payouts, payoutStatus, disputes, supportTickets, monthlyCommissions] = await Promise.all([
      prisma.transport.findMany({
        where: {
          createdAt: { gte: from, lte: to },
        },
        select: {
          id: true,
          status: true,
          agreedPrice: true,
          shipperBudget: true,
          currency: true,
          createdAt: true,
          completedAt: true,
          cancelledAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.transport.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { createdAt: { gte: from, lte: to } },
      }),
      prisma.commission.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          plan: true,
          commissionAmount: true,
          walletFeeAmount: true,
          createdAt: true,
        },
      }),
      prisma.walletTransaction.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          type: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
      }),
      prisma.subscriptionInvoice.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          status: true,
          subtotal: true,
          tax: true,
          total: true,
          amountPaid: true,
          amountDue: true,
          currency: true,
          createdAt: true,
        },
      }),
      prisma.payout.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          status: true,
          amountCents: true,
          currency: true,
          riskLevel: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.payout.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { amountCents: true },
        where: { createdAt: { gte: from, lte: to } },
      }),
      prisma.dispute.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: {
          disputedAmountCents: true,
          refundAmountCents: true,
        },
        where: { createdAt: { gte: from, lte: to } },
      }),
      prisma.supportTicket.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { createdAt: { gte: from, lte: to } },
      }),
      prisma.commission.findMany({
        where: { createdAt: { gte: defaultFrom, lte: now } },
        select: {
          commissionAmount: true,
          walletFeeAmount: true,
          createdAt: true,
        },
      }),
    ]);

    const grossTransportVolume = sumBy(transports, (transport) => transport.agreedPrice || transport.shipperBudget || 0);
    const commissionRevenue = sumBy(commissions, (commission) => commission.commissionAmount);
    const walletFeeRevenue = sumBy(commissions, (commission) => commission.walletFeeAmount);
    const subscriptionRevenue = sumBy(invoices, (invoice) => invoice.amountPaid || invoice.total);
    const walletInflow = sumBy(
      walletTransactions.filter((transaction) => ['PAYMENT_IN', 'RESERVE_RELEASE'].includes(transaction.type)),
      (transaction) => Math.max(transaction.amount, 0)
    );
    const walletOutflow = Math.abs(sumBy(
      walletTransactions.filter((transaction) => ['PAYMENT_OUT', 'PAYOUT', 'REFUND'].includes(transaction.type)),
      (transaction) => Math.min(transaction.amount, 0)
    ));

    const monthly = Array.from({ length: 6 }, (_, index) => {
      const monthStart = addMonths(defaultFrom, index);
      const nextMonth = addMonths(monthStart, 1);
      const rows = monthlyCommissions.filter((commission) => (
        commission.createdAt >= monthStart && commission.createdAt < nextMonth
      ));

      return {
        month: monthStart.toISOString().slice(0, 7),
        commissionRevenue: sumBy(rows, (row) => row.commissionAmount),
        walletFeeRevenue: sumBy(rows, (row) => row.walletFeeAmount),
        totalRevenue: sumBy(rows, (row) => row.commissionAmount + row.walletFeeAmount),
      };
    });

    const openDisputes = disputes
      .filter((row) => ['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'AWAITING_INFO'].includes(row.status))
      .reduce((sum, row) => sum + row._count.id, 0);
    const disputedAmount = sumBy(disputes, (row) => centsToCurrency(row._sum.disputedAmountCents));
    const refundedAmount = sumBy(disputes, (row) => centsToCurrency(row._sum.refundAmountCents));
    const pendingPayoutAmount = sumBy(
      payoutStatus.filter((row) => ['PENDING', 'PROCESSING'].includes(row.status)),
      (row) => centsToCurrency(row._sum.amountCents)
    );

    return NextResponse.json({
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      finance: {
        grossTransportVolume,
        commissionRevenue,
        walletFeeRevenue,
        subscriptionRevenue,
        totalNetRevenue: commissionRevenue + walletFeeRevenue + subscriptionRevenue,
        walletInflow,
        walletOutflow,
        pendingPayoutAmount,
      },
      operations: {
        totalTransports: transports.length,
        published: statusCount(transportStatus, TransportStatus.PUBLISHED),
        active: transportStatus
          .filter((row) => ['ASSIGNED', 'IN_TRANSIT', 'PICKUP_DONE', 'DELIVERY_DONE'].includes(row.status))
          .reduce((sum, row) => sum + row._count.id, 0),
        completed: statusCount(transportStatus, TransportStatus.COMPLETED),
        cancelled: statusCount(transportStatus, TransportStatus.CANCELLED),
        completionRate: transports.length
          ? Math.round((statusCount(transportStatus, TransportStatus.COMPLETED) / transports.length) * 1000) / 10
          : 0,
      },
      risk: {
        openDisputes,
        disputedAmount,
        refundedAmount,
        openTickets: statusCount(supportTickets, TicketStatus.OPEN),
        inProgressTickets: statusCount(supportTickets, TicketStatus.IN_PROGRESS),
        payoutFailed: statusCount(payoutStatus, PayoutStatus.FAILED),
      },
      statuses: {
        transports: transportStatus.map((row) => ({ status: row.status, count: row._count.id })),
        payouts: payoutStatus.map((row) => ({
          status: row.status,
          count: row._count.id,
          amount: centsToCurrency(row._sum.amountCents),
        })),
        disputes: disputes.map((row) => ({
          status: row.status,
          count: row._count.id,
          disputedAmount: centsToCurrency(row._sum.disputedAmountCents),
          refundedAmount: centsToCurrency(row._sum.refundAmountCents),
        })),
      },
      monthly,
      recent: {
        transports: transports.map((transport) => ({
          id: transport.id,
          status: transport.status,
          amount: transport.agreedPrice || transport.shipperBudget || 0,
          currency: transport.currency,
          createdAt: transport.createdAt,
        })),
        payouts: payouts.map((payout) => ({
          id: payout.id,
          status: payout.status,
          amount: centsToCurrency(payout.amountCents),
          currency: payout.currency,
          riskLevel: payout.riskLevel,
          createdAt: payout.createdAt,
        })),
      },
    });
  }, [AdminRole.ADMIN, AdminRole.FINANCE]);
}
