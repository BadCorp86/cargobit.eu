import { NextRequest, NextResponse } from 'next/server';
import { TransportStatus, TransportType } from '@prisma/client';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MARKETPLACE_STATUSES: TransportStatus[] = ['PUBLISHED'];

function parseLimit(value: string | null) {
  const parsed = Number(value || 24);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 50) : 24;
}

function parseOffset(value: string | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseType(value: string | null) {
  if (!value || value === 'all') return null;
  const normalized = value.toUpperCase();
  return Object.values(TransportType).includes(normalized as TransportType)
    ? normalized as TransportType
    : null;
}

function parseTypes(value: string | null) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => parseType(item.trim()))
    .filter(Boolean) as TransportType[];
}

function parseMoney(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseText(value: string | null) {
  const normalized = value?.trim();
  return normalized && normalized !== 'all' ? normalized : null;
}

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function countryAliases(country: string) {
  const aliases: Record<string, string[]> = {
    DE: ['DE', 'Deutschland', 'Germany'],
    AT: ['AT', 'Österreich', 'Austria'],
    CH: ['CH', 'Schweiz', 'Switzerland'],
    PL: ['PL', 'Polen', 'Poland'],
    CZ: ['CZ', 'Tschechien', 'Czechia', 'Czech Republic'],
    NL: ['NL', 'Niederlande', 'Netherlands'],
    BE: ['BE', 'Belgien', 'Belgium'],
    FR: ['FR', 'Frankreich', 'France'],
    IT: ['IT', 'Italien', 'Italy'],
  };

  return aliases[country.toUpperCase()] || [country];
}

function countryFilter(country: string) {
  return {
    OR: countryAliases(country).map((alias) => ({
      country: { contains: alias, mode: 'insensitive' as const },
    })),
  };
}

function getOrderBy(sort: string | null) {
  if (sort === 'price-asc') return [{ shipperBudget: 'asc' as const }, { publishedAt: 'desc' as const }];
  if (sort === 'price-desc') return [{ shipperBudget: 'desc' as const }, { publishedAt: 'desc' as const }];
  return [{ publishedAt: 'desc' as const }, { createdAt: 'desc' as const }];
}

function calculateMinimumBidPrice(budget?: number | null) {
  if (!budget || budget <= 0) return null;
  return Math.round(budget * 0.8 * 100) / 100;
}

function formatMarketplaceJob(transport: any) {
  const risk = transport.transportDetail?.isHazmat
    ? 'yellow'
    : transport.transportDetail?.weightKg && transport.transportDetail.weightKg > 12000
      ? 'yellow'
      : 'green';
  const budget = transport.shipperBudget || null;
  const currency = transport.currency || 'EUR';

  return {
    id: transport.id,
    status: transport.status,
    transportType: transport.transportType,
    description: transport.description,
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
      budget,
      minimumBid: calculateMinimumBidPrice(budget),
      currency,
      paymentProtection: true,
    },
    cargo: {
      weightKg: transport.transportDetail?.weightKg || null,
      volumeM3: transport.transportDetail?.volumeM3 || null,
      isHazmat: Boolean(transport.transportDetail?.isHazmat),
      isFragile: Boolean(transport.transportDetail?.isFragile),
      specialRequirements: transport.transportDetail?.specialRequirements || null,
    },
    offersCount: transport.offers?.length || 0,
    risk,
    publishedAt: transport.publishedAt,
    createdAt: transport.createdAt,
  };
}

function isDatabaseUnavailableError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();

  return (
    message.includes('p1001') ||
    message.includes('can\'t reach database server') ||
    message.includes('cannot reach database server') ||
    message.includes('connection refused') ||
    message.includes('connect econnrefused') ||
    message.includes('no response') ||
    message.includes('server closed the connection')
  );
}

function getMarketplaceErrorPayload(error: unknown) {
  if (isDatabaseUnavailableError(error)) {
    return {
      error: 'MarketplaceJobsError',
      code: 'DATABASE_UNAVAILABLE',
      message: 'Die Datenbank ist aktuell nicht erreichbar. Verfügbare Aufträge können deshalb nicht geladen werden.',
      localSetup: {
        databaseUrl: 'postgresql://cargobit:cargobit_dev_password@localhost:5432/cargobit?schema=public',
        commands: [
          'npm run db:deploy',
          'npm run db:seed:marketplace',
        ],
      },
    };
  }

  return {
    error: 'MarketplaceJobsError',
    code: 'MARKETPLACE_JOBS_UNAVAILABLE',
    message: 'Verfügbare Aufträge konnten nicht geladen werden.',
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const offset = parseOffset(searchParams.get('offset'));
    const type = parseType(searchParams.get('type'));
    const types = parseTypes(searchParams.get('types'));
    const search = searchParams.get('search')?.trim();
    const pickupCountry = parseText(searchParams.get('pickupCountry'));
    const deliveryCountry = parseText(searchParams.get('deliveryCountry'));
    const pickupFrom = parseDate(searchParams.get('pickupFrom'));
    const pickupTo = parseDate(searchParams.get('pickupTo'), true);
    const minPrice = parseMoney(searchParams.get('minPrice'));
    const maxPrice = parseMoney(searchParams.get('maxPrice'));
    const orderBy = getOrderBy(searchParams.get('sort'));

    const where: any = {
      status: { in: MARKETPLACE_STATUSES },
      assignment: null,
    };

    if (types.length) {
      where.transportType = { in: types };
    } else if (type) {
      where.transportType = type;
    }

    if (minPrice !== null || maxPrice !== null) {
      where.shipperBudget = {};
      if (minPrice !== null) where.shipperBudget.gte = minPrice;
      if (maxPrice !== null) where.shipperBudget.lte = maxPrice;
    }

    if (pickupCountry) {
      where.pickupAddress = countryFilter(pickupCountry);
    }

    if (deliveryCountry) {
      where.deliveryAddress = countryFilter(deliveryCountry);
    }

    if (pickupFrom || pickupTo) {
      where.pickupDatetime = {};
      if (pickupFrom) where.pickupDatetime.gte = pickupFrom;
      if (pickupTo) where.pickupDatetime.lte = pickupTo;
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { pickupAddress: { city: { contains: search, mode: 'insensitive' } } },
        { pickupAddress: { country: { contains: search, mode: 'insensitive' } } },
        { deliveryAddress: { city: { contains: search, mode: 'insensitive' } } },
        { deliveryAddress: { country: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.transport.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          pickupAddress: true,
          deliveryAddress: true,
          transportDetail: true,
          offers: {
            where: { status: { in: ['PENDING', 'ACCEPTED'] } },
            select: { id: true },
          },
        },
      }),
      prisma.transport.count({ where }),
    ]);

    return NextResponse.json({
      jobs: jobs.map(formatMarketplaceJob),
      total,
      limit,
      offset,
      source: 'database',
    });
  } catch (error) {
    console.error('[Marketplace] Jobs fetch failed:', error);
    const payload = getMarketplaceErrorPayload(error);

    return NextResponse.json(
      payload,
      { status: 500 },
    );
  }
}
