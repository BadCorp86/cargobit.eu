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

---
Task ID: hybrid-security-complete
Agent: Main Agent
Task: Hybrid-Security-Layer Implementierungsabschluss

## Work Log:
- Überprüfung aller implementierten Komponenten
- Verifikation der Hybrid-Security-Layer Logik
- Validierung der Risk-Scoring Gewichtung (0.4 User + 0.3 Company + 0.3 Transaction)
- Bestätigung der Schwellenwerte (GREEN ≤30, YELLOW 31-60, RED ≥61)

## Stage Summary:

### Implementierte Architektur (Mermaid):
```mermaid
flowchart TD
    A[User Action] --> B{Permission Matrix}
    B -- No --> Z1[403 Forbidden]
    B -- Yes --> C[Risk Engine]
    C --> D{Combined Risk Score}
    D -- <=30 --> E[Allow Action]
    D -- 31-60 --> F[Allow + Mitigation]
    D -- >=61 --> G[Block + Support Review]
    E --> H[Action Executor]
    F --> H
    G --> I[Support Notification]
    H --> J[Audit Log]
    I --> J
```

### Hybrid-Security-Layer Flow:
1. **Permission Check** (hart, binär) → 403 wenn verweigert
2. **Risk Scoring** (dynamisch) → Combined = 0.4×User + 0.3×Company + 0.3×Transaction
3. **Entscheidung**:
   - ≤30: Allow
   - 31-60: Allow + Mitigation (Delay, 2FA, GPS-Check)
   - ≥61: Block + Support Ticket
4. **Audit Log** schreiben

### Mitigation Actions:
- DELAY_24H: 24h Wartezeit bei Payouts
- EXTRA_LOGGING: Erweitertes Logging
- GPS_VERIFICATION: GPS-Verifikation erforderlich
- TWO_FACTOR_CHALLENGE: 2FA-Challenge
- DOCUMENT_RECHECK: Dokumente neu prüfen
- SUPPORT_NOTIFICATION: Support benachrichtigen

### Status: ✅ VOLLSTÄNDIG IMPLEMENTIERT

---
Task ID: permission-matrix-schema
Agent: Main Agent
Task: Permission-Matrix als JSON-Schema Dokumentation

## Work Log:
- Permission-Matrix als JSON Schema Draft-07 definiert
- Kompakte Permission-Matrix für alle Rollen erstellt
- Validierungsbeispiel dokumentiert
- Integration in Hybrid-Security-Layer bestätigt

## Permission-Matrix JSON Schema:
```json
{
  "roles": ["ADMIN", "SUPPORT", "SHIPPER", "DISPATCHER", "DRIVER", "MARKETER"],
  "permissions": {
    "CREATE_TRANSPORT": { "allowedRoles": ["SHIPPER"] },
    "MAKE_OFFER": { "allowedRoles": ["DISPATCHER"] },
    "ACCEPT_OFFER": { "allowedRoles": ["SHIPPER"] },
    "ASSIGN_DRIVER": { "allowedRoles": ["DISPATCHER"] },
    "UPDATE_STATUS": { "allowedRoles": ["DRIVER", "DISPATCHER"] },
    "VIEW_WALLET": { "allowedRoles": ["SHIPPER", "DISPATCHER", "ADMIN", "SUPPORT"] },
    "INITIATE_PAYOUT": { "allowedRoles": ["SHIPPER", "ADMIN"] },
    "MANAGE_VEHICLES": { "allowedRoles": ["DISPATCHER"] },
    "MANAGE_USERS": { "allowedRoles": ["ADMIN"] },
    "MANAGE_PLANS": { "allowedRoles": ["ADMIN"] }
  }
}
```

## Hybrid-Security-Layer Integration:
```pseudo
if not PermissionMatrix.allows(user.role, action):
    return 403 Forbidden
// Danach: Risk-Scoring, Mitigations, Block/Allow
```

### Status: ✅ DOKUMENTIERT & IMPLEMENTIERT
