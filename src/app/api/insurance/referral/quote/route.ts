import { NextRequest, NextResponse } from 'next/server';
import { createInsuranceReferralQuote } from '@/lib/insurance/referral';
import { getOptionalRequestUser, requestUserHasAnyRole } from '@/lib/request-user-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requestUser = await getOptionalRequestUser(request);
    const bodyUserId = body.requestedByUserId ? String(body.requestedByUserId) : null;
    const canActForOtherUser = requestUser ? requestUserHasAnyRole(requestUser, ['ADMIN', 'SUPPORT']) : false;

    if (body.persistLead && !requestUser) {
      return NextResponse.json(
        {
          error: 'AUTH_REQUIRED',
          message: 'Bitte anmelden, damit die Versicherungsanfrage gespeichert werden kann.',
        },
        { status: 401 },
      );
    }

    if (bodyUserId && requestUser && bodyUserId !== requestUser.id && !canActForOtherUser) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'Sie dürfen keine Versicherungsanfrage für ein fremdes Konto erstellen.',
        },
        { status: 403 },
      );
    }

    const requestedByUserId = requestUser?.id || bodyUserId || null;

    const quote = await createInsuranceReferralQuote({
      transportId: body.transportId,
      requestedByUserId,
      requestedByRole: body.requestedByRole === 'CARRIER' ? 'CARRIER' : 'SHIPPER',
      source: body.source === 'CARRIER_ACCEPTANCE' ? 'CARRIER_ACCEPTANCE' : 'SHIPPER_CREATE',
      cargoDescription: body.cargoDescription,
      cargoValueEur: body.cargoValueEur,
      weightKg: body.weightKg,
      pickupCity: body.pickupCity,
      pickupCountry: body.pickupCountry,
      deliveryCity: body.deliveryCity,
      deliveryCountry: body.deliveryCountry,
      consentAccepted: Boolean(body.consentAccepted),
      persistLead: Boolean(body.persistLead),
      markRedirected: Boolean(body.markRedirected),
    });

    return NextResponse.json(quote);
  } catch (error) {
    console.error('[InsuranceReferral] quote error:', error);
    return NextResponse.json(
      {
        error: 'INSURANCE_REFERRAL_FAILED',
        message: 'Versicherungs-Lead konnte nicht erstellt werden.',
      },
      { status: 500 }
    );
  }
}
