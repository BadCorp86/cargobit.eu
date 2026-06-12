/**
 * CargoBit Disputes List API
 * GET /api/disputes - List disputes (admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-rbac';
import { disputeService } from '@/services/dispute.service';
import type { DisputeStatus } from '@prisma/client';

// ============================================
// GET /api/disputes
// ============================================

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as DisputeStatus | null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const disputes = await disputeService.getDisputes({
      status: status || undefined,
      limit,
      offset,
    });
    
    return NextResponse.json({
      disputes,
      limit,
      offset,
      total: disputes.length,
    });
  }, ['ADMIN', 'SUPPORT']);
}

export async function POST() {
  try {
    return NextResponse.json(
      { error: 'METHOD_NOT_AVAILABLE', message: 'Use /api/jobs/[id]/disputes to create a dispute for a transport.' },
      { status: 405 },
    );
  } catch (error: any) {
    console.error('[API] POST /disputes error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process dispute request' },
      { status: 500 }
    );
  }
}
