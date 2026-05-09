/**
 * CargoBit Webhook Event Types API Route
 * 
 * Next.js API route for /api/webhooks/event-types
 */

import { NextRequest, NextResponse } from 'next/server';
import { GET_event_types } from '@/webhooks/controllers/webhooks.controller';

export async function GET(request: NextRequest) {
  return GET_event_types(request);
}
