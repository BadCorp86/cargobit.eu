import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/request-user-auth';
import { getVerificationProviderOverview } from '@/services/verification/providers';
import type { VerificationRole } from '@/services/verification-workflow.service';

const VALID_ROLES: VerificationRole[] = [
  'SHIPPER_PRIVATE',
  'SHIPPER_COMPANY',
  'CARRIER',
  'DISPATCHER',
  'DRIVER_SELF_EMPLOYED',
  'ADMIN',
  'SUPPORT',
  'MARKETER',
];

export async function GET(request: NextRequest) {
  const auth = await requireRequestUser(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const role = normalizeRole(searchParams.get('role'));

  if (!role) {
    return NextResponse.json(
      {
        success: false,
        error: 'INVALID_ROLE',
        message: 'role is required',
      },
      { status: 400 },
    );
  }

  const overview = getVerificationProviderOverview({
    role,
    country: searchParams.get('country') || 'DE',
    vatNumber: searchParams.get('vatNumber') || undefined,
    highRisk: searchParams.get('highRisk') === 'true',
    estimatedOrderValueCents: Number(searchParams.get('estimatedOrderValueCents') || 0),
  });

  return NextResponse.json({
    success: true,
    role,
    overview,
  });
}

function normalizeRole(role?: string | null): VerificationRole | null {
  if (!role) return null;
  const normalized = role.toUpperCase() as VerificationRole;
  return VALID_ROLES.includes(normalized) ? normalized : null;
}
