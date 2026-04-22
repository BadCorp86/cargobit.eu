# =============================================================================
# CargoBit Production Deployment Guide
# =============================================================================
# Registry: registry.cargobit.io
# Cluster: production.cargobit.io
# =============================================================================

## 1. Registry Login

```bash
# Docker Login
docker login registry.cargobit.io
# Username: cargobit-deployer
# Password: <Token aus Vault>
```

## 2. Images bauen und pushen

```bash
# Backend
docker build -f Dockerfile.backend -t registry.cargobit.io/payments-backend:v1.0.0 .
docker push registry.cargobit.io/payments-backend:v1.0.0

# Worker
docker build -f Dockerfile.worker -t registry.cargobit.io/payments-worker:v1.0.0 .
docker push registry.cargobit.io/payments-worker:v1.0.0

# Latest Tag
docker tag registry.cargobit.io/payments-backend:v1.0.0 registry.cargobit.io/payments-backend:latest
docker push registry.cargobit.io/payments-backend:latest
```

## 3. Kubernetes Namespace vorbereiten

```bash
# Namespaces erstellen
kubectl create namespace staging --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace production --dry-run=client -o yaml | kubectl apply -f -

# CI ServiceAccount anlegen
kubectl apply -f kubernetes/ci-serviceaccount.yaml -n staging
kubectl apply -f kubernetes/ci-serviceaccount.yaml -n production
```

## 4. Secrets erstellen

```bash
# Staging SealedSecret
kubeseal --controller-namespace kube-system --format yaml \
  < kubernetes/secrets/staging-secret.yaml \
  > kubernetes/sealedsecret-payments-staging.yaml
kubectl apply -f kubernetes/sealedsecret-payments-staging.yaml -n staging

# Production SealedSecret
kubeseal --controller-namespace kube-system --format yaml \
  < kubernetes/secrets/production-secret.yaml \
  > kubernetes/sealedsecret-payments-production.yaml
kubectl apply -f kubernetes/sealedsecret-payments-production.yaml -n production
```

## 5. Helm Deployment

```bash
# Staging
helm upgrade --install payments ./helm/payments-service \
  -n staging \
  -f ./helm/payments-service/values-cargobit.yaml \
  -f ./helm/payments-service/values-staging.yaml \
  --set image.tag=v1.0.0 \
  --set workerImage.tag=v1.0.0

# Production (mit mehr Replikas und Ressourcen)
helm upgrade --install payments ./helm/payments-service \
  -n production \
  -f ./helm/payments-service/values-cargobit.yaml \
  -f ./helm/payments-service/values-production.yaml \
  --set image.tag=v1.0.0 \
  --set workerImage.tag=v1.0.0 \
  --wait --timeout 10m
```

## 6. Deployment verifizieren

```bash
# Staging
kubectl get pods -n staging -l app=payments
kubectl get ingress -n staging
curl -k https://payments.staging.cargobit.io/api/health

# Production
kubectl get pods -n production -l app=payments
kubectl get ingress -n production
curl https://payments.cargobit.io/api/health
```

## 7. Rollback

```bash
# Helm History anzeigen
helm history payments -n production

# Zu vorheriger Version rollbacken
helm rollback payments 1 -n production

# Oder mit anderem Image Tag
helm upgrade --install payments ./helm/payments-service \
  -n production \
  --set image.tag=v0.9.5 \
  --set workerImage.tag=v0.9.5
```

## 8. CI/CD Setup

### GitHub Secrets konfigurieren

| Secret | Wert |
|--------|------|
| `DOCKER_REGISTRY` | `registry.cargobit.io` |
| `DOCKER_USERNAME` | `cargobit-deployer` |
| `DOCKER_PASSWORD` | `<Token aus Vault>` |
| `KUBE_CONFIG_DATA` | `<base64 kubeconfig>` |
| `KUBESEAL_CERT` | `<PEM Zertifikat>` |

### Workflows aktivieren

```bash
# Workflows sind bereit unter:
# .github/workflows/build-and-push-images.yml
# .github/workflows/helm-deploy-and-test.yml
# .github/workflows/generate-sealedsecret.yml
# .github/workflows/rotate-secrets.yml
```

## 9. Monitoring

```bash
# Prometheus Metrics
kubectl port-forward svc/prometheus-operated 9090:9090 -n monitoring

# Grafana Dashboard
kubectl port-forward svc/grafana 3000:80 -n monitoring

# Alerts konfigurieren in:
# observability/prometheus/rules.yml
```

## 10. Troubleshooting

```bash
# Pod Logs
kubectl logs -n staging deployment/payments-backend -f
kubectl logs -n staging deployment/payments-worker -f

# Pod Events
kubectl describe pod -n staging -l app=payments

# Redis Verbindung testen
kubectl run redis-cli --rm -it --image=redis:alpine -- \
  redis-cli -h redis -p 6379 ping

# Database Verbindung testen
kubectl run pg-cli --rm -it --image=postgres:14 -- \
  psql "$DATABASE_URL" -c "SELECT 1"
```

---

## Quick Reference

| Umgebung | Namespace | Host |
|----------|-----------|------|
| Staging | `staging` | `payments.staging.cargobit.io` |
| Production | `production` | `payments.cargobit.io` |

| Image | Registry |
|-------|----------|
| Backend | `registry.cargobit.io/payments-backend` |
| Worker | `registry.cargobit.io/payments-worker` |

| Workflow | Trigger |
|----------|---------|
| Build & Push | Push auf `main` |
| Helm Deploy | Manuell / Nach Build |
| Secret Rotation | Monatlich (1. des Monats) |
