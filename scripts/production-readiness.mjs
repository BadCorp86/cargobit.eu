#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = process.cwd();
loadDotEnv(path.join(root, '.env'));

const args = new Set(process.argv.slice(2));
const skipDb = args.has('--skip-db') || process.env.READINESS_SKIP_DB === 'true';
const json = args.has('--json');
const checks = [];

addCheck({
  id: 'prisma_provider',
  label: 'Prisma provider',
  required: true,
  ok: readFile('prisma/schema.prisma').includes('provider = "postgresql"'),
  detail: 'prisma/schema.prisma must use provider = "postgresql" for Vercel production.',
});

checkEnv('DATABASE_URL', {
  required: true,
  prefix: ['postgresql://', 'postgres://'],
  detail: 'Use a PostgreSQL connection string for production.',
});

checkEnv('NEXT_PUBLIC_APP_URL', {
  required: true,
  prefix: ['https://', 'http://'],
  fallback: process.env.NEXT_PUBLIC_URL || process.env.VERCEL_URL,
  detail: 'Public app URL for Stripe redirects.',
});

checkEnv('ENCRYPTION_KEY', {
  required: true,
  minLength: 24,
  detail: 'Use a long random secret.',
});

checkEnv('CRON_SECRET', {
  required: true,
  minLength: 24,
  detail: 'Required for secured Vercel Cron route calls.',
});

checkEnv('ADMIN_EMAIL', { required: true });
checkEnv('ADMIN_PASSWORD', { required: true, minLength: 12 });
checkEnv('ADMIN_JWT_SECRET', { required: true, minLength: 24 });

checkEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', {
  required: true,
  prefix: ['pk_live_', 'pk_test_'],
});

checkEnv('STRIPE_SECRET_KEY', {
  required: true,
  prefix: ['sk_live_', 'sk_test_'],
});

checkEnv('STRIPE_SUBSCRIPTION_WEBHOOK_SECRET', {
  required: true,
  prefix: ['whsec_'],
  fallback: process.env.STRIPE_WEBHOOK_SECRET,
});

checkEnv('STRIPE_PAYOUT_WEBHOOK_SECRET', {
  required: false,
  prefix: ['whsec_'],
  fallback: process.env.STRIPE_WEBHOOK_SECRET,
});

[
  'STRIPE_PRICE_STARTER_MONTHLY',
  'STRIPE_PRICE_STARTER_YEARLY',
  'STRIPE_PRICE_PROFESSIONAL_MONTHLY',
  'STRIPE_PRICE_PROFESSIONAL_YEARLY',
  'STRIPE_PRICE_ENTERPRISE_MONTHLY',
  'STRIPE_PRICE_ENTERPRISE_YEARLY',
].forEach((key) => checkEnv(key, { required: true, prefix: ['price_'] }));

checkEnv('SENDGRID_API_KEY', {
  required: false,
  prefix: ['SG.'],
  detail: 'Optional, but required for automatic invoice emails.',
});

if (process.env.NODE_ENV === 'production' && process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  addCheck({
    id: 'stripe_live_mode',
    label: 'Stripe live mode',
    required: true,
    ok: false,
    detail: 'Production must not use sk_test_.',
  });
}

if (!skipDb && isPostgresUrl(process.env.DATABASE_URL || '')) {
  await runDatabaseChecks();
} else {
  addCheck({
    id: 'database_connection',
    label: 'Database connection',
    required: !skipDb,
    ok: false,
    skipped: skipDb,
    detail: skipDb
      ? 'Skipped via --skip-db or READINESS_SKIP_DB=true.'
      : 'DATABASE_URL is not a PostgreSQL URL, so DB checks cannot run.',
  });
}

const required = checks.filter((check) => check.required);
const failed = required.filter((check) => !check.ok);
const warnings = checks.filter((check) => !check.required && !check.ok);
const score = required.length ? Math.round(((required.length - failed.length) / required.length) * 100) : 100;
const report = {
  ready: failed.length === 0,
  score,
  failed: failed.map((check) => check.id),
  warnings: warnings.map((check) => check.id),
  checks,
  checkedAt: new Date().toISOString(),
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);
}

process.exit(report.ready ? 0 : 1);

function checkEnv(key, options) {
  const value = process.env[key] || options.fallback || '';
  const meaningful = isMeaningfulValue(value);
  const hasPrefix = !options.prefix || options.prefix.some((prefix) => value.startsWith(prefix));
  const hasMinLength = !options.minLength || value.length >= options.minLength;

  addCheck({
    id: key.toLowerCase(),
    label: key,
    required: options.required,
    ok: meaningful && hasPrefix && hasMinLength,
    maskedValue: meaningful && hasPrefix ? maskValue(value) : undefined,
    detail: options.detail || buildEnvDetail(key, options),
  });
}

async function runDatabaseChecks() {
  const prisma = new PrismaClient({ log: [] });

  try {
    await prisma.$queryRaw`SELECT 1`;
    addCheck({
      id: 'database_connection',
      label: 'Database connection',
      required: true,
      ok: true,
    });

    await prisma.company.findFirst({ select: { id: true, stripeCustomerId: true }, take: 1 });
    addCheck({
      id: 'company_stripe_customer',
      label: 'Company.stripeCustomerId',
      required: true,
      ok: true,
    });

    await prisma.companyPlan.findFirst({
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
    addCheck({
      id: 'company_plan_stripe_fields',
      label: 'CompanyPlan Stripe fields',
      required: true,
      ok: true,
    });

    await prisma.subscriptionInvoice.findFirst({
      select: {
        id: true,
        stripeInvoiceId: true,
        subtotal: true,
        tax: true,
        total: true,
        emailRecipient: true,
        emailSent: true,
        emailSentAt: true,
        emailProvider: true,
        emailError: true,
      },
      take: 1,
    });
    addCheck({
      id: 'subscription_invoice_schema',
      label: 'SubscriptionInvoice schema',
      required: true,
      ok: true,
    });

    await prisma.systemSetting.findFirst({ select: { key: true, value: true, updatedAt: true }, take: 1 });
    addCheck({
      id: 'webhook_idempotency',
      label: 'Webhook idempotency table',
      required: true,
      ok: true,
    });
  } catch (error) {
    addCheck({
      id: 'database_schema',
      label: 'Database schema',
      required: true,
      ok: false,
      detail: getErrorMessage(error),
    });
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

function addCheck(check) {
  checks.push({
    ...check,
    status: check.ok ? 'ready' : check.required ? 'missing' : 'warning',
  });
}

function printReport(report) {
  console.log(`\nCargoBit production readiness: ${report.ready ? 'READY' : 'NOT READY'} (${report.score}%)\n`);

  for (const check of report.checks) {
    const symbol = check.ok ? '✓' : check.required ? '✕' : '!';
    const value = check.maskedValue ? ` ${check.maskedValue}` : '';
    console.log(`${symbol} ${check.label}${value}`);
    if (!check.ok && check.detail) {
      console.log(`  ${check.detail}`);
    }
  }

  if (!report.ready) {
    console.log('\nFix required checks before live Stripe/Vercel rollout.');
  }

  if (report.warnings.length > 0) {
    console.log('Warnings are optional but should be reviewed.');
  }
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function isMeaningfulValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return ![
    'replace',
    'replace_me',
    'placeholder',
    'user:password',
    'pk_live_replace',
    'sk_live_replace',
    'whsec_replace',
    'price_replace',
    'sg_replace',
  ].some((placeholder) => normalized.includes(placeholder));
}

function isPostgresUrl(value) {
  return value.startsWith('postgresql://') || value.startsWith('postgres://');
}

function maskValue(value) {
  if (value.length <= 12) return 'configured';
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function buildEnvDetail(key, options) {
  if (options.prefix) return `${key} must start with ${options.prefix.join(' or ')}.`;
  if (options.minLength) return `${key} must be at least ${options.minLength} characters.`;
  return `${key} is required.`;
}

function getErrorMessage(error) {
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
    )) || lines[0] || 'Database readiness failed.';
  }

  return 'Unknown database readiness error.';
}
