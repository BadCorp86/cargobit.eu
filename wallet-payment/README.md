# CargoBit Wallet & Payment Integration

## Übersicht

Dieses Verzeichnis enthält alle Dateien für die Wallet- und Zahlungsintegration von CargoBit.

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `wallet_schema.sql` | Vollständiges Datenbank-Schema für Wallets, Transaktionen, Payouts und Abos |
| `stripe_webhook_handler.py` | Produktionsreifer Webhook-Handler für Stripe-Events |
| `landing-page.html` | Fertige Landing Page (HTML/CSS/JS) |
| `outreach-carriers.csv` | CRM-Vorlage für Transporteure |
| `outreach-shippers.csv` | CRM-Vorlage für Verlader |
| `outreach-marketing-channels.csv` | Übersicht der Marketing-Kanäle |
| `outreach-templates.md` | Alle Outreach-Vorlagen (E-Mail, WhatsApp, LinkedIn, Kleinanzeigen) |
| `launch-plan-14-days.md` | Detaillierter 14-Tage-Launch-Plan |

---

## Schnellstart

### 1. Datenbank einrichten

```bash
# Mit PostgreSQL verbinden
psql -U postgres -d cargobit

# Schema ausführen
\i wallet_schema.sql
```

### 2. Stripe konfigurieren

```bash
# Umgebungsvariablen setzen
export STRIPE_SECRET_KEY="sk_test_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
export DATABASE_URL="postgresql://user:pass@localhost:5432/cargobit"

# Webhook-Handler starten
python stripe_webhook_handler.py
```

### 3. Landing Page deployen

```bash
# Landing Page kopieren
cp landing-page.html /var/www/html/index.html

# Oder in Next.js integrieren
```

### 4. Outreach starten

1. `outreach-carriers.csv` in Excel/Google Sheets öffnen
2. Kontakte eintragen
3. Vorlagen aus `outreach-templates.md` nutzen
4. Täglich im CRM aktualisieren

---

## Wallet-Gebühren

| Abo | User-Typ | Wallet-Fee | Payout-Fee |
|-----|----------|------------|------------|
| Free | Verlader | 3,5% | - |
| Pro | Verlader | 2,5% | - |
| Business | Verlader | 1,5% | - |
| Starter | Transporteur | 3,5% | 1% + 0,50€ |
| Pro | Transporteur | 2,0% | 0,5% + 0,25€ |
| Fleet | Transporteur | 1,0% | 0% |

---

## Stripe-Webhook-Events

Der Handler verarbeitet folgende Events:

| Event | Aktion |
|-------|--------|
| `payment_intent.succeeded` | Wallet aufladen |
| `checkout.session.completed` | Top-Up Session abschließen |
| `customer.subscription.created` | Abo anlegen |
| `customer.subscription.updated` | Abo aktualisieren |
| `customer.subscription.deleted` | Abo kündigen |
| `invoice.paid` | Abo-Zahlung erfolgreich |
| `invoice.payment_failed` | Abo-Zahlung fehlgeschlagen |
| `payout.paid` | Auszahlung erfolgreich |
| `payout.failed` | Auszahlung fehlgeschlagen |
| `charge.refunded` | Rückerstattung |
| `account.updated` | Connect Account aktualisiert |

---

## API-Endpoints

### Wallet

```
GET  /wallet/{user_id}                 # Wallet-Status
GET  /wallet/{user_id}/transactions    # Transaktionshistorie
POST /wallet/topup/create-session      # Top-Up Session erstellen
POST /wallet/payout/request            # Auszahlung anfordern
```

### Webhooks

```
POST /stripe/webhook                   # Stripe Webhook Handler
```

---

## Test-Cards (Stripe)

| Karte | Ergebnis |
|-------|----------|
| 4242 4242 4242 4242 | Erfolgreich |
| 4000 0000 0000 0002 | Fehler (Ablehnung) |
| 4000 0000 0000 9995 | Unzureichendes Guthaben |

---

## Launch-Checkliste

- [ ] Stripe-Account erstellt und verifiziert
- [ ] Bankkonto verknüpft
- [ ] API-Keys generiert
- [ ] Webhook-Secret notiert
- [ ] Datenbank-Schema ausgeführt
- [ ] Webhook-Handler deployt
- [ ] Landing Page online
- [ ] AGB, Datenschutz, Impressum
- [ ] Erste Transporteure kontaktiert
- [ ] Erste Verlader kontaktiert
- [ ] Test-Transaktionen erfolgreich
- [ ] Live-Modus aktiviert

---

## Support

Bei Fragen oder Problemen:
- E-Mail: support@cargobit.de
- Telefon: +49 30 123 456 78

---

**Version:** 1.0.0  
**Erstellt:** 2026-04-19  
**Letzte Aktualisierung:** 2026-04-19
