/**
 * CargoBit Webhook Delivery Replay API Route
 * 
 * Next.js API route for /api/webhooks/deliveries/[id]/replay
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST_delivery_replay } from '@/webhooks/controllers/webhooks.controller';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return POST_delivery_replay(request, { params });
}
