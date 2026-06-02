/**
 * Promote Stripe Key
 * POST /api/admin/stripe-key/promote
 * 
 * Moves the "next" key to "active" slot
 */

import { NextRequest, NextResponse } from 'next/server';
import { secretsService } from '@/services/secrets.service';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';

export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (admin) => {
    const result = await secretsService.promoteStripeKey(admin.id);

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
