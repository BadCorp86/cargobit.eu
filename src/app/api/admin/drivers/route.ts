import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';

export const dynamic = 'force-dynamic';

function parseLimit(value: string | null) {
  const limit = Number(value || 50);
  return Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
}

function parseBoolean(value: string | null) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
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

function licenseState(expiry?: Date | null) {
  if (!expiry) return 'missing';
  const days = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
}

function formatDriver(driver: any) {
  const user = driver.user;
  const vehicles = driver.driverVehicles?.map((relation: any) => relation.vehicle).filter(Boolean) || [];
  const activeAssignments = driver.assignments?.filter((assignment: any) => (
    ['ASSIGNED', 'IN_TRANSIT', 'PICKUP_DONE', 'DELIVERY_DONE'].includes(assignment.transport?.status)
  )) || [];
  const pendingOffers = driver.offers?.filter((offer: any) => offer.status === 'PENDING') || [];
  const verifications = user.verifications || [];
  const approvedVerifications = verifications.filter((verification: any) => verification.status === 'APPROVED');
  const pendingVerifications = verifications.filter((verification: any) => verification.status === 'PENDING');

  return {
    id: driver.id,
    userId: user.id,
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
    userStatus: user.status,
    company: driver.company
      ? {
          id: driver.company.id,
          name: driver.company.name,
          status: driver.company.status,
          country: driver.company.country,
        }
      : null,
    availability: {
      isAvailable: driver.isAvailable,
      currentLocation: driver.currentLocation,
      activeAssignments: activeAssignments.length,
      pendingOffers: pendingOffers.length,
    },
    license: {
      numberPresent: Boolean(driver.licenseNumber),
      class: driver.licenseClass,
      expiry: driver.licenseExpiry,
      state: licenseState(driver.licenseExpiry),
      driverCardExpiry: driver.driverCardExpiry,
      driverCardState: licenseState(driver.driverCardExpiry),
      adrLicense: driver.adrLicense,
      adrExpiry: driver.adrExpiry,
      adrState: driver.adrLicense ? licenseState(driver.adrExpiry) : 'not_required',
      adrClasses: parseJsonArray(driver.adrClasses),
    },
    stats: {
      ratingAvg: driver.ratingAvg,
      ratingCount: driver.ratingCount,
      completedTransports: driver.completedTransports,
      cancelledTransports: driver.cancelledTransports,
      damageCount: driver.damageCount,
      lastDamageAt: driver.lastDamageAt,
    },
    capabilities: {
      internationalExperience: driver.internationalExperience,
      yearsExperience: driver.yearsExperience,
      spokenLanguages: parseJsonArray(driver.spokenLanguages),
      vehicleExperience: parseJsonArray(driver.vehicleExperience),
      countryExperience: parseJsonArray(driver.countryExperience),
      permissions: driver.driverPermissions?.map((permission: any) => ({
        countryCode: permission.countryCode,
        countryName: permission.countryName,
        isAllowed: permission.isAllowed,
        expiresAt: permission.expiresAt,
      })) || [],
    },
    vehicles: vehicles.map((vehicle: any) => ({
      id: vehicle.id,
      type: vehicle.type,
      plateNumber: vehicle.plateNumber,
      status: vehicle.status,
      maxPayloadKg: vehicle.maxPayloadKg,
      coolingAvailable: vehicle.coolingAvailable,
      adrApproved: vehicle.adrApproved,
    })),
    verifications: {
      total: verifications.length,
      approved: approvedVerifications.length,
      pending: pendingVerifications.length,
      driverLicenseApproved: approvedVerifications.some((verification: any) => verification.type === 'DRIVER_LICENSE'),
      adrApproved: approvedVerifications.some((verification: any) => verification.type === 'ADR'),
    },
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const offset = Number(searchParams.get('offset') || 0);
    const availability = parseBoolean(searchParams.get('available'));
    const licenseFilter = searchParams.get('license');
    const search = searchParams.get('search')?.trim();

    const where: any = {};

    if (availability !== null) {
      where.isAvailable = availability;
    }

    if (search) {
      where.OR = [
        { licenseNumber: { contains: search, mode: 'insensitive' } },
        { licenseClass: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const now = new Date();
    const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (licenseFilter === 'missing') {
      where.licenseNumber = null;
    }

    if (licenseFilter === 'expired') {
      where.licenseExpiry = { lt: now };
    }

    if (licenseFilter === 'expiring') {
      where.licenseExpiry = { gte: now, lte: soon };
    }

    const [drivers, total, available, unavailable, licenseMissing, licenseAttention, damageOpen] = await Promise.all([
      prisma.driver.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: Number.isFinite(offset) && offset > 0 ? offset : 0,
        include: {
          user: {
            include: {
              verifications: {
                select: {
                  id: true,
                  type: true,
                  status: true,
                },
              },
            },
          },
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
              vehicle: true,
            },
          },
          driverPermissions: true,
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
        },
      }),
      prisma.driver.count({ where }),
      prisma.driver.count({ where: { isAvailable: true } }),
      prisma.driver.count({ where: { isAvailable: false } }),
      prisma.driver.count({ where: { licenseNumber: null } }),
      prisma.driver.count({
        where: {
          OR: [
            { licenseExpiry: { lt: now } },
            { licenseExpiry: { gte: now, lte: soon } },
            { driverCardExpiry: { lt: now } },
            { driverCardExpiry: { gte: now, lte: soon } },
          ],
        },
      }),
      prisma.driver.count({ where: { damageCount: { gt: 0 } } }),
    ]);

    return NextResponse.json({
      drivers: drivers.map(formatDriver),
      summary: {
        total,
        available,
        unavailable,
        licenseMissing,
        licenseAttention,
        damageOpen,
      },
      total,
      limit,
      offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    });
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}
