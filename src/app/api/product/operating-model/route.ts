import { NextRequest, NextResponse } from 'next/server';
import { getPlatformOperatingModel } from '@/lib/product-operating-model';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  return NextResponse.json({
    product: 'CargoBit Operating Model',
    positioning: 'Verifizierte DACH/Benelux-Transportabwicklung für kleine Gewerbe, Solo-Transporteure und Speditionen.',
    model: getPlatformOperatingModel(role),
  });
}
