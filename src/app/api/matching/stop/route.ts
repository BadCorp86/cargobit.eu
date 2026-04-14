import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { StopMatchingRequest, StopMatchingResponse, ApiErrorResponse } from '@/types/matching';

// POST /api/matching/stop - Stop matching for a transport
export async function POST(request: NextRequest) {
  try {
    const body: StopMatchingRequest = await request.json();

    if (!body.transportId) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'ValidationError',
        message: 'Missing required field: transportId',
        code: 'MISSING_TRANSPORT_ID'
      }, { status: 400 });
    }

    // Update all pending matching results
    const result = await prisma.matchingResult.updateMany({
      where: {
        transportId: body.transportId,
        status: 'PENDING'
      },
      data: {
        status: 'REJECTED'
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'MATCHING_STOPPED',
        entityType: 'Transport',
        entityId: body.transportId,
        newValue: JSON.stringify({
          reason: body.reason,
          affectedResults: result.count,
          stoppedAt: new Date().toISOString()
        })
      }
    }).catch(() => {});

    const matchingId = `match_${body.transportId}_${Date.now()}`;

    return NextResponse.json<StopMatchingResponse>({
      matchingId,
      status: 'stopped',
      stoppedAt: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('Stop matching error:', error);
    return NextResponse.json<ApiErrorResponse>({
      error: 'InternalServerError',
      message: 'Failed to stop matching',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
