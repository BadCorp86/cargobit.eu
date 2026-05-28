import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  applyDemoDriverAction,
  buildDriverMissionFromAssignment,
  getDriverActionMessage,
  getStatusForDriverAction,
  type DriverMobileActionId,
} from '@/lib/driver-mobile';

const validActions: DriverMobileActionId[] = [
  'confirm_pickup',
  'send_status',
  'confirm_delivery',
  'submit_pod',
  'upload_photo',
  'contact_support',
];

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const action = body.action as DriverMobileActionId;
  const missionId = body.missionId || body.transportId;
  const userId = body.userId || request.headers.get('x-user-id');

  if (!action || !validActions.includes(action)) {
    return NextResponse.json(
      { error: 'INVALID_ACTION', message: `action must be one of: ${validActions.join(', ')}` },
      { status: 400 },
    );
  }

  if (!missionId || missionId.startsWith('mission_demo')) {
    return NextResponse.json({
      mission: applyDemoDriverAction(action),
      message: getDriverActionMessage(action),
      source: 'fallback',
      next: action === 'submit_pod' ? 'invoice_and_payout_ready' : 'driver_timeline_updated',
      invoicePreviewHref: `/api/orders/${missionId || 'mission_demo_hh_muc'}/invoice?amount=850`,
      orderDetailHref: `/orders/${missionId || 'mission_demo_hh_muc'}?focus=invoice`,
    });
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'x-user-id is required for real transport actions' },
      { status: 401 },
    );
  }

  try {
    const transport = await prisma.transport.findUnique({
      where: { id: missionId },
      include: {
        assignment: {
          include: {
            driver: true,
            vehicle: true,
          },
        },
        pickupAddress: true,
        deliveryAddress: true,
        documents: true,
        statusHistory: true,
      },
    });

    if (!transport || !transport.assignment) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Active transport assignment not found' },
        { status: 404 },
      );
    }

    const driver = await prisma.driver.findFirst({ where: { userId } });
    const isAdmin = request.headers.get('x-user-role') === 'ADMIN';
    const isAssignedDriver = driver?.id === transport.assignment.driverId;

    if (!isAdmin && !isAssignedDriver) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Only the assigned driver or admin can update this tour' },
        { status: 403 },
      );
    }

    const nextStatus = getStatusForDriverAction(action, transport.status);
    const timestamp = new Date();
    const note = body.note || getDriverActionMessage(action);

    await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        status: nextStatus,
      };

      if (nextStatus === 'PICKUP_DONE' || nextStatus === 'IN_TRANSIT') {
        updateData.pickedUpAt = transport.pickedUpAt || timestamp;
      }

      if (nextStatus === 'DELIVERY_DONE' || nextStatus === 'COMPLETED') {
        updateData.deliveredAt = transport.deliveredAt || timestamp;
      }

      if (nextStatus === 'COMPLETED') {
        updateData.completedAt = timestamp;
      }

      await tx.transport.update({
        where: { id: transport.id },
        data: updateData,
      });

      await tx.transportStatusHistory.create({
        data: {
          transportId: transport.id,
          status: nextStatus as any,
          changedBy: userId,
          note,
        },
      });

      if (body.location && driver?.id) {
        await tx.trackingPoint.create({
          data: {
            transportId: transport.id,
            driverId: driver.id,
            latitude: Number(body.location.latitude),
            longitude: Number(body.location.longitude),
            speed: body.location.speed ? Number(body.location.speed) : undefined,
            heading: body.location.heading ? Number(body.location.heading) : undefined,
          },
        });
      }

      if (action === 'upload_photo' || action === 'submit_pod') {
        await tx.document.create({
          data: {
            transportId: transport.id,
            type: action === 'submit_pod' ? 'pod' : 'foto_delivery',
            name: action === 'submit_pod' ? 'Proof of Delivery' : 'Delivery Photo',
            description: note,
            fileUrl: body.podUrl || body.photoUrl || `/uploads/mobile/${transport.id}/${Date.now()}.jpg`,
            mimeType: 'image/jpeg',
            isSigned: action === 'submit_pod',
            signedAt: action === 'submit_pod' ? timestamp : undefined,
            createdBy: userId,
          },
        });
      }
    });

    const updatedAssignment = await prisma.assignment.findUnique({
      where: { transportId: transport.id },
      include: {
        vehicle: true,
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
      },
    });

    return NextResponse.json({
      mission: updatedAssignment
        ? buildDriverMissionFromAssignment(updatedAssignment, transport.assignment.driver)
        : applyDemoDriverAction(action),
      message: getDriverActionMessage(action),
      source: 'database',
      next: action === 'submit_pod' ? 'invoice_and_payout_ready' : 'driver_timeline_updated',
      invoicePreviewHref: `/api/orders/${transport.id}/invoice`,
      orderDetailHref: `/orders/${transport.id}?focus=invoice`,
    });
  } catch (error) {
    console.error('[DriverMobileActionAPI] Failed:', error);
    return NextResponse.json({
      mission: applyDemoDriverAction(action),
      message: getDriverActionMessage(action),
      source: 'fallback',
      warning: 'Database unavailable, using mobile action fallback',
      next: action === 'submit_pod' ? 'invoice_and_payout_ready' : 'driver_timeline_updated',
      invoicePreviewHref: `/api/orders/${missionId || 'mission_demo_hh_muc'}/invoice?amount=850`,
      orderDetailHref: `/orders/${missionId || 'mission_demo_hh_muc'}?focus=invoice`,
    });
  }
}
