# CargoBit Infrastructure — MVP Startup Guide

**Ziel:** Funktionales Production-System mit minimalen Kosten (~50-150€/Monat)

---

## Übersicht: Infrastruktur-Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRODUCTION STACK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐     ┌─────────────────┐                    │
│  │  Cloudflare     │────▶│  VPS Cluster    │                    │
│  │  (Free Tier)    │     │  (Hetzner)      │                    │
│  │  • CDN          │     │  • 3× CX22      │                    │
│  │  • DDoS Schutz  │     │  • 4 vCPU/16GB  │                    │
│  │  • SSL/TLS      │     │  • ~15€/Monat   │                    │
│  └─────────────────┘     └────────┬────────┘                    │
│                                   │                              │
│          ┌────────────────────────┼────────────────────────┐    │
│          │                        │                        │    │
│          ▼                        ▼                        ▼    │
│  ┌────────────────┐   ┌──────────────────┐   ┌────────────────┐ │
│  │  PostgreSQL    │   │  Redis           │   │  S3 Storage    │ │
│  │  (Neon Free)   │   │  (Upstash Free)  │   │  (Cloudflare)  │ │
│  │  • 0.5GB Free  │   │  • 10K cmds/day  │   │  • 10GB Free   │ │
│  │  • Auto-sleep  │   │  • 256MB         │   │  • R2 Bucket   │ │
│  └────────────────┘   └──────────────────┘   └────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    MONITORING (Free)                        ││
│  │  Grafana Cloud Free • 3 Dashboards • 10K Metrics           ││
│  │  Better Stack Free • Uptime Monitoring • Logs              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Compute — Hetzner Cloud (Best Value)

### Empfehlung: 3× CX22 (~15€/Monat total)

| Server | Specs | Preis/Monat | Rolle |
|--------|-------|-------------|-------|
| **node-1** | CX22 (2 vCPU, 4GB RAM, 40GB Disk) | 4,98€ | API Gateway + Main App |
| **node-2** | CX22 (2 vCPU, 4GB RAM, 40GB Disk) | 4,98€ | Workers + Services |
| **node-3** | CX22 (2 vCPU, 4GB RAM, 40GB Disk) | 4,98€ | Database Backup + Staging |

### Alternative: Single Server MVP

| Server | Specs | Preis/Monat | Rolle |
|--------|-------|-------------|-------|
| **single** | CPX31 (4 vCPU, 8GB RAM, 80GB Disk) | 9,90€ | Alles auf einem Server |

### Warum Hetzner?
- ✅ Beste Preisleistung in Europa
- ✅ Rechenzentren in DE (Falkenstein, Nürnberg)
- ✅ KVM-Virtualisierung (kein Overselling)
- ✅ IPv4 inklusive
- ✅ 20TB Traffic inklusive

### Bestellung
```
https://www.hetzner.com/cloud
→ Create Project: "cargobit-production"
→ Add Server: CX22 × 3
→ Location: Falkenstein (fsn1)
→ OS: Ubuntu 24.04 LTS
→ Add SSH Key
```

---

## 2. Database — Neon (Free Tier)

### Free Plan
- **Storage:** 0.5 GB
- **Compute:** 191.9 hours/month (auto-suspend)
- **Databases:** Unbegrenzt
- **Branches:** 10 (für Preview Deployments)

### Setup
```bash
# 1. Account erstellen
https://neon.tech → Sign Up (GitHub)

# 2. Projekt erstellen
Project Name: cargobit-production
Region: EU (Frankfurt)

# 3. Connection String kopieren
postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/cargobit?sslmode=require
```

### Limits
- ⚠️ Auto-suspend nach 5 Min Inaktivität (10-15s Cold Start)
- ⚠️ 0.5GB reicht für ~10.000 Transaktionen/Monat

### Upgrade (wenn nötig)
- **Pro Plan:** 19$/Monat → 10GB Storage, kein Auto-suspend

---

## 3. Redis — Upstash (Free Tier)

### Free Plan
- **Commands:** 10.000/Tag
- **Storage:** 256 MB
- **Bandwidth:** 10 GB/Monat
- **Max Connections:** 30

### Setup
```bash
# 1. Account erstellen
https://upstash.com → Sign Up (GitHub)

# 2. Redis Database erstellen
Database Name: cargobit-cache
Region: EU (Frankfurt)
Type: Regional

# 3. Connection Details kopieren
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

### Limits
- ⚠️ 10K Commands/Tag reicht für MVP mit moderatem Traffic
- ⚠️ 30 Connections können bei vielen Workern knapp werden

### Upgrade (wenn nötig)
- **Pay as you go:** Ab 0.20$/100K Commands

---

## 4. Object Storage — Cloudflare R2 (Free Tier)

### Free Plan
- **Storage:** 10 GB
- **Class A Operations:** 1.000.000/Monat
- **Class B Operations:** 10.000.000/Monat
- **Egress:** KOSTENLOS (im Gegensatz zu AWS S3!)

### Setup
```bash
# 1. Account erstellen
https://dash.cloudflare.com → R2

# 2. Bucket erstellen
Bucket Name: cargobit-exports
Location: Automatic (EU)

# 3. API Token erstellen
R2 > Manage R2 API Tokens > Create API Token
Permissions: Object Read & Write
Bucket: cargobit-exports

# 4. Credentials kopieren
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=cargobit-exports
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
```

### Signed URLs für Export-Downloads
```typescript
// Mit @aws-sdk/s3-request-presigner
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const command = new GetObjectCommand({
  Bucket: 'cargobit-exports',
  Key: `exports/${jobId}.csv`,
});

const signedUrl = await getSignedUrl(client, command, { expiresIn: 300 }); // 5 Min
```

---

## 5. CDN & DNS — Cloudflare (Free Tier)

### Free Plan
- **DNS:** Unbegrenzt
- **CDN:** Unbegrenzt
- **SSL/TLS:** Unbegrenzt
- **DDoS Schutz:** Basic
- **WAF:** Basic Rules

### Setup
```bash
# 1. Domain hinzufügen
https://dash.cloudflare.com → Add Site

# 2. DNS Records
Type: A
Name: api
Content: <HETZNER_IP>
Proxy: ✅ (Orange Cloud)

Type: A
Name: staging
Content: <HETZNER_IP_STAGING>
Proxy: ✅

# 3. SSL/TLS Mode
SSL/TLS → Overview → Full (Strict)

# 4. Page Rules (Optional)
api.cargobit.io/admin/* → Cache Level: Bypass
```

### Benefits
- ✅ Kostenlose SSL-Zertifikate
- ✅ DDoS Schutz inklusive
- ✅ CDN für statische Assets
- ✅ WAF Rules

---

## 6. Monitoring — Free Tier Stack

### Option A: Grafana Cloud Free

| Feature | Limit |
|---------|-------|
| Metrics | 10.000 Series |
| Logs | 50 GB/Monat |
| Dashboards | 3 |
| Alerts | 10 |

### Setup
```bash
https://grafana.com → Create Free Account

# Prometheus Remote Write
PROMETHEUS_URL=https://prometheus-prod-xxx.grafana.net/api/prom/push
PROMETHEUS_USER=xxx
PROMETHEUS_PASSWORD=xxx

# Loki Logs
LOKI_URL=https://logs-prod-xxx.grafana.net/loki/api/v1/push
```

### Option B: Better Stack (Uptime + Logs)

| Feature | Free Tier |
|---------|-----------|
| Monitors | 10 |
| Incidents | Unbegrenzt |
| Team Members | 5 |
| Log Retention | 3 Tage |

### Setup
```bash
https://betterstack.com → Sign Up

# Uptime Monitor
Monitor Type: HTTPS
URL: https://api.cargobit.io/health
Check Frequency: 5 min

# Alerting
Alert via: Email, Slack
```

---

## 7. Event Streaming — Alternative zu Kafka

### Problem: Kafka ist teuer und komplex

**Empfehlung für MVP:**

### Option A: Redis Streams (Upstash)

```typescript
// Nutzt bestehende Upstash Redis
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Event publishen
await redis.xadd('payout_events', '*', {
  payoutId: 'pay_123',
  type: 'created',
  amount: 1500,
});

// Events konsumieren
const events = await redis.xread('payout_events', '0');
```

**Limits:** Inklusive in Upstash Free Tier

### Option B: Supabase Realtime (PostgreSQL)

```bash
# Nutzt bestehende Neon PostgreSQL
# Realtime via PostgreSQL LISTEN/NOTIFY

# Alternative: Supabase Free Tier
# - 500MB Database
# - 2GB Bandwidth
# - Realtime inklusive
```

---

## 8. GitHub & CI/CD — Kostenlos

### GitHub Free
- **Private Repos:** Unbegrenzt
- **Actions:** 2.000 Minuten/Monat
- **Packages:** 500MB Storage
- **Secrets:** Unbegrenzt

### Setup
```bash
# Repository erstellen
gh repo create cargobit/payments --private

# Secrets setzen
gh secret set DATABASE_URL --repo cargobit/payments --body "postgresql://..."
gh secret set UPSTASH_REDIS_URL --repo cargobit/payments --body "https://xxx.upstash.io"
gh secret set R2_ACCESS_KEY_ID --repo cargobit/payments --body "xxx"
gh secret set R2_SECRET_ACCESS_KEY --repo cargobit/payments --body "xxx"
```

### CI/CD Workflow
- Build & Test bei jedem Push
- Deploy bei Merge auf `main`
- Staging Deploy bei PRs

---

## 9. Container Registry

### Option A: GitHub Container Registry (Free)

```yaml
# .github/workflows/build.yml
- name: Build and Push
  run: |
    docker build -t ghcr.io/${{ github.repository }}/api:${{ github.sha }} .
    docker push ghcr.io/${{ github.repository }}/api:${{ github.sha }}
```

**Limits:** 500MB im Free Tier

### Option B: Hetzner Private Registry

```bash
# Kleiner Docker Registry Server auf einem der Nodes
docker run -d -p 5000:5000 --name registry \
  -v /data/registry:/var/lib/registry \
  registry:2

# Images pushen
docker tag cargobit-api node-1:5000/cargobit-api:latest
docker push node-1:5000/cargobit-api:latest
```

---

## 10. Email & Notifications

### Resend (Free Tier)
- **Emails:** 3.000/Monat
- **Domains:** 1

```bash
https://resend.com → Sign Up

# API Key
RESEND_API_KEY=re_xxx

# Send Email
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -d '{"from":"noreply@cargobit.io","to":"user@example.com","subject":"Test","html":"<p>Test</p>"}'
```

---

## Kostenübersicht — MVP Setup

| Anbieter | Service | Kosten/Monat |
|----------|---------|--------------|
| **Hetzner** | 3× CX22 VPS | 14,94€ |
| **Neon** | PostgreSQL Free | 0€ |
| **Upstash** | Redis Free | 0€ |
| **Cloudflare** | R2 Storage Free | 0€ |
| **Cloudflare** | CDN/DNS Free | 0€ |
| **Grafana** | Monitoring Free | 0€ |
| **GitHub** | Actions Free | 0€ |
| **Resend** | Email Free | 0€ |
| **TOTAL** | | **~15€/Monat** |

### Scaling Path

| Phase | Änderung | Kosten |
|-------|----------|--------|
| MVP | 3× CX22 + Free Tiers | ~15€/Monat |
| Pilot (10 Partner) | 3× CPX31 | ~35€/Monat |
| Production (100 Partner) | 5× CPX41 + Neon Pro | ~100€/Monat |
| Scale (1000+ Partner) | Kubernetes Cluster | ~300-500€/Monat |

---

## Deployment Checklist

### Vor dem Start

- [ ] **Hetzner Account** erstellt und 3× CX22 bestellt
- [ ] **Neon Database** erstellt und Connection String gesichert
- [ ] **Upstash Redis** erstellt und Credentials gesichert
- [ ] **Cloudflare R2** Bucket erstellt und API Token erstellt
- [ ] **Cloudflare DNS** konfiguriert (api.cargobit.io)
- [ ] **Grafana Cloud** Account erstellt
- [ ] **GitHub Repository** erstellt und Secrets gesetzt
- [ ] **Resend Account** für Emails erstellt

### Server Setup (nach Hetzner Bestellung)

```bash
# Auf jedem Node ausführen
ssh root@<HETZNER_IP>

# Docker installieren
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu

# Docker Compose
apt install docker-compose-plugin

# Node.js (für lokale Tools)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Firewall
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable

# Git clone
git clone https://github.com/cargobit/payments.git /opt/cargobit
cd /opt/cargobit

# Environment Variables
cp .env.example .env
nano .env  # Werte eintragen
```

---

## Single-Server Deployment (Einfachste Option)

```yaml
# docker-compose.yml für einen Server
version: "3.9"

services:
  api:
    image: ghcr.io/cargobit/payments/api:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - UPSTASH_REDIS_URL=${UPSTASH_REDIS_URL}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
    restart: unless-stopped

  worker:
    image: ghcr.io/cargobit/payments/worker:latest
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - UPSTASH_REDIS_URL=${UPSTASH_REDIS_URL}
    restart: unless-stopped

  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    restart: unless-stopped

volumes:
  caddy_data:
```

```bash
# Caddyfile
api.cargobit.io {
    reverse_proxy api:3000
    encode gzip
    header Strict-Transport-Security "max-age=31536000"
}
```

```bash
# Deploy
docker compose up -d
```

---

## Empfehlung für Start

### Phase 1: Single Server (Monat 1-2)

```
Kosten: ~10€/Monat
- 1× Hetzner CPX31 (4 vCPU, 8GB RAM)
- Neon Free + Upstash Free + Cloudflare Free
- Docker Compose auf einem Server
```

### Phase 2: 3-Node Cluster (Monat 3-6)

```
Kosten: ~15€/Monat
- 3× Hetzner CX22
- Separate Nodes für API, Worker, Staging
- Manuelles Load Balancing mit Caddy
```

### Phase 3: Kubernetes (ab 6 Monaten)

```
Kosten: ~100€/Monat
- Hetzner Managed Kubernetes
- Oder: K3s Cluster auf 5 Nodes
- Vollständige Auto-Scaling
```

---

**Letzte Aktualisierung:** April 2026
**Nächste Überprüfung:** Bei Scaling-Bedarf
