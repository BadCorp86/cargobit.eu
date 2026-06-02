import { NextRequest, NextResponse } from 'next/server';
import { VehicleStatus, VehicleType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';

export const dynamic = 'force-dynamic';

const ACTIVE_TRANSPORT_STATUSES = ['ASSIGNED', 'IN_TRANSIT', 'PICKUP_DONE', 'DELIVERY_DONE'];

function parseLimit(value: string | null) {
  const limit = Number(value || 50);
  return Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
}

function parseVehicleStatus(value: string | null) {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return Object.values(VehicleStatus).includes(normalized as VehicleStatus)
    ? normalized as VehicleStatus
    : null;
}

function parseVehicleType(value: string | null) {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return Object.values(VehicleType).includes(normalized as VehicleType)
    ? normalized as VehicleType
    : null;
}

function parseJsonArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function formatDriverName(driver: any) {
  const user = driver?.user;
  if (!user) return '-';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '-';
}

function formatVehicle(vehicle: any) {
  const assignedDrivers = vehicle.driverVehicles?.map((relation: any) => ({
    id: relation.driver.id,
    name: formatDriverName(relation.driver),
    email: relation.driver.user?.email || '-',
    isPrimary: relation.isPrimary,
    isAvailable: relation.driver.isAvailable,
  })) || [];

  const activeAssignments = vehicle.assignments?.filter((assignment: any) => (
    ACTIVE_TRANSPORT_STATUSES.includes(assignment.transport?.status)
  )) || [];
  const pendingOffers = vehicle.offers?.filter((offer: any) => offer.status === 'PENDING') || [];

  return {
    id: vehicle.id,
    type: vehicle.type,
    plateNumber: vehicle.plateNumber,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    status: vehicle.status,
    currentLocation: vehicle.currentLocation,
    company: {
      id: vehicle.company.id,
      name: vehicle.company.name,
      status: vehicle.company.status,
      country: vehicle.company.country,
    },
    capacity: {
      lengthM: vehicle.lengthM,
      widthM: vehicle.widthM,
      heightM: vehicle.heightM,
      maxPayloadKg: vehicle.maxPayloadKg,
      volumeM3: vehicle.volumeM3,
      palletSpaces: vehicle.palletSpaces,
    },
    features: {
      adrApproved: vehicle.adrApproved,
      adrClasses: parseJsonArray(vehicle.adrClasses),
      coolingAvailable: vehicle.coolingAvailable,
      coolingMinTemp: vehicle.coolingMinTemp,
      coolingMaxTemp: vehicle.coolingMaxTemp,
      hasLift: vehicle.hasLift,
      hasCrane: vehicle.hasCrane,
      hasTank: vehicle.hasTank,
      tankCapacityL: vehicle.tankCapacityL,
      tunnelCodes: parseJsonArray(vehicle.tunnelCodes),
    },
    operations: {
      assignedDrivers,
      activeAssignments: activeAssignments.length,
      pendingOffers: pendingOffers.length,
      totalOffers: vehicle.offers?.length || 0,
      matchingCandidates: vehicle.matchingCandidates?.length || 0,
    },
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const offset = Number(searchParams.get('offset') || 0);
    const status = parseVehicleStatus(searchParams.get('status'));
    const type = parseVehicleType(searchParams.get('type'));
    const feature = searchParams.get('feature');
    const search = searchParams.get('search')?.trim();

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (feature === 'adr') {
      where.adrApproved = true;
    }

    if (feature === 'cooling') {
      where.coolingAvailable = true;
    }

    if (feature === 'lift') {
      where.hasLift = true;
    }

    if (feature === 'crane') {
      where.hasCrane = true;
    }

    if (feature === 'tank') {
      where.hasTank = true;
    }

    if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [vehicles, total, active, maintenance, inactive, adr, cooling, special] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: Number.isFinite(offset) && offset > 0 ? offset : 0,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              status: true,
              country: true,
            },
          },
          driverVehicles: {
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
          offers: {
            select: {
              id: true,
              status: true,
            },
          },
          assignments: {
            include: {
              transport: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
          matchingCandidates: {
            select: { id: true },
            take: 10,
          },
        },
      }),
      prisma.vehicle.count({ where }),
      prisma.vehicle.count({ where: { status: 'ACTIVE' } }),
      prisma.vehicle.count({ where: { status: 'MAINTENANCE' } }),
      prisma.vehicle.count({ where: { status: 'INACTIVE' } }),
      prisma.vehicle.count({ where: { adrApproved: true } }),
      prisma.vehicle.count({ where: { coolingAvailable: true } }),
      prisma.vehicle.count({
        where: {
          OR: [
            { hasCrane: true },
            { hasTank: true },
            { type: { in: ['TIEFLADER', 'TIEFBETT', 'AUTOTRANSPORTER', 'CONTAINERCHASSIS', 'REEFER'] } },
          ],
        },
      }),
    ]);

    return NextResponse.json({
      vehicles: vehicles.map(formatVehicle),
      summary: {
        total,
        active,
        maintenance,
        inactive,
        adr,
        cooling,
        special,
      },
      total,
      limit,
      offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    });
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}
