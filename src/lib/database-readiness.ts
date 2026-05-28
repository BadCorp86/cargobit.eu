import { db } from '@/lib/db';

export type DatabaseReadinessStatus = 'ready' | 'missing' | 'warning';

export interface DatabaseReadinessCheck {
  id: string;
  label: string;
  description: string;
  required: boolean;
  status: DatabaseReadinessStatus;
  detail?: string;
  maskedValue?: string;
}

export interface DatabaseReadinessReport {
  ready: boolean;
  score: number;
  missing: string[];
  warnings: string[];
  checks: DatabaseReadinessCheck[];
  migrationCommand: string;
  checkedAt: string;
}

export async function getDatabaseReadiness(): Promise<DatabaseReadinessReport> {
  const checks: DatabaseReadinessCheck[] = [];
  const databaseUrl = process.env.DATABASE_URL || '';

  checks.push({
    id: 'database_url',
    label: 'DATABASE_URL',
    description: 'Produktive Datenbankverbindung fuer Prisma, Stripe Webhooks, Abos und Rechnungen.',
    required: true,
    status: getDatabaseUrlStatus(databaseUrl),
    maskedValue: isMeaningfulDatabaseUrl(databaseUrl) ? maskDatabaseUrl(databaseUrl) : undefined,
    detail: databaseUrl.startsWith('file:')
      ? 'Prisma ist fuer Postgres konfiguriert. Verwende eine postgresql:// DATABASE_URL.'
      : undefined,
  });

  if (isPostgresDatabaseUrl(databaseUrl)) {
    checks.push(await runDatabaseCheck({
      id: 'connection',
      label: 'DB Verbindung',
      description: 'Prisma kann die Datenbank erreichen.',
      required: true,
      query: async () => {
        await db.$queryRaw`SELECT 1`;
      },
    }));

    checks.push(await runDatabaseCheck({
      id: 'company_stripe_customer',
      label: 'Company Stripe Customer',
      description: 'Company.stripeCustomerId ist vorhanden, damit bestehende Firmen mit Stripe Kunden verbunden bleiben.',
      required: true,
      query: async () => {
        await db.company.findFirst({
          select: { id: true, stripeCustomerId: true },
          take: 1,
        });
      },
    }));

    checks.push(await runDatabaseCheck({
      id: 'company_plan_stripe_fields',
      label: 'CompanyPlan Stripe Felder',
      description: 'Abo-Status, Subscription ID, Checkout Session, Billing Cycle und letzte Invoice koennen gespeichert werden.',
      required: true,
      query: async () => {
        await db.companyPlan.findFirst({
          select: {
            id: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            stripeCheckoutSessionId: true,
            stripeStatus: true,
            billingCycle: true,
            latestInvoiceId: true,
            cancelAtPeriodEnd: true,
          },
          take: 1,
        });
      },
    }));

    checks.push(await runDatabaseCheck({
      id: 'subscription_invoice_table',
      label: 'SubscriptionInvoice',
      description: 'Stripe Abo-Rechnungen koennen inklusive Netto, MwSt, Brutto, PDF-Link und Zahlungsstatus gespeichert werden.',
      required: true,
      query: async () => {
        await db.subscriptionInvoice.findFirst({
          select: {
            id: true,
            stripeInvoiceId: true,
            subtotal: true,
            tax: true,
            total: true,
            hostedInvoiceUrl: true,
            invoicePdfUrl: true,
          },
          take: 1,
        });
      },
    }));

    checks.push(await runDatabaseCheck({
      id: 'subscription_invoice_email_fields',
      label: 'Invoice E-Mail Felder',
      description: 'Automatischer Rechnungsversand speichert Empfaenger, Versandstatus, Provider und Fehler.',
      required: true,
      query: async () => {
        await db.subscriptionInvoice.findFirst({
          select: {
            id: true,
            emailRecipient: true,
            emailSent: true,
            emailSentAt: true,
            emailProvider: true,
            emailError: true,
          },
          take: 1,
        });
      },
    }));

    checks.push(await runDatabaseCheck({
      id: 'webhook_idempotency',
      label: 'Webhook Idempotenz',
      description: 'SystemSetting ist verfuegbar, damit Stripe Events nicht doppelt verarbeitet werden.',
      required: true,
      query: async () => {
        await db.systemSetting.findFirst({
          select: { key: true, value: true, updatedAt: true },
          take: 1,
        });
      },
    }));
  }

  const requiredChecks = checks.filter((check) => check.required);
  const readyRequired = requiredChecks.filter((check) => check.status === 'ready').length;
  const missing = requiredChecks
    .filter((check) => check.status === 'missing')
    .map((check) => check.id);
  const warnings = checks
    .filter((check) => check.status === 'warning' || check.detail)
    .map((check) => `${check.label}: ${check.detail || 'Pruefung hat einen Hinweis ergeben.'}`);

  return {
    ready: missing.length === 0 && requiredChecks.every((check) => check.status === 'ready'),
    score: requiredChecks.length === 0 ? 0 : Math.round((readyRequired / requiredChecks.length) * 100),
    missing,
    warnings,
    checks,
    migrationCommand: 'npm run db:deploy',
    checkedAt: new Date().toISOString(),
  };
}

async function runDatabaseCheck(input: {
  id: string;
  label: string;
  description: string;
  required: boolean;
  query: () => Promise<void>;
}): Promise<DatabaseReadinessCheck> {
  try {
    await input.query();

    return {
      id: input.id,
      label: input.label,
      description: input.description,
      required: input.required,
      status: 'ready',
    };
  } catch (error) {
    return {
      id: input.id,
      label: input.label,
      description: input.description,
      required: input.required,
      status: input.required ? 'missing' : 'warning',
      detail: getErrorMessage(error),
    };
  }
}

function isMeaningfulDatabaseUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return !['replace', 'placeholder', 'user:password', 'database?schema=public'].some((placeholder) => (
    normalized.includes(placeholder)
  ));
}

function isPostgresDatabaseUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('postgresql://') || normalized.startsWith('postgres://');
}

function getDatabaseUrlStatus(value: string): DatabaseReadinessStatus {
  if (!isMeaningfulDatabaseUrl(value)) return 'missing';
  if (!isPostgresDatabaseUrl(value)) return 'missing';
  return 'ready';
}

function maskDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === 'file:') return 'file:...';

    const auth = url.username ? `${url.username.slice(0, 2)}***@` : '';
    return `${url.protocol}//${auth}${url.host}${url.pathname}`;
  } catch {
    return 'konfiguriert';
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const lines = error.message
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.find((line) => (
      line.includes('Error querying the database') ||
      line.includes('Unable to open') ||
      line.includes('does not exist') ||
      line.includes('Unknown field') ||
      line.includes('P1001') ||
      line.includes('P2021') ||
      line.includes('P2022')
    )) || lines[0] || 'Datenbankpruefung fehlgeschlagen';
  }

  return 'Unbekannter Datenbankfehler';
}
