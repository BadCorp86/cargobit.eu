/**
 * CargoBit Webhook API Route - Single Webhook
 * 
 * Next.js API route for /api/webhooks/[id]
 * 
 * @module @cargobit/webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  GET_webhook,
  PUT_webhook,
  DELETE_webhook,
} from '@/webhooks/controllers/webhooks.controller';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return GET_webhook(request, { params });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return PUT_webhook(request, { params });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return DELETE_webhook(request, { params });
}
