export type StripeReadinessStatus = 'ready' | 'missing' | 'warning';

export interface StripeReadinessItem {
  key: string;
  label: string;
  description: string;
  configured: boolean;
  required: boolean;
  maskedValue?: string;
  expectedPrefix?: string;
  status: StripeReadinessStatus;
}

export interface StripeReadinessSection {
  id: string;
  title: string;
  description: string;
  items: StripeReadinessItem[];
}

export interface StripeReadinessReport {
  ready: boolean;
  score: number;
  missing: string[];
  warnings: string[];
  webhookEndpoints: Array<{
    label: string;
    path: string;
    events: string[];
    secretEnv: string;
  }>;
  sections: StripeReadinessSection[];
  checkedAt: string;
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

const PAYOUT_EVENTS = [
  'transfer.created',
  'transfer.reversed',
  'transfer.updated',
  'payout.created',
  'payout.paid',
  'payout.failed',
  'payout.canceled',
];

const PRICE_KEYS = [
  ['STRIPE_PRICE_STARTER_MONTHLY', 'Starter monatlich'],
  ['STRIPE_PRICE_STARTER_YEARLY', 'Starter jährlich'],
  ['STRIPE_PRICE_PROFESSIONAL_MONTHLY', 'Professional monatlich'],
  ['STRIPE_PRICE_PROFESSIONAL_YEARLY', 'Professional jährlich'],
  ['STRIPE_PRICE_ENTERPRISE_MONTHLY', 'Enterprise monatlich'],
  ['STRIPE_PRICE_ENTERPRISE_YEARLY', 'Enterprise jährlich'],
] as const;

export function getStripeReadiness(): StripeReadinessReport {
  const sections: StripeReadinessSection[] = [
    {
      id: 'core',
      title: 'Stripe Core',
      description: 'Grundlage für Checkout, Kundenanlage und Zahlungsverarbeitung.',
      items: [
        createEnvItem('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'Publishable Key', 'Frontend-Key für Stripe Checkout.', true, 'pk_'),
        createEnvItem('STRIPE_SECRET_KEY', 'Secret Key', 'Backend-Key für Checkout Sessions, Webhooks und Stripe API.', true, 'sk_'),
        createEnvItem('NEXT_PUBLIC_APP_URL', 'App URL', 'Öffentliche URL für Success- und Cancel-Redirects.', true, 'http'),
      ],
    },
    {
      id: 'webhooks',
      title: 'Webhooks',
      description: 'Stripe meldet erfolgreiche Abos, Rechnungen, Wallet-Zahlungen und Payouts zurück.',
      items: [
        createWebhookItem(
          'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET',
          'Subscription Webhook Secret',
          'Signing Secret für /api/stripe/webhook. Fallback: STRIPE_WEBHOOK_SECRET.',
          true,
        ),
        createWebhookItem(
          'STRIPE_PAYOUT_WEBHOOK_SECRET',
          'Payout Webhook Secret',
          'Signing Secret für /api/stripe/webhook/payouts. Fallback: STRIPE_WEBHOOK_SECRET.',
          false,
        ),
      ],
    },
    {
      id: 'prices',
      title: 'Abo Price IDs',
      description: 'Preis-IDs aus Stripe für Starter, Professional und Enterprise.',
      items: PRICE_KEYS.map(([key, label]) => (
        createEnvItem(key, label, 'Stripe Price ID aus dem Product Catalog.', true, 'price_')
      )),
    },
    {
      id: 'tax',
      title: 'Steuer und Rechnung',
      description: 'Vorbereitung für Netto-Preis im Vordergrund und MwSt-Ausweis auf der Rechnung.',
      items: [
        createBooleanItem('STRIPE_TAX_ENABLED', 'Stripe Tax aktiviert', 'Nur aktivieren, wenn Stripe Tax im Dashboard eingerichtet ist.', false),
        createEnvItem('SENDGRID_API_KEY', 'E-Mail Versand', 'Optional für automatischen Rechnungsversand per E-Mail.', false, 'SG.'),
      ],
    },
  ];

  const items = sections.flatMap((section) => section.items);
  const missing = items
    .filter((item) => item.required && !item.configured)
    .map((item) => item.key);
  const warnings = buildWarnings(sections);
  const requiredItems = items.filter((item) => item.required);
  const configuredRequired = requiredItems.filter((item) => item.configured).length;
  const score = requiredItems.length === 0 ? 100 : Math.round((configuredRequired / requiredItems.length) * 100);

  return {
    ready: missing.length === 0,
    score,
    missing,
    warnings,
    webhookEndpoints: [
      {
        label: 'Subscriptions, invoices, wallet topups',
        path: '/api/stripe/webhook',
        events: SUBSCRIPTION_EVENTS,
        secretEnv: process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET ? 'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET',
      },
      {
        label: 'Payouts and transfers',
        path: '/api/stripe/webhook/payouts',
        events: PAYOUT_EVENTS,
        secretEnv: process.env.STRIPE_PAYOUT_WEBHOOK_SECRET ? 'STRIPE_PAYOUT_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET',
      },
    ],
    sections,
    checkedAt: new Date().toISOString(),
  };
}

export function withoutMaskedStripeValues(report: StripeReadinessReport): StripeReadinessReport {
  return {
    ...report,
    sections: report.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        maskedValue: undefined,
      })),
    })),
  };
}

export function getSubscriptionWebhookSecret() {
  return process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
}

export function getPayoutWebhookSecret() {
  return process.env.STRIPE_PAYOUT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
}

function createEnvItem(
  key: string,
  label: string,
  description: string,
  required: boolean,
  expectedPrefix?: string,
): StripeReadinessItem {
  const rawValue = getEnvValue(key);
  const configured = isMeaningfulValue(rawValue) && (!expectedPrefix || rawValue.startsWith(expectedPrefix));

  return {
    key,
    label,
    description,
    configured,
    required,
    expectedPrefix,
    maskedValue: configured ? maskValue(rawValue) : undefined,
    status: configured ? 'ready' : required ? 'missing' : 'warning',
  };
}

function createWebhookItem(
  key: 'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET' | 'STRIPE_PAYOUT_WEBHOOK_SECRET',
  label: string,
  description: string,
  required: boolean,
): StripeReadinessItem {
  const fallback = getEnvValue('STRIPE_WEBHOOK_SECRET');
  const dedicated = getEnvValue(key);
  const value = dedicated || fallback;
  const configured = isMeaningfulValue(value) && value.startsWith('whsec_');

  return {
    key,
    label,
    description,
    configured,
    required,
    expectedPrefix: 'whsec_',
    maskedValue: configured ? maskValue(value) : undefined,
    status: configured ? (dedicated ? 'ready' : 'warning') : required ? 'missing' : 'warning',
  };
}

function createBooleanItem(
  key: string,
  label: string,
  description: string,
  required: boolean,
): StripeReadinessItem {
  const value = getEnvValue(key);
  const configured = value === 'true';

  return {
    key,
    label,
    description,
    configured,
    required,
    maskedValue: value || 'false',
    status: configured ? 'ready' : required ? 'missing' : 'warning',
  };
}

function buildWarnings(sections: StripeReadinessSection[]) {
  const warnings: string[] = [];
  const subscriptionSecret = getEnvValue('STRIPE_SUBSCRIPTION_WEBHOOK_SECRET');
  const payoutSecret = getEnvValue('STRIPE_PAYOUT_WEBHOOK_SECRET');
  const genericSecret = getEnvValue('STRIPE_WEBHOOK_SECRET');

  if (!subscriptionSecret && genericSecret) {
    warnings.push('STRIPE_SUBSCRIPTION_WEBHOOK_SECRET fehlt. CargoBit nutzt aktuell STRIPE_WEBHOOK_SECRET als Fallback.');
  }

  if (!payoutSecret && genericSecret) {
    warnings.push('STRIPE_PAYOUT_WEBHOOK_SECRET fehlt. CargoBit nutzt aktuell STRIPE_WEBHOOK_SECRET als Fallback.');
  }

  if (process.env.NODE_ENV === 'production' && getEnvValue('STRIPE_SECRET_KEY')?.startsWith('sk_test_')) {
    warnings.push('Produktivumgebung nutzt einen Stripe Test Secret Key.');
  }

  const taxItem = sections
    .find((section) => section.id === 'tax')
    ?.items.find((item) => item.key === 'STRIPE_TAX_ENABLED');

  if (taxItem && !taxItem.configured) {
    warnings.push('STRIPE_TAX_ENABLED ist nicht aktiv. MwSt muss dann durch CargoBit selbst ausgewiesen werden.');
  }

  return warnings;
}

function getEnvValue(key: string) {
  if (key === 'NEXT_PUBLIC_APP_URL') {
    return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || process.env.VERCEL_URL || '';
  }

  return process.env[key] || '';
}

function isMeaningfulValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return ![
    'replace',
    'replace_me',
    'placeholder',
    'pk_live_replace',
    'sk_live_replace',
    'whsec_replace',
    'acct_replace',
  ].some((placeholder) => normalized.includes(placeholder));
}

function maskValue(value: string) {
  if (value.length <= 12) return 'konfiguriert';
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
