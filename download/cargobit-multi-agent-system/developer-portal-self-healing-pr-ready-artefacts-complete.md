# Self-Healing PR-Ready Artefakte — Komplett-Set

**Ziel:** Vier produktionsreife Artefakte für sofortigen Einsatz — Starter-Repo, Terraform/Helm Snippets, CI-Pipeline und Event-Schema.

---

## 1. governance-postcheck Starter-Repo

### Repo-Struktur

```
governance-postcheck/
├── Dockerfile
├── README.md
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── postcheck.py
│   └── config.py
├── tests/
│   ├── __init__.py
│   ├── test_main.py
│   └── test_postcheck.py
├── .github/
│   └── workflows/
│       └── ci.yaml
└── k8s/
    └── deployment.yaml
```

### app/main.py

```python
"""
governance-postcheck - Canary PostCheck Service
Evaluates Prometheus health scores for Canary slices
"""

from flask import Flask, request, jsonify
from app.postcheck import evaluate_health_slice
from app.config import Config
import logging
import structlog

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()

app = Flask(__name__)
app.config.from_object(Config)


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "governance-postcheck"}), 200


@app.route("/ready", methods=["GET"])
def ready():
    """Readiness check endpoint"""
    return jsonify({"status": "ready"}), 200


@app.route("/postcheck", methods=["POST"])
def postcheck():
    """
    Evaluate health score for a Canary slice.
    
    Request JSON:
    {
        "partner": "string (optional)",
        "endpoint": "string (optional)",
        "region": "string (optional)",
        "slice": "string (default: canary)",
        "required_health": 85,
        "window": 300
    }
    
    Response JSON:
    {
        "pass": true/false,
        "value": 87.5,
        "required": 85,
        "reason": "optional error message"
    }
    """
    payload = request.get_json() or {}
    
    partner = payload.get("partner")
    endpoint = payload.get("endpoint")
    region = payload.get("region")
    slice_label = payload.get("slice", "canary")
    required_health = int(payload.get("required_health", 85))
    window = int(payload.get("window", 300))
    
    logger.info(
        "postcheck_requested",
        partner=partner,
        endpoint=endpoint,
        region=region,
        slice=slice_label,
        required_health=required_health,
        window=window
    )
    
    result = evaluate_health_slice(
        partner=partner,
        endpoint=endpoint,
        region=region,
        required_health=required_health,
        window_seconds=window
    )
    
    status = 200 if result["pass"] else 412
    
    logger.info(
        "postcheck_completed",
        passed=result["pass"],
        value=result.get("value"),
        status=status
    )
    
    return jsonify(result), status


@app.route("/postcheck/batch", methods=["POST"])
def postcheck_batch():
    """
    Batch evaluation for multiple slices.
    
    Request JSON:
    {
        "checks": [
            {"partner": "p1", "required_health": 85},
            {"partner": "p2", "required_health": 90}
        ],
        "window": 300
    }
    """
    payload = request.get_json() or {}
    checks = payload.get("checks", [])
    window = int(payload.get("window", 300))
    
    results = []
    for check in checks:
        result = evaluate_health_slice(
            partner=check.get("partner"),
            endpoint=check.get("endpoint"),
            region=check.get("region"),
            required_health=int(check.get("required_health", 85)),
            window_seconds=window
        )
        result["check"] = check
        results.append(result)
    
    all_passed = all(r["pass"] for r in results)
    status = 200 if all_passed else 412
    
    return jsonify({"passed": all_passed, "results": results}), status


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8443)
```

### app/postcheck.py

```python
"""
Prometheus health score evaluation logic
"""

import os
import requests
from typing import Optional, Dict, Any
import structlog

logger = structlog.get_logger()

PROM_URL = os.getenv("PROM_URL", "http://prometheus.monitoring.svc:9090")
PROM_TIMEOUT = int(os.getenv("PROM_TIMEOUT", "10"))


def query_prometheus(query: str) -> Dict[str, Any]:
    """
    Execute a PromQL query against Prometheus.
    
    Args:
        query: PromQL query string
        
    Returns:
        Prometheus API response data
        
    Raises:
        requests.RequestException: On connection/timeout errors
    """
    url = f"{PROM_URL}/api/v1/query"
    logger.debug("prometheus_query", url=url, query=query)
    
    resp = requests.get(
        url,
        params={"query": query},
        timeout=PROM_TIMEOUT
    )
    resp.raise_for_status()
    return resp.json()


def evaluate_health_slice(
    partner: Optional[str],
    endpoint: Optional[str],
    region: Optional[str],
    required_health: int,
    window_seconds: int
) -> Dict[str, Any]:
    """
    Evaluate health score for a specific slice.
    
    Args:
        partner: Partner identifier (optional)
        endpoint: Endpoint identifier (optional)
        region: Region identifier (optional)
        required_health: Minimum health score required (0-100)
        window_seconds: Time window for avg_over_time
        
    Returns:
        Dict with pass status, value, and optional reason
    """
    # Build label filters
    label_filters = []
    if partner:
        label_filters.append(f'partner="{partner}"')
    if endpoint:
        label_filters.append(f'endpoint="{endpoint}"')
    if region:
        label_filters.append(f'region="{region}"')
    
    labels = "{" + ",".join(label_filters) + "}" if label_filters else ""
    
    # Build PromQL query
    promql = f'avg_over_time(proxy:health_score{labels}[{window_seconds}s])'
    
    try:
        data = query_prometheus(promql)
        results = data.get("data", {}).get("result", [])
        
        if not results:
            return {
                "pass": False,
                "value": None,
                "required": required_health,
                "reason": "no_metrics_found"
            }
        
        # Extract value from Prometheus response
        value = float(results[0]["value"][1])
        
    except requests.RequestException as e:
        logger.error("prometheus_error", error=str(e))
        return {
            "pass": False,
            "value": None,
            "required": required_health,
            "reason": f"prometheus_error: {str(e)}"
        }
    except (KeyError, IndexError, ValueError) as e:
        logger.error("parse_error", error=str(e))
        return {
            "pass": False,
            "value": None,
            "required": required_health,
            "reason": f"parse_error: {str(e)}"
        }
    
    passed = value >= required_health
    
    return {
        "pass": passed,
        "value": round(value, 2),
        "required": required_health,
        "reason": None if passed else "below_threshold"
    }


def evaluate_multiple_metrics(
    metrics: Dict[str, str],
    window_seconds: int
) -> Dict[str, float]:
    """
    Query multiple metrics and return their values.
    
    Args:
        metrics: Dict of metric_name -> PromQL query (without avg_over_time)
        window_seconds: Time window for avg_over_time
        
    Returns:
        Dict of metric_name -> value
    """
    results = {}
    
    for name, query in metrics.items():
        promql = f'avg_over_time({query}[{window_seconds}s])'
        try:
            data = query_prometheus(promql)
            result = data.get("data", {}).get("result", [])
            if result:
                results[name] = float(result[0]["value"][1])
            else:
                results[name] = None
        except Exception:
            results[name] = None
    
    return results
```

### app/config.py

```python
"""
Configuration for governance-postcheck service
"""

import os


class Config:
    """Application configuration"""
    
    # Prometheus
    PROM_URL = os.getenv("PROM_URL", "http://prometheus.monitoring.svc:9090")
    PROM_TIMEOUT = int(os.getenv("PROM_TIMEOUT", "10"))
    
    # Server
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8443"))
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    
    # Defaults
    DEFAULT_REQUIRED_HEALTH = int(os.getenv("DEFAULT_REQUIRED_HEALTH", "85"))
    DEFAULT_WINDOW = int(os.getenv("DEFAULT_WINDOW", "300"))
```

### requirements.txt

```
Flask==2.3.3
requests==2.31.0
structlog==23.2.0
gunicorn==21.2.0
prometheus-client==0.19.0
```

### Dockerfile

```dockerfile
# Build stage
FROM python:3.11-slim as builder

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy application
COPY app /app/app
COPY requirements.txt .

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Environment
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

EXPOSE 8443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8443/health || exit 1

# Run with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8443", "--workers", "2", "--threads", "4", "app.main:app"]
```

### tests/test_postcheck.py

```python
"""
Unit tests for postcheck module
"""

import pytest
from unittest.mock import patch, MagicMock
from app.postcheck import evaluate_health_slice, query_prometheus


class TestQueryPrometheus:
    """Tests for query_prometheus function"""
    
    @patch("app.postcheck.requests.get")
    def test_query_success(self, mock_get):
        """Test successful Prometheus query"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "status": "success",
            "data": {
                "result": [{"metric": {}, "value": [1700000000, "85.5"]}]
            }
        }
        mock_get.return_value = mock_response
        
        result = query_prometheus("up")
        
        assert result["status"] == "success"
        mock_get.assert_called_once()


class TestEvaluateHealthSlice:
    """Tests for evaluate_health_slice function"""
    
    @patch("app.postcheck.query_prometheus")
    def test_health_above_threshold(self, mock_query):
        """Test when health score is above threshold"""
        mock_query.return_value = {
            "data": {
                "result": [{"value": [1700000000, "87.5"]}]
            }
        }
        
        result = evaluate_health_slice(
            partner="test-partner",
            endpoint="test-endpoint",
            region="eu-west-1",
            required_health=85,
            window_seconds=300
        )
        
        assert result["pass"] is True
        assert result["value"] == 87.5
        assert result["required"] == 85
    
    @patch("app.postcheck.query_prometheus")
    def test_health_below_threshold(self, mock_query):
        """Test when health score is below threshold"""
        mock_query.return_value = {
            "data": {
                "result": [{"value": [1700000000, "72.0"]}]
            }
        }
        
        result = evaluate_health_slice(
            partner="test-partner",
            required_health=85,
            window_seconds=300
        )
        
        assert result["pass"] is False
        assert result["value"] == 72.0
        assert result["reason"] == "below_threshold"
    
    @patch("app.postcheck.query_prometheus")
    def test_no_metrics_found(self, mock_query):
        """Test when no metrics are found"""
        mock_query.return_value = {
            "data": {
                "result": []
            }
        }
        
        result = evaluate_health_slice(
            partner="unknown-partner",
            required_health=85,
            window_seconds=300
        )
        
        assert result["pass"] is False
        assert result["value"] is None
        assert result["reason"] == "no_metrics_found"
```

---

## 2. Terraform/Helm Snippets für Secrets & ConfigMaps

### Terraform: Kubernetes Secrets und ConfigMaps

```hcl
# terraform/modules/governance-secrets/main.tf

# ============================================================================
# SSH Key Secret for ArgoCD Git Access
# ============================================================================

resource "kubernetes_secret" "git_ssh_key" {
  metadata {
    name      = "git-ssh-key"
    namespace = "governance"
    
    labels = {
      app.kubernetes.io/name      = "governance"
      app.kubernetes.io/component = "git-access"
    }
  }
  
  data = {
    id_rsa      = var.git_ssh_private_key
    id_rsa.pub  = var.git_ssh_public_key
    known_hosts = var.git_known_hosts
  }
  
  type = "Opaque"
}

# ============================================================================
# Governance Public Keys ConfigMap
# ============================================================================

resource "kubernetes_config_map" "governance_public_keys" {
  metadata {
    name      = "governance-public-keys"
    namespace = "governance"
    
    labels = {
      app.kubernetes.io/name      = "governance"
      app.kubernetes.io/component = "policy-signing"
    }
  }
  
  data = {
    "policy_signing_key_2024.pub" = var.policy_signing_public_key_2024
    "policy_signing_key_2025.pub" = var.policy_signing_public_key_2025
  }
}

# ============================================================================
# RBAC for governance-hook ServiceAccount
# ============================================================================

resource "kubernetes_service_account" "governance_hook" {
  metadata {
    name      = "governance-hook"
    namespace = "governance"
    
    labels = {
      app.kubernetes.io/name = "governance-hook"
    }
  }
}

resource "kubernetes_role" "governance_hook" {
  metadata {
    name      = "governance-hook"
    namespace = "governance"
  }
  
  rule {
    api_groups = [""]
    resources  = ["secrets", "configmaps"]
    verbs      = ["get", "list"]
  }
  
  rule {
    api_groups = ["batch"]
    resources  = ["jobs"]
    verbs      = ["get", "list", "watch", "create", "delete"]
  }
}

resource "kubernetes_role_binding" "governance_hook" {
  metadata {
    name      = "governance-hook"
    namespace = "governance"
  }
  
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.governance_hook.metadata[0].name
  }
  
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.governance_hook.metadata[0].name
    namespace = "governance"
  }
}

# ============================================================================
# RBAC for governance-operator ServiceAccount
# ============================================================================

resource "kubernetes_service_account" "governance_operator" {
  metadata {
    name      = "governance-operator"
    namespace = "proxy-control"
    
    labels = {
      app.kubernetes.io/name = "governance-operator"
    }
  }
}

resource "kubernetes_role" "governance_operator" {
  metadata {
    name      = "governance-operator"
    namespace = "proxy-control"
  }
  
  rule {
    api_groups = ["argoproj.io"]
    resources  = ["rollouts"]
    verbs      = ["get", "list", "watch", "update", "patch"]
  }
  
  rule {
    api_groups = [""]
    resources  = ["pods"]
    verbs      = ["get", "list", "delete"]
  }
  
  rule {
    api_groups = [""]
    resources  = ["configmaps"]
    verbs      = ["get", "update"]
  }
}

resource "kubernetes_role_binding" "governance_operator" {
  metadata {
    name      = "governance-operator"
    namespace = "proxy-control"
  }
  
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.governance_operator.metadata[0].name
  }
  
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.governance_operator.metadata[0].name
    namespace = "proxy-control"
  }
}
```

### Terraform Variables

```hcl
# terraform/modules/governance-secrets/variables.tf

variable "git_ssh_private_key" {
  description = "Private SSH key for Git access"
  type        = string
  sensitive   = true
}

variable "git_ssh_public_key" {
  description = "Public SSH key for Git access"
  type        = string
}

variable "git_known_hosts" {
  description = "Known hosts for Git server"
  type        = string
  default     = "github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlGeGQ2T6..."
}

variable "policy_signing_public_key_2024" {
  description = "Policy signing public key for 2024"
  type        = string
}

variable "policy_signing_public_key_2025" {
  description = "Policy signing public key for 2025"
  type        = string
}
```

### Helm Chart: governance-secrets

```yaml
# helm/governance-secrets/Chart.yaml
apiVersion: v2
name: governance-secrets
description: Kubernetes secrets and RBAC for governance system
type: application
version: 1.0.0
appVersion: "1.0.0"
```

```yaml
# helm/governance-secrets/values.yaml
git:
  ssh:
    privateKey: ""
    publicKey: ""
    knownHosts: |
      github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlGeGQ2T6...

policySigning:
  keys:
    "2024": ""
    "2025": ""

serviceAccounts:
  governanceHook:
    create: true
  governanceOperator:
    create: true

rbac:
  create: true
```

```yaml
# helm/governance-secrets/templates/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: git-ssh-key
  namespace: governance
  labels:
    {{- include "governance-secrets.labels" . | nindent 4 }}
type: Opaque
data:
  id_rsa: {{ .Values.git.ssh.privateKey | b64enc | quote }}
  id_rsa.pub: {{ .Values.git.ssh.publicKey | b64enc | quote }}
  known_hosts: {{ .Values.git.ssh.knownHosts | b64enc | quote }}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: governance-public-keys
  namespace: governance
  labels:
    {{- include "governance-secrets.labels" . | nindent 4 }}
data:
  {{- range $key, $value := .Values.policySigning.keys }}
  policy_signing_key_{{ $key }}.pub: |
    {{ $value }}
  {{- end }}
```

---

## 3. CI-Pipeline Snippet (GitHub Actions)

### GitHub Actions Workflow

```yaml
# .github/workflows/build-images.yaml
name: Build and Push Images

on:
  push:
    branches: [main]
    paths:
      - 'images/**'
      - '.github/workflows/build-images.yaml'
  pull_request:
    branches: [main]
    paths:
      - 'images/**'
  workflow_dispatch:
    inputs:
      image:
        description: 'Image to build (gov-sign-checker, policy-operator, governance-postcheck, or all)'
        required: false
        default: 'all'

env:
  REGISTRY: ghcr.io
  ORG: cargobit

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      gov-sign-checker: ${{ steps.changes.outputs.gov-sign-checker }}
      policy-operator: ${{ steps.changes.outputs.policy-operator }}
      governance-postcheck: ${{ steps.changes.outputs.governance-postcheck }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: changes
        with:
          filters: |
            gov-sign-checker:
              - 'images/gov-sign-checker/**'
            policy-operator:
              - 'images/policy-operator/**'
            governance-postcheck:
              - 'images/governance-postcheck/**'

  build-gov-sign-checker:
    needs: detect-changes
    if: needs.detect-changes.outputs.gov-sign-checker == 'true' || github.event_name == 'workflow_dispatch'
    uses: ./.github/workflows/build-single-image.yaml
    with:
      image-name: gov-sign-checker
      image-path: images/gov-sign-checker
    secrets: inherit

  build-policy-operator:
    needs: detect-changes
    if: needs.detect-changes.outputs.policy-operator == 'true' || github.event_name == 'workflow_dispatch'
    uses: ./.github/workflows/build-single-image.yaml
    with:
      image-name: policy-operator
      image-path: images/policy-operator
    secrets: inherit

  build-governance-postcheck:
    needs: detect-changes
    if: needs.detect-changes.outputs.governance-postcheck == 'true' || github.event_name == 'workflow_dispatch'
    uses: ./.github/workflows/build-single-image.yaml
    with:
      image-name: governance-postcheck
      image-path: images/governance-postcheck
    secrets: inherit
```

### Reusable Workflow: build-single-image.yaml

```yaml
# .github/workflows/build-single-image.yaml
name: Build Single Image

on:
  workflow_call:
    inputs:
      image-name:
        required: true
        type: string
      image-path:
        required: true
        type: string

env:
  REGISTRY: ghcr.io
  ORG: cargobit

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.ORG }}/${{ inputs.image-name }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=sha,prefix=
            type=raw,value=latest,enable={{is_default_branch}}
      
      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: ${{ inputs.image-path }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          sbom: true
          provenance: true
          outputs: type=docker,dest=/tmp/image.tar
      
      # Security Scan
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.ORG }}/${{ inputs.image-name }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
      
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
      
      # Sign Image with cosign
      - name: Install cosign
        uses: sigstore/cosign-installer@v3
      
      - name: Sign image
        env:
          DIGEST: ${{ steps.build.outputs.digest }}
        run: |
          cosign sign --yes \
            ${{ env.REGISTRY }}/${{ env.ORG }}/${{ inputs.image-name }}@${DIGEST}
      
      - name: Verify signature
        env:
          DIGEST: ${{ steps.build.outputs.digest }}
        run: |
          cosign verify \
            --certificate-identity=${{ github.server_url }}/${{ github.repository }}/.github/workflows/build-single-image.yaml@refs/heads/main \
            --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
            ${{ env.REGISTRY }}/${{ env.ORG }}/${{ inputs.image-name }}@${DIGEST}
      
      # Output digest for release notes
      - name: Output image digest
        run: |
          echo "### Image Built" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Property | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|----------|-------|" >> $GITHUB_STEP_SUMMARY
          echo "| Image | \`${{ env.REGISTRY }}/${{ env.ORG }}/${{ inputs.image-name }}\` |" >> $GITHUB_STEP_SUMMARY
          echo "| Digest | \`${{ steps.build.outputs.digest }}\` |" >> $GITHUB_STEP_SUMMARY
          echo "| Tags | ${{ steps.meta.outputs.tags }} |" >> $GITHUB_STEP_SUMMARY

  test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Run unit tests
        run: |
          cd ${{ inputs.image-path }}
          if [ -f "pytest.ini" ] || [ -f "tests/test_*.py" ]; then
            pip install pytest pytest-cov
            pytest --cov=app --cov-report=xml --cov-report=html
          elif [ -f "package.json" ]; then
            npm ci
            npm test
          fi
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage.xml
          flags: ${{ inputs.image-name }}
```

---

## 4. governance_event_v1 JSON-Schema

### JSON Schema Definition

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://cargobit.com/schemas/governance_event_v1.json",
  "title": "Governance Event v1",
  "description": "Schema for governance audit events in the CargoBit platform",
  "type": "object",
  "required": [
    "schema_version",
    "event_id",
    "timestamp",
    "correlation_id",
    "actor",
    "action",
    "resource",
    "signature"
  ],
  "additionalProperties": false,
  "properties": {
    "schema_version": {
      "type": "string",
      "const": "governance_event_v1",
      "description": "Schema version identifier"
    },
    "event_id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique identifier for this event"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp when the event occurred"
    },
    "correlation_id": {
      "type": "string",
      "format": "uuid",
      "description": "Correlation ID linking related events"
    },
    "actor": {
      "type": "object",
      "required": ["type", "id"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["automation", "user", "system"],
          "description": "Type of actor that triggered the event"
        },
        "id": {
          "type": "string",
          "description": "Identifier for the actor (user email, service name, etc.)"
        },
        "ip_address": {
          "type": "string",
          "format": "ipv4",
          "description": "IP address of the actor (if applicable)"
        }
      }
    },
    "action": {
      "type": "object",
      "required": ["type", "status"],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "policy_apply",
            "policy_promote",
            "policy_rollback",
            "canary_start",
            "canary_promote",
            "canary_rollback",
            "containment_triggered",
            "repair_triggered",
            "escalation_triggered",
            "key_rotation",
            "key_revoke"
          ],
          "description": "Type of action performed"
        },
        "status": {
          "type": "string",
          "enum": ["started", "completed", "failed", "rolled_back"],
          "description": "Status of the action"
        },
        "reason": {
          "type": "string",
          "description": "Reason for the action (optional)"
        }
      }
    },
    "resource": {
      "type": "object",
      "required": ["type", "id"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["policy", "canary_slice", "endpoint", "partner", "key"],
          "description": "Type of resource affected"
        },
        "id": {
          "type": "string",
          "description": "Identifier for the resource"
        },
        "namespace": {
          "type": "string",
          "description": "Kubernetes namespace (if applicable)"
        },
        "region": {
          "type": "string",
          "description": "Cloud region (if applicable)"
        }
      }
    },
    "policy": {
      "type": "object",
      "properties": {
        "policy_id": {
          "type": "string",
          "description": "Policy identifier"
        },
        "policy_version": {
          "type": "string",
          "description": "Policy version"
        },
        "policy_name": {
          "type": "string",
          "description": "Human-readable policy name"
        }
      }
    },
    "health_score": {
      "type": "object",
      "properties": {
        "before": {
          "type": "number",
          "minimum": 0,
          "maximum": 100,
          "description": "Health score before action"
        },
        "after": {
          "type": "number",
          "minimum": 0,
          "maximum": 100,
          "description": "Health score after action"
        },
        "required_threshold": {
          "type": "number",
          "minimum": 0,
          "maximum": 100,
          "description": "Required health threshold"
        }
      }
    },
    "canary": {
      "type": "object",
      "properties": {
        "slice_percent": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100,
          "description": "Canary traffic percentage"
        },
        "step": {
          "type": "integer",
          "minimum": 1,
          "description": "Canary step number"
        },
        "region": {
          "type": "string",
          "description": "Canary region"
        }
      }
    },
    "before_state": {
      "type": "object",
      "properties": {
        "hash": {
          "type": "string",
          "description": "SHA256 hash of state before action"
        },
        "snapshot_id": {
          "type": "string",
          "format": "uuid",
          "description": "ID of forensic snapshot"
        }
      }
    },
    "after_state": {
      "type": "object",
      "properties": {
        "hash": {
          "type": "string",
          "description": "SHA256 hash of state after action"
        },
        "snapshot_id": {
          "type": "string",
          "format": "uuid",
          "description": "ID of forensic snapshot"
        }
      }
    },
    "signature": {
      "type": "object",
      "required": ["algorithm", "value", "key_id"],
      "properties": {
        "algorithm": {
          "type": "string",
          "enum": ["RS256", "ES256", "EdDSA"],
          "description": "Signature algorithm"
        },
        "value": {
          "type": "string",
          "format": "base64",
          "description": "Base64-encoded signature"
        },
        "key_id": {
          "type": "string",
          "description": "Identifier of the signing key"
        },
        "timestamp": {
          "type": "string",
          "format": "date-time",
          "description": "When the signature was created"
        }
      }
    },
    "metadata": {
      "type": "object",
      "additionalProperties": true,
      "description": "Additional metadata"
    }
  }
}
```

### Beispiel-Event

```json
{
  "schema_version": "governance_event_v1",
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-05-05T14:30:00.000Z",
  "correlation_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "actor": {
    "type": "automation",
    "id": "policy-operator",
    "ip_address": "10.0.0.15"
  },
  "action": {
    "type": "canary_promote",
    "status": "completed",
    "reason": "health_score_recovered"
  },
  "resource": {
    "type": "canary_slice",
    "id": "partner-acme-endpoint-api-v1",
    "namespace": "proxy-control",
    "region": "eu-west-1"
  },
  "policy": {
    "policy_id": "cp-2026-0002",
    "policy_version": "2026-06-01",
    "policy_name": "advanced-containment-and-repair"
  },
  "health_score": {
    "before": 62.5,
    "after": 87.3,
    "required_threshold": 85
  },
  "canary": {
    "slice_percent": 10,
    "step": 2,
    "region": "eu-west-1"
  },
  "before_state": {
    "hash": "sha256:a1b2c3d4e5f6...",
    "snapshot_id": "snap-001"
  },
  "after_state": {
    "hash": "sha256:f6e5d4c3b2a1...",
    "snapshot_id": "snap-002"
  },
  "signature": {
    "algorithm": "ES256",
    "value": "MEUCIQDvz3...",
    "key_id": "policy-signing-key-2025",
    "timestamp": "2026-05-05T14:30:00.500Z"
  },
  "metadata": {
    "source": "policy-operator",
    "version": "1.0.0"
  }
}
```

---

## Dokument-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-05-05 | Initiale Erstellung |

---

**CargoBit Multi-Agent System** — Developer Portal Documentation
