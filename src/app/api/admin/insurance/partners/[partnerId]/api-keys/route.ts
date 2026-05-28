import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';
import { createPartnerApiKey, PARTNER_SCOPES } from '@/lib/partner-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> | { partnerId: string } }
) {
  return withAdminAuth(request, async (admin) => {
    const { partnerId } = await params;
    const body = await readBody(request);

    const partner = await prisma.partner.findFirst({
      where: {
        id: partnerId,
        type: 'INSURANCE',
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Insurance partner not found' }, { status: 404 });
    }

    const isTestKey = body.isTestKey !== false;
    const name = typeof body.name === 'string' && body.name.trim()
      ? body.name.trim()
      : isTestKey ? 'Insurance Test API Key' : 'Insurance Live API Key';
    const expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : undefined;
    const scopes = [
      PARTNER_SCOPES.INSURANCE_READ,
      PARTNER_SCOPES.INSURANCE_WRITE,
      PARTNER_SCOPES.BILLING_READ,
    ];

    const apiKey = await createPartnerApiKey(
      partnerId,
      name,
      scopes,
      isTestKey,
      expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : undefined
    );

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'INSURANCE_PARTNER_API_KEY_CREATED',
        entityType: 'insurance_partner',
        entityId: partnerId,
        dataAfter: JSON.stringify({
          name,
          apiKeyPrefix: apiKey.apiKeyPrefix,
          isTestKey,
          scopes,
          expiresAt: expiresAt?.toISOString() || null,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      partnerId,
      name,
      apiKey: apiKey.apiKey,
      apiKeyPrefix: apiKey.apiKeyPrefix,
      isTestKey,
      scopes,
      warning: 'Dieser API-Key wird nur einmal im Klartext angezeigt.',
    }, { status: 201 });
  }, [AdminRole.ADMIN]);
}

async function readBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
