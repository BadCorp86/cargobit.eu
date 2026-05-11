/**
 * CargoBit Stripe Webhook API Route
 * 
 * POST /api/webhooks/stripe
 * 
 * Stripe calls this endpoint for all payment events.
 * This is the source of truth for wallet operations.
 * 
 * Python equivalent:
 * ```python
 * @webhook_router.post("/stripe/webhook")
 * async def stripe_webhook(request: Request):
 *     payload = await request.body()
 *     sig_header = request.headers.get("Stripe-Signature")
 * 
 *     event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
 * 
 *     if event["type"] == "payment_intent.succeeded":
 *         handle_pi_succeeded(event["data"]["object"])
 *     elif event["type"] == "charge.refunded":
 *         handle_charge_refunded(event["data"]["object"])
 * 
 *     return {"received": True}
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { dispatchStripeEvent, StripeEvent } from '@/services/stripe-webhook.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    
    // Parse the Stripe event
    let event: StripeEvent;
    try {
      event = JSON.parse(body) as StripeEvent;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    const result = await dispatchStripeEvent(event);
    
    if (result.success) {
      return NextResponse.json({ received: true });
    } else {
      return NextResponse.json(
        { error: result.error || 'Webhook processing failed' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[StripeWebhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Stripe webhooks need raw body - disable body parsing
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
