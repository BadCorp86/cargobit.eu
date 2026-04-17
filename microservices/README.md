# CargoBit Microservices Architecture

## Overview

CargoBit is a European logistics marketplace platform built with a microservice architecture for scalability, maintainability, and independent deployment.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Port 3000)                    │
│  - Routing  - Auth  - Rate-Limiting  - Logging  - mTLS       │
└───────────────────────────┬──────────────────────────────────┘
                            │
    ┌───────────────────────┼───────────────────────┐
    │           │           │           │           │
┌───▼───┐  ┌───▼───┐  ┌───▼───┐  ┌───▼───┐  ┌───▼───┐
│ Auth  │  │ Order │  │Insuran│  │  Ad   │  │ Risk  │
│Service│  │Service│  │Service│  │Service│  │Engine │
│ :3001 │  │ :3002 │  │ :3003 │  │ :3004 │  │ :3005 │
└───┬───┘  └───┬───┘  └───┬───┘  └───┬───┘  └───┬───┘
    │          │          │          │          │
    └──────────┴──────────┴──────────┴──────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
    ┌────▼────┐        ┌────▼────┐       ┌────▼────┐
    │ Audit   │        │Notificat│       │ Partner │
    │ Service │        │ Service │       │ Service │
    │  :3006  │        │  :3007  │       │  :3008  │
    └─────────┘        └─────────┘       └─────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
         ┌────▼────┐                 ┌────▼────┐
         │PostgreSQL│                │  Redis  │
         │   :5432  │                │  :6379  │
         └──────────┘                └─────────┘
```

## Services

### 1. API Gateway (Port 3000)
- **Single entry point** for all client requests
- **JWT & API Key validation** via Auth Service
- **Rate limiting**: User (100/min), Partner (300/min), Internal (unlimited)
- **Request routing** to appropriate microservices
- **Audit logging** for all security-relevant requests

### 2. Auth Service (Port 3001)
- User authentication (JWT)
- Partner API key management
- Service-to-service authentication (mTLS + Service JWT)
- Password reset, token refresh

### 3. Order Service (Port 3002)
- Order lifecycle management
- Matching engine integration
- Offer handling
- Driver assignment

### 4. Insurance Service (Port 3003)
- Quote generation
- Policy management
- Claims processing
- Commission calculation

### 5. Ad Service (Port 3004)
- Campaign management
- Impression/click tracking
- Banner serving
- Partner commissions

### 6. Risk Engine (Port 3005)
- Risk scoring (0-100)
- Fraud detection rules
- Geo-location checks
- Device fingerprinting

### 7. Audit Service (Port 3006)
- Append-only audit log
- Hash chain for integrity (WORM storage)
- Compliance-ready event tracking

### 8. Notification Service (Port 3007)
- Email, SMS, Push notifications
- Webhooks
- Slack integration

## Gateway Routing

| Path | Service | Auth Type |
|------|---------|-----------|
| `/auth/*` | Auth Service | Public/User |
| `/orders/*` | Order Service | User |
| `/insurance/*` | Insurance Service | User/Partner |
| `/ads/*` | Ad Service | Partner/Public |
| `/risk/*` | Risk Engine | Service/User |
| `/audit/*` | Audit Service | Admin |
| `/notifications/*` | Notification Service | User |

## Authentication Levels

### 1. User Auth (JWT)
```json
{
  "sub": "userId",
  "role": "shipper | carrier | admin",
  "permissions": ["orders:read", "insurance:create"],
  "exp": 1710000000
}
```

### 2. Partner Auth (API Key)
```
x-api-key: cb_xxxxxxxxxxxxxxxxxxxxx
```

### 3. Service Auth (mTLS + Service JWT)
```json
{
  "service": "risk-engine",
  "permissions": ["risk:score"],
  "exp": 1710000000
}
```

## Rate Limiting

| Client Type | Limit | Window |
|-------------|-------|--------|
| User | 100 requests | 1 minute |
| Partner | 300 requests | 1 minute |
| Internal Service | Unlimited | - |

## Quick Start

### Development
```bash
# Start all services with Docker Compose
cd microservices
docker-compose up -d

# Check service health
curl http://localhost:3000/health
```

### Production (Kubernetes)
```bash
# Apply Kubernetes manifests
kubectl apply -f kubernetes/deployment.yml

# Check deployment status
kubectl get pods -n cargobit
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret | *required* |
| `JWT_EXPIRY` | Access token expiry | `15m` |
| `DATABASE_URL` | PostgreSQL connection | *required* |
| `REDIS_URL` | Redis connection | *required* |
| `SERVICE_SHARED_SECRET` | Inter-service auth | *required* |

## Health Checks

Each service provides a `/health` endpoint:

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "service": "auth-service",
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Monitoring

Prometheus + Grafana dashboards available:

```bash
# Start monitoring stack
docker-compose --profile monitoring up -d

# Access Grafana
open http://localhost:3001
# Default: admin/admin
```

## Event Streaming (Kafka)

Optional Kafka support for event-driven architecture:

```bash
# Start Kafka stack
docker-compose --profile kafka up -d
```

Topics:
- `order.created`
- `order.assigned`
- `order.completed`
- `risk.score_calculated`
- `insurance.policy_created`
- `notification.sent`

## Database Migrations

Each service manages its own database schema:

```bash
# Run migrations for all services
npm run db:migrate

# Seed demo data
npm run db:seed
```

## Testing

```bash
# Run all tests
npm test

# Run tests for specific service
cd auth-service && npm test
```

## CI/CD Pipeline

GitHub Actions workflow:
1. Lint & Test
2. Build Docker images
3. Push to registry
4. Deploy to staging
5. Run integration tests
6. Deploy to production (manual approval)

## Security Considerations

- All inter-service communication uses Service JWT
- User passwords are hashed with PBKDF2
- API keys are prefix-based for easy identification
- Rate limiting prevents abuse
- Audit log is immutable (hash chain)
- All endpoints require authentication by default

## License

Proprietary - CargoBit GmbH
