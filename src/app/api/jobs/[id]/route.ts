/**
 * CargoBit Job Detail API Routes
 * GET   /api/jobs/[id]  - Get job details
 * PATCH /api/jobs/[id]  - Update job status
 * DELETE /api/jobs/[id] - Cancel job
 */

import { NextRequest, NextResponse } from 'next/server';
import { jobsService, type JobStatus } from '@/services/jobs.service';
import { requireRequestUser, type RequestUser } from '@/lib/request-user-auth';

// ============================================
// GET /api/jobs/[id] - Get job details
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;
    const user = auth.user as RequestUser;
    const userId = user.id;
    
    const { id } = await params;
    const roleHeader = resolveUserRolesForRequest(request, user);
    const job = await jobsService.getJob(id, userId, roleHeader);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found or access denied' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ job });
    
  } catch (error: any) {
    console.error('[API] GET /jobs/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job' },
      { status: 500 }
    );
  }
}

function resolveUserRolesForRequest(request: NextRequest, user: RequestUser) {
  if (user.roles.length > 0) return user.roles.join(',');

  if (process.env.NODE_ENV !== 'production') {
    return request.headers.get('x-user-role') || request.headers.get('x-user-roles') || '';
  }

  return '';
}

// ============================================
// PATCH /api/jobs/[id] - Update job status
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user!.id;
    
    const { id } = await params;
    const body = await request.json();
    
    const newStatus = body.status as JobStatus;
    const note = body.note;
    
    if (!newStatus) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      );
    }
    
    const validStatuses: JobStatus[] = [
      'open', 'matched', 'booked', 'in_progress', 'completed', 'canceled'
    ];
    
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Valid values: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }
    
    const result = await jobsService.updateJobStatus(id, newStatus, userId, note);
    
    return NextResponse.json({
      success: result.success,
      newStatus: result.newStatus,
    });
    
  } catch (error: any) {
    console.error('[API] PATCH /jobs/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update job' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/jobs/[id] - Cancel job
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user!.id;
    
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get('reason') || 'Canceled by user';
    
    const result = await jobsService.cancelJob(id, userId, reason);
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('[API] DELETE /jobs/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel job' },
      { status: 500 }
    );
  }
}
