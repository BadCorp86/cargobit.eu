/**
 * CargoBit Job Status API
 * POST /api/jobs/[id]/status - Update job status
 * 
 * Python equivalent:
 * @router.post("/jobs/{job_id}/status")
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOptionalAdmin } from '@/lib/request-admin-auth';
import { trackingService } from '@/services/tracking.service';
import { requireRequestUser } from '@/lib/request-user-auth';
import type { TransportStatus, JobEventType } from '@prisma/client';

// ============================================
// POST /api/jobs/[id]/status
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user!.id;
    
    const { id: jobId } = await params;
    const body = await request.json();
    
    // Validate request
    const { status, eventType, description, latitude, longitude } = body as {
      status: TransportStatus;
      eventType?: JobEventType;
      description?: string;
      latitude?: number;
      longitude?: number;
    };
    
    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }
    
    // Python: update_status(...)
    const result = await trackingService.updateJobStatus(jobId, userId, {
      status,
      eventType,
      description,
      latitude,
      longitude,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    // Python: return {"status": job.status}
    return NextResponse.json({
      status: result.status,
      job_id: jobId,
      event_type: eventType,
    });
    
  } catch (error: any) {
    console.error('[API] POST /jobs/[id]/status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update status' },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/jobs/[id]/status - Get timeline
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const auth = await canReadJobTimeline(request, jobId);
    if (!auth.allowed) {
      return NextResponse.json(
        { error: auth.code, message: auth.message },
        { status: auth.status },
      );
    }
    
    const timeline = await trackingService.getJobTimeline(jobId);
    
    return NextResponse.json(timeline);
    
  } catch (error: any) {
    console.error('[API] GET /jobs/[id]/status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get timeline' },
      { status: 500 }
    );
  }
}

async function canReadJobTimeline(request: NextRequest, jobId: string) {
  if (process.env.NODE_ENV !== 'production' && isDemoJob(jobId)) {
    return { allowed: true, status: 200, code: null, message: null };
  }

  const admin = await getOptionalAdmin(request);
  if (admin && ['ADMIN', 'SUPPORT'].includes(admin.role)) {
    return { allowed: true, status: 200, code: null, message: null };
  }

  const auth = await requireRequestUser(request);
  if (auth.response || !auth.user) {
    return {
      allowed: false,
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'Authentifizierung erforderlich',
    };
  }

  const transport = await prisma.transport.findUnique({
    where: { id: jobId },
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

  if (transport.shipperUserId === auth.user.id || transport.assignment?.driver.userId === auth.user.id) {
    return { allowed: true, status: 200, code: null, message: null };
  }

  if (transport.assignment?.driver.companyId) {
    const companyUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId: transport.assignment.driver.companyId,
          userId: auth.user.id,
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
    message: 'Keine Berechtigung für die Statusdaten dieses Auftrags',
  };
}

function isDemoJob(id: string) {
  return id.startsWith('mission_demo') || id.startsWith('demo') || id.startsWith('TR-');
}
