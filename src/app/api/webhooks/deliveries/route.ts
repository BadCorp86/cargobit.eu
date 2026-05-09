/**
 * CargoBit Webhook Deliveries API Route
 * 
 * Next.js API route for /api/webhooks/deliveries
 */

import { NextRequest, NextResponse } from 'next/server';
import { GET_deliveries } from '@/webhooks/controllers/webhooks.controller';

export async function GET(request: NextRequest) {
  return GET_deliveries(request);
}
