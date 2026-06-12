/**
 * Execution/Transport Tracking API
 *
 * Existing URL kept for compatibility. The route now treats [id] as the
 * transport/job id and writes to TrackingPoint through trackingService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOptionalRequestUser } from '@/lib/request-user-auth';
import { trackingService } from '@/services/tracking.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
