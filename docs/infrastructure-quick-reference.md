# Quick Reference — CargoBit MVP Infrastruktur

## Minimales Setup (~15€/Monat)

| Komponente | Anbieter | Kosten | Free Tier Limits |
|------------|----------|--------|------------------|
| **Compute** | Hetzner Cloud | 14,94€/Mo | 3× CX22 (2 vCPU, 4GB RAM) |
| **Database** | Neon | 0€ | 0.5GB, Auto-sleep |
| **Cache** | Upstash Redis | 0€ | 10K cmds/day, 256MB |
| **Storage** | Cloudflare R2 | 0€ | 10GB, Free Egress |
| **CDN/DNS** | Cloudflare | 0€ | Unbegrenzt |
| **Monitoring** | Grafana Cloud | 0€ | 10K Metrics, 3 Dashboards |
| **CI/CD** | GitHub Actions | 0€ | 2.000 Min/Monat |
| **Email** | Resend | 0€ | 3.000 Emails/Monat |

---

## Noch günstiger? Single Server Option

| Option | Server | Kosten/Monat |
|--------|--------|--------------|
| **Ultra-Budget** | 1× Hetzner CX22 | 4,98€ |
| **Budget** | 1× Hetzner CPX31 | 9,90€ |
| **Empfohlen** | 3× Hetzner CX22 | 14,94€ |

---

## Registrierungs-Reihenfolge

```
1. GitHub Account        → github.com
2. Hetzner Cloud         → hetzner.com/cloud
3. Neon Database         → neon.tech
4. Upstash Redis         → upstash.com
5. Cloudflare (R2+DNS)   → dash.cloudflare.com
6. Grafana Cloud         → grafana.com
7. Resend Email          → resend.com
```

---

## Einmalige Einrichtung (~2-3 Stunden)

```
□ Hetzner: 3 Server bestellt (CX22 × 3)
□ Neon: Database + Connection String
□ Upstash: Redis Database + Credentials
□ Cloudflare: R2 Bucket + API Token
□ Cloudflare: DNS Record (api.cargobit.io)
□ GitHub: Repository + Secrets
□ Server: Docker + Caddy installiert
□ Deploy: docker compose up -d
```

---

## Skalierungspfad

| Nutzer | Setup | Kosten |
|--------|-------|--------|
| 0-100 | 3× CX22 + Free Tiers | ~15€ |
| 100-500 | 3× CPX31 + Neon Pro | ~50€ |
| 500-2000 | 5× CPX41 + Managed DB | ~150€ |
| 2000+ | Kubernetes Cluster | ~300€+ |

---

**Dokumentation:** `/docs/infrastructure-mvp-startup.md`
