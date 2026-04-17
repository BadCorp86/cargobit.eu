# CargoBit End-to-End Deployment Playbook

## Übersicht

Dieses Playbook beschreibt die vollständige Deployment-Reihenfolge für die CargoBit Transport-Plattform auf Kubernetes.

**Deployment-Reihenfolge:** Data → Core → Domain

---

## 1. Voraussetzungen

### 1.1 Kubernetes Cluster

```bash
# Cluster-Info prüfen
kubectl cluster-info
kubectl get nodes

# Benötigte Kubernetes Version
kubectl version --short
# Server Version: v1.28+

# Namespaces erstellen
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: core
  labels:
    name: core
    type: core
    istio-injection: enabled
---
apiVersion: v1
kind: Namespace
metadata:
  name: domain
  labels:
    name: domain
    type: domain
    istio-injection: enabled
---
apiVersion: v1
kind: Namespace
metadata:
  name: data
  labels:
    name: data
    type: data
    istio-injection: enabled
EOF
```

### 1.2 Benötigte Tools

```bash
# Helm 3.x
helm version

# kubectl
kubectl version --client

# Optional: Istio (für mTLS)
istioctl version
```

### 1.3 Secrets vorbereiten

```bash
# Registry Secret
kubectl create secret docker-registry regcred \
  --docker-server=your-registry.io \
  --docker-username=user \
  --docker-password=password \
  -n core

# Internal CA für mTLS
kubectl create secret generic internal-ca \
  --from-file=ca.crt=./certs/ca.crt \
  -n core

# API-Gateway Client Cert
kubectl create secret tls api-gateway-client-cert \
  --cert=./certs/gateway-client.crt \
  --key=./certs/gateway-client.key \
  -n core

# Service Tokens
kubectl create secret generic pricing-service-token \
  --from-literal=token=srv_pricing_token_xxx \
  -n domain
```

---

## 2. Phase 1: Data Layer

### 2.1 PostgreSQL

```bash
# PostgreSQL deployen
helm install postgres ./helm/data/postgres \
  -n data \
  -f ./helm/data/postgres/values-prod.yaml

# Status prüfen
kubectl get pods -n data -l app.kubernetes.io/name=postgres

# Datenbanken erstellen
kubectl exec -n data -it postgres-0 -- psql -U postgres -c "
CREATE DATABASE pricing;
CREATE DATABASE orders;
CREATE DATABASE carriers;
CREATE DATABASE executions;
"

# Wait
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=postgres -n data --timeout=300s
```

### 2.2 Kafka/NATS

```bash
# Kafka deployen
helm install kafka ./helm/data/kafka \
  -n data \
  -f ./helm/data/kafka/values-prod.yaml

# Status prüfen
kubectl get pods -n data -l app.kubernetes.io/name=kafka

# Topics erstellen
kubectl exec -n data -it kafka-0 -- kafka-topics.sh --create \
  --topic pricing.calculated \
  --bootstrap-server localhost:9092

kubectl exec -n data -it kafka-0 -- kafka-topics.sh --create \
  --topic bid.validated \
  --bootstrap-server localhost:9092

kubectl exec -n data -it kafka-0 -- kafka-topics.sh --create \
  --topic fraud.suspected \
  --bootstrap-server localhost:9092

# Wait
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=kafka -n data --timeout=300s
```

### 2.3 Redis (Optional)

```bash
helm install redis ./helm/data/redis \
  -n data \
  -f ./helm/data/redis/values-prod.yaml

kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=redis -n data --timeout=120s
```

---

## 3. Phase 2: Core Layer

### 3.1 Security-Config-Service

```bash
# ConfigMap mit Security-Config erstellen
kubectl create configmap security-config \
  --from-file=security-config.yaml=./config/security-config.yaml \
  -n core

# Security-Config-Service deployen
helm install security-config-service ./helm/core/security-config-service \
  -n core \
  -f ./helm/core/security-config-service/values-prod.yaml

# Status prüfen
kubectl get pods -n core -l app.kubernetes.io/name=security-config-service

# Health Check
kubectl exec -n core -it deploy/security-config-service -- curl -s http://localhost:3005/health

# Wait
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=security-config-service -n core --timeout=120s
```

### 3.2 Auth-Service

```bash
helm install auth-service ./helm/core/auth-service \
  -n core \
  -f ./helm/core/auth-service/values-prod.yaml

kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=auth-service -n core --timeout=120s
```

### 3.3 API-Gateway

```bash
# API-Gateway deployen
helm install api-gateway ./helm/core/api-gateway \
  -n core \
  -f ./helm/core/api-gateway/values-prod.yaml \
  --set auth.oidc.issuer=https://auth.cargobit.io \
  --set auth.oidc.audience=cargobit-api \
  --set mtls.enabled=true

# Status prüfen
kubectl get pods -n core -l app.kubernetes.io/name=api-gateway
kubectl get svc -n core api-gateway
kubectl get ingress -n core

# Health Check
kubectl exec -n core -it deploy/api-gateway -- curl -s http://localhost:8080/health

# Wait
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=api-gateway -n core --timeout=120s
```

### 3.4 Monitoring (Optional)

```bash
# Prometheus Stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n core \
  -f ./helm/core/monitoring/values-prod.yaml

# Grafana Dashboards importieren
kubectl apply -f ./dashboards/ -n core
```

---

## 4. Phase 3: Domain Layer

### 4.1 Pricing-Service

```bash
# DB Credentials
kubectl create secret generic pricing-db-credentials \
  --from-literal=username=pricing \
  --from-literal=password=$(openssl rand -base64 32) \
  --from-literal=url="postgresql://pricing:xxx@postgres.data.svc.cluster.local:5432/pricing" \
  -n domain

# Pricing-Service deployen
helm install pricing-service ./helm/domain/pricing-service \
  -n domain \
  -f ./helm/domain/pricing-service/values-prod.yaml

# Health Check
kubectl exec -n domain -it deploy/pricing-service -- curl -s http://localhost:3002/health
kubectl exec -n domain -it deploy/pricing-service -- curl -s http://localhost:3002/ready

# Wait
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=pricing-service -n domain --timeout=120s
```

### 4.2 Order-Service

```bash
kubectl create secret generic order-db-credentials \
  --from-literal=url="postgresql://order:xxx@postgres.data.svc.cluster.local:5432/orders" \
  -n domain

helm install order-service ./helm/domain/order-service \
  -n domain \
  -f ./helm/domain/order-service/values-prod.yaml

kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=order-service -n domain --timeout=120s
```

### 4.3 Matching-Service

```bash
helm install matching-service ./helm/domain/matching-service \
  -n domain \
  -f ./helm/domain/matching-service/values-prod.yaml

kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=matching-service -n domain --timeout=120s
```

### 4.4 Carrier-Service

```bash
helm install carrier-service ./helm/domain/carrier-service \
  -n domain \
  -f ./helm/domain/carrier-service/values-prod.yaml

kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=carrier-service -n domain --timeout=120s
```

### 4.5 Execution-Service

```bash
helm install execution-service ./helm/domain/execution-service \
  -n domain \
  -f ./helm/domain/execution-service/values-prod.yaml

kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=execution-service -n domain --timeout=120s
```

### 4.6 Bidding-Service

```bash
helm install bidding-service ./helm/domain/bidding-service \
  -n domain \
  -f ./helm/domain/bidding-service/values-prod.yaml

kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=bidding-service -n domain --timeout=120s
```

### 4.7 Risk-Service

```bash
helm install risk-service ./helm/domain/risk-service \
  -n domain \
  -f ./helm/domain/risk-service/values-prod.yaml

kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=risk-service -n domain --timeout=120s
```

---

## 5. Verifikation

### 5.1 Alle Services prüfen

```bash
# Core Namespace
kubectl get pods -n core
kubectl get svc -n core
kubectl get ingress -n core

# Domain Namespace
kubectl get pods -n domain
kubectl get svc -n domain

# Data Namespace
kubectl get pods -n data
kubectl get svc -n data
```

### 5.2 Network Policies prüfen

```bash
# API-Gateway sollte von außen erreichbar sein
curl -k https://api.cargobit.io/health

# Security-Config-Service sollte NICHT von außen erreichbar sein
kubectl run test-pod --rm -it --image=curlimages/curl -- curl http://security-config-service.core.svc.cluster.local:3005/health
```

### 5.3 End-to-End Test

```bash
# 1. Token holen
TOKEN=$(curl -s -X POST https://api.cargobit.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test-carrier","password":"xxx"}' | jq -r '.token')

# 2. Pricing Request
curl -s -X POST https://api.cargobit.io/api/pricing/calculate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "test-001",
    "distanceKm": 150,
    "isInternational": false,
    "transportType": "FTL"
  }' | jq .

# 3. Bid Validation
curl -s -X POST https://api.cargobit.io/api/pricing/orders/test-001/bid/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "carrierId": "carrier-123",
    "bidPrice": 180
  }' | jq .
```

---

## 6. Rollback

### 6.1 Einzelner Service

```bash
# Helm History
helm history pricing-service -n domain

# Rollback
helm rollback pricing-service 1 -n domain
```

### 6.2 Kompletter Rollback

```bash
# In umgekehrter Reihenfolge
helm uninstall risk-service -n domain
helm uninstall bidding-service -n domain
helm uninstall execution-service -n domain
helm uninstall carrier-service -n domain
helm uninstall matching-service -n domain
helm uninstall order-service -n domain
helm uninstall pricing-service -n domain

helm uninstall api-gateway -n core
helm uninstall auth-service -n core
helm uninstall security-config-service -n core

helm uninstall redis -n data
helm uninstall kafka -n data
helm uninstall postgres -n data
```

---

## 7. Upgrade

### 7.1 Security-Config Hot-Reload

```bash
# Config aktualisieren
kubectl create configmap security-config \
  --from-file=security-config.yaml=./config/security-config-v2.yaml \
  -n core \
  --dry-run=client -o yaml | kubectl apply -f -

# Service reload triggern
kubectl exec -n core -it deploy/security-config-service -- \
  curl -X POST http://localhost:3005/config/security/reload \
  -H "Authorization: Bearer admin_token"
```

### 7.2 Service Upgrade

```bash
# Pricing-Service auf neue Version upgraden
helm upgrade pricing-service ./helm/domain/pricing-service \
  -n domain \
  -f ./helm/domain/pricing-service/values-prod.yaml \
  --set image.tag=2.1.0
```

---

## 8. Troubleshooting

### 8.1 Logs

```bash
# Pricing-Service Logs
kubectl logs -n domain -l app.kubernetes.io/name=pricing-service -f

# API-Gateway Logs
kubectl logs -n core -l app.kubernetes.io/name=api-gateway -f

# Security-Config-Service Logs
kubectl logs -n core -l app.kubernetes.io/name=security-config-service -f
```

### 8.2 Events

```bash
kubectl get events -n domain --sort-by='.lastTimestamp'
kubectl describe pod pricing-service-xxx -n domain
```

### 8.3 Connectivity Test

```bash
# Test ob Pricing-Service Security-Config-Service erreicht
kubectl exec -n domain -it deploy/pricing-service -- \
  curl -s http://security-config-service.core.svc.cluster.local:3005/health

# Test ob API-Gateway Pricing-Service erreicht
kubectl exec -n core -it deploy/api-gateway -- \
  curl -s http://pricing-service.domain.svc.cluster.local:80/health
```

---

## 9. Checklist

### Pre-Deployment

- [ ] Kubernetes Cluster erreichbar
- [ ] Namespaces erstellt (core, domain, data)
- [ ] Secrets erstellt (regcred, internal-ca, service-tokens)
- [ ] ConfigMaps vorbereitet (security-config.yaml)
- [ ] Helm Charts validiert (`helm lint ./helm/**`)

### Data Layer

- [ ] PostgreSQL deployed und running
- [ ] Datenbanken erstellt (pricing, orders, carriers, executions)
- [ ] Kafka deployed und running
- [ ] Topics erstellt (pricing.*, bid.*, fraud.*)
- [ ] Redis deployed (optional)

### Core Layer

- [ ] Security-Config-Service deployed und running
- [ ] Auth-Service deployed und running
- [ ] API-Gateway deployed und running
- [ ] Ingress/TLS konfiguriert
- [ ] mTLS aktiviert

### Domain Layer

- [ ] Pricing-Service deployed und running
- [ ] Order-Service deployed und running
- [ ] Matching-Service deployed und running
- [ ] Carrier-Service deployed und running
- [ ] Execution-Service deployed und running
- [ ] Bidding-Service deployed und running
- [ ] Risk-Service deployed und running

### Post-Deployment

- [ ] Health-Checks erfolgreich
- [ ] End-to-End Tests bestanden
- [ ] Network-Policies aktiv
- [ ] Monitoring dashboards erreichbar
- [ ] Alerts konfiguriert

---

*Document Version: 1.0.0 | Last Updated: 2026-04-18*
