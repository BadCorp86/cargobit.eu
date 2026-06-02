import { NextRequest, NextResponse } from 'next/server';
import { TransportStatus, TransportType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';

export const dynamic = 'force-dynamic';

const ACTIVE_STATUSES: TransportStatus[] = [
  'PUBLISHED',
  'ASSIGNED',
  'IN_TRANSIT',
  'PICKUP_DONE',
  'DELIVERY_DONE',
];

function parseLimit(value: string | null) {
  const limit = Number(value || 50);
  return Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
}

function parseStatus(value: string | null) {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return Object.values(TransportStatus).includes(normalized as TransportStatus)
    ? normalized as TransportStatus
    : null;
}

function parseType(value: string | null) {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return Object.values(TransportType).includes(normalized as TransportType)
    ? normalized as TransportType
    : null;
}

function formatTransport(transport: any) {
  const pendingOffers = transport.offers?.filter((offer: any) => offer.status === 'PENDING') || [];
  const acceptedOffer = transport.offers?.find((offer: any) => offer.status === 'ACCEPTED') || null;
  const latestStatus = transport.statusHistory?.[0] || null;
  const driverUser = transport.assignment?.driver?.user || null;

  return {
    id: transport.id,
    status: transport.status,
    transportType: transport.transportType,
    route: {
      pickup: {
        city: transport.pickupAddress?.city || '-',
        country: transport.pickupAddress?.country || '-',
      },
      delivery: {
        city: transport.deliveryAddress?.city || '-',
        country: transport.deliveryAddress?.country || '-',
      },
    },
    schedule: {
      pickupDatetime: transport.pickupDatetime,
      deliveryDatetime: transport.deliveryDatetime,
    },
    shipper: {
      id: transport.shipperUser?.id,
      email: transport.shipperUser?.email || '-',
      name: [transport.shipperUser?.firstName, transport.shipperUser?.lastName].filter(Boolean).join(' ') || transport.shipperUser?.email || '-',
    },
    driver: driverUser
      ? {
          id: driverUser.id,
          email: driverUser.email,
          name: [driverUser.firstName, driverUser.lastName].filter(Boolean).join(' ') || driverUser.email,
        }
      : null,
    price: {
      budget: transport.shipperBudget,
      agreed: transport.agreedPrice || acceptedOffer?.price || null,
      currency: transport.currency,
    },
    cargo: {
      weightKg: transport.transportDetail?.weightKg || null,
      volumeM3: transport.transportDetail?.volumeM3 || null,
      isHazmat: Boolean(transport.transportDetail?.isHazmat),
      isFragile: Boolean(transport.transportDetail?.isFragile),
    },
    operational: {
      pendingOffers: pendingOffers.length,
      matchingSessions: transport.matchingSessions?.length || 0,
      trackingPoints: transport.trackingPoints?.length || 0,
      documents: transport.documents?.length || 0,
      latestStatusNote: latestStatus?.note || null,
      latestStatusAt: latestStatus?.changedAt || null,
    },
    createdAt: transport.createdAt,
    updatedAt: transport.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const offset = Number(searchParams.get('offset') || 0);
    const status = parseStatus(searchParams.get('status'));
    const transportType = parseType(searchParams.get('type'));
    const search = searchParams.get('search')?.trim();

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (transportType) {
      where.transportType = transportType;
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { pickupAddress: { city: { contains: search, mode: 'insensitive' } } },
        { deliveryAddress: { city: { contains: search, mode: 'insensitive' } } },
        { shipperUser: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [transports, total, active, completed, podPending, offerPending] = await Promise.all([
      prisma.transport.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: Number.isFinite(offset) && offset > 0 ? offset : 0,
        include: {
          shipperUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          pickupAddress: true,
          deliveryAddress: true,
          transportDetail: true,
          offers: {
            select: {
              id: true,
              price: true,
              status: true,
            },
          },
          assignment: {
            include: {
              driver: {
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
              },
            },
          },
          matchingSessions: {
            select: { id: true },
          },
          trackingPoints: {
            select: { id: true },
            take: 1,
          },
          documents: {
            select: { id: true },
          },
          statusHistory: {
            orderBy: { changedAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.transport.count({ where }),
      prisma.transport.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      prisma.transport.count({ where: { status: 'COMPLETED' } }),
      prisma.transport.count({
        where: {
          status: 'DELIVERY_DONE',
          documents: {
            none: {
              type: { in: ['pod', 'cmr', 'delivery_photo'] },
            },
          },
        },
      }),
      prisma.offer.count({ where: { status: 'PENDING' } }),
    ]);

    return NextResponse.json({
      transports: transports.map(formatTransport),
      summary: {
        total,
        active,
        completed,
        podPending,
        offerPending,
      },
      total,
      limit,
      offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    });
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}
