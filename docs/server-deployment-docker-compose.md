# CargoBit Server Deployment mit Docker Compose

Dieser Weg ist der Standard für die erste kontrollierte Beta auf einem eigenen Server. Vercel bleibt damit nur Testumgebung.

## Voraussetzungen

- Ubuntu/Debian Server mit Docker und Docker Compose Plugin
- Domain zeigt per A/AAAA Record auf den Server
- Ports `80` und `443` sind offen
- Stripe Webhooks zeigen auf die endgültige Domain
- Rechtliche Freigabe liegt vor, bevor `LEGAL_REVIEW_CONFIRMED=true` gesetzt wird

## 1. Repository auf Server holen

```bash
git clone https://github.com/BadCorp86/cargobit.eu.git
cd cargobit.eu
cp .env.production.example .env.production
```

## 2. Environment setzen

Pflichtwerte in `.env.production`:

- `POSTGRES_PASSWORD`
- `NEXT_PUBLIC_APP_URL`
- `ENCRYPTION_KEY`
- `CRON_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_JWT_SECRET`
- Stripe Keys und Webhook Secrets
- `LEGAL_REVIEW_CONFIRMED=true` erst nach juristischer Prüfung

## 3. Build und Start

Compose-Datei strukturell prüfen:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml config
```

Hinweis: `docker-compose.production.yml` enthält technische Fallbacks, damit `config` ohne Shell-Exports validierbar bleibt. Für Produktion müssen die Werte trotzdem in `.env.production` gesetzt werden. `change-me-before-production` darf nie produktiv bleiben.

```bash
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d postgres redis
docker compose -f docker-compose.production.yml run --rm app bunx prisma db push
docker compose -f docker-compose.production.yml up -d
```

## 4. Health und Readiness prüfen

```bash
curl https://cargobit.eu/api/health
docker compose -f docker-compose.production.yml exec app bun run readiness
docker compose -f docker-compose.production.yml logs -f app
```

Der Readiness-Check muss vor einer echten Beta grün sein. Wenn `LEGAL_REVIEW_CONFIRMED` fehlt, ist das gewollt ein Blocker.

Um nur die Produktionsumgebung ohne DB-Verbindung zu prüfen:

```bash
docker compose -f docker-compose.production.yml exec app bun run readiness:env
```

Erwartet rot, solange echte Produktionswerte, Stripe-IDs oder juristische Freigabe fehlen.

## 5. Stripe Webhooks

Im Stripe Dashboard diese Endpunkte setzen:

- `https://cargobit.eu/api/stripe/webhook`
- `https://cargobit.eu/api/stripe/webhook/payouts`

Danach die jeweiligen `whsec_...` Werte in `.env.production` speichern und App neu starten.

```bash
docker compose -f docker-compose.production.yml restart app payout-worker
```

## 6. Backups

Täglich mindestens PostgreSQL sichern:

```bash
docker compose -f docker-compose.production.yml exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup-$(date +%F).sql
```

Backups müssen verschlüsselt und außerhalb des Servers abgelegt werden.

## 7. Beta-Betrieb

- Nutzer nur invite-only aufnehmen
- Transportwerte begrenzen
- Carrier/Fahrer manuell verifizieren
- offene Disputes täglich prüfen
- Stripe- und Wallet-Transaktionen täglich abgleichen
- keine Versicherungsabschlüsse selbst verkaufen; nur Partner-Lead weiterleiten

## 8. E2E-Testdaten auf Staging

Nur auf lokaler Umgebung oder Staging ausführen, nie auf Produktivdaten:

```bash
npm run db:seed:e2e
```

Der Seed gibt Session-Tokens aus. Diese Tokens werden für den produktionsnahen API-Test genutzt:

```bash
RUN_ORDER_E2E=true \
BASE_URL=http://localhost:3000 \
E2E_SHIPPER_TOKEN=<seed-output> \
E2E_CARRIER_TOKEN=<seed-output> \
E2E_SETTLEMENT_READY_JOB_ID=e2e_settlement_ready_transport \
E2E_CARRIER_PAYOUT_METHOD_ID=e2e_carrier_payout_method \
npm run test:e2e:order-wallet
```

Der Test nutzt `Authorization: Bearer ...` und nicht mehr `x-user-id` als primären Auth-Mechanismus.
