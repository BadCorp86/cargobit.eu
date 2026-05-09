/**
 * CargoBit Webhook API Route
 * 
 * Next.js API route for /api/webhooks
 * 
 * @module @cargobit/webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  GET_webhooks,
  POST_webhooks,
} from '@/webhooks/controllers/webhooks.controller';

export async function GET(request: NextRequest) {
  return GET_webhooks(request);
}

export async function POST(request: NextRequest) {
  return POST_webhooks(request);
}
