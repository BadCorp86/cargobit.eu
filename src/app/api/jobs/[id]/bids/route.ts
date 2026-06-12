/**
 * CargoBit Job Bids API
 * GET /api/jobs/[id]/bids - Get all bids for a job
 */

import { NextRequest, NextResponse } from 'next/server';
import { bidsService } from '@/services/bids.service';
import { db } from '@/lib/db';
import { requireRequestUser, type RequestUser } from '@/lib/request-user-auth';

interface CreateBidRequest {
  price?: number;
  vehicleId?: string;
  message?: string;
  estimatedDuration?: number;
  validUntilHours?: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userRole = '';

  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;

    const userId = auth.user.id;
    userRole = resolveUserRoleHeader(request, auth.user);
    
    const { id: jobId } = await params;
    const bids = await bidsService.getBidsForJob(jobId, userId);
    
    return NextResponse.json({
      jobId,
      bids,
      total: bids.length,
    });
    
  } catch (error: any) {
    console.error('[API] GET /jobs/[id]/bids error:', error);
    if (error?.message === 'Not authorized' && canSubmitBid(userRole)) {
      const { id: jobId } = await params;
      return NextResponse.json({
        jobId,
        bids: [],
        total: 0,
      });
    }

    if (error?.message === 'Not authorized') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Sie haben keinen Zugriff auf diese Angebote.' },
        { status: 403 },
      );
    }

    if (error?.message === 'Job not found') {
      return NextResponse.json(
        { error: 'NotFound', message: 'Auftrag nicht gefunden.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch bids' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;

    const userId = auth.user.id;
    const userRole = resolveUserRoleHeader(request, auth.user);

    if (!canSubmitBid(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Nur Transporteure, Dispatcher oder Fahrer können Angebote abgeben.' },
        { status: 403 }
      );
    }

    const { id: jobId } = await params;
    const body: CreateBidRequest = await request.json();
    const price = Number(body.price);

    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Ein gültiger Angebotspreis ist erforderlich.' },
        { status: 400 }
      );
    }

    const transport = await db.transport.findUnique({
      where: { id: jobId },
      include: { transportDetail: true },
    });

    if (!transport) {
      return NextResponse.json(
        { error: 'NotFound', message: 'Auftrag nicht gefunden.' },
        { status: 404 }
      );
    }

    if (transport.shipperUserId === userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Der Auftragsersteller kann kein eigenes Transportangebot abgeben.' },
        { status: 403 }
      );
    }

    if (transport.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: 'JobNotOpen', message: 'Dieser Auftrag ist aktuell nicht für Angebote geöffnet.' },
        { status: 400 }
      );
    }

    const minimumPrice = calculateMinimumBidPrice(transport.shipperBudget);
    if (minimumPrice && price < minimumPrice) {
      return NextResponse.json(
        {
          error: 'BID_BELOW_MINIMUM',
          message: `Das Angebot liegt unter der Anti-Dumping-Grenze von ${minimumPrice.toFixed(2)} ${transport.currency}.`,
          minimumPrice,
          currency: transport.currency,
        },
        { status: 400 }
      );
    }

    const profile = await ensureCarrierProfile({
      userId,
      email: auth.user.email || request.headers.get('x-user-email') || `${userId}@local.cargobit.test`,
      role: normalizeUserRole(userRole),
      transportType: transport.transportType,
      vehicleId: body.vehicleId,
    });

    const result = await bidsService.createBid({
      jobId,
      transporterId: profile.driverId,
      vehicleId: profile.vehicleId,
      price,
      currency: transport.currency,
      message: body.message,
      estimatedDuration: body.estimatedDuration,
      validUntilHours: body.validUntilHours,
    });

    const bids = await bidsService.getBidsForJob(jobId, userId);

    return NextResponse.json({
      success: true,
      jobId,
      bidId: result.bidId,
      status: result.status,
      minimumPrice,
      bids,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[API] POST /jobs/[id]/bids error:', error);

    if (error?.message === 'You already have an active bid for this job') {
      return NextResponse.json(
        { error: 'DuplicateBid', message: 'Sie haben für diesen Auftrag bereits ein aktives Angebot abgegeben.' },
        { status: 409 },
      );
    }

    if (error?.message === 'Job is not open for bids') {
      return NextResponse.json(
        { error: 'JobNotOpen', message: 'Dieser Auftrag ist aktuell nicht für Angebote geöffnet.' },
        { status: 400 },
      );
    }

    if (error?.message === 'Carrier profile required') {
      return NextResponse.json(
        { error: 'CarrierProfileRequired', message: 'Vor der Angebotsabgabe muss ein verifiziertes Transporteur-/Fahrerprofil vorhanden sein.' },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create bid' },
      { status: 500 }
    );
  }
}

function canSubmitBid(roleHeader: string) {
  const roles = roleHeader.split(',').map((role) => role.trim());
  return roles.some((role) => ['CARRIER', 'DISPATCHER', 'DRIVER_SELF_EMPLOYED'].includes(role));
}

function calculateMinimumBidPrice(shipperBudget?: number | null) {
  if (!shipperBudget || shipperBudget <= 0) return null;
  return Math.round(shipperBudget * 0.8 * 100) / 100;
}

function normalizeUserRole(roleHeader: string) {
  const firstRole = roleHeader.split(',').map((role) => role.trim()).find(Boolean) || 'CARRIER';
  const allowed = new Set([
    'ADMIN',
    'SUPPORT',
    'SHIPPER_COMPANY',
    'SHIPPER_PRIVATE',
    'CARRIER',
    'DISPATCHER',
    'DRIVER_SELF_EMPLOYED',
    'MARKETER',
  ]);
  return allowed.has(firstRole) ? firstRole as any : 'CARRIER';
}

function resolveUserRoleHeader(request: NextRequest, user: RequestUser) {
  if (user.roles.length > 0) return user.roles.join(',');

  if (process.env.NODE_ENV !== 'production') {
    return request.headers.get('x-user-role') || request.headers.get('x-user-roles') || '';
  }

  return '';
}

function vehicleTypeForTransport(transportType: string) {
  const map: Record<string, string> = {
    LIQUID: 'TANKAUFLIEGER',
    BULK: 'KIPPER',
    CAR_TRANSPORT: 'AUTOTRANSPORTER',
    LOWLOADER: 'TIEFLADER',
    OVERSIZE: 'TIEFLADER',
    COOLING: 'REEFER',
    HAZMAT: 'TANKAUFLIEGER',
    CONTAINER: 'CONTAINERCHASSIS',
    PALLET: 'SPRINTER',
  };
  return map[transportType] || 'SPRINTER';
}

function getReadableCarrierName(user: { firstName?: string | null; lastName?: string | null; email?: string | null; id: string }) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName && !/^demo transporteur$/i.test(fullName)) return `${fullName} Transporte`;

  const emailName = user.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  if (emailName) {
    return `${emailName
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')} Transporte`;
  }

  return `CargoBit Transporteur ${user.id.slice(0, 8)}`;
}

async function ensureCarrierProfile(input: {
  userId: string;
  email: string;
  role: any;
  transportType: string;
  vehicleId?: string;
}) {
  const existingDriver = await db.driver.findUnique({
    where: { userId: input.userId },
    include: {
      driverVehicles: {
        include: { vehicle: true },
        orderBy: { isPrimary: 'desc' },
      },
    },
  });

  if (existingDriver) {
    const requestedVehicle = input.vehicleId
      ? existingDriver.driverVehicles.find((item) => item.vehicleId === input.vehicleId)
      : null;
    const vehicle = requestedVehicle?.vehicle || existingDriver.driverVehicles[0]?.vehicle;

    if (vehicle) {
      return { driverId: existingDriver.id, vehicleId: vehicle.id };
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Carrier profile required');
  }

  return db.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { id: input.userId },
      update: {
        email: input.email.toLowerCase(),
        status: 'ACTIVE',
      },
      create: {
        id: input.userId,
        email: input.email.toLowerCase(),
        passwordHash: 'auth-store-demo-user',
        firstName: 'Demo',
        lastName: 'Transporteur',
        status: 'ACTIVE',
        roles: {
          create: {
            role: {
              connectOrCreate: {
                where: { name: input.role },
                create: {
                  name: input.role,
                  description: 'Auto-created from local CargoBit auth store',
                },
              },
            },
          },
        },
      },
    });

    const companyUser = await tx.companyUser.findFirst({
      where: { userId: user.id },
      include: { company: true },
    });

    const company = companyUser?.company || await tx.company.create({
      data: {
        name: getReadableCarrierName(user),
        type: 'CARRIER',
        country: 'DE',
        status: 'ACTIVE',
        companyUsers: {
          create: {
            userId: user.id,
            roleInCompany: 'owner',
          },
        },
      },
    });

    const driver = await tx.driver.upsert({
      where: { userId: user.id },
      update: {
        companyId: company.id,
        isAvailable: true,
      },
      create: {
        userId: user.id,
        companyId: company.id,
        isAvailable: true,
        ratingAvg: 4.7,
        ratingCount: 12,
      },
    });

    const vehicle = await tx.vehicle.create({
      data: {
        companyId: company.id,
        type: vehicleTypeForTransport(input.transportType) as any,
        plateNumber: `CB-${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
        brand: 'CargoBit',
        model: 'Demo Vehicle',
        maxPayloadKg: 24000,
        volumeM3: 90,
        status: 'ACTIVE',
      },
    });

    await tx.driverVehicle.create({
      data: {
        driverId: driver.id,
        vehicleId: vehicle.id,
        isPrimary: true,
      },
    });

    return { driverId: driver.id, vehicleId: vehicle.id };
  });
}
