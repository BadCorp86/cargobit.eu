import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PlanName } from '@prisma/client';
import { db } from '@/lib/db';
import { getBillingPlan, normalizeBillingPlan } from '@/lib/billing/plans';
import { getSubscriptionWebhookSecret } from '@/lib/stripe-readiness';
import { sendTransactionalEmail } from '@/lib/email/sendgrid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StripeWebhookEvent {
  id: string;
  type: string;
  created?: number;
  data: {
    object: StripeObject;
  };
}

interface StripeObject {
  id: string;
  object?: string;
  amount?: number;
  amount_paid?: number;
  amount_total?: number;
  amount_due?: number;
  subtotal?: number;
  total?: number;
  tax?: number;
  number?: string;
  currency?: string;
  status?: string;
  payment_status?: string;
  customer?: string;
  subscription?: string | { id: string };
  current_period_end?: number;
  period_start?: number;
  period_end?: number;
  cancel_at_period_end?: boolean;
  latest_invoice?: string | { id: string };
  hosted_invoice_url?: string;
  invoice_pdf?: string;
  created?: number;
  due_date?: number;
  status_transitions?: {
    paid_at?: number;
  };
  metadata?: Record<string, string>;
  client_reference_id?: string;
  payment_intent?: string;
  last_payment_error?: {
    message?: string;
  };
}

interface WebhookActionResult {
  success: boolean;
  action: string;
  message: string;
  userId?: string;
  companyId?: string;
  plan?: string;
}

const SUBSCRIPTION_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
];

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/stripe/webhook',
    purpose: 'Stripe checkout, subscription, invoice and wallet webhook receiver',
    stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecretConfigured: Boolean(getSubscriptionWebhookSecret()),
    webhookSecretEnv: process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET
      ? 'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET'
      : 'STRIPE_WEBHOOK_SECRET',
    acceptedEvents: SUBSCRIPTION_EVENTS,
    localFallback: process.env.NODE_ENV !== 'production',
  });
}

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') || '';
  const verification = verifyStripeEvent(payload, signature);

  if (!verification.valid || !verification.event) {
    return NextResponse.json(
      {
        error: 'SignatureVerificationError',
        message: verification.error || 'Invalid Stripe webhook signature',
      },
      { status: 400 },
    );
  }

  const event = verification.event;

  try {
    const duplicate = await isStripeEventAlreadyProcessed(event.id);
    if (duplicate) {
      return NextResponse.json({
        received: true,
        duplicate: true,
        processed: true,
      });
    }

    await recordStripeEvent(event, false);
    const result = await dispatchStripeEvent(event);
    await markStripeEventProcessed(event.id, result);

    return NextResponse.json({
      received: true,
      processed: result.success,
      action: result.action,
      message: result.message,
      userId: result.userId,
      companyId: result.companyId,
      plan: result.plan,
      source: 'database',
    });
  } catch (error) {
    console.error('[StripeWebhook] Processing failed:', error);

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(createDevelopmentFallback(event, error));
    }

    return NextResponse.json(
      {
        error: 'InternalServerError',
        message: 'Webhook processing failed. Stripe should retry this event.',
      },
      { status: 500 },
    );
  }
}

function verifyStripeEvent(payload: string, signature: string): {
  valid: boolean;
  event?: StripeWebhookEvent;
  error?: string;
} {
  const webhookSecret = getSubscriptionWebhookSecret();

  if (webhookSecret) {
    if (!signature) {
      return { valid: false, error: 'Missing stripe-signature header' };
    }

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_signature_verification_only');
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return { valid: true, event: normalizeStripeEvent(event) };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Stripe signature verification failed',
      };
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return { valid: false, error: 'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET is required in production' };
  }

  try {
    const event = JSON.parse(payload) as StripeWebhookEvent;
    if (!event.id || !event.type || !event.data?.object?.id) {
      return { valid: false, error: 'Invalid Stripe event shape' };
    }
    return { valid: true, event };
  } catch {
    return { valid: false, error: 'Invalid JSON payload' };
  }
}

function normalizeStripeEvent(event: Stripe.Event): StripeWebhookEvent {
  return {
    id: event.id,
    type: event.type,
    created: event.created,
    data: {
      object: event.data.object as StripeObject,
    },
  };
}

async function isStripeEventAlreadyProcessed(eventId: string) {
  const setting = await db.systemSetting.findUnique({
    where: { key: stripeEventKey(eventId) },
  });

  if (!setting) return false;

  try {
    const value = JSON.parse(setting.value) as { processed?: boolean };
    return Boolean(value.processed);
  } catch {
    return true;
  }
}

async function recordStripeEvent(event: StripeWebhookEvent, processed: boolean) {
  await db.systemSetting.upsert({
    where: { key: stripeEventKey(event.id) },
    create: {
      key: stripeEventKey(event.id),
      description: 'Stripe webhook idempotency and processing log',
      value: JSON.stringify({
        id: event.id,
        type: event.type,
        processed,
        receivedAt: new Date().toISOString(),
      }),
    },
    update: {
      value: JSON.stringify({
        id: event.id,
        type: event.type,
        processed,
        receivedAt: new Date().toISOString(),
      }),
    },
  });
}

async function markStripeEventProcessed(eventId: string, result: WebhookActionResult) {
  await db.systemSetting.update({
    where: { key: stripeEventKey(eventId) },
    data: {
      value: JSON.stringify({
        id: eventId,
        processed: result.success,
        processedAt: new Date().toISOString(),
        result,
      }),
    },
  });
}

async function dispatchStripeEvent(event: StripeWebhookEvent): Promise<WebhookActionResult> {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(event);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return handleSubscriptionUpsert(event);
    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(event);
    case 'invoice.payment_succeeded':
      return handleInvoicePaymentSucceeded(event);
    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(event);
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(event);
    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(event);
    default:
      await db.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'stripe_webhook',
          entityId: event.id,
          dataAfter: JSON.stringify({ type: event.type, ignored: true }),
        },
      });
      return {
        success: true,
        action: 'ignored',
        message: `Unhandled Stripe event type: ${event.type}`,
      };
  }
}

async function handleCheckoutSessionCompleted(event: StripeWebhookEvent): Promise<WebhookActionResult> {
  const session = event.data.object;
  const metadata = session.metadata || {};

  if (metadata.type === 'wallet_topup') {
    return handleWalletTopupCheckoutCompleted(event);
  }

  const userId = metadata.userId || session.client_reference_id;
  const companyId = metadata.companyId;
  const plan = metadata.plan;
  const billingCycle = metadata.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;

  if (!userId || !plan) {
    return {
      success: true,
      action: 'checkout_missing_metadata',
      message: 'Checkout session completed without CargoBit subscription metadata',
    };
  }

  const periodEnd = calculateFallbackPeriodEnd(billingCycle);
  const activation = await activateCompanyPlan({
    userId,
    companyId,
    plan,
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
    stripeCheckoutSessionId: session.id,
    status: session.status || 'complete',
    validTo: periodEnd,
    sourceEventId: event.id,
    billingCycle,
  });

  return {
    success: true,
    action: 'subscription_checkout_activated',
    message: `Subscription checkout activated ${activation.plan}`,
    userId: activation.userId,
    companyId: activation.companyId,
    plan: activation.plan,
  };
}

async function handleWalletTopupCheckoutCompleted(event: StripeWebhookEvent): Promise<WebhookActionResult> {
  const session = event.data.object;
  const metadata = session.metadata || {};
  const userId = metadata.userId || session.client_reference_id;
  const metadataWalletId = metadata.walletId;
  const amountCents = Number(metadata.amountCents || session.amount_total || session.amount_paid || session.total || 0);

  if (session.payment_status && session.payment_status !== 'paid') {
    return {
      success: true,
      action: 'wallet_topup_checkout_not_paid',
      message: `Wallet topup checkout ignored because payment_status is ${session.payment_status}`,
      userId,
    };
  }

  if (!userId || !amountCents || amountCents < 1) {
    return {
      success: true,
      action: 'wallet_topup_checkout_missing_metadata',
      message: 'Checkout session completed without usable CargoBit wallet topup metadata',
    };
  }

  const currency = String(session.currency || 'EUR').toUpperCase();
  const amount = amountCents / 100;
  let wallet = await db.wallet.findFirst({
    where: metadataWalletId
      ? { id: metadataWalletId, ownerUserId: userId }
      : { ownerUserId: userId },
  });

  if (!wallet) {
    if (metadataWalletId) {
      return {
        success: false,
        action: 'wallet_topup_wallet_mismatch',
        message: 'Checkout wallet metadata does not belong to the CargoBit user.',
        userId,
      };
    }

    wallet = await db.wallet.create({
      data: {
        ownerUserId: userId,
        balance: 0,
        reservedBalance: 0,
        currency,
        status: 'ACTIVE',
      },
    });
  }

  const existingTransaction = await db.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      reference: session.id,
      type: 'DEPOSIT',
    },
  });

  let credited = false;
  if (!existingTransaction?.processedAt) {
    await db.$transaction(async (tx) => {
      if (existingTransaction) {
        await tx.walletTransaction.update({
          where: { id: existingTransaction.id },
          data: {
            amount,
            currency,
            description: 'Zahlungsschutz-Aufladung via Stripe Checkout',
            processedAt: new Date(),
          },
        });
      } else {
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEPOSIT',
            amount,
            currency,
            description: 'Zahlungsschutz-Aufladung via Stripe Checkout',
            reference: session.id,
            processedAt: new Date(),
          },
        });
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: amount },
          totalDeposited: { increment: amount },
        },
      });
    });

    credited = true;
  }

  if (credited) {
    await db.notification.create({
      data: {
        userId,
        type: 'WALLET_TOPUP',
        title: 'Zahlungsschutz aufgeladen',
        message: `Ihr Zahlungsschutz-Konto wurde um ${formatMoney(amount, currency)} aufgeladen.`,
        data: JSON.stringify({
          checkoutSessionId: session.id,
          eventId: event.id,
        }),
      },
    });
  }

  return {
    success: true,
    action: credited ? 'wallet_topup_checkout_credited' : 'wallet_topup_checkout_duplicate',
    message: 'Wallet topup checkout processed',
    userId,
  };
}

async function handleSubscriptionUpsert(event: StripeWebhookEvent): Promise<WebhookActionResult> {
  const subscription = event.data.object;
  const metadata = subscription.metadata || {};
  const userId = metadata.userId;
  const companyId = metadata.companyId;
  const plan = metadata.plan;
  const billingCycle = metadata.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : calculateFallbackPeriodEnd(billingCycle);
  const latestInvoiceId = typeof subscription.latest_invoice === 'string'
    ? subscription.latest_invoice
    : subscription.latest_invoice?.id;

  if (!userId || !plan) {
    return {
      success: true,
      action: 'subscription_missing_metadata',
      message: 'Subscription event has no CargoBit metadata. Checkout session event may handle activation.',
    };
  }

  const activation = await activateCompanyPlan({
    userId,
    companyId,
    plan,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : undefined,
    latestInvoiceId,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    status: subscription.status || 'active',
    validTo: periodEnd,
    sourceEventId: event.id,
    billingCycle,
  });

  return {
    success: true,
    action: 'subscription_upserted',
    message: `Subscription ${subscription.id} synced`,
    userId: activation.userId,
    companyId: activation.companyId,
    plan: activation.plan,
  };
}

async function handleSubscriptionDeleted(event: StripeWebhookEvent): Promise<WebhookActionResult> {
  const subscription = event.data.object;
  const metadata = subscription.metadata || {};
  const userId = metadata.userId;
  let companyId = metadata.companyId;

  if (!companyId) {
    const existingPlan = await db.companyPlan.findFirst({
      where: { stripeSubscriptionId: subscription.id },
      select: { companyId: true },
    });
    companyId = existingPlan?.companyId;
  }

  if (!userId && !companyId) {
    return {
      success: true,
      action: 'subscription_delete_missing_metadata',
      message: 'Subscription delete event has no CargoBit metadata.',
    };
  }

  const resolvedCompanyId = companyId || await getCompanyIdForUser(userId);
  if (!resolvedCompanyId) {
    return {
      success: true,
      action: 'subscription_delete_no_company',
      message: 'No company found for subscription deletion.',
      userId,
    };
  }

  await expireActiveCompanyPlans(resolvedCompanyId);

  if (userId) {
    await db.notification.create({
      data: {
        userId,
        type: 'SUBSCRIPTION_CANCELLED',
        title: 'Business-Tarif beendet',
        message: 'Ihr CargoBit Business-Tarif wurde beendet. Ihr Konto nutzt wieder das Start-Modell.',
        data: JSON.stringify({
          companyId: resolvedCompanyId,
          stripeSubscriptionId: subscription.id,
          eventId: event.id,
        }),
      },
    });
  }

  await db.auditLog.create({
    data: {
      userId,
      action: 'UPDATE',
      entityType: 'company_plan',
      entityId: resolvedCompanyId,
      dataAfter: JSON.stringify({
        eventId: event.id,
        subscriptionId: subscription.id,
        status: 'cancelled',
      }),
    },
  });

  return {
    success: true,
    action: 'subscription_cancelled',
    message: 'Company plan expired',
    userId,
    companyId: resolvedCompanyId,
    plan: 'FREE',
  };
}

async function handleInvoicePaymentSucceeded(event: StripeWebhookEvent): Promise<WebhookActionResult> {
  const invoice = event.data.object;
  const metadata = invoice.metadata || {};
  const userId = metadata.userId;
  const companyId = await resolveCompanyIdFromInvoice(invoice, metadata.companyId);

  if (companyId) {
    await syncSubscriptionInvoice(invoice, companyId);
    await sendSubscriptionInvoiceEmail(invoice, companyId, userId);
  }

  if (userId) {
    await db.notification.create({
      data: {
        userId,
        type: 'SUBSCRIPTION_PAYMENT_SUCCEEDED',
        title: 'Business-Zahlung erfolgreich',
        message: `Ihre Business-Zahlung über ${formatMoney((invoice.amount_paid || invoice.amount || 0) / 100, invoice.currency || 'EUR')} wurde verarbeitet.`,
        data: JSON.stringify({
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
          companyId,
          eventId: event.id,
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          invoicePdfUrl: invoice.invoice_pdf,
        }),
      },
    });
  }

  await db.auditLog.create({
    data: {
      userId,
      action: 'CREATE',
      entityType: 'stripe_invoice',
      entityId: invoice.id,
      dataAfter: JSON.stringify({
        eventId: event.id,
        type: event.type,
        amountPaid: invoice.amount_paid || invoice.amount,
        currency: invoice.currency,
        subscriptionId: invoice.subscription,
      }),
    },
  });

  return {
    success: true,
    action: 'invoice_payment_succeeded',
    message: companyId ? 'Invoice payment synced and notification recorded' : 'Invoice payment notification recorded',
    userId,
    companyId,
  };
}

async function handleInvoicePaymentFailed(event: StripeWebhookEvent): Promise<WebhookActionResult> {
  const invoice = event.data.object;
  const metadata = invoice.metadata || {};
  const userId = metadata.userId;
  const companyId = await resolveCompanyIdFromInvoice(invoice, metadata.companyId);

  if (companyId) {
    await syncSubscriptionInvoice(invoice, companyId);
  }

  if (userId) {
    await db.notification.create({
      data: {
        userId,
        type: 'SUBSCRIPTION_PAYMENT_FAILED',
        title: 'Business-Zahlung fehlgeschlagen',
        message: 'Ihre Business-Zahlung konnte nicht verarbeitet werden. Bitte prüfen Sie Ihre Zahlungsmethode.',
        data: JSON.stringify({
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
          companyId,
          eventId: event.id,
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          invoicePdfUrl: invoice.invoice_pdf,
        }),
      },
    });
  }

  return {
    success: true,
    action: 'invoice_payment_failed',
    message: companyId ? 'Invoice payment failure synced and notification recorded' : 'Invoice payment failure notification recorded',
    userId,
    companyId,
  };
}

async function handlePaymentIntentSucceeded(event: StripeWebhookEvent): Promise<WebhookActionResult> {
  const paymentIntent = event.data.object;
  const metadata = paymentIntent.metadata || {};

  if (metadata.type !== 'wallet_topup' || !metadata.userId || !paymentIntent.amount) {
    return {
      success: true,
      action: 'payment_intent_ignored',
      message: 'PaymentIntent is not a CargoBit wallet topup',
    };
  }

  let wallet = await db.wallet.findFirst({
    where: { ownerUserId: metadata.userId },
  });

  if (!wallet) {
    wallet = await db.wallet.create({
      data: {
        ownerUserId: metadata.userId,
        balance: 0,
        currency: String(paymentIntent.currency || 'EUR').toUpperCase(),
        status: 'ACTIVE',
      },
    });
  }

  const existingTransaction = await db.walletTransaction.findFirst({
    where: { reference: paymentIntent.id },
  });

  if (!existingTransaction) {
    await db.$transaction(async (tx) => {
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          amount: paymentIntent.amount! / 100,
          currency: String(paymentIntent.currency || 'EUR').toUpperCase(),
          description: 'Zahlungsschutz-Aufladung via Stripe',
          reference: paymentIntent.id,
          processedAt: new Date(),
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: paymentIntent.amount! / 100 },
          totalDeposited: { increment: paymentIntent.amount! / 100 },
        },
      });
    });
  }

  await db.notification.create({
    data: {
      userId: metadata.userId,
      type: 'WALLET_TOPUP',
      title: 'Zahlungsschutz aufgeladen',
      message: `Ihr Zahlungsschutz-Konto wurde um ${formatMoney(paymentIntent.amount / 100, paymentIntent.currency || 'EUR')} aufgeladen.`,
      data: JSON.stringify({
        paymentIntentId: paymentIntent.id,
        eventId: event.id,
      }),
    },
  });

  return {
    success: true,
    action: existingTransaction ? 'wallet_topup_duplicate' : 'wallet_topup_credited',
    message: 'Wallet topup processed',
    userId: metadata.userId,
  };
}

async function handlePaymentIntentFailed(event: StripeWebhookEvent): Promise<WebhookActionResult> {
  const paymentIntent = event.data.object;
  const metadata = paymentIntent.metadata || {};

  if (metadata.userId) {
    await db.notification.create({
      data: {
        userId: metadata.userId,
        type: 'PAYMENT_FAILED',
        title: 'Zahlung fehlgeschlagen',
        message: paymentIntent.last_payment_error?.message || 'Ihre Zahlung konnte nicht verarbeitet werden.',
        data: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          eventId: event.id,
        }),
      },
    });
  }

  return {
    success: true,
    action: 'payment_intent_failed_recorded',
    message: 'Payment failure notification recorded',
    userId: metadata.userId,
  };
}

async function activateCompanyPlan(input: {
  userId: string;
  companyId?: string;
  plan: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  stripeCheckoutSessionId?: string;
  latestInvoiceId?: string;
  cancelAtPeriodEnd?: boolean;
  status: string;
  validTo: Date;
  sourceEventId: string;
  billingCycle: 'monthly' | 'yearly';
}) {
  const planKey = normalizeBillingPlan(input.plan);
  const companyId = input.companyId || await getCompanyIdForUser(input.userId);

  if (!companyId) {
    throw new Error(`No company found for user ${input.userId}`);
  }

  const planDefinition = getBillingPlan(planKey);
  const existingStripePlan = input.stripeSubscriptionId
    ? await db.companyPlan.findFirst({
        where: { stripeSubscriptionId: input.stripeSubscriptionId },
      })
    : null;
  const planRecord = await db.plan.upsert({
    where: { name: planKey as PlanName },
    create: {
      name: planKey as PlanName,
      monthlyFee: planDefinition.monthlyFee,
      yearlyFee: planDefinition.yearlyFee,
      currency: 'EUR',
      commissionPercent: planDefinition.commissionPercent,
      walletFeePercent: planDefinition.walletFeePercent,
      featuresJson: JSON.stringify(planDefinition.features),
    },
    update: {
      monthlyFee: planDefinition.monthlyFee,
      yearlyFee: planDefinition.yearlyFee,
      currency: 'EUR',
      commissionPercent: planDefinition.commissionPercent,
      walletFeePercent: planDefinition.walletFeePercent,
      featuresJson: JSON.stringify(planDefinition.features),
    },
  });

  await db.$transaction(async (tx) => {
    if (input.stripeCustomerId) {
      await tx.company.update({
        where: { id: companyId },
        data: { stripeCustomerId: input.stripeCustomerId },
      });
    }

    if (existingStripePlan) {
      await tx.companyPlan.update({
        where: { id: existingStripePlan.id },
        data: {
          planId: planRecord.id,
          validTo: input.validTo,
          stripeCustomerId: input.stripeCustomerId,
          stripeCheckoutSessionId: input.stripeCheckoutSessionId,
          stripeStatus: input.status,
          billingCycle: input.billingCycle,
          latestInvoiceId: input.latestInvoiceId,
          cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
        },
      });
    } else {
      await tx.companyPlan.updateMany({
        where: {
          companyId,
          OR: [
            { validTo: null },
            { validTo: { gte: new Date() } },
          ],
        },
        data: {
          validTo: new Date(),
        },
      });

      await tx.companyPlan.create({
        data: {
          companyId,
          planId: planRecord.id,
          validFrom: new Date(),
          validTo: input.validTo,
          stripeCustomerId: input.stripeCustomerId,
          stripeSubscriptionId: input.stripeSubscriptionId,
          stripeCheckoutSessionId: input.stripeCheckoutSessionId,
          stripeStatus: input.status,
          billingCycle: input.billingCycle,
          latestInvoiceId: input.latestInvoiceId,
          cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: input.userId,
        type: 'SUBSCRIPTION_ACTIVATED',
        title: 'Business-Tarif aktiviert',
        message: `Ihr CargoBit ${planDefinition.name} Tarif ist aktiv bis ${formatDate(input.validTo)}.`,
        data: JSON.stringify({
          companyId,
          plan: planKey,
          status: input.status,
          billingCycle: input.billingCycle,
          validTo: input.validTo.toISOString(),
          stripeSubscriptionId: input.stripeSubscriptionId,
          stripeCustomerId: input.stripeCustomerId,
          stripeCheckoutSessionId: input.stripeCheckoutSessionId,
          latestInvoiceId: input.latestInvoiceId,
          cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
          eventId: input.sourceEventId,
        }),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: input.userId,
        action: 'UPDATE',
        entityType: 'company_plan',
        entityId: companyId,
        dataAfter: JSON.stringify({
          plan: planKey,
          status: input.status,
          billingCycle: input.billingCycle,
          validTo: input.validTo.toISOString(),
          stripeSubscriptionId: input.stripeSubscriptionId,
          stripeCustomerId: input.stripeCustomerId,
          stripeCheckoutSessionId: input.stripeCheckoutSessionId,
          latestInvoiceId: input.latestInvoiceId,
          cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
          eventId: input.sourceEventId,
        }),
      },
    });
  });

  return {
    userId: input.userId,
    companyId,
    plan: planKey,
  };
}

async function getCompanyIdForUser(userId?: string) {
  if (!userId) return null;

  const companyUser = await db.companyUser.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  return companyUser?.companyId || null;
}

async function expireActiveCompanyPlans(companyId: string) {
  await db.companyPlan.updateMany({
    where: {
      companyId,
      OR: [
        { validTo: null },
        { validTo: { gte: new Date() } },
      ],
    },
    data: {
      validTo: new Date(),
    },
  });
}

async function resolveCompanyIdFromInvoice(invoice: StripeObject, metadataCompanyId?: string) {
  if (metadataCompanyId) return metadataCompanyId;

  const subscriptionId = getStripeId(invoice.subscription);
  if (subscriptionId) {
    const companyPlan = await db.companyPlan.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      select: { companyId: true },
    });

    if (companyPlan?.companyId) return companyPlan.companyId;
  }

  if (typeof invoice.customer === 'string') {
    const company = await db.company.findFirst({
      where: { stripeCustomerId: invoice.customer },
      select: { id: true },
    });

    if (company?.id) return company.id;
  }

  return null;
}

async function syncSubscriptionInvoice(invoice: StripeObject, companyId: string) {
  const subscriptionId = getStripeId(invoice.subscription);
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : undefined;
  const currency = String(invoice.currency || 'EUR').toUpperCase();
  const issuedAt = invoice.created ? new Date(invoice.created * 1000) : new Date();
  const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000) : undefined;
  const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000) : undefined;
  const dueAt = invoice.due_date ? new Date(invoice.due_date * 1000) : undefined;
  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : invoice.status === 'paid'
      ? new Date()
      : undefined;

  const subtotal = centsToMoney(invoice.subtotal ?? invoice.amount ?? 0);
  const total = centsToMoney(invoice.total ?? invoice.amount_paid ?? invoice.amount_due ?? invoice.amount ?? 0);
  const amountPaid = centsToMoney(invoice.amount_paid ?? 0);
  const amountDue = centsToMoney(invoice.amount_due ?? 0);
  const tax = centsToMoney(invoice.tax ?? Math.max(0, Math.round((total - subtotal) * 100)));

  const savedInvoice = await db.subscriptionInvoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      companyId,
      stripeInvoiceId: invoice.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      invoiceNumber: invoice.number,
      status: invoice.status,
      currency,
      subtotal,
      tax,
      total,
      amountPaid,
      amountDue,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdfUrl: invoice.invoice_pdf,
      periodStart,
      periodEnd,
      issuedAt,
      dueAt,
      paidAt,
      rawPayload: JSON.stringify(invoice),
    },
    update: {
      companyId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      invoiceNumber: invoice.number,
      status: invoice.status,
      currency,
      subtotal,
      tax,
      total,
      amountPaid,
      amountDue,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdfUrl: invoice.invoice_pdf,
      periodStart,
      periodEnd,
      issuedAt,
      dueAt,
      paidAt,
      rawPayload: JSON.stringify(invoice),
    },
  });

  if (subscriptionId) {
    await db.companyPlan.updateMany({
      where: { stripeSubscriptionId: subscriptionId },
      data: {
        latestInvoiceId: invoice.id,
        stripeStatus: invoice.status,
      },
    });
  }

  return savedInvoice;
}

async function sendSubscriptionInvoiceEmail(
  invoice: StripeObject,
  companyId: string,
  userId?: string,
) {
  const storedInvoice = await db.subscriptionInvoice.findUnique({
    where: { stripeInvoiceId: invoice.id },
    select: {
      emailSent: true,
      invoiceNumber: true,
      currency: true,
      subtotal: true,
      tax: true,
      total: true,
      hostedInvoiceUrl: true,
      invoicePdfUrl: true,
      status: true,
      issuedAt: true,
    },
  });

  if (storedInvoice?.emailSent) return;

  const recipient = await resolveSubscriptionInvoiceRecipient(companyId, userId);
  if (!recipient?.email) {
    await db.subscriptionInvoice.update({
      where: { stripeInvoiceId: invoice.id },
      data: {
        emailSent: false,
        emailError: 'No billing recipient found for company',
      },
    });
    return;
  }

  const invoiceNumber = storedInvoice?.invoiceNumber || invoice.number || invoice.id;
  const currency = storedInvoice?.currency || String(invoice.currency || 'EUR').toUpperCase();
  const subtotal = storedInvoice?.subtotal ?? centsToMoney(invoice.subtotal ?? 0);
  const tax = storedInvoice?.tax ?? centsToMoney(invoice.tax ?? 0);
  const total = storedInvoice?.total ?? centsToMoney(invoice.total ?? invoice.amount_paid ?? 0);
  const documentUrl = storedInvoice?.hostedInvoiceUrl || storedInvoice?.invoicePdfUrl || invoice.hosted_invoice_url || invoice.invoice_pdf;
  const subject = `CargoBit Business-Rechnung ${invoiceNumber}`;
  const name = [recipient.firstName, recipient.lastName].filter(Boolean).join(' ');
  const salutation = name ? `Hallo ${name}` : 'Hallo';
  const documentButton = documentUrl
    ? `<p style="margin:28px 0"><a href="${documentUrl}" style="display:inline-block;background:#1C7ED6;color:#ffffff;padding:13px 18px;border-radius:10px;text-decoration:none;font-weight:700">Rechnung öffnen</a></p>`
    : '';

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:auto;background:#06121C;color:#EAF7FF;padding:28px;border-radius:18px">
      <div style="border-bottom:1px solid rgba(255,255,255,.12);padding-bottom:18px;margin-bottom:22px">
        <div style="color:#00D4FF;font-size:13px;letter-spacing:.08em;text-transform:uppercase">CargoBit Billing</div>
        <h1 style="margin:8px 0 0;font-size:26px">Ihre Business-Rechnung ist bereit</h1>
      </div>
      <p style="color:#C7D7E4">${salutation},</p>
      <p style="color:#C7D7E4">die Zahlung für Ihren CargoBit Business-Tarif wurde verarbeitet. Die Rechnung <strong>${invoiceNumber}</strong> wurde automatisch erstellt.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;background:rgba(255,255,255,.05);border-radius:14px;overflow:hidden">
        <tr><td style="padding:14px 16px;color:#9EB2C2">Netto</td><td style="padding:14px 16px;text-align:right;font-weight:700">${formatMoney(subtotal, currency)}</td></tr>
        <tr><td style="padding:14px 16px;color:#9EB2C2;border-top:1px solid rgba(255,255,255,.08)">MwSt.</td><td style="padding:14px 16px;text-align:right;font-weight:700;border-top:1px solid rgba(255,255,255,.08)">${formatMoney(tax, currency)}</td></tr>
        <tr><td style="padding:14px 16px;color:#ffffff;border-top:1px solid rgba(255,255,255,.08)">Brutto</td><td style="padding:14px 16px;text-align:right;font-size:20px;font-weight:800;color:#2ECC71;border-top:1px solid rgba(255,255,255,.08)">${formatMoney(total, currency)}</td></tr>
      </table>
      ${documentButton}
      <p style="color:#7F94A6;font-size:13px">Diese E-Mail wurde automatisch erstellt. Die vollstaendige Rechnung bleibt im CargoBit Billing-Bereich abrufbar.</p>
    </div>
  `;
  const text = `${salutation}, Ihre CargoBit Business-Rechnung ${invoiceNumber} wurde erstellt. Netto: ${formatMoney(subtotal, currency)}, MwSt.: ${formatMoney(tax, currency)}, Brutto: ${formatMoney(total, currency)}.${documentUrl ? ` Rechnung: ${documentUrl}` : ''}`;
  const result = await sendTransactionalEmail({
    to: {
      email: recipient.email,
      name: name || undefined,
    },
    subject,
    html,
    text,
  });

  await db.subscriptionInvoice.update({
    where: { stripeInvoiceId: invoice.id },
    data: {
      emailRecipient: recipient.email,
      emailSent: result.success,
      emailSentAt: result.success ? new Date() : undefined,
      emailProvider: result.provider,
      emailError: result.error,
    },
  });
}

async function resolveSubscriptionInvoiceRecipient(companyId: string, userId?: string) {
  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (user?.email) return user;
  }

  const companyUser = await db.companyUser.findFirst({
    where: {
      companyId,
      roleInCompany: { in: ['owner', 'admin'] },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: { email: true, firstName: true, lastName: true },
      },
    },
  });

  return companyUser?.user || null;
}

function getStripeId(value?: string | { id: string }) {
  return typeof value === 'string' ? value : value?.id;
}

function centsToMoney(cents: number) {
  return Math.round((cents / 100 + Number.EPSILON) * 100) / 100;
}

function calculateFallbackPeriodEnd(billingCycle: 'monthly' | 'yearly') {
  const date = new Date();
  if (billingCycle === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setMonth(date.getMonth() + 1);
  }
  return date;
}

function stripeEventKey(eventId: string) {
  return `stripe_event:${eventId}`;
}

function createDevelopmentFallback(event: StripeWebhookEvent, error: unknown) {
  return {
    received: true,
    processed: true,
    action: 'development_fallback',
    message: 'Database unavailable in local development; webhook shape accepted.',
    event: {
      id: event.id,
      type: event.type,
      objectId: event.data.object.id,
    },
    source: 'fallback',
    warning: error instanceof Error ? error.message : 'Database unavailable',
  };
}

function formatMoney(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: String(currency).toUpperCase(),
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}
