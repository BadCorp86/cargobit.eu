import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOptionalRequestUser } from '@/lib/request-user-auth';
import { buildDriverMissionFromAssignment } from '@/lib/driver-mobile';
import { getFallbackDriverMission } from '@/lib/product-operating-model';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestUser = await getOptionalRequestUser(request);
  const userId = requestUser?.id;
  const driverId = process.env.NODE_ENV !== 'production' ? searchParams.get('driverId') : null;

  if (!userId && !driverId) {
    return NextResponse.json({
      mission: getFallbackDriverMission(),
      source: 'fallback',
    });
  }

  try {
    const driver = driverId
      ? await prisma.driver.findUnique({
          where: { id: driverId },
          include: buildDriverIncludes(),
        })
      : await prisma.driver.findFirst({
          where: { userId: userId || undefined },
          include: buildDriverIncludes(),
        });

    if (!driver) {
      return NextResponse.json({
        mission: getFallbackDriverMission(),
        source: 'fallback',
      });
    }

    const activeAssignment = driver.assignments.find((assignment: any) =>
      ['ASSIGNED', 'IN_TRANSIT', 'PICKUP_DONE', 'DELIVERY_DONE'].includes(assignment.transport.status),
    );

    if (!activeAssignment) {
      return NextResponse.json({
        mission: {
          ...getFallbackDriverMission(),
          title: 'Kein aktiver Auftrag',
          subtitle: 'Du bist verfügbar für passende DACH/Benelux-Aufträge.',
          status: driver.isAvailable ? 'AVAILABLE' : 'OFFLINE',
          progress: 0,
        },
        source: 'database',
      });
    }

    const mission = buildDriverMissionFromAssignment(activeAssignment, driver);

    return NextResponse.json({
      mission,
      source: 'database',
    });
  } catch (error) {
    console.error('[DriverMobileAPI] Failed:', error);
    return NextResponse.json({
      mission: getFallbackDriverMission(),
      source: 'fallback',
      warning: 'Database unavailable, using mobile fallback mission',
    });
  }
}

function buildDriverIncludes() {
  return {
    assignments: {
      orderBy: { assignedAt: 'desc' },
      take: 5,
      include: {
        transport: {
          include: {
            pickupAddress: true,
            deliveryAddress: true,
            documents: true,
            statusHistory: {
              orderBy: { changedAt: 'asc' },
            },
          },
        },
        vehicle: true,
      },
    },
  } as const;
}
