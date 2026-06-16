# CargoBit Beta-Readiness Checkliste

Diese Checkliste ist der harte Gate vor einer kontrollierten Beta. Vercel kann weiter als Testumgebung dienen; der produktive Zielbetrieb ist Docker Compose auf eigenem Server.

## Harte Blocker vor Beta

- `NEXT_PUBLIC_APP_URL` zeigt auf die echte Beta-Domain.
- `ALLOWED_ORIGINS` enthält nur erlaubte Frontend-/Admin-Domains, z. B. `https://cargobit.eu,https://www.cargobit.eu`. Kein `*` in Production.
- `ENCRYPTION_KEY`, `CRON_SECRET` und `ADMIN_JWT_SECRET` sind lange, zufällige Produktionswerte.
- Stripe Live/Test-Keys, Webhook-Secrets und Business-Price-IDs sind gesetzt.
- Stripe Webhooks schreiben Wallet-Guthaben nur nach verifiziertem `checkout.session.completed`.
- Echte Bankauszahlungen bleiben blockiert, bis `STRIPE_PAYOUTS_ENABLED=true`, `STRIPE_SECRET_KEY` und ein Stripe-Connect-Zielkonto gesetzt sind.
- `LEGAL_REVIEW_CONFIRMED=true` wird erst nach externer juristischer Prüfung gesetzt.
- `.env` und `.env.production` enthalten echte Secrets und bleiben außerhalb von Git.
- `npm run readiness:env` ist vor Beta grün.
- `npm run readiness` ist auf dem Zielserver grün.

## Erwartet rote Checks vor echter Konfiguration

`npm run readiness:env` darf auf lokalen Maschinen und frischen Servern rot bleiben, solange diese Werte fehlen:

- `NEXT_PUBLIC_APP_URL`
- `ALLOWED_ORIGINS`
- `ENCRYPTION_KEY`
- `CRON_SECRET`
- `ADMIN_JWT_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`
- `STRIPE_PRICE_BUSINESS_MONTHLY`
- `LEGAL_REVIEW_CONFIRMED=true`

`STRIPE_PAYOUT_WEBHOOK_SECRET`, `STRIPE_PAYOUTS_ENABLED`, `DEFAULT_STRIPE_ACCOUNT_ID` und `SENDGRID_API_KEY` sind lokal Warnungen, müssen aber vor echten Auszahlungen bzw. automatischen Rechnungs-E-Mails ebenfalls geprüft werden.

## Stripe-Testschritte vor Beta

- Stripe-Testkeys setzen: `pk_test_...`, `sk_test_...`, `whsec_...`.
- Einen Stripe-Testpreis für `STRIPE_PRICE_BUSINESS_MONTHLY` anlegen.
- `/admin/system/stripe` öffnen und fehlende Pflichtwerte prüfen.
- Business-Checkout im Testmodus durchführen.
- `checkout.session.completed` und `invoice.payment_succeeded` aus Stripe erneut senden.
- Zahlungsschutz-Aufladung testen und doppelte Webhooks prüfen.
- Sicherstellen, dass doppelte Webhooks kein Guthaben doppelt buchen.
- Payout-Provider prüfen: Ohne `STRIPE_PAYOUTS_ENABLED=true` darf Production keine Auszahlung als bezahlt markieren.
- Erst nach erfolgreichem Test und juristischer Freigabe auf Live-Keys wechseln.

## Tägliche Beta-Kontrolle

- Offene Verifizierungen prüfen.
- Offene Disputes und Support-Tickets prüfen.
- Feedback-Inbox prüfen.
- Stripe-Zahlungen mit Wallet-Transaktionen abgleichen.
- Fehlgeschlagene Payouts prüfen.
- Cron-/Worker-Läufe prüfen.
- Hohe Warenwerte, Versicherungshinweise und Risikofälle manuell kontrollieren.

## Operative Beta-Grenzen

- Invite-only Nutzeraufnahme.
- Nur manuell geprüfte Carrier/Fahrer.
- Begrenzte Auftragswerte.
- Keine Garantie, dass jeder Auftrag angenommen wird.
- Versicherung nur als Partner-/Lead-Modell, nicht als eigener Versicherungsabschluss.
- Öffentlich weiterhin `Zahlungsschutz` verwenden, nicht den englischen Treuhandbegriff.

## Commit-Scope

Vorgeschlagene Commit-Blöcke:

- `feat(readiness): harden auth and wallet topup`
- `feat(legal): add beta legal pages and readiness gate`
- `feat(deploy): add docker compose production runbook`
- `test(e2e): add order wallet settlement coverage`

Vor jedem Push:

```bash
git diff --check
npx tsc --noEmit --pretty false
npm run lint
npm run build
npm run dev:check
npm run readiness:env
```

`npm run readiness:env` darf nur vorübergehend rot sein, wenn bewusst noch echte Produktionswerte oder die juristische Freigabe fehlen.
