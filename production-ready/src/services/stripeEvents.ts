/**
 * Stripe Event Handlers
 * 
 * Business logic for processing Stripe webhook events.
 * Each handler is idempotent and safe to retry.
 */

import Stripe from "stripe";

// ============================================
// Types
// ============================================

interface PaymentUpdate {
  stripePaymentId: string;
  status: "SUCCEEDED" | "FAILED" | "REFUNDED" | "CANCELLED";
  metadata?: Record<string, any>;
}

// ============================================
// Payment Handlers
// ============================================

/**
 * Handle successful payment
 */
export async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const { id, amount, currency, metadata } = paymentIntent;

  console.log(`[StripeEvent] Payment succeeded: ${id}`);
  console.log(`  Amount: ${amount} ${currency}`);
  console.log(`  Metadata:`, metadata);

  // TODO: Implement with your database
  // await prisma.payment.update({
  //   where: { stripePaymentId: id },
  //   data: {
  //     status: "SUCCEEDED",
  //     metadata: { ...metadata, processedAt: new Date().toISOString() },
  //   },
  // });

  // TODO: Send confirmation email
  // TODO: Update user balance/credits
  // TODO: Trigger any webhooks to your customers

  // Example: Write to audit log
  // await writeAuditLog({
  //   actor: "system",
  //   actorType: "WEBHOOK",
  //   action: "payment.succeeded",
  //   entity: "payment",
  //   entityId: id,
  //   metadata: { amount, currency },
  // });
}

/**
 * Handle failed payment
 */
export async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const { id, amount, currency, last_payment_error } = paymentIntent;

  console.log(`[StripeEvent] Payment failed: ${id}`);
  console.log(`  Reason:`, last_payment_error?.message);

  // TODO: Implement with your database
  // await prisma.payment.update({
  //   where: { stripePaymentId: id },
  //   data: {
  //     status: "FAILED",
  //     metadata: {
  //       error: last_payment_error?.message,
  //       errorCode: last_payment_error?.code,
  //       failedAt: new Date().toISOString(),
  //     },
  //   },
  // });

  // TODO: Notify customer of failed payment
  // TODO: Check if retry should be attempted
}

/**
 * Handle refund created
 */
export async function handleRefundCreated(charge: Stripe.Charge): Promise<void> {
  const { id, payment_intent, amount_refunded, amount, refunded } = charge;

  console.log(`[StripeEvent] Refund created for charge: ${id}`);
  console.log(`  Amount refunded: ${amount_refunded}`);

  if (refunded) {
    console.log(`[StripeEvent] Charge fully refunded`);

    // TODO: Update payment status
    // await prisma.payment.update({
    //   where: { stripePaymentId: payment_intent as string },
    //   data: { status: "REFUNDED" },
    // });
  }

  // TODO: Update internal refund tracking
  // TODO: Notify customer
}

// ============================================
// Subscription Handlers (if applicable)
// ============================================

/**
 * Handle subscription created
 */
export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<void> {
  console.log(`[StripeEvent] Subscription created: ${subscription.id}`);

  // TODO: Create subscription record in database
  // TODO: Set up billing reminders
  // TODO: Activate premium features
}

/**
 * Handle subscription updated
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  console.log(`[StripeEvent] Subscription updated: ${subscription.id}`);
  console.log(`  Status: ${subscription.status}`);

  // TODO: Update subscription record
  // TODO: Adjust feature access based on status
}

/**
 * Handle subscription deleted/cancelled
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  console.log(`[StripeEvent] Subscription deleted: ${subscription.id}`);

  // TODO: Mark subscription as cancelled
  // TODO: Schedule feature deactivation
  // TODO: Send cancellation confirmation email
}

// ============================================
// Invoice Handlers
// ============================================

/**
 * Handle invoice paid
 */
export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  console.log(`[StripeEvent] Invoice paid: ${invoice.id}`);

  // TODO: Update invoice status
  // TODO: Extend subscription if applicable
}

/**
 * Handle invoice payment failed
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  console.log(`[StripeEvent] Invoice payment failed: ${invoice.id}`);
  console.log(`  Attempt: ${invoice.attempt_count}`);

  // TODO: Notify customer
  // TODO: Retry logic
  // TODO: Dunning management
}

// ============================================
// Dispute Handlers
// ============================================

/**
 * Handle dispute created (chargeback)
 */
export async function handleDisputeCreated(
  dispute: Stripe.Dispute
): Promise<void> {
  console.warn(`[StripeEvent] DISPUTE CREATED: ${dispute.id}`);
  console.warn(`  Charge: ${dispute.charge}`);
  console.warn(`  Reason: ${dispute.reason}`);
  console.warn(`  Amount: ${dispute.amount}`);

  // URGENT: This is a chargeback - needs immediate attention
  // TODO: Alert the team (Slack, email, SMS)
  // TODO: Gather evidence for dispute
  // TODO: Update payment status
  // TODO: Consider suspending user account

  // await sendAlert({
  //   type: "dispute",
  //   severity: "high",
  //   message: `Dispute created for ${dispute.amount} ${dispute.currency}`,
  //   data: dispute,
  // });
}

/**
 * Handle dispute closed
 */
export async function handleDisputeClosed(
  dispute: Stripe.Dispute
): Promise<void> {
  console.log(`[StripeEvent] Dispute closed: ${dispute.id}`);
  console.log(`  Status: ${dispute.status}`);

  if (dispute.status === "won") {
    console.log(`[StripeEvent] Dispute WON - funds returned`);
  } else if (dispute.status === "lost") {
    console.log(`[StripeEvent] Dispute LOST - funds not returned`);
  }

  // TODO: Update payment status
  // TODO: Log for reporting
}

// ============================================
// Payout Handlers
// ============================================

/**
 * Handle payout created
 */
export async function handlePayoutCreated(payout: Stripe.Payout): Promise<void> {
  console.log(`[StripeEvent] Payout created: ${payout.id}`);
  console.log(`  Amount: ${payout.amount} ${payout.currency}`);
  console.log(`  Arrival: ${payout.arrival_date}`);

  // TODO: Record payout in database
  // TODO: Update balance tracking
}

/**
 * Handle payout paid
 */
export async function handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
  console.log(`[StripeEvent] Payout completed: ${payout.id}`);

  // TODO: Mark payout as completed
  // TODO: Reconcile with bank
}

/**
 * Handle payout failed
 */
export async function handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
  console.error(`[StripeEvent] Payout FAILED: ${payout.id}`);
  console.error(`  Failure message: ${payout.failure_message}`);

  // TODO: Alert team
  // TODO: Update payout status
  // TODO: Investigate cause
}

// ============================================
// Helper Functions
// ============================================

/**
 * Convert Stripe amount to decimal
 */
export function stripeAmountToDecimal(amount: number, currency: string): number {
  // Most currencies use 2 decimals, some use 0 (JPY) or 3 (BHD)
  const zeroDecimalCurrencies = ["JPY", "KRW", "VND"];
  const threeDecimalCurrencies = ["BHD", "JOD", "KWD"];

  if (zeroDecimalCurrencies.includes(currency.toUpperCase())) {
    return amount;
  }
  if (threeDecimalCurrencies.includes(currency.toUpperCase())) {
    return amount / 1000;
  }
  return amount / 100;
}

/**
 * Get user-friendly error message
 */
export function getPaymentErrorMessage(
  error: Stripe.LastPaymentError | null | undefined
): string {
  if (!error) {
    return "Payment failed for unknown reason";
  }

  const messages: Record<string, string> = {
    card_declined: "Your card was declined",
    insufficient_funds: "Insufficient funds in your account",
    lost_card: "This card has been reported lost",
    stolen_card: "This card has been reported stolen",
    expired_card: "This card has expired",
    incorrect_cvc: "The security code is incorrect",
    processing_error: "An error occurred while processing your card",
    incorrect_number: "The card number is incorrect",
  };

  return messages[error.code || ""] || error.message || "Payment failed";
}
