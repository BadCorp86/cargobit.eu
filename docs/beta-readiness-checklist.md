# CargoBit Beta-Readiness Checkliste

Diese Checkliste ist der harte Gate vor einer kontrollierten Beta. Vercel kann weiter als Testumgebung dienen; der produktive Zielbetrieb ist Docker Compose auf eigenem Server.

## Harte Blocker vor Beta

- `NEXT_PUBLIC_APP_URL` zeigt auf die echte Beta-Domain.
- `ENCRYPTION_KEY`, `CRON_SECRET` und `ADMIN_JWT_SECRET` sind lange, zufällige Produktionswerte.
- Stripe Live/Test-Keys, Webhook-Secrets und Business-Price-IDs sind gesetzt.
- Stripe Webhooks schreiben Wallet-Guthaben nur nach verifiziertem `checkout.session.completed`.
- `LEGAL_REVIEW_CONFIRMED=true` wird erst nach externer juristischer Prüfung gesetzt.
- `.env` und `.env.production` enthalten echte Secrets und bleiben außerhalb von Git.
- `npm run readiness:env` ist vor Beta grün.
- `npm run readiness` ist auf dem Zielserver grün.

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
- Öffentlich weiterhin `Zahlungsschutz` verwenden, nicht `Escrow`.

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
