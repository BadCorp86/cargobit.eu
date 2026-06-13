/**
 * Execution/Transport Tracking API
 *
 * Existing URL kept for compatibility. The route now treats [id] as the
 * transport/job id and writes to TrackingPoint through trackingService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOptionalAdmin } from '@/lib/request-admin-auth';
import { getOptionalRequestUser } from '@/lib/request-user-auth';
import { trackingService } from '@/services/tracking.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await canReadTransportTracking(request, id);
    if (!auth.allowed) {
      return NextResponse.json(
        { code: auth.code, message: auth.message },
        { status: auth.status },
      );
    }

    const trackingPoints = await prisma.trackingPoint.findMany({
      where: { transportId: id },
      orderBy: { timestamp: 'asc' },
      take: 500,
    });

    const lastPoint = trackingPoints.at(-1);

    return NextResponse.json({
      tracking: {
        status: lastPoint ? 'live' : 'offline',
        lastLocation: lastPoint
          ? {
              lat: lastPoint.latitude,
              lng: lastPoint.longitude,
              speed: lastPoint.speed,
              heading: lastPoint.heading,
              accuracy: lastPoint.accuracy,
              timestamp: lastPoint.timestamp,
            }
          : null,
        trackingHistory: trackingPoints.map((point) => ({
          lat: point.latitude,
          lng: point.longitude,
          speed: point.speed,
          heading: point.heading,
          accuracy: point.accuracy,
          timestamp: point.timestamp,
        })),
      },
    });
  } catch (error) {
    console.error('[TrackingAPI] GET failed:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const requestUser = await getOptionalRequestUser(request);

    const lat = Number(body.lat ?? body.latitude);
    const lng = Number(body.lng ?? body.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { code: 'INVALID_LOCATION', message: 'lat/lng are required and must be numbers' },
        { status: 400 },
      );
    }

    const driver = requestUser
      ? await prisma.driver.findFirst({ where: { userId: requestUser.id } })
      : null;

    if (!driver) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Assigned driver identity is required' },
        { status: 401 },
      );
    }

    const result = await trackingService.updateTracking(id, driver.id, lat, lng, {
      speed: typeof body.speed === 'number' ? body.speed : undefined,
      heading: typeof body.heading === 'number' ? body.heading : undefined,
      accuracy: typeof body.accuracy === 'number' ? body.accuracy : undefined,
    });

    if (!result.success) {
      const status = result.error?.includes('Invalid') ? 400 : result.error?.includes('assigned') ? 403 : 409;
      return NextResponse.json(
        { code: 'TRACKING_REJECTED', message: result.error },
        { status },
      );
    }

    return NextResponse.json({ success: true, pointId: result.pointId });
  } catch (error) {
    console.error('[TrackingAPI] POST failed:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500 },
    );
  }
}

async function canReadTransportTracking(request: NextRequest, transportId: string) {
  if (process.env.NODE_ENV !== 'production' && isDemoTransport(transportId)) {
    return { allowed: true, status: 200, code: null, message: null };
  }

  const admin = await getOptionalAdmin(request);
  if (admin && ['ADMIN', 'SUPPORT'].includes(admin.role)) {
    return { allowed: true, status: 200, code: null, message: null };
  }

  const requestUser = await getOptionalRequestUser(request);
  if (!requestUser) {
    return {
      allowed: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Login required for transport tracking',
    };
  }

  const transport = await prisma.transport.findUnique({
    where: { id: transportId },
    include: {
      assignment: {
        include: { driver: true },
      },
    },
  });

  if (!transport) {
    return {
      allowed: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'Transport not found',
    };
  }

  if (transport.shipperUserId === requestUser.id || transport.assignment?.driver.userId === requestUser.id) {
    return { allowed: true, status: 200, code: null, message: null };
  }

  if (transport.assignment?.driver.companyId) {
    const companyUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId: transport.assignment.driver.companyId,
          userId: requestUser.id,
        },
      },
    });

    if (companyUser) {
      return { allowed: true, status: 200, code: null, message: null };
    }
  }

  return {
    allowed: false,
    status: 403,
    code: 'FORBIDDEN',
    message: 'You are not allowed to view this tracking stream',
  };
}

function isDemoTransport(id: string) {
  return id.startsWith('mission_demo') || id.startsWith('demo') || id.startsWith('TR-');
}
