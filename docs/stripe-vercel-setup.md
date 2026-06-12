# CargoBit Stripe Setup für Testumgebung und Server-Beta

Diese Checkliste beschreibt Stripe für CargoBit, ohne echte Secrets in Git zu speichern. Vercel kann weiter für Tests genutzt werden; der Zielbetrieb für die Beta ist ein eigener Server mit Docker Compose.

## 1. Secrets nicht committen

Echte Werte gehören ausschließlich in lokale `.env`-Dateien, Server-Umgebungsvariablen oder die jeweilige Testumgebung:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`
- `STRIPE_PAYOUT_WEBHOOK_SECRET`
- `ADMIN_PASSWORD`
- `ADMIN_JWT_SECRET`
- `ENCRYPTION_KEY`
- `CRON_SECRET`
- `DATABASE_URL`
- `SENDGRID_API_KEY`

`.env.example` und `.env.production.example` bleiben Vorlagen mit Platzhaltern.

## 2. Pflichtvariablen

Für Staging/Beta müssen diese Werte gesetzt sein:

```env
NEXT_PUBLIC_APP_URL=https://cargobit.eu
NEXT_PUBLIC_URL=https://cargobit.eu
DATABASE_URL=postgresql://...
REDIS_URL=redis://redis:6379
ENCRYPTION_KEY=...
CRON_SECRET=...
ADMIN_EMAIL=admin@cargobit.eu
ADMIN_PASSWORD=...
ADMIN_JWT_SECRET=...
LEGAL_REVIEW_CONFIRMED=false
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_...
STRIPE_PAYOUT_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
```

Für automatische E-Mails zusätzlich:

```env
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@cargobit.eu
SENDGRID_FROM_NAME=CargoBit
```

`LEGAL_REVIEW_CONFIRMED=true` wird erst gesetzt, wenn Impressum, Datenschutz, AGB, Zahlungsschutzbedingungen, Vermittler-/Haftungshinweise und Partner-/Versicherungshinweise juristisch geprüft wurden.

## 3. Business-Preis in Stripe

Aktives Beta-Modell:

| Tarif | Monatlich netto | Auftragslimit | CargoBit-Provision | Zahlungsschutz-Gebühr |
| --- | ---: | ---: | ---: | ---: |
| Start | 0 € | 10 Aufträge/Monat | 14% | 3,5% |
| Business | 89 € | 30 Aufträge/Monat | 12% | 2,5% |

In Stripe wird vorerst nur der Business-Tarif als wiederkehrender Preis benötigt:

```env
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
```

Die früheren Starter-, Professional- und Enterprise-Preisvariablen werden nicht mehr als aktive Beta-Konfiguration verwendet.

## 4. Datenbank vorbereiten

CargoBit nutzt PostgreSQL. SQLite- oder `file:`-URLs sind für alte lokale Experimente und nicht beta-tauglich.

Auf dem Zielserver:

```bash
npm run db:deploy
npm run readiness
```

In Docker Compose:

```bash
docker compose -f docker-compose.production.yml run --rm app bunx prisma db push
docker compose -f docker-compose.production.yml exec app bun run readiness
```

## 5. Stripe Webhooks

In Stripe zwei Webhook-Endpunkte anlegen:

```text
https://cargobit.eu/api/stripe/webhook
https://cargobit.eu/api/stripe/webhook/payouts
```

Events für `/api/stripe/webhook`:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Events für `/api/stripe/webhook/payouts`:

- `transfer.created`
- `transfer.reversed`
- `transfer.updated`
- `payout.created`
- `payout.paid`
- `payout.failed`
- `payout.canceled`

Separate Webhook-Secrets sind empfohlen. `STRIPE_WEBHOOK_SECRET` bleibt nur als Fallback erhalten.

## 6. Zahlungsschutz und Auszahlungen

Stripe verarbeitet die technische Zahlung. CargoBit zeigt gegenüber Nutzern den internen Zahlungsschutz:

- Verlader lädt Guthaben oder bezahlt über Stripe.
- CargoBit reserviert auftragsbezogen den nötigen Betrag.
- Nach POD, Rechnung, Risk Gate und 24-Werktagsstunden wird Guthaben für Transporteur/Fahrer freigegeben.
- Bankauszahlung startet nur aus dem eigenen Wallet-Bereich und nur mit verifizierter Auszahlungsmethode.

Für echte Carrier-/Fahrer-Auszahlungen wird Stripe Connect oder ein gleichwertiger Payout-Provider benötigt.

## 7. Readiness vor Beta

Vor der Beta müssen diese Checks reproduzierbar laufen:

```bash
npm run readiness:env
npm run readiness
npm run build
npm run lint
npm run dev:check
```

`npm run readiness:env` bleibt absichtlich rot, solange Produktivwerte, Stripe-IDs oder juristische Freigabe fehlen.

## 8. Stripe-Testablauf

1. Test-Keys setzen: `pk_test_...`, `sk_test_...`, `whsec_...`.
2. `STRIPE_PRICE_BUSINESS_MONTHLY` mit einem Stripe-Testpreis befüllen.
3. App starten und `/admin/system/stripe` prüfen.
4. Business-Checkout im Testmodus starten.
5. Webhook `checkout.session.completed` aus Stripe auslösen.
6. Prüfen, dass Abonnement-/Rechnungsdaten gespeichert werden.
7. Zahlungsschutz-Aufladung testen.
8. Doppelte Webhooks testen; Guthaben darf nicht doppelt gebucht werden.

Live-Keys werden erst nach erfolgreicher Testumgebung und juristischer Freigabe verwendet.
