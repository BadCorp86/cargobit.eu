# 🧱 BLOCK BB — Developer‑Portal Enterprise‑Architecture‑Blueprint

## Master-Artefakt für Architektur-Reviews und Team-Referenz

---

## 1. Scope & Leitprinzipien

### 1.1 Scope

Der Enterprise-Architecture-Blueprint deckt folgende Bereiche ab:

| Domäne | Beschreibung |
|--------|--------------|
| **Developer‑Portal (UI + Docs)** | Öffentliches Portal, Dokumentation, Guides |
| **Tools‑Suite** | API Explorer, Webhook Simulator, Replay, Schema Viewer, Determinism Checker |
| **Partner‑Dashboard & Onboarding** | Partner-Verwaltung, Onboarding-Wizard, Zertifizierung |
| **Governance, Security, Compliance** | Policies, Audits, Reviews, Approvals |
| **Observability & Ops** | Logs, Metrics, Traces, Incidents, Runbooks |
| **AI‑Layer & Self‑Healing** | RAG, automatische Problemlösung, intelligente Hinweise |
| **Multi‑Region & Enterprise‑Integration** | Globale Verfügbarkeit, Enterprise-Connectoren |

### 1.2 Leitprinzipien

Diese fünf Prinzipien leiten alle Architekturentscheidungen:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARCHITEKTUR-LEITPRINZIPIEN                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. DETERMINISTISCH                                             │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ Gleiche Inputs → Gleiche Outputs                    │     │
│     │ Keine hidden state, keine surprises                 │     │
│     │ Reproduzierbare Ergebnisse in allen Umgebungen      │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  2. AUDITIERBAR                                                 │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ Jede Entscheidung, jeder Flow nachvollziehbar       │     │
│     │ Vollständige Protokollierung aller Änderungen       │     │
│     │ Traceability von Request bis Response               │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  3. ISOLIERT                                                    │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ Portal ≠ Core‑Transaktionssystem                    │     │
│     │ Keine direkten Datenbankzugriffe auf Core           │     │
│     │ Klare Schnittstellen und Service-Boundaries         │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  4. COMPOSABLE                                                  │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ Alles modular, ersetzbar                            │     │
│     │ Lose Kopplung, hohe Kohäsion                        │     │
│     │ Plugin-fähige Architektur                           │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  5. DEVELOPER‑FIRST                                             │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ Jede Architekturentscheidung spürbar in der DX      │     │
│     │ Performance als Feature                             │     │
│     │ Feedback-Schleifen in jeden Flow integriert         │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Domänen & Systemlandschaft

### 2.1 Domänen-Modell

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CARGOBIT DEVELOPER PORTAL                          │
│                           DOMÄNEN-MODELL                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐       │
│  │ DOCS & KNOWLEDGE  │  │ EXECUTION TOOLS   │  │ PARTNER & IDENTITY│       │
│  ├───────────────────┤  ├───────────────────┤  ├───────────────────┤       │
│  │ • Inhalte         │  │ • API Explorer    │  │ • Accounts        │       │
│  │ • IA              │  │ • Webhook Tools   │  │ • Rollen          │       │
│  │ • Suche           │  │ • Determinism     │  │ • Zertifizierung  │       │
│  │ • Guides          │  │ • Replay          │  │ • Scoring         │       │
│  │ • API Reference   │  │ • Schema Viewer   │  │ • Onboarding      │       │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘       │
│                                                                             │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐       │
│  │ GOVERNANCE &      │  │ OBSERVABILITY     │  │ AI & AUTOMATION   │       │
│  │ COMPLIANCE        │  │ & OPS             │  │                   │       │
│  ├───────────────────┤  ├───────────────────┤  ├───────────────────┤       │
│  │ • Policies        │  │ • Logs            │  │ • RAG             │       │
│  │ • Audits          │  │ • Metrics         │  │ • Self-Healing    │       │
│  │ • Reviews         │  │ • Traces          │  │ • Scoring         │       │
│  │ • Approvals       │  │ • Incidents       │  │ • Guardrails      │       │
│  │ • Deprecation     │  │ • Runbooks        │  │ • Prompt Logging  │       │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Systemlandschaft (Logisch)

| System | Beschreibung | Technologie-Stack |
|--------|--------------|-------------------|
| **Portal Frontend** | SSG, UI, Routing, i18n | Next.js, Tailwind, shadcn/ui |
| **Tools Backend** | API-Proxy, Webhook Engine, Replay, Determinism | Node.js, TypeScript |
| **Search Engine** | Index, Ranking, Semantik | Elasticsearch / Algolia |
| **Partner Service** | Accounts, Scoring, Zertifizierung | Node.js, PostgreSQL |
| **Governance Service** | Policies, Reviews, Approvals | Node.js, PostgreSQL |
| **Observability Stack** | Logging, Metrics, Tracing, Dashboards | Datadog / Grafana Stack |
| **AI Gateway** | RAG, Guardrails, Prompt/Output-Logging | Custom + LLM Provider |

### 2.3 System-Interaktionen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM-INTERAKTIONEN                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐                              ┌─────────────────────────┐   │
│  │   Portal    │◄────────────────────────────►│   Search Engine         │   │
│  │  Frontend   │                              │   (Elasticsearch)       │   │
│  └──────┬──────┘                              └─────────────────────────┘   │
│         │                                                                   │
│         │ HTTP/REST                                                         │
│         ▼                                                                   │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────────────────────┐  │
│  │   Tools     │◄────►│   Partner   │◄────►│   Governance Service        │  │
│  │  Backend    │      │  Service    │      │   (Policies, Reviews)       │  │
│  └──────┬──────┘      └──────┬──────┘      └─────────────────────────────┘  │
│         │                    │                                               │
│         │                    │                                               │
│         │                    ▼                                               │
│         │             ┌─────────────┐                                        │
│         │             │   Partner   │                                        │
│         └────────────►│   Database  │                                        │
│                       │ (PostgreSQL)│                                        │
│                       └─────────────┘                                        │
│                                                                             │
│         ┌─────────────────────────────────────────────────────────────┐     │
│         │                    EXTERNE SYSTEME                           │     │
│         ├─────────────────────────────────────────────────────────────┤     │
│         │                                                             │     │
│         │  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐   │     │
│         │  │ CargoBit Core  │  │   Identity     │  │     AI       │   │     │
│         │  │     APIs       │  │   Provider     │  │   Gateway    │   │     │
│         │  │  (Zahlungen)   │  │ (SSO/SAML)     │  │   (RAG)      │   │     │
│         │  └────────────────┘  └────────────────┘  └──────────────┘   │     │
│         │                                                             │     │
│         │  ┌────────────────┐  ┌────────────────┐                     │     │
│         │  │ Observability  │  │    Status      │                     │     │
│         │  │    Stack       │  │    Page        │                     │     │
│         │  │ (Datadog)      │  │ (Incidents)    │                     │     │
│         │  └────────────────┘  └────────────────┘                     │     │
│         │                                                             │     │
│         └─────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Architektur‑Sichten (C4-Modell)

### 3.1 Kontext‑Sicht (C4 Level 1)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         C4 LEVEL 1 - SYSTEM CONTEXT                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         ┌─────────────────┐                                 │
│                         │    Developer    │                                 │
│                         │   (External)    │                                 │
│                         └────────┬────────┘                                 │
│                                  │                                          │
│                                  │ HTTPS                                    │
│                                  ▼                                          │
│     ┌────────────────────────────────────────────────────────────┐          │
│     │                                                            │          │
│     │              CARGOBIT DEVELOPER PORTAL                     │          │
│     │                                                            │          │
│     │  • Dokumentation & Guides                                  │          │
│     │  • API Explorer & Testing Tools                            │          │
│     │  • Webhook Simulator & Debugger                            │          │
│     │  • Partner Dashboard & Onboarding                          │          │
│     │  • Governance & Compliance                                 │          │
│     │                                                            │          │
│     └────────┬───────────────────────────────────┬───────────────┘          │
│              │                                   │                          │
│              │ Internal API                      │ SSO/OAuth                │
│              ▼                                   ▼                          │
│     ┌─────────────────┐                ┌─────────────────┐                  │
│     │  CargoBit Core  │                │   Identity      │                  │
│     │     APIs        │                │   Provider      │                  │
│     │  (Zahlungen)    │                │ (SSO/SAML/OIDC) │                  │
│     └─────────────────┘                └─────────────────┘                  │
│                                                                             │
│              ┌───────────────────────────────────────────────┐              │
│              │                                               │              │
│              ▼                                               ▼              │
│     ┌─────────────────┐              ┌─────────────────┐  ┌──────────────┐  │
│     │ Observability   │              │   AI‑Gateway    │  │  Status Page │  │
│     │    Stack        │              │   (RAG, Docs)   │  │  / Incident  │  │
│     │ (Logs/Metrics)  │              │                 │  │    System    │  │
│     └─────────────────┘              └─────────────────┘  └──────────────┘  │
│                                                                             │
│     Legende:                                                                │
│     [Person]  Rechteck = System                                             │
│     [System]  Pfeil = Datenfluss / Kommunikation                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Kontext-Beschreibung:**

| Interaktion | Beschreibung | Protokoll |
|-------------|--------------|-----------|
| Developer → Portal | Dokumentation lesen, Tools nutzen, Onboarding | HTTPS |
| Portal → CargoBit Core APIs | API-Calls über Tools Backend | HTTPS/REST |
| Portal → Identity Provider | Authentifizierung, SSO | SAML/OIDC |
| Portal → Observability Stack | Logs, Metrics, Traces senden | OTLP/HTTPS |
| Portal → AI-Gateway | RAG-Queries für Dokumentation | HTTPS/REST |
| Portal → Status Page | Incident-Updates | HTTPS |

### 3.2 Container‑Sicht (C4 Level 2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         C4 LEVEL 2 - CONTAINER VIEW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         DEVELOPER PORTAL                            │    │
│  │                                                                     │    │
│  │  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────┐  │    │
│  │  │   Web Frontend    │  │   Tools Service   │  │ Search Service  │  │    │
│  │  │   (SSG, CDN)      │  │   (Node.js)       │  │ (Elasticsearch) │  │    │
│  │  │                   │  │                   │  │                 │  │    │
│  │  │ • Next.js SSG     │  │ • API Explorer    │  │ • Index         │  │    │
│  │  │ • Tailwind CSS    │  │ • Webhook Engine  │  │ • Ranking       │  │    │
│  │  │ • shadcn/ui       │  │ • Replay Service  │  │ • Semantik      │  │    │
│  │  │ • i18n            │  │ • Determinism     │  │ • Autocomplete  │  │    │
│  │  └─────────┬─────────┘  └─────────┬─────────┘  └────────┬────────┘  │    │
│  │            │                      │                     │           │    │
│  │            │                      │                     │           │    │
│  │  ┌─────────┴─────────┐  ┌─────────┴─────────┐  ┌────────┴────────┐  │    │
│  │  │  Partner Service  │  │ Governance Service │  │   AI Gateway    │  │    │
│  │  │   (Node.js)       │  │    (Node.js)       │  │   (Custom)      │  │    │
│  │  │                   │  │                    │  │                 │  │    │
│  │  │ • Accounts        │  │ • API Policies     │  │ • RAG Engine    │  │    │
│  │  │ • Scoring         │  │ • Event Policies   │  │ • Guardrails    │  │    │
│  │  │ • Certification   │  │ • Data Policies    │  │ • Prompt Log    │  │    │
│  │  │ • Onboarding      │  │ • Reviews          │  │ • Output Log    │  │    │
│  │  └─────────┬─────────┘  └─────────┬──────────┘  └────────┬────────┘  │    │
│  │            │                      │                     │           │    │
│  │            └──────────────────────┼─────────────────────┘           │    │
│  │                                   │                                 │    │
│  │            ┌──────────────────────┴──────────────────────┐          │    │
│  │            │              DATABASES                       │          │    │
│  │            │  ┌────────────────┐  ┌────────────────┐     │          │    │
│  │            │  │   PostgreSQL   │  │     Redis      │     │          │    │
│  │            │  │   (Partner,    │  │   (Cache,      │     │          │    │
│  │            │  │   Governance)  │  │   Sessions)    │     │          │    │
│  │            │  └────────────────┘  └────────────────┘     │          │    │
│  │            └─────────────────────────────────────────────┘          │    │
│  │                                                                     │    │
│  │            ┌─────────────────────────────────────────────┐          │    │
│  │            │          OBSERVABILITY STACK                │          │    │
│  │            │  ┌────────────┐  ┌────────────┐            │          │    │
│  │            │  │   Logs     │  │  Metrics   │            │          │    │
│  │            │  │ (Datadog)  │  │ (Datadog)  │            │          │    │
│  │            │  └────────────┘  └────────────┘            │          │    │
│  │            │  ┌────────────┐  ┌────────────┐            │          │    │
│  │            │  │  Traces    │  │ Dashboards │            │          │    │
│  │            │  │ (Datadog)  │  │ (Grafana)  │            │          │    │
│  │            │  └────────────┘  └────────────┘            │          │    │
│  │            └─────────────────────────────────────────────┘          │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Container-Beschreibung:**

| Container | Technologie | Verantwortlichkeit |
|-----------|-------------|-------------------|
| **Web Frontend** | Next.js SSG, CDN, Edge | Statische Seiten, UI, Routing |
| **Tools Service** | Node.js, TypeScript | API Explorer, Webhooks, Replay, Determinism |
| **Search Service** | Elasticsearch | Dokumentation-Suche, Semantische Suche |
| **Partner Service** | Node.js, PostgreSQL | Accounts, Scoring, Zertifizierung |
| **Governance Service** | Node.js, PostgreSQL | Policies, Reviews, Approvals |
| **AI Gateway** | Custom + LLM | RAG, Guardrails, Prompt-Logging |
| **Observability Stack** | Datadog, Grafana | Logs, Metrics, Traces, Dashboards |

---

## 4. Kern‑Flows (End‑to‑End)

### 4.1 Flow: „First API Call"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLOW: FIRST API CALL                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    1. Visit Portal     ┌──────────────────┐                  │
│  │          │ ──────────────────────►│                  │                  │
│  │ Developer│                        │  Portal Frontend │                  │
│  │          │ ◄──────────────────────│  (Getting Started)│                  │
│  └────┬─────┘    2. Show Guide       └────────┬─────────┘                  │
│       │                                          │                           │
│       │ 3. Request API Key                       │                           │
│       ▼                                          ▼                           │
│  ┌──────────────────┐    4. Create Key    ┌──────────────────┐              │
│  │                  │ ◄───────────────────│                  │              │
│  │  Partner Service │                     │  Portal Frontend │              │
│  │                  │ ───────────────────►│                  │              │
│  └──────────────────┘    5. Return Key    └────────┬─────────┘              │
│                                                    │                         │
│       ┌────────────────────────────────────────────┘                         │
│       │ 6. Build Request in API Explorer                                     │
│       ▼                                                                     │
│  ┌──────────────────┐    7. Proxy Request    ┌──────────────────┐           │
│  │                  │ ──────────────────────►│                  │           │
│  │   Tools Service  │                        │  CargoBit Core   │           │
│  │  (API Explorer)  │ ◄──────────────────────│       APIs       │           │
│  │                  │    8. Response         │                  │           │
│  └────────┬─────────┘                        └──────────────────┘           │
│           │                                                                 │
│           │ 9. Return to Developer                                          │
│           ▼                                                                 │
│  ┌──────────────────┐    10. Log/Metrics    ┌──────────────────┐           │
│  │  Portal Frontend │ ─────────────────────►│ Observability    │           │
│  │                  │                        │     Stack        │           │
│  └──────────────────┘                        └──────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Flow-Schritte:**

| Schritt | Actor | Aktion | System |
|---------|-------|--------|--------|
| 1 | Developer | Visit Portal | Portal Frontend |
| 2 | Portal | Show Getting Started Guide | Portal Frontend |
| 3 | Developer | Request API Key | Partner Service |
| 4 | Partner Service | Create Sandbox Key | Partner Service |
| 5 | Partner Service | Return Key to Developer | Portal Frontend |
| 6 | Developer | Build Request in API Explorer | Tools Service |
| 7 | Tools Service | Proxy Request to Core API | CargoBit Core |
| 8 | Core API | Return Response | CargoBit Core |
| 9 | Tools Service | Return Response to Developer | Portal Frontend |
| 10 | Tools Service | Log Request/Metrics | Observability |

### 4.2 Flow: „Webhook Integration & Debugging"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLOW: WEBHOOK INTEGRATION & DEBUGGING                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    1. Open Guide        ┌──────────────────┐                 │
│  │          │ ──────────────────────► │                  │                 │
│  │ Developer│                         │  Portal Frontend │                 │
│  │          │ ◄────────────────────── │  (Webhook Setup) │                 │
│  └────┬─────┘   2. Show Guide         └────────┬─────────┘                 │
│       │                                          │                          │
│       │ 3. Configure Webhook                     │                          │
│       ▼                                          ▼                          │
│  ┌──────────────────┐    4. Test Webhook    ┌──────────────────┐           │
│  │                  │ ─────────────────────►│                  │           │
│  │   Tools Service  │                       │ Partner Endpoint │           │
│  │ (Webhook Simul.) │ ◄─────────────────────│                  │           │
│  │                  │    5. Response        │                  │           │
│  └────────┬─────────┘                       └──────────────────┘           │
│           │                                                                 │
│           │ 6. Log Delivery + Signature Check                               │
│           ▼                                                                 │
│  ┌──────────────────┐                       ┌──────────────────┐           │
│  │ Delivery Log     │                       │   Partner        │           │
│  │ (Success/Fail)   │                       │   Scoring        │           │
│  └────────┬─────────┘                       └──────────────────┘           │
│           │                                                                 │
│           │ 7. Error? → Webhook Debugger Pro                                │
│           ▼                                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                    WEBHOOK DEBUGGER PRO                          │       │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │       │
│  │  │   Diff     │  │   Replay   │  │   Hints    │  │   History  │ │       │
│  │  │  Analysis  │  │   Failed   │  │   Fix      │  │   View     │ │       │
│  │  │            │  │   Events   │  │   Suggestions│ │            │ │       │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘ │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│           ┌─────────────────────────────────────────────────────────┐       │
│           │                    OBSERVABILITY                         │       │
│           │  Events & Logs → Traces, Metrics, Dashboards            │       │
│           └─────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Webhook Debugging Features:**

| Feature | Beschreibung | Nutzen |
|---------|--------------|--------|
| Diff Analysis | Vergleicht erwartete vs. tatsächliche Payload | Schnelle Fehleridentifikation |
| Replay | Wiederholt fehlgeschlagene Events | Einfache Wiederholung |
| Fix Hints | KI-gestützte Lösungsvorschläge | Schnellere Problemlösung |
| History View | Alle Webhook-Versuche mit Timeline | Vollständige Nachvollziehbarkeit |

### 4.3 Flow: „API / Event Change (Governance)"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLOW: API/EVENT CHANGE (GOVERNANCE)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    1. Submit RFC         ┌──────────────────┐                │
│  │          │ ──────────────────────►  │                  │                │
│  │   Team   │                          │ Governance       │                │
│  │ (Owner)  │ ◄──────────────────────  │   Service        │                │
│  └──────────┘    2. Acknowledge        │                  │                │
│                                         └────────┬─────────┘                │
│                                                  │                           │
│                    ┌─────────────────────────────┼─────────────────────┐    │
│                    │                             │                     │    │
│                    ▼                             ▼                     ▼    │
│             ┌────────────┐              ┌────────────┐         ┌────────────┐
│             │ Architecture│              │  Security  │         │ Compliance │
│             │   Review    │              │   Review   │         │   Review   │
│             └──────┬─────┘              └──────┬─────┘         └──────┬─────┘
│                    │                           │                      │     │
│                    └───────────────────────────┼──────────────────────┘     │
│                                                │                            │
│                                                ▼                            │
│                    ┌──────────────────────────────────────────────────┐     │
│                    │              GOVERNANCE SERVICE                   │     │
│                    │  3. Aggregate Reviews                             │     │
│                    │  4. Decision: Approved / Rejected / Needs Work   │     │
│                    └───────────────────────────┬──────────────────────┘     │
│                                                │                            │
│                                                │ 5. Approved                │
│                                                ▼                            │
│                    ┌──────────────────────────────────────────────────┐     │
│                    │               UPDATE PIPELINE                     │     │
│                    │  ┌──────────┐ ┌──────────┐ ┌──────────┐         │     │
│                    │  │ Schema   │ │  Docs    │ │Changelog │         │     │
│                    │  │ Update   │ │ Update   │ │ Update   │         │     │
│                    │  └──────────┘ └──────────┘ └──────────┘         │     │
│                    └───────────────────────────┬──────────────────────┘     │
│                                                │                            │
│                    ┌───────────────────────────┼──────────────────────┐     │
│                    │                           │                      │     │
│                    ▼                           ▼                      ▼     │
│             ┌────────────┐             ┌────────────┐          ┌────────────┐
│             │   Portal   │             │    API     │          │ Simulator  │
│             │    Docs    │             │  Explorer  │          │   Update   │
│             └────────────┘             └────────────┘          └────────────┘
│                                                                             │
│                    ┌──────────────────────────────────────────────────┐     │
│                    │           MONITORING & DEPRECATION               │     │
│                    │  • Usage Tracking                                 │     │
│                    │  • Deprecation Warnings                           │     │
│                    │  • Partner Notifications                          │     │
│                    └──────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Governance Review-Checkliste:**

| Review-Typ | Prüfpunkte | Genehmiger |
|------------|------------|------------|
| Architecture | Schema-Konsistenz, ADR-Compliance, Breaking Changes | Tech Lead |
| Security | Threat Model, Auth/Authz, Data Classification | Security Lead |
| Compliance | GDPR, SOC2, ISO27001, Audit-Requirements | Compliance Lead |

---

## 5. Querschnittsthemen

### 5.1 Security

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         FRONTEND SECURITY                           │    │
│  │  • Content Security Policy (CSP)                                    │    │
│  │  • Keine PII im Frontend                                            │    │
│  │  • HSTS (HTTP Strict Transport Security)                            │    │
│  │  • XSS Protection                                                   │    │
│  │  • CSRF Tokens                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         TOOLS SECURITY                              │    │
│  │  • Rate Limits (per Partner, per Endpoint)                          │    │
│  │  • Sandbox Isolation (keine Produktionsdaten)                       │    │
│  │  • Request Validation & Sanitization                                │    │
│  │  • Signature Verification für Webhooks                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         IDENTITY SECURITY                           │    │
│  │  • SSO (SAML 2.0 / OIDC)                                            │    │
│  │  • RBAC (Role-Based Access Control)                                 │    │
│  │  • Least Privilege                                                  │    │
│  │  • MFA für Admin-Funktionen                                         │    │
│  │  • Session Management                                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         DATA SECURITY                               │    │
│  │  • Encryption at Rest (AES-256)                                     │    │
│  │  • Encryption in Transit (TLS 1.3)                                  │    │
│  │  • Key Management (AWS KMS / HashiCorp Vault)                       │    │
│  │  • No PII in Logs                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Compliance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPLIANCE ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         DATA GOVERNANCE                             │    │
│  │  • Data Classification (A/B/C/D)                                    │    │
│  │  • Keine PII im Portal                                              │    │
│  │  • Retention Policies (automatisch durchgesetzt)                    │    │
│  │  • Audit Logs (1-3 Jahre)                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         AUDIT TRAILS                                │    │
│  │  • Alle Governance-Entscheidungen protokolliert                     │    │
│  │  • Alle API/Event-Changes versioniert                               │    │
│  │  • Alle Incidents dokumentiert                                      │    │
│  │  • Access Logs für sensible Daten                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         REGULATORY COMPLIANCE                       │    │
│  │  • GDPR (DSGVO)                                                     │    │
│  │  • SOC2 Type II                                                     │    │
│  │  • ISO27001                                                         │    │
│  │  • PCI DSS (via CargoBit Core)                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Observability

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OBSERVABILITY ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         THREE PILLARS                               │    │
│  │                                                                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │    │
│  │  │    LOGS     │  │   METRICS   │  │   TRACES    │                 │    │
│  │  │             │  │             │  │             │                 │    │
│  │  │ • Structured│  │ • RED       │  │ • Distributed│                 │    │
│  │  │ • Correlated│  │ • SLIs/SLOs │  │ • End-to-End│                 │    │
│  │  │ • No PII    │  │ • Dashboards│  │ • Latency   │                 │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         USER JOURNEY TRACING                        │    │
│  │  • Jede User-Journey tracebar (ohne PII)                           │    │
│  │  • Tools & Portal getrennt messbar                                 │    │
│  │  • Funnel-Analysen                                                  │    │
│  │  • Error-Tracking mit Context                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         ALERTING                                    │    │
│  │  • Error Rate Spikes                                                │    │
│  │  • Latency Anomalies                                                │    │
│  │  • Availability Drops                                               │    │
│  │  • Security Events                                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 AI Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI ARCHITECTURE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         AI GATEWAY                                  │    │
│  │  • Nur Zugriff auf Docs/Metadata                                    │    │
│  │  • Kein Zugriff auf Partner- oder Transaktionsdaten                 │    │
│  │  • Alle Prompts/Outputs versioniert                                 │    │
│  │  • Guardrails für Output-Qualität                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         RAG PIPELINE                                │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │    │
│  │  │  Docs    │  │ Chunking │  │ Embedding│  │  Vector  │           │    │
│  │  │  Index   │─►│          │─►│          │─►│   DB     │           │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         USE CASES                                   │    │
│  │  • Dokumentation-Suche (semantisch)                                 │    │
│  │  • Error-Hints für Partner                                          │    │
│  │  • Code-Beispiel-Generierung                                        │    │
│  │  • Self-Healing-Empfehlungen                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Mapping auf Organisation & Operating Model

### 6.1 RACI-Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RACI MATRIX                                          │
├──────────────────────┬──────────┬──────────┬──────────┬──────────┬─────────┤
│                      │ Portal   │ Arch     │ DX       │ Platform │ Security│
│ Aktivität            │ Owner    │ Board    │ Team     │ /SRE     │ Team    │
├──────────────────────┼──────────┼──────────┼──────────┼──────────┼─────────┤
│ Portal UI/UX         │    A     │    C     │    R     │    I     │    C    │
│ Dokumentation        │    A     │    C     │    R     │    I     │    C    │
│ API Governance       │    C     │    A     │    I     │    R     │    C    │
│ Event Governance     │    C     │    A     │    I     │    R     │    C    │
│ Security Policies    │    I     │    C     │    I     │    C     │    A    │
│ Observability        │    I     │    C     │    I     │    A     │    C    │
│ Partner Onboarding   │    A     │    C     │    R     │    C     │    C    │
│ Incident Response    │    I     │    C     │    I     │    A     │    R    │
│ Compliance Audits    │    C     │    C     │    I     │    I     │    A    │
├──────────────────────┴──────────┴──────────┴──────────┴──────────┴─────────┤
│  R = Responsible (führt aus)                                                 │
│  A = Accountable (trägt Verantwortung)                                       │
│  C = Consulted (wird konsultiert)                                            │
│  I = Informed (wird informiert)                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Team-Struktur

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TEAM STRUKTUR                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         PORTAL OWNER                                │    │
│  │  End-to-End Verantwortung für Developer Portal                      │    │
│  │  Berichtslinie: CTO / VP Engineering                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐            │
│         │                          │                          │            │
│         ▼                          ▼                          ▼            │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐        │
│  │    DX       │          │  Platform   │          │  Security   │        │
│  │    Team     │          │    /SRE     │          │    Team     │        │
│  ├─────────────┤          ├─────────────┤          ├─────────────┤        │
│  │ • Portal UI │          │ • Infra     │          │ • Policies  │        │
│  │ • Docs      │          │ • Observ.   │          │ • Audits    │        │
│  │ • Tools     │          │ • Self-Heal │          │ • Threats   │        │
│  │ • Partner   │          │ • Multi-Reg │          │ • Compl.    │        │
│  └─────────────┘          └─────────────┘          └─────────────┘        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       ARCHITECTURE BOARD                            │    │
│  │  API/Event/Data Governance, Strategic Decisions                     │    │
│  │  Mitglieder: Tech Leads, Architects, Security Lead                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        PARTNER TEAM                                 │    │
│  │  Onboarding, Zertifizierung, Scoring, Partner-Support               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Nächste Vertiefungen

### 7.1 C4 Level 3 (Component View)

Für folgende Container werden Component-Diagramme empfohlen:

| Container | Komponenten für Level 3 |
|-----------|------------------------|
| **Tools Service** | API Explorer, Webhook Engine, Replay Service, Determinism Checker |
| **Search Service** | Indexer, Query Engine, Ranking, Autocomplete |
| **Governance Service** | Policy Engine, Review Workflow, Approval Engine |
| **AI Gateway** | RAG Engine, Guardrails, Prompt Logger, Output Logger |

### 7.2 Operating Model (RACI pro Flow)

Detaillierte RACI-Matrices für:

- API-Change Flow
- Incident Response Flow
- New Tool Development Flow
- New Partner Onboarding Flow

### 7.3 Maturity Model

Assessment der aktuellen Reife und Gaps:

| Dimension | Level 1-2 | Level 3-4 | Level 5 |
|-----------|-----------|-----------|---------|
| Documentation | Basic | Comprehensive | Living Docs |
| Governance | Ad-hoc | Formal | Automated |
| Observability | Reactive | Proactive | Predictive |
| DX | Functional | Optimized | Delightful |

### 7.4 Strategic Roadmap 2026-2030

Phasenweise Entwicklung der Fähigkeiten:

| Phase | Jahr | Fokus |
|-------|------|-------|
| Foundation | 2026 | Core Portal, Tools, Governance |
| Scale | 2027 | Multi-Region, Enterprise Features |
| Intelligence | 2028 | AI-Integration, Self-Healing |
| Ecosystem | 2029-2030 | Partner Ecosystem, Platform Services |

---

## 8. Referenzen

- [API Governance Framework](./developer-portal-api-governance-framework.md)
- [Event Governance Framework](./developer-portal-event-governance-framework.md)
- [Data Governance Framework](./developer-portal-data-governance-framework.md)
- [Compliance Framework](./developer-portal-compliance-framework.md)
- [Architecture Deep Dive](./developer-portal-architecture-deep-dive.md)
- [Future Vision 2030](./developer-portal-future-vision-2030.md)

---

*Letzte Aktualisierung: Januar 2025*
*Owner: Architecture Board*
*Status: Master-Artefakt*
