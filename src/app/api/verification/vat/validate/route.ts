import { NextRequest, NextResponse } from 'next/server';
import { validateEuVatNumber } from '@/services/verification/vies.service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const result = await validateEuVatNumber({
    country: searchParams.get('country') || undefined,
    vatNumber: searchParams.get('vatNumber') || undefined,
  });

  return NextResponse.json({
    success: result.status === 'passed',
    vatCheck: result,
  }, { status: result.status === 'failed' ? 422 : 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await validateEuVatNumber({
      country: body.country,
      vatNumber: body.vatNumber,
    });

    return NextResponse.json({
      success: result.status === 'passed',
      vatCheck: result,
    }, { status: result.status === 'failed' ? 422 : 200 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'VAT_VALIDATION_FAILED',
        message: error instanceof Error ? error.message : 'VAT validation failed',
      },
      { status: 500 },
    );
  }
}
