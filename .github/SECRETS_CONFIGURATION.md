# GitHub Secrets Configuration

CargoBit nutzt GitHub Actions aktuell für Beta-Readiness, manuelle Prüfungen und optionale Betriebsjobs. Vercel ist keine Produktionspflicht. Der Zielbetrieb bleibt ein eigener Server mit Docker Compose, PostgreSQL, Redis und Reverse Proxy.

## Primärer CI-Workflow

Der automatische Workflow auf `main` ist:

- `.github/workflows/ci.yml`
- nutzt `npm ci`, `package-lock.json`, Prisma, TypeScript, ESLint und Next.js Build
- erwartet keine Slack-, Docker-, AWS- oder Vercel-Secrets
- führt `readiness:env` separat als dokumentierten Readiness-Job aus

Alle älteren Spezial-Workflows für Loadtests, Docker Images, ML, Security Gateway, E2E-Sonderfälle und Secret Rotation sind manuell oder optional.

## Required Environment Secrets

Diese Secrets gehören in die GitHub Environments `staging` und `production`, falls der manuelle Workflow `Production Readiness` genutzt wird.

| Secret Name | Beschreibung |
|-------------|--------------|
| `DATABASE_URL` | PostgreSQL-Verbindung der Zielumgebung |
| `ENCRYPTION_KEY` | Langer zufälliger Verschlüsselungs-Key |
| `CRON_SECRET` | Secret für Cron-/Worker-Endpunkte |
| `ADMIN_EMAIL` | Admin-Login-E-Mail |
| `ADMIN_PASSWORD` | Admin-Login-Passwort |
| `ADMIN_JWT_SECRET` | Langer zufälliger Admin-JWT-Secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Publishable Key der Umgebung |
| `STRIPE_SECRET_KEY` | Stripe Secret Key der Umgebung |
| `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` | Stripe Webhook Signing Secret für Business-Abos |
| `STRIPE_PAYOUT_WEBHOOK_SECRET` | Stripe Webhook Signing Secret für Auszahlungen |
| `STRIPE_PRICE_BUSINESS_MONTHLY` | Stripe Price ID für Business 89 EUR netto/Monat |

## Required Environment Variables

Diese Werte gehören unter **Secrets and variables → Actions → Environments → Variables**.

| Variable Name | Beschreibung |
|---------------|--------------|
| `NEXT_PUBLIC_APP_URL` | Öffentliche URL der Umgebung, z. B. `https://cargobit.eu` |
| `LEGAL_REVIEW_CONFIRMED` | Erst nach juristischer Prüfung auf `true` setzen |

## Optional Secrets

Diese Secrets sind nicht erforderlich, damit die Beta-CI auf `main` grün wird.

| Secret Name | Einsatz |
|-------------|---------|
| `SENDGRID_API_KEY` | Echte E-Mail-Zustellung |
| `SENDGRID_FROM_EMAIL` | Absenderadresse für System- und Rechnungs-E-Mails |
| `DOCKER_REGISTRY` | Manueller Docker Image Push |
| `DOCKER_USERNAME` | Manueller Docker Image Push |
| `DOCKER_PASSWORD` | Manueller Docker Image Push |
| `DOCKER_NAMESPACE` | Manueller Docker Image Push |
| `SLACK_WEBHOOK_URL` | Optionale Benachrichtigungen in manuellen Legacy-Workflows |
| `AWS_ACCESS_KEY_ID` | Optionale ML-/S3-Workflows |
| `AWS_SECRET_ACCESS_KEY` | Optionale ML-/S3-Workflows |
| `ML_MODELS_BUCKET` | Optionale ML-Modellablage |
| `ML_REGISTRY_DB` | Optionale ML-Modellregistry |

## Nicht mehr aktiv benötigte Preis-Secrets

Die alten Stripe-Price-Secrets für Starter, Professional und Enterprise werden für das aktuelle Beta-Modell nicht mehr verwendet. In neuen Workflows und Environments wird nur noch der Business-Monatspreis benötigt.

Aktuelles Modell:

- Start über Provision und Zahlungsschutz
- Business 89 EUR netto/Monat
- Business behält CargoBit-Provision von 12 Prozent
- öffentlich wird der Begriff `Zahlungsschutz` verwendet

## GitHub UI

1. Repository öffnen
2. **Settings → Secrets and variables → Actions**
3. Für echte Zielumgebungen möglichst **Environments** verwenden
4. Secrets und Variables getrennt anlegen
5. Keine echten Werte in Workflow-Dateien oder Dokumentation schreiben

## GitHub CLI Beispiele

```bash
gh secret set DATABASE_URL --env staging --body "postgresql://..."
gh secret set ENCRYPTION_KEY --env staging --body "..."
gh secret set CRON_SECRET --env staging --body "..."
gh secret set ADMIN_JWT_SECRET --env staging --body "..."
gh secret set STRIPE_SECRET_KEY --env staging --body "sk_test_..."
gh secret set STRIPE_PRICE_BUSINESS_MONTHLY --env staging --body "price_..."

gh variable set NEXT_PUBLIC_APP_URL --env staging --body "https://staging.cargobit.eu"
gh variable set LEGAL_REVIEW_CONFIRMED --env staging --body "false"
```

## Vor Beta-Freigabe

`npm run readiness:env` darf erst grün werden, wenn echte Werte gesetzt sind und die Rechtsprüfung bestätigt wurde. Bis dahin ist ein roter Readiness-Status korrekt und gewollt.

Minimal zu prüfen:

- Stripe Test-Checkout für Business-Abo
- Stripe Test-Topup für Zahlungsschutz
- Stripe Webhook-Signaturprüfung
- doppelter Webhook schreibt keine doppelte Gutschrift
- Auftrag bis Wallet-Reservierung
- Gebot, Annahme, POD, Rechnung, Wallet-Freigabe
- Bankauszahlung nur aus eigenem Wallet
- Admin-/Support-Zugriffe
- Backup/Restore auf dem Zielserver
