"""
CargoBit ML Inference - Observability Module
============================================

Production-ready metrics, logging, and tracing:
- Prometheus metrics (latency, errors, throughput)
- Structured logging
- OpenTelemetry tracing (optional)
- Health checks

Usage:
    from observability import setup_observability, metrics
    app = FastAPI()
    setup_observability(app)
"""

import os
import time
import logging
import json
from datetime import datetime
from typing import Callable

from fastapi import FastAPI, Request, Response
from prometheus_client import Counter, Histogram, Gauge, Info, generate_latest, CONTENT_TYPE_LATEST

# =============================================================================
# PROMETHEUS METRICS
# =============================================================================

# Request latency histogram
REQUEST_LATENCY = Histogram(
    "ml_inference_request_latency_seconds",
    "Latency of ML inference requests",
    ["endpoint", "method"],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 1.0]
)

# Request counter
REQUEST_COUNT = Counter(
    "ml_inference_requests_total",
    "Total ML inference requests",
    ["endpoint", "method", "status"]
)

# Model predictions
PREDICTION_COUNT = Counter(
    "ml_predictions_total",
    "Total predictions made",
    ["model_version", "model_type"]
)

# Model scores distribution
SCORE_HISTOGRAM = Histogram(
    "ml_score_distribution",
    "Distribution of ML scores",
    ["model_version"],
    buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

# Model info
MODEL_INFO = Info(
    "ml_model_info",
    "Current model information"
)

# Cache metrics
CACHE_HITS = Counter(
    "ml_cache_hits_total",
    "Model cache hits",
    ["cache_type"]
)

CACHE_MISSES = Counter(
    "ml_cache_misses_total",
    "Model cache misses",
    ["cache_type"]
)

# Active connections
ACTIVE_REQUESTS = Gauge(
    "ml_active_requests",
    "Number of active requests"
)

# Business metrics
CANARY_TRAFFIC = Gauge(
    "ml_canary_traffic_share",
    "Share of traffic going to canary model"
)


# =============================================================================
# STRUCTURED LOGGING
# =============================================================================

class StructuredFormatter(logging.Formatter):
    """JSON structured log formatter"""
    
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add extra fields
        if hasattr(record, "extra"):
            log_entry.update(record.extra)
        
        # Add exception info
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_entry)


def setup_logging(level: str = "INFO"):
    """Configure structured logging"""
    handler = logging.StreamHandler()
    handler.setFormatter(StructuredFormatter())
    
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.addHandler(handler)
    
    # Reduce noise from libraries
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


# =============================================================================
# MIDDLEWARE
# =============================================================================

def setup_observability(app: FastAPI, app_name: str = "ml-inference"):
    """Setup all observability components"""
    
    # Setup logging
    log_level = os.getenv("LOG_LEVEL", "INFO")
    setup_logging(log_level)
    
    logger = logging.getLogger(app_name)
    
    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next: Callable):
        """Collect metrics for all requests"""
        endpoint = request.url.path
        method = request.method
        
        # Skip metrics endpoint
        if endpoint == "/metrics":
            return await call_next(request)
        
        ACTIVE_REQUESTS.inc()
        
        try:
            start_time = time.time()
            
            with REQUEST_LATENCY.labels(endpoint=endpoint, method=method).time():
                response = await call_next(request)
            
            # Record metrics
            REQUEST_COUNT.labels(
                endpoint=endpoint,
                method=method,
                status=response.status_code
            ).inc()
            
            # Log request
            logger.info(
                f"{method} {endpoint}",
                extra={
                    "method": method,
                    "endpoint": endpoint,
                    "status": response.status_code,
                    "latency_ms": int((time.time() - start_time) * 1000)
                }
            )
            
            return response
        
        finally:
            ACTIVE_REQUESTS.dec()
    
    @app.get("/metrics")
    async def metrics_endpoint():
        """Prometheus metrics endpoint"""
        return Response(
            content=generate_latest(),
            media_type=CONTENT_TYPE_LATEST
        )
    
    logger.info(f"Observability setup complete for {app_name}")


# =============================================================================
# TRACING (OpenTelemetry - Optional)
# =============================================================================

def setup_tracing(app: FastAPI, service_name: str = "ml-inference"):
    """Setup OpenTelemetry tracing (optional)"""
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        
        # Setup tracer
        provider = TracerProvider()
        otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "tempo:4317")
        processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_endpoint))
        provider.add_span_processor(processor)
        trace.set_tracer_provider(provider)
        
        # Instrument FastAPI
        FastAPIInstrumentor.instrument_app(app)
        
        return True
    except ImportError:
        logging.warning("OpenTelemetry not installed, skipping tracing setup")
        return False


# =============================================================================
# BUSINESS METRICS
# =============================================================================

def record_prediction(
    model_version: str,
    score: float,
    model_type: str = "lightgbm",
    is_canary: bool = False
):
    """Record prediction metrics"""
    PREDICTION_COUNT.labels(
        model_version=model_version,
        model_type=model_type
    ).inc()
    
    SCORE_HISTOGRAM.labels(model_version=model_version).observe(score)


def record_cache_hit(cache_type: str = "model"):
    """Record cache hit"""
    CACHE_HITS.labels(cache_type=cache_type).inc()


def record_cache_miss(cache_type: str = "model"):
    """Record cache miss"""
    CACHE_MISSES.labels(cache_type=cache_type).inc()


def update_model_info(version: str, model_type: str, metrics: dict):
    """Update model info gauge"""
    MODEL_INFO.info({
        "version": version,
        "model_type": model_type,
        "auc": str(metrics.get("auc", 0)),
        "trained_at": metrics.get("trained_at", "unknown")
    })


def set_canary_share(share: float):
    """Set canary traffic share gauge"""
    CANARY_TRAFFIC.set(share)


# =============================================================================
# GRAFANA DASHBOARD QUERIES
# =============================================================================

# These PromQL queries can be used in Grafana dashboards:

DASHBOARD_QUERIES = """
# Request Rate
sum(rate(ml_inference_requests_total[5m])) by (endpoint)

# P95 Latency
histogram_quantile(0.95, 
  sum(rate(ml_inference_request_latency_seconds_bucket[5m])) by (le, endpoint)
)

# Error Rate
sum(rate(ml_inference_requests_total{status!~"2.."}[5m])) 
/ sum(rate(ml_inference_requests_total[5m]))

# Predictions per Model Version
sum(rate(ml_predictions_total[5m])) by (model_version)

# Score Distribution
sum(rate(ml_score_distribution_bucket[5m])) by (le, model_version)

# Cache Hit Rate
sum(rate(ml_cache_hits_total[5m])) 
/ (sum(rate(ml_cache_hits_total[5m])) + sum(rate(ml_cache_misses_total[5m])))

# Active Requests
ml_active_requests

# Canary Traffic Share
ml_canary_traffic_share
"""


# =============================================================================
# EXPORT
# =============================================================================

__all__ = [
    "setup_observability",
    "setup_tracing",
    "setup_logging",
    "record_prediction",
    "record_cache_hit",
    "record_cache_miss",
    "update_model_info",
    "set_canary_share",
    "REQUEST_LATENCY",
    "REQUEST_COUNT",
    "PREDICTION_COUNT",
    "DASHBOARD_QUERIES",
]
