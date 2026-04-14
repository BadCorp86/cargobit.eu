# CargoBit Development Worklog

---
Task ID: security-implementation
Agent: Main Agent
Task: Implementation der Rollen- und Berechtigungslogik sowie Sicherheitsarchitektur (Anti-Fraud, KYC, KYB)

## Work Log:

### 1. Permission System (RBAC Matrix)
- Datei: `/src/types/permissions.ts` - Erweitert
- Datei: `/src/lib/permissions.ts` - Middleware implementiert
- Kompakte Permission Matrix implementiert:
  - ADMIN: Vollzugriff, keine operativen Transporte
  - SUPPORT: Tickets, Read-Only Zugriff
  - SHIPPER: Transporte anlegen, Angebote annehmen
  - DISPATCHER: Flotte verwalten, Angebote abgeben
  - DRIVER: Aufträge sehen, Status updaten
  - MARKETER: Kampagnen nur

### 2. Risk Scoring System
- Datei: `/src/lib/risk-scoring.ts` - NEU
- Drei Score-Typen implementiert:
  - UserRiskScore (0-100)
  - CompanyRiskScore (0-100)
  - TransactionRiskScore (0-100)
- Schwellenwerte:
  - Grün (0-30): Normal durchlassen
  - Gelb (31-60): Erlauben mit Logging/Delay
  - Rot (61-100): Blockieren, manuelle Prüfung

### 3. Hybrid Security Layer
- Datei: `/src/lib/hybrid-security.ts` - NEU
- Zwei-Schichten-Prüfung:
  - Schritt 1: Permission Check (hart, binär)
  - Schritt 2: Risk Scoring (dynamisch, kontextsensitiv)
- Middleware Factory: `withHybridSecurity()`
- Audit Logging für alle Security Events

### 4. KYC Verification Service
- Datei: `/src/services/kyc.service.ts` - NEU
- Drei Verifizierungsstufen:
  - Basic: Grundlegende Identitätsprüfung
  - Standard: Mit Selfie-Match
  - Enhanced: Mit Adressverifizierung + PEP/Sanctions Check
- Driver Verification: Führerschein + ADR

### 5. KYB Verification Service
- Datei: `/src/services/kyb.service.ts` - NEU
- Unternehmensverifizierung:
  - Handelsregister-Check
  - USt-IdNr. Validierung (VIES)
  - Wirtschaftlich Berechtigte (Beneficial Owners)
  - Sanctions Screening

### 6. Fraud Detection Service
- Datei: `/src/services/fraud-detection.service.ts` - NEU
- Checks implementiert:
  - Login Pattern (Velocity, Impossible Travel)
  - Transaction Check (Amount, IBAN, Velocity)
  - GPS Plausibility (Spoofing, Route Deviation)
  - Behavioral Anomaly Detection
- Automatische Security Flag Erstellung

### 7. Auth Service mit 2FA
- Datei: `/src/services/auth.service.ts` - NEU
- Features:
  - JWT/Session Management
  - 2FA (TOTP + Backup Codes)
  - Rate Limiting
  - Account Lockout
  - Password Reset
  - Session Management

### 8. Route Protection Middleware
- Datei: `/src/middleware.ts` - NEU
- Route-spezifische Protection
- Rate Limiting per Route
- CORS Headers
- Security Headers

### 9. API Route Beispiel
- Datei: `/src/app/api/offers/accept/route.ts` - NEU
- Demonstriert Hybrid Security Layer in Aktion

## Stage Summary:

### Implementierte Dateien:
1. `/src/lib/risk-scoring.ts` - Risk Scoring System
2. `/src/lib/hybrid-security.ts` - Hybrid Security Layer
3. `/src/services/kyc.service.ts` - KYC Verification
4. `/src/services/kyb.service.ts` - KYB Verification
5. `/src/services/fraud-detection.service.ts` - Anti-Fraud
6. `/src/services/auth.service.ts` - Auth mit 2FA
7. `/src/middleware.ts` - Route Protection
8. `/src/app/api/offers/accept/route.ts` - Beispiel API

### Architektur:
```
                ┌──────────────────────────┐
                │        User Action       │
                │   (z.B. Accept Offer)    │
                └─────────────┬────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │   Permission Matrix       │
                │  (Role → Allowed?)        │
                └─────────────┬────────────┘
                        NO ───▶│ 403 Forbidden
                              │
                        YES   ▼
                ┌──────────────────────────┐
                │       Risk Engine        │
                │ UserRisk + CompanyRisk + │
                │ TransactionRisk → Score  │
                └─────────────┬────────────┘
                              │
        ┌─────────────────────┼──────────────────────────┐
        │                     │                          │
        ▼                     ▼                          ▼
   GREEN (0–30)         YELLOW (31–60)              RED (61–100)
   Allow Action         Allow + Mitigation          Block + Review
        │                     │                          │
        ▼                     ▼                          ▼
┌──────────────┐     ┌──────────────┐          ┌────────────────┐
│ ActionExec   │     │ Mitigations: │          │ Support Ticket │
│ (execute)    │     │ • 24h Delay  │          │ + Audit Log    │
└──────────────┘     │ • 2FA Check  │          │ + Notify User  │
                     │ • GPS Verify │          └────────────────┘
                     │ • Extra Log  │
                     └──────────────┘
```

### Mitigation Actions (YELLOW):
- DELAY_24H: 24h Wartezeit bei Payouts
- EXTRA_LOGGING: Erweitertes Logging aktiviert
- GPS_VERIFICATION: GPS-Verifikation erforderlich
- TWO_FACTOR_CHALLENGE: 2FA-Verifizierung erforderlich
- DOCUMENT_RECHECK: Dokumente werden erneut geprüft
- SUPPORT_NOTIFICATION: Support-Team benachrichtigt

### Risk Factors:
**UserRiskScore:**
- +20: KYC unvollständig
- +15: Neue IBAN < 48h
- +10: Hohe Stornierungsrate
- +10: Ungewöhnliche Logins
- -10: Lange Historie ohne Probleme

**TransactionRiskScore:**
- +20: Hoher Betrag > 50.000€
- +15: Neue IBAN + hoher Betrag
- +10: International + Gefahrgut
- -10: Wiederkehrender Partner
