import { NextRequest, NextResponse } from 'next/server';
import { createInsuranceReferralQuote } from '@/lib/insurance/referral';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requestedByUserId = request.headers.get('x-user-id') || body.requestedByUserId || null;

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
