# CargoBit Stripe and Vercel Setup

This checklist is for connecting CargoBit to Stripe without committing secrets.

## 1. Do not share or commit secrets

Never commit real values for:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ADMIN_PASSWORD`
- `ADMIN_JWT_SECRET`
- `ENCRYPTION_KEY`
- `DATABASE_URL`
- `SENDGRID_API_KEY`

Use `.env.example` only as a template. Real values belong in Vercel Environment Variables.

## 2. Required Vercel variables

Set these in Vercel:

```env
NEXT_PUBLIC_APP_URL=https://cargobit.eu
NEXT_PUBLIC_URL=https://cargobit.eu
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=...
ADMIN_EMAIL=admin@cargobit.eu
ADMIN_PASSWORD=...
ADMIN_JWT_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
DEFAULT_STRIPE_ACCOUNT_ID=acct_...
```

For invoice email delivery:

```env
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@cargobit.eu
SENDGRID_FROM_NAME=CargoBit
```

## 3. Production database schema

CargoBit stores Stripe customer IDs, subscription states, invoice history, invoice email status and webhook idempotency in Prisma.

CargoBit Prisma is configured for PostgreSQL. SQLite `file:` URLs are only useful for old local experiments and will fail the production readiness checks.

After setting `DATABASE_URL` in Vercel, run this once against the production database:

```bash
npm run db:deploy
```

Then open:

```text
https://cargobit.eu/admin/system/stripe
```

The database readiness card should show:

- `DB Verbindung`
- `Company Stripe Customer`
- `CompanyPlan Stripe Felder`
- `SubscriptionInvoice`
- `Invoice E-Mail Felder`
- `Webhook Idempotenz`

All of them must be ready before live Stripe payments are used.

## 4. Subscription price variables

Create recurring Stripe Prices in the Stripe dashboard and copy the Price IDs into Vercel:

```env
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_...
STRIPE_PRICE_PROFESSIONAL_YEARLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_YEARLY=price_...
```

Recommended Stripe Product setup:

| Plan | Monthly net | Yearly net |
| --- | ---: | ---: |
| Starter | EUR 89 | EUR 890 |
| Professional | EUR 149 | EUR 1490 |
| Enterprise | EUR 490 | EUR 4900 |

CargoBit displays net prices in the foreground. VAT is handled as a separate invoice/tax line.

If Stripe Tax is configured in Stripe, set:

```env
STRIPE_TAX_ENABLED=true
```

Keep it `false` until Stripe Tax is fully configured.

## 5. Stripe webhook endpoints

Create webhook endpoints in Stripe:

```text
https://cargobit.eu/api/stripe/webhook
https://cargobit.eu/api/stripe/webhook/payouts
```

Subscription endpoint events for `/api/stripe/webhook`:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Payout endpoint events for `/api/stripe/webhook/payouts`:

- `transfer.created`
- `transfer.reversed`
- `transfer.updated`
- `payout.created`
- `payout.paid`
- `payout.failed`
- `payout.canceled`

Use the signing secrets from Stripe as:

```env
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_...
STRIPE_PAYOUT_WEBHOOK_SECRET=whsec_...
```

`STRIPE_WEBHOOK_SECRET` remains supported as a fallback, but separate secrets are cleaner.

## 6. Stripe Connect

For carrier/driver payouts, configure Stripe Connect:

```env
DEFAULT_STRIPE_ACCOUNT_ID=acct_...
STRIPE_CONNECT_CLIENT_ID=ca_...
```

Production payout requirements:

- Transporteur/driver has a connected Stripe account.
- Bank account or payout method is verified.
- CargoBit Wallet has sufficient released balance.
- POD/eCMR, invoice, and Risk Gate have passed.

## 7. Vercel steps

1. Open Vercel project.
2. Go to `Settings` -> `Environment Variables`.
3. Add every variable from `.env.example` that is required for production.
4. Select `Production`, `Preview`, and `Development` only where appropriate.
5. Redeploy the project after saving variables.

Before going live, run the static readiness check:

```bash
npm run readiness:env
```

After the production `DATABASE_URL` is set and reachable, run the full readiness check:

```bash
npm run readiness
```

For machine-readable CI output:

```bash
npm run readiness:json
```

In GitHub Actions, run the manual **Production Readiness** workflow and choose `staging` or `production`.
The selected GitHub Environment must contain the same production secrets as Vercel, especially `DATABASE_URL`, Stripe keys, webhook secrets, Stripe Price IDs, and admin credentials.

## 8. Vercel Cron jobs

`vercel.json` registers two production cron jobs:

- `/api/cron/reconcile`: hourly payment/refund reconciliation.
- `/api/cron/payouts/run`: daily payout processing and reconciliation at 04:30 UTC.

Set `CRON_SECRET` in Vercel. Vercel sends it as `Authorization: Bearer <CRON_SECRET>` when invoking cron routes.
Without `CRON_SECRET`, production cron routes return a configuration error instead of running with an unsafe default.

You can also use the Vercel CLI:

```bash
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add DEFAULT_STRIPE_ACCOUNT_ID production
```

## 9. First production smoke test

After deploy:

1. Open the admin login.
2. Open `/admin/system/stripe` and confirm Stripe plus database readiness.
3. Check `/api/health`; it should return `status: "ok"` or at least no database error.
4. Start one test subscription checkout in Stripe test mode.
5. Trigger one `invoice.payment_succeeded` webhook from Stripe.
6. Confirm that `/billing` shows the subscription invoice and email status.
7. Test one demo payout with a Stripe test connected account.
8. Confirm that no secret value appears in Git, logs, or browser output.

Start with Stripe test keys (`pk_test`, `sk_test`, `whsec_test`) before switching to live keys.
