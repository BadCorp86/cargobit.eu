import { NextRequest, NextResponse } from 'next/server';
import {
  getVerificationProviderOverview,
  startVerificationProvider,
} from '@/services/verification/providers';
import type {
  VerificationProviderName,
  VerificationProviderStartInput,
} from '@/services/verification/providers/types';
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
  const { searchParams } = new URL(request.url);
  const role = normalizeRole(searchParams.get('role')) || 'SHIPPER_PRIVATE';

  return NextResponse.json({
    success: true,
    overview: getVerificationProviderOverview({
      role,
      country: searchParams.get('country') || 'DE',
      vatNumber: searchParams.get('vatNumber') || undefined,
      highRisk: searchParams.get('highRisk') === 'true',
      estimatedOrderValueCents: Number(searchParams.get('estimatedOrderValueCents') || 0),
    }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const role = normalizeRole(body.role);
    const userId = body.userId || request.headers.get('x-user-id');

    if (!role || !userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_REQUEST',
          message: 'userId and role are required',
        },
        { status: 400 },
      );
    }

    const result = await startVerificationProvider({
      provider: normalizeProvider(body.provider),
      userId,
      role,
      country: body.country || 'DE',
      companyId: body.companyId,
      vatNumber: body.vatNumber,
      documents: body.documents || [],
      capabilities: body.capabilities || {},
      returnUrl: body.returnUrl,
    } as VerificationProviderStartInput);

    return NextResponse.json({
      success: result.status === 'ready',
      provider: result,
    }, { status: result.status === 'ready' ? 200 : 202 });
  } catch (error) {
    console.error('[VerificationProviderStartAPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'PROVIDER_START_FAILED',
        message: error instanceof Error ? error.message : 'Provider start failed',
      },
      { status: 500 },
    );
  }
}

function normalizeRole(role?: string | null): VerificationRole | null {
  if (!role) return null;
  const normalized = role.toUpperCase() as VerificationRole;
  return VALID_ROLES.includes(normalized) ? normalized : null;
}

function normalizeProvider(provider?: string): VerificationProviderName | undefined {
  if (provider === 'local' || provider === 'sumsub' || provider === 'veriff' || provider === 'idnow') {
    return provider;
  }

  return undefined;
}
