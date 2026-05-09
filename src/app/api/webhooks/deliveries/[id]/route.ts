/**
 * CargoBit Webhook Delivery API Route
 * 
 * Next.js API route for /api/webhooks/deliveries/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { GET_delivery } from '@/webhooks/controllers/webhooks.controller';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return GET_delivery(request, { params });
}
