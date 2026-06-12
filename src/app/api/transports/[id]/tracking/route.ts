import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOptionalAdmin } from '@/lib/request-admin-auth';
import { getOptionalRequestUser } from '@/lib/request-user-auth';
import { mapService, type Coordinates } from '@/services/map.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type TrackingStatus = 'live' | 'stale' | 'offline' | 'completed';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  if (canUseDemoTracking(id)) {
    return NextResponse.json(buildDemoTrackingResponse(id));
  }

  const requestUser = await getOptionalRequestUser(request);
  const userId = requestUser?.id || null;
  const admin = await getOptionalAdmin(request);
  const userRole = admin?.role || null;

  if (!userId && !isInternalRole(userRole)) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Login required for transport tracking' },
      { status: 401 },
    );
  }

  const transport = await prisma.transport.findUnique({
    where: { id },
    include: {
      pickupAddress: true,
      deliveryAddress: true,
      assignment: {
        include: {
          driver: true,
          vehicle: true,
        },
      },
      trackingPoints: {
        orderBy: { timestamp: 'asc' },
        take: 500,
      },
    },
  });

  if (!transport) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Transport not found' },
      { status: 404 },
    );
  }

  const allowed = await canReadTracking({
    userId,
    userRole,
    shipperUserId: transport.shipperUserId,
    driverUserId: transport.assignment?.driver.userId,
    driverCompanyId: transport.assignment?.driver.companyId,
  });

  if (!allowed) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'You are not allowed to view this tracking stream' },
      { status: 403 },
    );
  }

  const route = await resolveRoute(transport);
  const lastPoint = transport.trackingPoints.at(-1);
  const status = getTrackingStatus(transport.status, lastPoint?.timestamp);

  return NextResponse.json({
    transportId: transport.id,
    status,
    provider: {
      maps: process.env.MAP_PROVIDER || 'mock',
      browserKeyConfigured: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY),
      serverKeyConfigured: Boolean(process.env.GOOGLE_MAPS_SERVER_KEY),
    },
    route,
    lastLocation: lastPoint ? serializeTrackingPoint(lastPoint) : null,
    points: transport.trackingPoints.map(serializeTrackingPoint),
    eta: buildEta(route?.duration, lastPoint?.timestamp),
    updatedAt: lastPoint?.timestamp || null,
    visibility: {
      completed: transport.status === 'COMPLETED',
      canPostLocation: false,
      websocketChannel: `tracking:${transport.id}`,
      pollingFallbackSeconds: 15,
    },
  });
}

async function canReadTracking(input: {
  userId: string | null;
  userRole: string | null;
  shipperUserId: string;
  driverUserId?: string | null;
  driverCompanyId?: string | null;
}) {
  if (isInternalRole(input.userRole)) return true;
  if (!input.userId) return false;
  if (input.userId === input.shipperUserId) return true;
  if (input.userId === input.driverUserId) return true;

  if (input.driverCompanyId) {
    const companyUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId: input.driverCompanyId,
          userId: input.userId,
        },
      },
    });

    if (companyUser) return true;
  }

  return false;
}

async function resolveRoute(transport: {
  calculatedRoute: string | null;
  pickupAddress: { latitude: number | null; longitude: number | null; city: string; country: string; street: string; postalCode: string };
  deliveryAddress: { latitude: number | null; longitude: number | null; city: string; country: string; street: string; postalCode: string };
}) {
  const savedRoute = parseJson<RoutePayload>(transport.calculatedRoute);

  if (savedRoute?.distance || savedRoute?.distanceKm) {
    return normalizeSavedRoute(savedRoute);
  }

  const pickup = addressCoordinates(transport.pickupAddress) || addressLabel(transport.pickupAddress);
  const delivery = addressCoordinates(transport.deliveryAddress) || addressLabel(transport.deliveryAddress);
  const calculated = await mapService.calculateRoute(pickup, delivery, undefined, { vehicleType: 'truck' });

  if (!calculated) return null;

  return {
    distanceKm: calculated.distance,
    durationMinutes: calculated.duration,
    tollCost: calculated.tollCost,
    fuelCost: calculated.fuelCost,
    polyline: calculated.polyline,
    provider: calculated.provider,
    waypoints: calculated.waypoints,
  };
}

function getTrackingStatus(transportStatus: string, lastTimestamp?: Date): TrackingStatus {
  if (transportStatus === 'COMPLETED') return 'completed';
  if (!lastTimestamp) return 'offline';

  const ageMs = Date.now() - lastTimestamp.getTime();
  return ageMs <= 15 * 60 * 1000 ? 'live' : 'stale';
}

function buildEta(durationMinutes?: number | null, lastTimestamp?: Date | null) {
  if (!durationMinutes) return null;

  const eta = new Date(Date.now() + durationMinutes * 60 * 1000);

  return {
    durationMinutes,
    arrivalEstimate: eta.toISOString(),
    basedOnLastLocationAt: lastTimestamp?.toISOString() || null,
  };
}

function serializeTrackingPoint(point: {
  id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  timestamp: Date;
}) {
  return {
    id: point.id,
    lat: point.latitude,
    lng: point.longitude,
    speed: point.speed,
    heading: point.heading,
    accuracy: point.accuracy,
    timestamp: point.timestamp.toISOString(),
  };
}

function addressCoordinates(address: { latitude: number | null; longitude: number | null }): Coordinates | null {
  if (typeof address.latitude === 'number' && typeof address.longitude === 'number') {
    return { lat: address.latitude, lng: address.longitude };
  }

  return null;
}

function addressLabel(address: { street: string; postalCode: string; city: string; country: string }) {
  return `${address.street}, ${address.postalCode} ${address.city}, ${address.country}`;
}

function isInternalRole(role?: string | null) {
  return role === 'ADMIN' || role === 'SUPPORT';
}

function isDemoTransport(id: string) {
  return id.startsWith('mission_demo') || id.startsWith('demo') || id.startsWith('TR-');
}

function canUseDemoTracking(id: string) {
  return process.env.NODE_ENV !== 'production' && isDemoTransport(id);
}

function buildDemoTrackingResponse(id: string) {
  const now = new Date();
  const points = [
    { id: 'demo_tracking_1', lat: 53.5511, lng: 9.9937, speed: 0, heading: 160, accuracy: 12, timestamp: new Date(now.getTime() - 25 * 60 * 1000).toISOString() },
    { id: 'demo_tracking_2', lat: 52.9667, lng: 10.5589, speed: 78, heading: 168, accuracy: 9, timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString() },
    { id: 'demo_tracking_3', lat: 52.3759, lng: 11.8154, speed: 82, heading: 170, accuracy: 8, timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString() },
  ];

  return {
    transportId: id,
    status: 'live',
    provider: {
      maps: process.env.MAP_PROVIDER || 'mock',
      browserKeyConfigured: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY),
      serverKeyConfigured: Boolean(process.env.GOOGLE_MAPS_SERVER_KEY),
    },
    route: {
      distanceKm: 790,
      durationMinutes: 540,
      tollCost: 118.5,
      fuelCost: 426.6,
      polyline: null,
      provider: 'mock',
      waypoints: [
        { lat: 53.5511, lng: 9.9937 },
        { lat: 48.1374, lng: 11.5755 },
      ],
    },
    lastLocation: points.at(-1),
    points,
    eta: {
      durationMinutes: 280,
      arrivalEstimate: new Date(now.getTime() + 280 * 60 * 1000).toISOString(),
      basedOnLastLocationAt: points.at(-1)?.timestamp || null,
    },
    updatedAt: points.at(-1)?.timestamp || null,
    visibility: {
      completed: false,
      canPostLocation: false,
      websocketChannel: `tracking:${id}`,
      pollingFallbackSeconds: 15,
    },
  };
}

interface RoutePayload {
  distance?: number;
  distanceKm?: number;
  duration?: number;
  durationMinutes?: number;
  tollCost?: number;
  fuelCost?: number;
  polyline?: string;
  provider?: string;
  waypoints?: Coordinates[];
}

function parseJson<T>(value?: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeSavedRoute(route: RoutePayload) {
  return {
    distanceKm: route.distanceKm ?? route.distance ?? 0,
    durationMinutes: route.durationMinutes ?? route.duration ?? 0,
    tollCost: route.tollCost ?? 0,
    fuelCost: route.fuelCost ?? 0,
    polyline: route.polyline,
    provider: route.provider || 'stored',
    waypoints: route.waypoints || [],
  };
}
