/**
 * CargoBit Webhook Statistics API Route
 * 
 * Next.js API route for /api/webhooks/statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { GET_statistics } from '@/webhooks/controllers/webhooks.controller';

export async function GET(request: NextRequest) {
  return GET_statistics(request);
}
