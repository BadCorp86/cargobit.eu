# DX – Developer-Exam (Multiple Choice)

> **Zweck**: Strukturierter Wissenstest zum Governance Postcheck für Entwickler, SREs und Security-Personal. 25 Fragen mit Lösungen und Bewertung.

---

## 📝 Developer-Exam – Governance Postcheck

### Prüfungs-Informationen

| Feld | Wert |
|------|------|
| Dauer | 30 Minuten |
| Fragen | 25 (Multiple Choice) |
| Bestehensgrenze | 80% (20/25 richtig) |
| Zielgruppe | Entwickler, SRE, Security |

---

## Teil 1: Grundlagen (5 Fragen)

### Frage 1.1

**Was ist der Hauptzweck des Governance Postcheck?**

- [ ] A) Automatisierte Code-Reviews durchführen
- [ ] B) Sicherstellen, dass Deployments signiert, gescannt und audit-fähig sind
- [ ] C) Performance-Tests für alle Services durchführen
- [ ] D) Automatische Dokumentationsgenerierung

<details>
<summary>✅ Lösung</summary>
**B)** Sicherstellen, dass Deployments signiert, gescannt und audit-fähig sind
</details>

---

### Frage 1.2

**Welche Komponente wird für Image-Signaturen verwendet?**

- [ ] A) GPG
- [ ] B) cosign
- [ ] C) OpenSSL
- [ ] D) SSH Keys

<details>
<summary>✅ Lösung</summary>
**B)** cosign
</details>

---

### Frage 1.3

**Was bedeutet "Keyless Signing"?**

- [ ] A) Signieren ohne jegliche Authentifizierung
- [ ] B) Signieren mit OIDC-basierter Authentifizierung statt manuellen Schlüsseln
- [ ] C) Signieren mit einem öffentlichen Schlüssel
- [ ] D) Signieren ohne Transparenz-Log

<details>
<summary>✅ Lösung</summary>
**B)** Signieren mit OIDC-basierter Authentifizierung statt manuellen Schlüsseln
</details>

---

### Frage 1.4

**Welches Tool wird für Vulnerability-Scanning verwendet?**

- [ ] A) SonarQube
- [ ] B) Snyk
- [ ] C) Trivy
- [ ] D) OWASP ZAP

<details>
<summary>✅ Lösung</summary>
**C)** Trivy
</details>

---

### Frage 1.5

**Was ist eine SBOM?**

- [ ] A) Secure Binary Object Model
- [ ] B) Software Bill of Materials
- [ ] C) System Build Optimization Manager
- [ ] D) Security Based Operation Matrix

<details>
<summary>✅ Lösung</summary>
**B)** Software Bill of Materials
</details>

---

## Teil 2: Security & Signing (5 Fragen)

### Frage 2.1

**Wo werden Signaturen im Keyless-Modus gespeichert?**

- [ ] A) In der Kubernetes Secret
- [ ] B) Im Rekor Transparency Log
- [ ] C) In der Git-Repository
- [ ] D) In einer Datenbank

<details>
<summary>✅ Lösung</summary>
**B)** Im Rekor Transparency Log
</details>

---

### Frage 2.2

**Welcher Befehl verifiziert eine Image-Signatur?**

- [ ] A) `cosign check`
- [ ] B) `cosign verify --keyless`
- [ ] C) `cosign validate`
- [ ] D) `cosign inspect`

<details>
<summary>✅ Lösung</summary>
**B)** `cosign verify --keyless`
</details>

---

### Frage 2.3

**Was passiert bei einem Signing-Fehler in der Pipeline?**

- [ ] A) Das Deployment wird mit Warning fortgesetzt
- [ ] B) Das Deployment wird blockiert
- [ ] C) Eine E-Mail wird gesendet
- [ ] D) Ein Fallback-Image wird verwendet

<details>
<summary>✅ Lösung</summary>
**B)** Das Deployment wird blockiert
</details>

---

### Frage 2.4

**Wie oft soll der Signing-Key rotiert werden?**

- [ ] A) Monatlich
- [ ] B) Alle 90 Tage
- [ ] C) Jährlich
- [ ] D) Nie (Keyless benötigt keine Rotation)

<details>
<summary>✅ Lösung</summary>
**B)** Alle 90 Tage (für den Fall, dass keyed Mode verwendet wird)
</details>

---

### Frage 2.5

**Welches Format wird NICHT für SBOMs unterstützt?**

- [ ] A) SPDX
- [ ] B) CycloneDX
- [ ] C) PDF
- [ ] D) JSON

<details>
<summary>✅ Lösung</summary>
**C)** PDF
</details>

---

## Teil 3: Vulnerability Management (5 Fragen)

### Frage 3.1

**Welche Vulnerability-Severity blockiert standardmäßig das Deployment?**

- [ ] A) LOW
- [ ] B) MEDIUM
- [ ] C) HIGH
- [ ] D) UNKNOWN

<details>
<summary>✅ Lösung</summary>
**C)** HIGH (und CRITICAL)
</details>

---

### Frage 3.2

**Wie oft werden Runtime-Scans durchgeführt?**

- [ ] A) Nur bei Bedarf
- [ ] B) Täglich
- [ ] C) Wöchentlich
- [ ] D) Monatlich

<details>
<summary>✅ Lösung</summary>
**B)** Täglich
</details>

---

### Frage 3.3

**Welcher Befehl führt einen Trivy-Scan durch?**

- [ ] A) `trivy check image:tag`
- [ ] B) `trivy scan image:tag`
- [ ] C) `trivy image image:tag`
- [ ] D) `trivy inspect image:tag`

<details>
<summary>✅ Lösung</summary>
**C)** `trivy image image:tag`
</details>

---

### Frage 3.4

**Was ist der erste Schritt bei einer CRITICAL CVE?**

- [ ] A) Das Image trotzdem deployen
- [ ] B) Das Ticket an Security übergeben
- [ ] C) Die CVE recherchieren und das Package aktualisieren oder eine Exception beantragen
- [ ] D) Den Service abschalten

<details>
<summary>✅ Lösung</summary>
**C)** Die CVE recherchieren und das Package aktualisieren oder eine Exception beantragen
</details>

---

### Frage 3.5

**Welches Output-Format wird für GitHub Security empfohlen?**

- [ ] A) JSON
- [ ] B) SARIF
- [ ] C) XML
- [ ] D) Plain Text

<details>
<summary>✅ Lösung</summary>
**B)** SARIF
</details>

---

## Teil 4: Deployment & Canary (5 Fragen)

### Frage 4.1

**Welcher Traffic-Anteil wird beim Start eines Canary-Deployments verwendet?**

- [ ] A) 1%
- [ ] B) 5%
- [ ] C) 25%
- [ ] D) 50%

<details>
<summary>✅ Lösung</summary>
**B)** 5%
</details>

---

### Frage 4.2

**Was passiert bei einer SLO-Verletzung während Canary?**

- [ ] A) Automatischer Rollback
- [ ] B) Manuelle Entscheidung erforderlich
- [ ] C) Canary wird pausiert
- [ ] D) Alert an On-Call

<details>
<summary>✅ Lösung</summary>
**A)** Automatischer Rollback
</details>

---

### Frage 4.3

**Warum sind "latest" Tags verboten?**

- [ ] A) Sie sind länger als andere Tags
- [ ] B) Sie sind nicht reproduzierbar und können sich ändern
- [ ] C) Sie werden von Kubernetes nicht unterstützt
- [ ] D) Sie verursachen Performance-Probleme

<details>
<summary>✅ Lösung</summary>
**B)** Sie sind nicht reproduzierbar und können sich ändern
</details>

---

### Frage 4.4

**Was ist das korrekte Format für digest-basierte Deployments?**

- [ ] A) `image:latest`
- [ ] B) `image:v1.0.0`
- [ ] C) `image@sha256:abc123...`
- [ ] D) `image:sha256-abc123`

<details>
<summary>✅ Lösung</summary>
**C)** `image@sha256:abc123...`
</details>

---

### Frage 4.5

**Welches SLO-Target gilt für Tier-1-Services?**

- [ ] A) 99.0%
- [ ] B) 99.5%
- [ ] C) 99.9%
- [ ] D) 99.99%

<details>
<summary>✅ Lösung</summary>
**C)** 99.9%
</details>

---

## Teil 5: Admission Control & Compliance (5 Fragen)

### Frage 5.1

**Was ist der Admission Controller?**

- [ ] A) Ein Tool für Benutzerauthentifizierung
- [ ] B) Eine Kubernetes-Komponente, die Deployments validiert
- [ ] C) Ein Monitoring-Tool
- [ ] D) Ein Log-Aggregator

<details>
<summary>✅ Lösung</summary>
**B)** Eine Kubernetes-Komponente, die Deployments validiert
</details>

---

### Frage 5.2

**Was passiert mit unsignierten Images?**

- [ ] A) Sie werden automatisch signiert
- [ ] B) Sie werden blockiert
- [ ] C) Sie erhalten eine Warning
- [ ] D) Sie werden in einen separaten Namespace deployed

<details>
<summary>✅ Lösung</summary>
**B)** Sie werden blockiert
</details>

---

### Frage 5.3

**Welcher Compliance-Standard wird durch den Governance Postcheck unterstützt?**

- [ ] A) PCI-DSS
- [ ] B) HIPAA
- [ ] C) ISO 27001
- [ ] D) Alle der genannten

<details>
<summary>✅ Lösung</summary>
**D)** Alle der genannten (der Governance Postcheck unterstützt mehrere Standards)
</details>

---

### Frage 5.4

**Wie lange werden Audit-Logs aufbewahrt?**

- [ ] A) 30 Tage
- [ ] B) 90 Tage
- [ ] C) 1 Jahr
- [ ] D) 7 Jahre

<details>
<summary>✅ Lösung</summary>
**D)** 7 Jahre
</details>

---

### Frage 5.5

**Wo wird der Exception-Prozess dokumentiert?**

- [ ] A) In der README.md
- [ ] B) Im EXCEPTIONS.md im Audit-Bundle
- [ ] C) Im Slack Channel
- [ ] D) In E-Mails

<details>
<summary>✅ Lösung</summary>
**B)** Im EXCEPTIONS.md im Audit-Bundle
</details>

---

## 📊 Antwortbogen

### Teil 1: Grundlagen

| Frage | A | B | C | D |
|-------|---|---|---|---|
| 1.1 | ☐ | ☐ | ☐ | ☐ |
| 1.2 | ☐ | ☐ | ☐ | ☐ |
| 1.3 | ☐ | ☐ | ☐ | ☐ |
| 1.4 | ☐ | ☐ | ☐ | ☐ |
| 1.5 | ☐ | ☐ | ☐ | ☐ |

### Teil 2: Security & Signing

| Frage | A | B | C | D |
|-------|---|---|---|---|
| 2.1 | ☐ | ☐ | ☐ | ☐ |
| 2.2 | ☐ | ☐ | ☐ | ☐ |
| 2.3 | ☐ | ☐ | ☐ | ☐ |
| 2.4 | ☐ | ☐ | ☐ | ☐ |
| 2.5 | ☐ | ☐ | ☐ | ☐ |

### Teil 3: Vulnerability Management

| Frage | A | B | C | D |
|-------|---|---|---|---|
| 3.1 | ☐ | ☐ | ☐ | ☐ |
| 3.2 | ☐ | ☐ | ☐ | ☐ |
| 3.3 | ☐ | ☐ | ☐ | ☐ |
| 3.4 | ☐ | ☐ | ☐ | ☐ |
| 3.5 | ☐ | ☐ | ☐ | ☐ |

### Teil 4: Deployment & Canary

| Frage | A | B | C | D |
|-------|---|---|---|---|
| 4.1 | ☐ | ☐ | ☐ | ☐ |
| 4.2 | ☐ | ☐ | ☐ | ☐ |
| 4.3 | ☐ | ☐ | ☐ | ☐ |
| 4.4 | ☐ | ☐ | ☐ | ☐ |
| 4.5 | ☐ | ☐ | ☐ | ☐ |

### Teil 5: Admission Control & Compliance

| Frage | A | B | C | D |
|-------|---|---|---|---|
| 5.1 | ☐ | ☐ | ☐ | ☐ |
| 5.2 | ☐ | ☐ | ☐ | ☐ |
| 5.3 | ☐ | ☐ | ☐ | ☐ |
| 5.4 | ☐ | ☐ | ☐ | ☐ |
| 5.5 | ☐ | ☐ | ☐ | ☐ |

---

## 📈 Auswertung

### Lösungen

| Teil | 1 | 2 | 3 | 4 | 5 |
|------|---|---|---|---|---|
| **1. Grundlagen** | B | B | B | C | B |
| **2. Security** | B | B | B | B | C |
| **3. Vulnerability** | C | B | C | C | B |
| **4. Deployment** | B | A | B | C | C |
| **5. Compliance** | B | B | D | D | B |

### Bewertung

| Punkte | Note | Status |
|--------|------|--------|
| 23-25 | Ausgezeichnet | ✅ Bestanden |
| 20-22 | Gut | ✅ Bestanden |
| 17-19 | Befriedigend | ❌ Nicht bestanden |
| 14-16 | Ausreichend | ❌ Nicht bestanden |
| 0-13 | Nicht bestanden | ❌ Nicht bestanden |

---

## 📎 Guided Links

| Thema | Block / Datei |
|-------|---------------|
| Onboarding-Guide | → `developer-portal-DU.md` |
| Training-Deck | → `developer-portal-DP.md` |
| Stakeholder-FAQ | → `developer-portal-DQ.md` |
| Security-Awareness-Poster | → `developer-portal-DW.md` |

---

*Block DX – Developer-Exam – v1.0*
