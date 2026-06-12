/**
 * CargoBit Dispute Resolution API
 * POST /api/disputes/[id]/resolve - Admin resolves dispute
 * GET /api/disputes/[id] - Get dispute details
 * 
 * Python equivalent:
 * @router.post("/disputes/{dispute_id}/resolve")
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-rbac';
import { disputeService, type DisputeAction } from '@/services/dispute.service';

// ============================================
// POST /api/disputes/[id]/resolve
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(request, async (admin) => {
    const { id: disputeId } = await params;
    const body = await request.json();
    
    // Validate request
    const { action, resolution, refundAmountCents } = body as {
      action: DisputeAction;
      resolution: string;
      refundAmountCents?: number;
    };
    
    if (!action || !resolution) {
      return NextResponse.json(
        { error: 'action and resolution are required' },
        { status: 400 }
      );
    }
    
    // Python: resolve_dispute(...)
    const result = await disputeService.resolveDispute(disputeId, admin.id, {
      action,
      resolution,
      refundAmountCents,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    // Python: return {"status": d.status}
    return NextResponse.json({
      status: result.status,
      dispute_id: disputeId,
    });
  }, ['ADMIN', 'SUPPORT']);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return POST(request, context);
}

// ============================================
// GET /api/disputes/[id]
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(request, async () => {
    try {
      const { id: disputeId } = await params;

      const dispute = await disputeService.getDisputeById(disputeId);

      if (!dispute) {
        return NextResponse.json(
          { error: 'Dispute not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(dispute);
    } catch (error: any) {
      console.error('[API] GET /disputes/[id] error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to get dispute' },
        { status: 500 }
      );
    }
  }, ['ADMIN', 'SUPPORT']);
}
