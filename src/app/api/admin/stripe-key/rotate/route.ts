/**
 * Rotate Stripe Key
 * POST /api/admin/stripe-key/rotate
 * 
 * Body: { newKey }
 * Stores new key in "next" slot for testing before promotion
 */

import { NextRequest, NextResponse } from 'next/server';
import { secretsService } from '@/services/secrets.service';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';

export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (admin) => {
    const body = await request.json();
    const { newKey } = body;

    if (!newKey) {
      return NextResponse.json(
        { error: 'New key is required' },
        { status: 400 }
      );
    }

    const result = await secretsService.rotateStripeKey(newKey, admin.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  }, [AdminRole.ADMIN]);
}
