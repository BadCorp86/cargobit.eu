import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRequestUser } from '@/lib/request-user-auth';
import { getOrderPayoutReadiness } from '@/services/order-payout-release.service';

export const dynamic = 'force-dynamic';

const CARRIER_ROLES = new Set(['CARRIER', 'DISPATCHER', 'DRIVER_SELF_EMPLOYED', 'ADMIN', 'SUPPORT']);

function parseLimit(value: string | null) {
  const parsed = Number(value || 20);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 50) : 20;
}

function parseOffset(value: string | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function mapStatus(status: string) {
  const labels: Record<string, string> = {
    PUBLISHED: 'Angebot offen',
    ASSIGNED: 'Zugewiesen',
    IN_TRANSIT: 'Unterwegs',
    PICKUP_DONE: 'Abgeholt',
    DELIVERY_DONE: 'Geliefert',
    COMPLETED: 'Abgeschlossen',
    CANCELLED: 'Storniert',
  };
  return labels[status] || status;
}

function mapOfferStatus(status?: string | null) {
  const labels: Record<string, string> = {
    PENDING: 'Angebot offen',
    ACCEPTED: 'Angenommen',
    REJECTED: 'Abgelehnt',
    WITHDRAWN: 'Zurückgezogen',
  };
  return status ? labels[status] || status : null;
}

function mapPayoutStatus(status?: string | null) {
  const labels: Record<string, string> = {
    released: 'Ins Wallet freigegeben',
    ready: 'Freigabe bereit',
    blocked: 'Noch gesperrt',
  };
  return status ? labels[status] || status : null;
}

function formatJob(transport: any, driverId: string, payoutInfo?: any) {
  const ownOffer = transport.offers?.find((offer: any) => offer.driverId === driverId) || null;
  const isAssignedToMe = transport.assignment?.driverId === driverId;
  const currency = transport.currency || ownOffer?.currency || 'EUR';

  return {
    id: transport.id,
    status: transport.status,
    statusLabel: mapStatus(transport.status),
    relation: isAssignedToMe ? 'assigned' : ownOffer ? 'bid' : 'visible',
    route: {
      from: transport.pickupAddress?.city || '-',
      to: transport.deliveryAddress?.city || '-',
      pickupCountry: transport.pickupAddress?.country || '-',
      deliveryCountry: transport.deliveryAddress?.country || '-',
    },
    schedule: {
      pickupDatetime: transport.pickupDatetime,
      deliveryDatetime: transport.deliveryDatetime,
    },
    price: {
      budget: transport.shipperBudget,
      agreedPrice: transport.agreedPrice,
      ownBid: ownOffer?.price || null,
      currency,
    },
    offer: ownOffer ? {
      id: ownOffer.id,
      status: ownOffer.status,
      statusLabel: mapOfferStatus(ownOffer.status),
      price: ownOffer.price,
      message: ownOffer.message,
      validUntil: ownOffer.validUntil,
    } : null,
    cargo: {
      type: transport.transportType,
      weightKg: transport.transportDetail?.weightKg || null,
      volumeM3: transport.transportDetail?.volumeM3 || null,
    },
    payout: payoutInfo || null,
    description: transport.description,
    createdAt: transport.createdAt,
    updatedAt: transport.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;

    const userId = auth.user.id;
    if (!auth.user.roles.some((role) => CARRIER_ROLES.has(role))) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Nur Transporteure, Dispatcher oder Fahrer können diese Aufträge sehen.' },
        { status: 403 },
      );
    }

    const driver = await prisma.driver.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!driver) {
      return NextResponse.json({
        jobs: [],
        total: 0,
        limit: parseLimit(new URL(request.url).searchParams.get('limit')),
        offset: parseOffset(new URL(request.url).searchParams.get('offset')),
        message: 'Noch kein Transporteur-/Fahrerprofil vorhanden.',
      });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const offset = parseOffset(searchParams.get('offset'));
    const view = searchParams.get('view') || 'active';

    const statusFilter = view === 'completed'
      ? ['COMPLETED']
      : view === 'offers'
        ? ['PUBLISHED']
        : view === 'all'
          ? undefined
          : ['ASSIGNED', 'IN_TRANSIT', 'PICKUP_DONE', 'DELIVERY_DONE'];

    const where: any = {
      OR: [
        { assignment: { driverId: driver.id } },
        { offers: { some: { driverId: driver.id } } },
      ],
    };
    if (statusFilter) where.status = { in: statusFilter };

    const [transports, total] = await Promise.all([
      prisma.transport.findMany({
        where,
        include: {
          pickupAddress: true,
          deliveryAddress: true,
          transportDetail: true,
          assignment: true,
          offers: {
            where: { driverId: driver.id },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: [
          { assignedAt: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.transport.count({ where }),
    ]);

    const payoutCandidates = transports.filter((transport) => (
      transport.assignment?.driverId === driver.id &&
      ['DELIVERY_DONE', 'COMPLETED'].includes(transport.status)
    ));

    const payoutEntries = await Promise.all(payoutCandidates.map(async (transport) => {
      const [readiness, releaseTransaction] = await Promise.all([
        getOrderPayoutReadiness({ orderId: transport.id }),
        prisma.walletTransaction.findFirst({
          where: {
            relatedTransportId: transport.id,
            type: 'PAYMENT_IN',
            amount: { gt: 0 },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      if (!readiness) return [transport.id, null] as const;

      const status = releaseTransaction ? 'released' : readiness.release.status;

      return [transport.id, {
        status,
        statusLabel: mapPayoutStatus(status),
        amount: readiness.release.settlement.carrierWalletCredit,
        currency: readiness.release.currency,
        releaseEligibleAt: readiness.releaseEligibleAt || null,
        deliveredAt: readiness.deliveredAt || null,
        blockers: readiness.release.blockedReasons,
        openDisputes: readiness.openDisputes,
        openTickets: readiness.openTickets,
        releasedAt: releaseTransaction?.processedAt || releaseTransaction?.createdAt || null,
        walletTransactionId: releaseTransaction?.id || null,
      }] as const;
    }));

    const payoutByTransportId = new Map(payoutEntries);

    return NextResponse.json({
      jobs: transports.map((transport) => formatJob(
        transport,
        driver.id,
        payoutByTransportId.get(transport.id),
      )),
      total,
      limit,
      offset,
      view,
    });
  } catch (error) {
    console.error('[CarrierJobs] Fetch failed:', error);
    return NextResponse.json(
      { error: 'CarrierJobsError', message: 'Eigene Aufträge konnten nicht geladen werden.' },
      { status: 500 },
    );
  }
}
