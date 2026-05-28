import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasAnyScope, PARTNER_SCOPES, verifyPartnerApiKey } from '@/lib/partner-auth';
import {
  normalizeInsuranceReferralLeadStatus,
  updateInsuranceReferralLeadStatus,
} from '@/lib/insurance/referral';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  const leadId = typeof body.leadId === 'string' ? body.leadId.trim() : '';
  const status = normalizeInsuranceReferralLeadStatus(body.status || body.event || body.type);

  if (!leadId) {
    return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
  }

  if (!status) {
    return NextResponse.json(
      { error: 'Valid status or event is required' },
      { status: 400 }
    );
  }

  const authResult = await verifyWebhookAccess(request, leadId);
  if (authResult instanceof NextResponse) return authResult;

  const externalReference =
    body.externalReference ||
    body.policyNumber ||
    body.contractNumber ||
    body.partnerReference ||
    null;

  const lead = await updateInsuranceReferralLeadStatus(leadId, {
    status,
    externalReference: typeof externalReference === 'string' ? externalReference.trim() : null,
    premiumEur: toOptionalNumber(body.premiumEur || body.premium || body.finalPremiumEur),
    commissionEur: toOptionalNumber(body.commissionEur || body.commission || body.partnerCommissionEur),
    convertedAt: body.convertedAt,
    actorType: authResult?.type === 'partner_api_key' ? 'PARTNER' : 'WEBHOOK',
    actorId: authResult?.session?.partnerId || null,
    metadata: {
      source: 'insurance_webhook',
      authenticatedBy: authResult?.type || 'webhook_secret',
      apiKeyId: authResult?.session?.apiKeyId || null,
    },
  });

  if (!lead) {
    return NextResponse.json({ error: 'Insurance lead not found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    mode: 'partner_lead',
    leadId: lead.id,
    status: lead.status,
    externalReference: lead.externalReference,
    authenticatedBy: authResult?.type || 'webhook_secret',
  });
}

async function verifyWebhookAccess(request: NextRequest, leadId: string) {
  const partnerApiKey = getPartnerApiKey(request);

  if (partnerApiKey) {
    const session = await verifyPartnerApiKey(partnerApiKey);

    if (!session) {
      return NextResponse.json({ error: 'Invalid partner API key' }, { status: 401 });
    }

    if (!hasAnyScope(session, [PARTNER_SCOPES.INSURANCE_WRITE])) {
      return NextResponse.json(
        { error: 'Insufficient partner scope', required: [PARTNER_SCOPES.INSURANCE_WRITE] },
        { status: 403 }
      );
    }

    const lead = await db.insuranceReferralLead.findFirst({
      where: {
        id: leadId,
        partnerId: session.partnerId,
      },
      select: { id: true },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Insurance lead not found for partner' }, { status: 404 });
    }

    return { type: 'partner_api_key', session };
  }

  const authError = verifyWebhookSecret(request);
  if (authError) return authError;

  return { type: 'webhook_secret' };
}

function getPartnerApiKey(request: NextRequest) {
  const xApiKey = request.headers.get('x-api-key');
  if (xApiKey) return xApiKey;

  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.replace(/^Bearer\s+/i, '').trim();
  return bearer.startsWith('cb_partner_') ? bearer : null;
}

function verifyWebhookSecret(request: NextRequest) {
  const configuredSecret = process.env.INSURANCE_WEBHOOK_SECRET;
  const providedSecret =
    request.headers.get('x-insurance-webhook-secret') ||
    request.headers.get('x-webhook-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';

  if (!configuredSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Insurance webhook secret is not configured' },
      { status: 503 }
    );
  }

  if (configuredSecret && providedSecret !== configuredSecret) {
    return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
  }

  return null;
}

async function readBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function toOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
