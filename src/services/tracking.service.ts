/**
 * CargoBit Tracking Service
 *
 * Central tracking logic for Transport, Assignment, Driver and TrackingPoint.
 * Redis/WebSocket publishing is best-effort so GPS writes do not fail when
 * Redis is not available in local/test environments.
 */

import { prisma } from '@/lib/db';
import type { TransportStatus } from '@prisma/client';
import { broadcastJobStatusWithMetadata, broadcastTrackingUpdate } from './redis-publisher.service';

export interface UpdateStatusRequest {
  status: TransportStatus;
  eventType?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
}

export interface TrackingLocationInput {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

const ACTIVE_TRACKING_STATUSES: TransportStatus[] = ['ASSIGNED', 'PICKUP_DONE', 'IN_TRANSIT', 'DELIVERY_DONE'];

export async function updateJobStatus(
  jobId: string,
  userId: string,
  req: UpdateStatusRequest,
): Promise<{ success: boolean; status?: TransportStatus; error?: string }> {
  const transport = await prisma.transport.findUnique({
    where: { id: jobId },
    include: { assignment: true },
  });

  if (!transport) return { success: false, error: 'Job not found' };

  const driver = await prisma.driver.findFirst({ where: { userId } });
  const isAssignedDriver = Boolean(driver && transport.assignment?.driverId === driver.id);

  if (!isAssignedDriver) return { success: false, error: 'Not authorized to update this job' };

  const validTransitions: Record<TransportStatus, TransportStatus[]> = {
    CREATED: ['PUBLISHED', 'CANCELLED'],
    PUBLISHED: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['PICKUP_DONE', 'IN_TRANSIT', 'CANCELLED'],
    PICKUP_DONE: ['IN_TRANSIT', 'DELIVERY_DONE', 'COMPLETED'],
    IN_TRANSIT: ['DELIVERY_DONE', 'COMPLETED', 'CANCELLED'],
    DELIVERY_DONE: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  if (!validTransitions[transport.status].includes(req.status)) {
    return { success: false, error: `Invalid status transition: ${transport.status} -> ${req.status}` };
  }

  const timestamp = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.transport.update({
      where: { id: jobId },
      data: {
        status: req.status,
        ...(req.status === 'PICKUP_DONE' || req.status === 'IN_TRANSIT' ? { pickedUpAt: transport.pickedUpAt || timestamp } : {}),
        ...(req.status === 'DELIVERY_DONE' ? { deliveredAt: transport.deliveredAt || timestamp } : {}),
        ...(req.status === 'COMPLETED' ? { completedAt: timestamp, deliveredAt: transport.deliveredAt || timestamp } : {}),
        ...(req.status === 'CANCELLED' ? { cancelledAt: timestamp } : {}),
      },
    });

    await tx.transportStatusHistory.create({
      data: {
        transportId: jobId,
        status: req.status,
        changedBy: userId,
        note: req.description,
      },
    });

    if (typeof req.latitude === 'number' && typeof req.longitude === 'number' && driver) {
      await tx.trackingPoint.create({
        data: {
          transportId: jobId,
          driverId: driver.id,
          latitude: req.latitude,
          longitude: req.longitude,
        },
      });
    }

    return updated;
  });

  await safeBroadcastJobStatus(jobId, req.status, {
    previousStatus: transport.status,
    eventType: req.eventType,
    description: req.description,
  });

  return { success: true, status: result.status };
}

export async function createJobEvent(
  jobId: string,
  userId: string,
  data: {
    type: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const status = data.type === 'delivery' ? 'DELIVERY_DONE' : data.type === 'pickup' ? 'PICKUP_DONE' : 'IN_TRANSIT';
  const result = await updateJobStatus(jobId, userId, {
    status,
    eventType: data.type,
    description: data.description,
    latitude: data.latitude,
    longitude: data.longitude,
  });

  return result.success
    ? { success: true, eventId: `${jobId}:${data.type}:${Date.now()}` }
    : { success: false, error: result.error };
}

export async function getJobTimeline(jobId: string) {
  const [statusHistory, trackingPoints] = await Promise.all([
    prisma.transportStatusHistory.findMany({
      where: { transportId: jobId },
      orderBy: { changedAt: 'asc' },
    }),
    prisma.trackingPoint.findMany({
      where: { transportId: jobId },
      orderBy: { timestamp: 'asc' },
      take: 200,
    }),
  ]);

  return {
    events: trackingPoints.map((point) => ({
      id: point.id,
      type: 'tracking_update',
      description: 'GPS tracking update',
      location: { lat: point.latitude, lng: point.longitude },
      metadata: {
        speed: point.speed,
        heading: point.heading,
        accuracy: point.accuracy,
      },
      createdAt: point.timestamp,
    })),
    statusHistory: statusHistory.map((item) => ({
      status: item.status,
      changedBy: item.changedBy,
      note: item.note,
      changedAt: item.changedAt,
    })),
  };
}

export async function updateTracking(
  jobId: string,
  driverId: string,
  latitude: number,
  longitude: number,
  options?: { speed?: number; heading?: number; accuracy?: number },
): Promise<{ success: boolean; pointId?: string; error?: string }> {
  if (!isValidCoordinate(latitude, longitude)) {
    return { success: false, error: 'Invalid coordinates' };
  }

  const assignment = await prisma.assignment.findFirst({
    where: { transportId: jobId, driverId },
    include: {
      transport: true,
      driver: true,
      vehicle: true,
    },
  });

  if (!assignment) return { success: false, error: 'Not assigned to this job' };

  if (!ACTIVE_TRACKING_STATUSES.includes(assignment.transport.status)) {
    return { success: false, error: 'Tracking is not active for this job status' };
  }

  const timestamp = new Date();
  const currentLocation = JSON.stringify({
    lat: latitude,
    lng: longitude,
    timestamp: timestamp.toISOString(),
    accuracy: options?.accuracy,
  });

  const point = await prisma.$transaction(async (tx) => {
    const created = await tx.trackingPoint.create({
      data: {
        transportId: jobId,
        driverId,
        latitude,
        longitude,
        speed: options?.speed,
        heading: options?.heading,
        accuracy: options?.accuracy,
        timestamp,
      },
    });

    await tx.driver.update({
      where: { id: driverId },
      data: { currentLocation },
    });

    await tx.vehicle.update({
      where: { id: assignment.vehicleId },
      data: { currentLocation },
    });

    return created;
  });

  await safeBroadcastTracking({
    jobId,
    driverId,
    latitude,
    longitude,
    speed: options?.speed,
    heading: options?.heading,
    accuracy: options?.accuracy,
  });

  return { success: true, pointId: point.id };
}

function isValidCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

async function safeBroadcastTracking(payload: {
  jobId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
}) {
  try {
    await broadcastTrackingUpdate(payload);
  } catch (error) {
    console.warn('[TrackingService] Redis tracking broadcast skipped:', error instanceof Error ? error.message : error);
  }
}

async function safeBroadcastJobStatus(jobId: string, status: TransportStatus, metadata?: Record<string, unknown>) {
  try {
    await broadcastJobStatusWithMetadata({ id: jobId, status }, metadata || {});
  } catch (error) {
    console.warn('[TrackingService] Redis status broadcast skipped:', error instanceof Error ? error.message : error);
  }
}

export const trackingService = {
  updateJobStatus,
  createJobEvent,
  getJobTimeline,
  updateTracking,
};
