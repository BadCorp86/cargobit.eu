# DW – Security-Awareness-Poster

> **Zweck**: Visuelles Poster für Büros, Team-Räume und Intranet. Erinnert an die wichtigsten Security-Praktiken des Governance Postcheck.

---

## 🖼️ Security-Awareness-Poster (A3 / A4)

---

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   🛡️  GOVERNANCE POSTCHECK                                                  ║
║   ──────────────────────────────────────────────────────────────────────     ║
║   SICHER • SIGNIERT • AUDIT-READY                                           ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   📋 DIE 5 GOLDENEN REGELN                                                  ║
║                                                                              ║
║   ┌────────────────────────────────────────────────────────────────────┐     ║
║   │                                                                    │     ║
║   │  1️⃣  SIGNIERE ALLE IMAGES                                         │     ║
║   │     → Keyless Signing via cosign                                  │     ║
║   │     → Verifikation vor jedem Deploy                               │     ║
║   │                                                                    │     ║
║   │  2️⃣  SCANNE FÜR VULNERABILITIES                                   │     ║
║   │     → Trivy bei jedem Build                                       │     ║
║   │     → CRITICAL/HIGH = BLOCKER                                     │     ║
║   │                                                                    │     ║
║   │  3️⃣  ERSTELLE EINE SBOM                                           │     ║
║   │     → Vollständige Transparenz                                    │     ║
║   │     → Syft für alle Artefakte                                     │     ║
║   │                                                                    │     ║
║   │  4️⃣  DEPLOYE NUR DIGEST-BASIERT                                   │     ║
║   │     → Keine "latest" Tags!                                        │     ║
║   │     → Reproduzierbare Deployments                                 │     ║
║   │                                                                    │     ║
║   │  5️⃣  TESTE ROLLBACK VORAB                                         │     ║
║   │     → Canary mit Monitoring                                       │     ║
║   │     → Rollback-Drill vor Go-Live                                  │     ║
║   │                                                                    │     ║
║   └────────────────────────────────────────────────────────────────────┘     ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   🚫 VERBOTEN                                                               ║
║                                                                              ║
║   ❌  "latest" Tags in Produktion                                           ║
║   ❌  Unsignierte Images                                                    ║
║   ❌  Secrets im Dockerfile                                                 ║
║   ❌  Root-User im Container                                                ║
║   ❌  Ungepatchte CRITICAL CVEs                                             ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   ✅ CHECKLISTE VOR JEDEM DEPLOY                                            ║
║                                                                              ║
║   □ Image signiert?          cosign verify                                  ║
║   □ Scan bestanden?          trivy image                                    ║
║   □ SBOM erstellt?           syft -o spdx-json                              ║
║   □ Digest verwendet?        image@sha256:...                               ║
║   □ Rollback getestet?       ./rollback.sh --dry-run                        ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   📞 SUPPORT & KONTAKT                                                      ║
║                                                                              ║
║   💬  #governance-support                                                   ║
║   📧  governance@company.com                                                ║
║   📖  docs.company.com/governance                                           ║
║                                                                              ║
║   ──────────────────────────────────────────────────────────────────────     ║
║                                                                              ║
║   Platform Engineering | Security | SRE                                     ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 📄 PDF-Druckversion (Markdown)

```markdown
# 🛡️ Governance Postcheck

## Die 5 Goldenen Regeln

### 1️⃣ Signiere alle Images
- Keyless Signing via cosign
- Verifikation vor jedem Deploy

### 2️⃣ Scanne für Vulnerabilities
- Trivy bei jedem Build
- CRITICAL/HIGH = Blocker

### 3️⃣ Erstelle eine SBOM
- Vollständige Transparenz
- Syft für alle Artefakte

### 4️⃣ Deploye nur Digest-basiert
- Keine "latest" Tags!
- Reproduzierbare Deployments

### 5️⃣ Teste Rollback vorab
- Canary mit Monitoring
- Rollback-Drill vor Go-Live

---

## 🚫 Verboten

| ❌ | Verhalten |
|---|-----------|
| ❌ | "latest" Tags in Produktion |
| ❌ | Unsignierte Images |
| ❌ | Secrets im Dockerfile |
| ❌ | Root-User im Container |
| ❌ | Ungepatchte CRITICAL CVEs |

---

## ✅ Checkliste vor jedem Deploy

| Check | Befehl |
|-------|--------|
| Image signiert? | `cosign verify` |
| Scan bestanden? | `trivy image` |
| SBOM erstellt? | `syft -o spdx-json` |
| Digest verwendet? | `image@sha256:...` |
| Rollback getestet? | `./rollback.sh --dry-run` |

---

**Support**: #governance-support | governance@company.com
```

---

## 🖼️ HTML-Version (für Intranet/Digital Signage)

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Governance Postcheck - Security Awareness</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
      min-height: 100vh;
      padding: 40px;
      color: white;
    }
    .poster {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 25px 50px rgba(0,0,0,0.3);
    }
    .header {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      padding: 40px;
      text-align: center;
    }
    .header h1 { font-size: 2.5em; margin-bottom: 10px; }
    .header p { font-size: 1.2em; opacity: 0.9; }
    .content { padding: 40px; color: #1e293b; }
    .rules { display: grid; gap: 20px; margin-bottom: 30px; }
    .rule {
      display: flex;
      align-items: flex-start;
      gap: 15px;
      padding: 20px;
      background: #f8fafc;
      border-radius: 10px;
      border-left: 4px solid #2563eb;
    }
    .rule-number {
      background: #2563eb;
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 1.2em;
      flex-shrink: 0;
    }
    .rule h3 { margin-bottom: 5px; color: #1e40af; }
    .rule p { color: #64748b; font-size: 0.95em; }
    .forbidden {
      background: #fef2f2;
      padding: 25px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    .forbidden h3 { color: #dc2626; margin-bottom: 15px; }
    .forbidden ul { list-style: none; }
    .forbidden li { 
      padding: 8px 0; 
      border-bottom: 1px solid #fecaca;
      color: #991b1b;
    }
    .forbidden li:last-child { border-bottom: none; }
    .forbidden li::before { content: "❌  "; }
    .checklist {
      background: #f0fdf4;
      padding: 25px;
      border-radius: 10px;
    }
    .checklist h3 { color: #16a34a; margin-bottom: 15px; }
    .checklist-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #bbf7d0;
    }
    .checklist-item:last-child { border-bottom: none; }
    .checklist code {
      background: #dcfce7;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      color: #166534;
    }
    .footer {
      background: #1e293b;
      padding: 30px;
      text-align: center;
      color: #94a3b8;
    }
    .footer a { color: #60a5fa; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="poster">
    <div class="header">
      <h1>🛡️ Governance Postcheck</h1>
      <p>Sicher • Signiert • Audit-Ready</p>
    </div>
    
    <div class="content">
      <div class="rules">
        <div class="rule">
          <div class="rule-number">1</div>
          <div>
            <h3>Signiere alle Images</h3>
            <p>Keyless Signing via cosign • Verifikation vor jedem Deploy</p>
          </div>
        </div>
        <div class="rule">
          <div class="rule-number">2</div>
          <div>
            <h3>Scanne für Vulnerabilities</h3>
            <p>Trivy bei jedem Build • CRITICAL/HIGH = Blocker</p>
          </div>
        </div>
        <div class="rule">
          <div class="rule-number">3</div>
          <div>
            <h3>Erstelle eine SBOM</h3>
            <p>Vollständige Transparenz • Syft für alle Artefakte</p>
          </div>
        </div>
        <div class="rule">
          <div class="rule-number">4</div>
          <div>
            <h3>Deploye nur Digest-basiert</h3>
            <p>Keine "latest" Tags! • Reproduzierbare Deployments</p>
          </div>
        </div>
        <div class="rule">
          <div class="rule-number">5</div>
          <div>
            <h3>Teste Rollback vorab</h3>
            <p>Canary mit Monitoring • Rollback-Drill vor Go-Live</p>
          </div>
        </div>
      </div>
      
      <div class="forbidden">
        <h3>🚫 Verboten</h3>
        <ul>
          <li>"latest" Tags in Produktion</li>
          <li>Unsignierte Images</li>
          <li>Secrets im Dockerfile</li>
          <li>Root-User im Container</li>
          <li>Ungepatchte CRITICAL CVEs</li>
        </ul>
      </div>
      
      <div class="checklist">
        <h3>✅ Checkliste vor jedem Deploy</h3>
        <div class="checklist-item">
          <span>Image signiert?</span>
          <code>cosign verify</code>
        </div>
        <div class="checklist-item">
          <span>Scan bestanden?</span>
          <code>trivy image</code>
        </div>
        <div class="checklist-item">
          <span>SBOM erstellt?</span>
          <code>syft -o spdx-json</code>
        </div>
        <div class="checklist-item">
          <span>Digest verwendet?</span>
          <code>image@sha256:...</code>
        </div>
        <div class="checklist-item">
          <span>Rollback getestet?</span>
          <code>./rollback.sh --dry-run</code>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>💬 #governance-support • 📧 governance@company.com • 📖 docs.company.com/governance</p>
      <p style="margin-top: 10px;">Platform Engineering | Security | SRE</p>
    </div>
  </div>
</body>
</html>
```

---

## 📎 Guided Links

| Thema | Block / Datei |
|-------|---------------|
| Onboarding-Guide | → `developer-portal-DU.md` |
| Training-Deck | → `developer-portal-DP.md` |
| Stakeholder-FAQ | → `developer-portal-DQ.md` |
| Debug Checklist | → `developer-portal-CF.md` |

---

*Block DW – Security-Awareness-Poster – v1.0*
