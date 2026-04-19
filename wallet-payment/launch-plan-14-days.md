# CargoBit 14-Tage Launch-Plan

## Übersicht

Dieser Plan führt dich Schritt für Schritt zum Go-Live in 14 Tagen.

**Startdatum:** 2026-04-20  
**Go-Live:** 2026-05-04

---

## Woche 1 — Produkt & Infrastruktur

### Tag 1 (Mo, 20.04.) — Stripe einrichten

**Ziel:** Stripe-Account vollständig konfiguriert

**Aufgaben:**
- [ ] Stripe-Account erstellen unter stripe.com
- [ ] Business-Daten eintragen (Firmenname, Adresse, USt-ID)
- [ ] Bankkonto verknüpfen für Auszahlungen
- [ ] Stripe Connect aktivieren (für Transporteur-Payouts)
- [ ] API-Keys generieren (Test-Keys zuerst)
- [ ] Webhook-Secret notieren
- [ ] Test-Produkte in Stripe anlegen:
  - Free (0 EUR)
  - Pro (9,99 EUR/Monat)
  - Business (24,99 EUR/Monat)
  - Fleet (39,99 EUR/Monat)

**Dauer:** 2-3 Stunden

**Blocker vermeiden:**
- Bankkonto muss auf deinen Namen lauten
- USt-ID muss korrekt sein

---

### Tag 2 (Di, 21.04.) — Wallet-System implementieren

**Ziel:** Datenbank und Backend für Wallets

**Aufgaben:**
- [ ] SQL-Schema ausführen (wallet_schema.sql)
- [ ] API-Endpoints erstellen:
  - GET /wallet/:userId — Wallet abrufen
  - GET /wallet/:userId/transactions — Transaktionshistorie
  - POST /wallet/topup/create-session — Top-Up Session
  - POST /wallet/payout/request — Auszahlung anfordern
- [ ] Webhook-Handler deployen (stripe_webhook_handler.py)
- [ ] Tests: Top-Up mit Stripe Test-Cards

**Dauer:** 4-6 Stunden

**Test-Cards:**
- Erfolgreich: 4242 4242 4242 4242
- Fehler: 4000 0000 0000 0002

---

### Tag 3 (Mi, 22.04.) — Payout-Flow & Connect

**Ziel:** Auszahlungen an Transporteure

**Aufgaben:**
- [ ] Stripe Connect Onboarding-Flow erstellen
- [ ] Connected Account Tabelle füllen
- [ ] Payout-Request API finalisieren
- [ ] Test-Auszahlung im Test-Modus
- [ ] Gebührenlogik implementieren (3,5% / 2,5% / 1,5%)

**Dauer:** 4-5 Stunden

---

### Tag 4 (Do, 23.04.) — Abo-System

**Ziel:** Subscription-Management

**Aufgaben:**
- [ ] Stripe Checkout Sessions für Abos
- [ ] Subscription-Status in DB speichern
- [ ] Webhooks für Abo-Events:
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
- [ ] Abo-Kündigung implementieren

**Dauer:** 3-4 Stunden

---

### Tag 5 (Fr, 24.04.) — Feature-Gates

**Ziel:** Limits pro Abo durchsetzen

**Aufgaben:**
- [ ] Middleware für Abo-Check
- [ ] Limits implementieren:
  - Free: 2 aktive Aufträge
  - Pro: unbegrenzt
  - Business: unbegrenzt + Analytics
- [ ] Wallet-Gebühren nach Abo differenzieren
- [ ] Premium-Features hinter Abo
- [ ] UI-Badges für Abo-Status

**Dauer:** 3-4 Stunden

---

### Tag 6 (Sa, 25.04.) — Rechtliches

**Ziel:** Alle rechtlichen Dokumente

**Aufgaben:**
- [ ] AGB erstellen (Vorlage anpassen)
- [ ] Datenschutzbestimmungen (DSGVO)
- [ ] Impressum (vollständig)
- [ ] Widerrufsbelehrung
- [ ] Cookie-Banner einbauen
- [ ] Footer mit allen Links

**Dauer:** 2-3 Stunden

**Ressourcen:**
- eRecht24 für AGB-Vorlagen
- Iubenda für Datenschutz

---

### Tag 7 (So, 26.04.) — End-to-End Testing

**Ziel:** Alle Flows funktionieren

**Aufgaben:**
- [ ] Registrierung testen (Verlader + Transporteur)
- [ ] Top-Up mit Test-Card
- [ ] Auftrag einstellen
- [ ] Angebot abgeben
- [ ] Matching
- [ ] Zahlung
- [ ] Abo abschließen
- [ ] Abo kündigen
- [ ] Payout anfordern (Test)

**Dauer:** 4-5 Stunden

---

## Woche 2 — Marketing & Onboarding

### Tag 8 (Mo, 27.04.) — Landing Page final

**Ziel:** Landing Page ist produktionsreif

**Aufgaben:**
- [ ] HTML/CSS aus landing-page.html übernehmen
- [ ] Alle Links funktionieren
- [ ] Mobile Responsiveness testen
- [ ] SEO-Meta-Tags
- [ ] Open Graph Tags für Social Sharing
- [ ] Favicon und Logo
- [ ] Load-Time optimieren (< 3 Sek.)

**Dauer:** 3-4 Stunden

---

### Tag 9 (Di, 28.04.) — Content & Assets

**Ziel:** Alle Marketing-Assets

**Aufgaben:**
- [ ] Screenshots der Plattform
- [ ] Erklärvideo (optional: Loom, 2-3 Min.)
- [ ] FAQ-Seite schreiben
- [ ] How-it-works-Seite
- [ ] Testimonials vorbereiten (fiktiv für Start)

**Dauer:** 3-4 Stunden

---

### Tag 10 (Mi, 29.04.) — Outreach starten

**Ziel:** Erste 10 Transporteure kontaktieren

**Aufgaben:**
- [ ] Liste mit 20 Transporteuren erstellen
- [ ] E-Mail-Vorlagen anpassen
- [ ] 10 E-Mails versenden
- [ ] 5 LinkedIn-Nachrichten
- [ ] 3 Facebook-Gruppen-Posts
- [ ] Kleinanzeigen schalten

**Dauer:** 4-5 Stunden

---

### Tag 11 (Do, 30.04.) — Outreach intensivieren

**Ziel:** Weitere 20 Kontakte + Follow-ups

**Aufgaben:**
- [ ] Follow-ups an Tag-10-Kontakte
- [ ] 10 weitere E-Mails
- [ ] WhatsApp-Gruppen nutzen
- [ ] Lokale Speditionen anrufen
- [ ] Alle Antworten im CRM tracken

**Dauer:** 4-5 Stunden

---

### Tag 12 (Fr, 01.05.) — Verlader gewinnen

**Ziel:** Erste 10 Verlader kontaktieren

**Aufgaben:**
- [ ] Liste mit lokalen Unternehmen erstellen:
  - Möbelhäuser
  - Baumärkte
  - Autohäuser
  - Elektronikhändler
- [ ] 10 E-Mails an potenzielle Verlader
- [ ] Kleinanzeigen für "Transport gesucht"
- [ ] Freunde/Familie für ersten Auftrag bitten

**Dauer:** 3-4 Stunden

---

### Tag 13 (Sa, 02.05.) — Social Media Launch

**Ziel:** Sichtbarkeit auf allen Kanälen

**Aufgaben:**
- [ ] LinkedIn Launch-Post (persönlich)
- [ ] LinkedIn Unternehmensseite erstellen
- [ ] Facebook-Post auf Unternehmensseite
- [ ] 3 Facebook-Gruppen posten
- [ ] Instagram (falls vorhanden)
- [ ] X/Twitter (falls vorhanden)

**Dauer:** 2-3 Stunden

---

### Tag 14 (So, 03.05.) — GO-LIVE

**Ziel:** Plattform öffentlich zugänglich

**Aufgaben:**
- [ ] Stripe von Test- auf Live-Modus umstellen
- [ ] Alle Webhooks auf Production
- [ ] Live-API-Keys einsetzen
- [ ] Monitoring aktivieren
- [ ] Fehler-Tracking (Sentry o.ä.)
- [ ] Launch-Post auf allen Kanälen
- [ ] E-Mail an alle registrierten Nutzer
- [ ] Ersten echten Auftrag feiern!

**Dauer:** 3-4 Stunden

---

## Meilensteine & KPIs

### Kritische Meilensteine

| Meilenstein | Deadline | Status |
|-------------|----------|--------|
| Stripe + Wallet fertig | Tag 3 | ⬜ |
| Abo-System aktiv | Tag 5 | ⬜ |
| Rechtliches final | Tag 7 | ⬜ |
| 10 Transporteure registriert | Tag 12 | ⬜ |
| 5 Verlader registriert | Tag 13 | ⬜ |
| GO-LIVE | Tag 14 | ⬜ |

---

### KPIs nach Go-Live (Woche 3-4)

| KPI | Ziel | Messung |
|-----|------|---------|
| Registrierungen | 50 | Analytics |
| Aktive Transporteure | 15 | Dashboard |
| Aktive Verlader | 10 | Dashboard |
| Erste Aufträge | 20 | DB |
| Erste erfolgreiche Transporte | 10 | DB |
| Wallet-Transaktionen | 2.000 EUR | Stripe |

---

## Risiken & Mitigation

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Stripe-Verifizierung verzögert | Mittel | Hoch | Früh starten, alle Dokumente bereithalten |
| Keine Transporteure gefunden | Mittel | Hoch | Intensiver Outreach, Incentives |
| Technische Bugs | Hoch | Mittel | Gründliches Testing Tag 7 |
| Lange Ladezeiten | Niedrig | Mittel | Caching, CDN nutzen |

---

## Nach dem Launch

### Woche 3-4
- [ ] Tägliches Monitoring
- [ ] Nutzer-Feedback sammeln
- [ ] Bugs priorisiert fixen
- [ ] Weitere Transporteure onboarden
- [ ] Marketing fortsetzen
- [ ] Erste Testimonials sammeln

### Woche 5-8
- [ ] A/B-Testing der Preise
- [ ] Google Ads starten (500 EUR Budget)
- [ ] Erste Case Studies
- [ ] Referral-Programm überlegen
- [ ] App-Entwicklung evaluieren

---

**Erstellt:** 2026-04-19  
**Version:** 1.0.0
