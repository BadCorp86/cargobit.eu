import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRequestUser } from '@/lib/request-user-auth';

export const dynamic = 'force-dynamic';

const SHIPPER_ROLES = new Set(['SHIPPER_PRIVATE', 'SHIPPER_COMPANY', 'ADMIN', 'SUPPORT']);

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
    CREATED: 'Entwurf',
    PUBLISHED: 'Veröffentlicht',
    ASSIGNED: 'Vergeben',
    IN_TRANSIT: 'Unterwegs',
    PICKUP_DONE: 'Abgeholt',
    DELIVERY_DONE: 'Geliefert',
    COMPLETED: 'Abgeschlossen',
    CANCELLED: 'Storniert',
  };
  return labels[status] || status;
}

function mapTransport(transport: any) {
  const pendingOffers = transport.offers?.filter((offer: any) => offer.status === 'PENDING') || [];
  const acceptedOffer = transport.offers?.find((offer: any) => offer.status === 'ACCEPTED') || null;
  const lowestOffer = pendingOffers.reduce((lowest: any | null, offer: any) => {
    if (!lowest || offer.price < lowest.price) return offer;
    return lowest;
  }, null);

  return {
    id: transport.id,
    status: transport.status,
    statusLabel: mapStatus(transport.status),
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
      lowestOffer: lowestOffer?.price || null,
      currency: transport.currency || lowestOffer?.currency || acceptedOffer?.currency || 'EUR',
    },
    offers: {
      total: transport.offers?.length || 0,
      pending: pendingOffers.length,
      accepted: acceptedOffer
        ? {
            id: acceptedOffer.id,
            price: acceptedOffer.price,
            transporterName: getTransporterDisplayName(acceptedOffer.driver),
          }
        : null,
      lowest: lowestOffer
        ? {
            id: lowestOffer.id,
            price: lowestOffer.price,
            transporterName: getTransporterDisplayName(lowestOffer.driver),
          }
        : null,
    },
    cargo: {
      type: transport.transportType,
      weightKg: transport.transportDetail?.weightKg || null,
      volumeM3: transport.transportDetail?.volumeM3 || null,
    },
    description: transport.description,
    createdAt: transport.createdAt,
    updatedAt: transport.updatedAt,
  };
}

function getTransporterDisplayName(driver: any) {
  const driverCompanyName = driver?.company?.name;
  if (driverCompanyName) return driverCompanyName;

  const companyUserName = driver?.user?.companyUsers?.find((item: any) => item.company?.type === 'CARRIER')?.company?.name
    || driver?.user?.companyUsers?.[0]?.company?.name;
  if (companyUserName) return companyUserName;

  const fullName = [driver?.user?.firstName, driver?.user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || 'Transporteur';
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;

    const userId = auth.user.id;
    if (!auth.user.roles.some((role) => SHIPPER_ROLES.has(role))) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Nur Verlader, Admin oder Support können diese Aufträge sehen.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const offset = parseOffset(searchParams.get('offset'));
    const view = searchParams.get('view') || 'active';

    const where: any = { shipperUserId: userId };
    if (view === 'drafts') where.status = 'CREATED';
    if (view === 'offers') {
      where.status = 'PUBLISHED';
      where.offers = { some: { status: 'PENDING' } };
    }
    if (view === 'active') where.status = { in: ['PUBLISHED', 'ASSIGNED', 'IN_TRANSIT', 'PICKUP_DONE', 'DELIVERY_DONE'] };
    if (view === 'completed') where.status = { in: ['COMPLETED', 'CANCELLED'] };

    const [transports, total] = await Promise.all([
      prisma.transport.findMany({
        where,
        include: {
          pickupAddress: true,
          deliveryAddress: true,
          transportDetail: true,
          offers: {
            include: {
              driver: {
                include: {
                  company: true,
                  user: {
                    include: {
                      companyUsers: {
                        include: { company: true },
                      },
                    },
                  },
                },
              },
            },
            orderBy: [{ status: 'asc' }, { price: 'asc' }],
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.transport.count({ where }),
    ]);

    return NextResponse.json({
      jobs: transports.map(mapTransport),
      total,
      limit,
      offset,
      view,
    });
  } catch (error) {
    console.error('[ShipperJobs] Fetch failed:', error);
    return NextResponse.json(
      { error: 'ShipperJobsError', message: 'Verlader-Aufträge konnten nicht geladen werden.' },
      { status: 500 },
    );
  }
}
