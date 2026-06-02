import { NextRequest, NextResponse } from 'next/server';
import { TransportStatus, TransportType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';

export const dynamic = 'force-dynamic';

const ACTIVE_STATUSES: TransportStatus[] = [
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

function formatPerson(user?: any) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '-',
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '-',
  };
}

function formatJob(transport: any) {
  const pendingOffers = transport.offers?.filter((offer: any) => offer.status === 'PENDING') || [];
  const acceptedOffer = transport.offers?.find((offer: any) => offer.status === 'ACCEPTED') || null;
  const latestStatus = transport.statusHistory?.[0] || null;
  const assignment = transport.assignment || null;
  const driverUser = assignment?.driver?.user || null;
  const podDocuments = transport.documents?.filter((document: any) => (
    ['pod', 'cmr', 'delivery_photo', 'foto_delivery'].includes(String(document.type).toLowerCase())
  )) || [];
  const invoiceDocuments = transport.documents?.filter((document: any) => (
    ['rechnung', 'invoice'].includes(String(document.type).toLowerCase())
  )) || [];

  return {
    id: transport.id,
    status: transport.status,
    transportType: transport.transportType,
    description: transport.description,
    route: {
      pickup: {
        city: transport.pickupAddress?.city || '-',
        country: transport.pickupAddress?.country || '-',
        label: [transport.pickupAddress?.city, transport.pickupAddress?.country].filter(Boolean).join(', ') || '-',
      },
      delivery: {
        city: transport.deliveryAddress?.city || '-',
        country: transport.deliveryAddress?.country || '-',
        label: [transport.deliveryAddress?.city, transport.deliveryAddress?.country].filter(Boolean).join(', ') || '-',
      },
      distanceKm: transport.distanceKm,
      isInternational: transport.isInternational,
      customsRequired: transport.customsRequired,
    },
    schedule: {
      pickupDatetime: transport.pickupDatetime,
      deliveryDatetime: transport.deliveryDatetime,
      publishedAt: transport.publishedAt,
      assignedAt: transport.assignedAt,
      completedAt: transport.completedAt,
      cancelledAt: transport.cancelledAt,
    },
    shipper: formatPerson(transport.shipperUser),
    transporter: driverUser
      ? {
          driver: formatPerson(driverUser),
          vehicle: assignment?.vehicle
            ? {
                id: assignment.vehicle.id,
                plateNumber: assignment.vehicle.plateNumber,
                type: assignment.vehicle.type,
              }
            : null,
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
      specialRequirements: transport.transportDetail?.specialRequirements || null,
    },
    operational: {
      offersTotal: transport.offers?.length || 0,
      pendingOffers: pendingOffers.length,
      acceptedOfferId: acceptedOffer?.id || null,
      matchingSessions: transport.matchingSessions?.length || 0,
      documents: transport.documents?.length || 0,
      podDocuments: podDocuments.length,
      invoiceDocuments: invoiceDocuments.length,
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
        { pickupAddress: { country: { contains: search, mode: 'insensitive' } } },
        { deliveryAddress: { city: { contains: search, mode: 'insensitive' } } },
        { deliveryAddress: { country: { contains: search, mode: 'insensitive' } } },
        { shipperUser: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [jobs, total, drafts, published, active, completed, podOpen, invoiceOpen] = await Promise.all([
      prisma.transport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
              vehicle: {
                select: {
                  id: true,
                  plateNumber: true,
                  type: true,
                },
              },
            },
          },
          matchingSessions: {
            select: { id: true },
          },
          documents: {
            select: {
              id: true,
              type: true,
              isGenerated: true,
              isSigned: true,
            },
          },
          statusHistory: {
            orderBy: { changedAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.transport.count({ where }),
      prisma.transport.count({ where: { status: 'CREATED' } }),
      prisma.transport.count({ where: { status: 'PUBLISHED' } }),
      prisma.transport.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      prisma.transport.count({ where: { status: 'COMPLETED' } }),
      prisma.transport.count({
        where: {
          status: 'DELIVERY_DONE',
          documents: {
            none: {
              type: { in: ['pod', 'cmr', 'delivery_photo', 'foto_delivery'] },
            },
          },
        },
      }),
      prisma.transport.count({
        where: {
          status: { in: ['DELIVERY_DONE', 'COMPLETED'] },
          documents: {
            none: {
              type: { in: ['rechnung', 'invoice'] },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      jobs: jobs.map(formatJob),
      summary: {
        total,
        drafts,
        published,
        active,
        podOpen,
        invoiceOpen,
        completed,
      },
      total,
      limit,
      offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    });
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}
