"""
CargoBit ML Inference Service - Production Ready
================================================

FastAPI-based ML inference service with:
- /score endpoint for predictions
- /explain endpoint for SHAP explanations
- Model hot-reloading
- Prometheus metrics
- Health checks
- Request validation
- Error handling
"""

import os
import json
import time
import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from contextlib import asynccontextmanager
from dataclasses import dataclass, asdict

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Request, Response, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

from model_loader import ModelLoader, ModelLoaderConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =============================================================================
# PROMETHEUS METRICS
# =============================================================================

# Request counters
REQUEST_COUNT = Counter(
    'ml_inference_requests_total',
    'Total inference requests',
    ['endpoint', 'status']
)

# Latency histograms
REQUEST_LATENCY = Histogram(
    'ml_inference_request_latency_seconds',
    'Request latency in seconds',
    ['endpoint'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 1.0]
)

# Model metrics
MODEL_LOAD_COUNT = Counter(
    'ml_model_loads_total',
    'Total model load attempts',
    ['status']
)

MODEL_INFO = Gauge(
    'ml_model_info',
    'Current model information',
    ['version', 'model_type']
)

PREDICTION_COUNT = Counter(
    'ml_predictions_total',
    'Total predictions made',
    ['model_version']
)

# SHAP metrics
SHAP_COMPUTATION_TIME = Histogram(
    'ml_shap_computation_seconds',
    'SHAP computation time',
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class FeatureInput(BaseModel):
    """Input features for a single suggestion"""
    # Heuristic features
    heuristic_score: float = Field(..., ge=0, le=100, description="Original heuristic score")
    distance_km: float = Field(..., ge=0, description="Distance in kilometers")
    price_per_km: float = Field(..., ge=0, description="Price per kilometer")
    vehicle_match_score: float = Field(..., ge=0, le=100, description="Vehicle compatibility score")
    
    # Context features
    hour_of_day: int = Field(..., ge=0, le=23, description="Hour of day (0-23)")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0-6)")
    is_weekend: bool = Field(default=False, description="Weekend indicator")
    is_peak_hour: bool = Field(default=False, description="Peak hour indicator")
    
    # Historical features
    driver_acceptance_rate_7d: float = Field(..., ge=0, le=1, description="7-day acceptance rate")
    driver_acceptance_rate_30d: float = Field(..., ge=0, le=1, description="30-day acceptance rate")
    driver_avg_response_time_min: float = Field(..., ge=0, description="Avg response time in minutes")
    driver_completed_jobs_30d: int = Field(..., ge=0, description="Completed jobs in 30 days")
    carrier_reliability_score: float = Field(..., ge=0, le=100, description="Carrier reliability score")
    
    # Transport features
    transport_urgency_hours: float = Field(..., ge=0, description="Hours until pickup")
    cargo_weight_tons: float = Field(..., ge=0, description="Cargo weight in tons")
    requires_special_equipment: bool = Field(default=False, description="Special equipment required")
    is_international: bool = Field(default=False, description="International transport")
    
    # Market features
    market_demand_score: float = Field(..., ge=0, le=100, description="Market demand score")
    competitor_price_avg: float = Field(..., ge=0, description="Average competitor price")
    fuel_price_index: float = Field(..., ge=0, description="Fuel price index")
    
    # Meta features
    suggestion_position: int = Field(..., ge=0, description="Position in suggestion list")
    num_competing_suggestions: int = Field(..., ge=0, description="Number of competing suggestions")
    price_rank_in_suggestions: int = Field(..., ge=1, description="Price rank among suggestions")


class ScoreRequest(BaseModel):
    """Request for scoring suggestions"""
    transport_id: str = Field(..., description="Transport ID")
    suggestions: List[FeatureInput] = Field(..., min_items=1, description="List of suggestions to score")
    return_heuristic: bool = Field(default=False, description="Include heuristic score in response")
    alpha: float = Field(default=0.8, ge=0, le=1, description="Weight for heuristic score in hybrid scoring")
    
    @validator('suggestions')
    def validate_suggestions(cls, v):
        if len(v) > 100:
            raise ValueError('Maximum 100 suggestions per request')
        return v


class ScoredSuggestion(BaseModel):
    """Scored suggestion result"""
    suggestion_index: int = Field(..., description="Index in input list")
    ml_score: float = Field(..., ge=0, le=1, description="ML model score")
    heuristic_score: Optional[float] = Field(None, description="Original heuristic score")
    final_score: float = Field(..., ge=0, le=1, description="Final hybrid score")
    rank: int = Field(..., ge=1, description="Rank among all suggestions")


class ScoreResponse(BaseModel):
    """Response for scoring request"""
    transport_id: str
    model_version: str
    scored_suggestions: List[ScoredSuggestion]
    processing_time_ms: float
    timestamp: str


class ExplainRequest(BaseModel):
    """Request for SHAP explanation"""
    features: FeatureInput = Field(..., description="Features to explain")
    top_k: int = Field(default=5, ge=1, le=20, description="Number of top contributors to return")
    include_baseline: bool = Field(default=True, description="Include baseline value")


class FeatureContribution(BaseModel):
    """SHAP feature contribution"""
    feature_name: str
    feature_value: float
    contribution: float  # SHAP value
    direction: str  # "positive" or "negative"


class ExplainResponse(BaseModel):
    """Response for SHAP explanation"""
    predicted_score: float
    baseline_value: float
    top_positive_contributors: List[FeatureContribution]
    top_negative_contributors: List[FeatureContribution]
    all_contributions: Optional[List[FeatureContribution]] = None
    model_version: str
    processing_time_ms: float


class ModelInfoResponse(BaseModel):
    """Model information response"""
    version: str
    model_type: str
    feature_names: List[str]
    metrics: Dict[str, float]
    status: str
    created_at: str
    cached: bool


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loader: Dict[str, Any]
    timestamp: str


# =============================================================================
# FEATURE PROCESSING
# =============================================================================

FEATURE_COLUMNS = [
    'heuristic_score', 'distance_km', 'price_per_km', 'vehicle_match_score',
    'hour_of_day', 'day_of_week', 'is_weekend', 'is_peak_hour',
    'driver_acceptance_rate_7d', 'driver_acceptance_rate_30d',
    'driver_avg_response_time_min', 'driver_completed_jobs_30d',
    'carrier_reliability_score', 'transport_urgency_hours', 'cargo_weight_tons',
    'requires_special_equipment', 'is_international', 'market_demand_score',
    'competitor_price_avg', 'fuel_price_index', 'suggestion_position',
    'num_competing_suggestions', 'price_rank_in_suggestions'
]


def features_to_dataframe(features: Union[FeatureInput, List[FeatureInput]]) -> pd.DataFrame:
    """Convert feature input(s) to DataFrame with cyclic encoding"""
    if isinstance(features, FeatureInput):
        features = [features]
    
    records = [f.dict() for f in features]
    df = pd.DataFrame(records)
    
    # Ensure all columns exist
    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0
    
    # Add cyclic encoding for time features
    df['hour_of_day_sin'] = np.sin(2 * np.pi * df['hour_of_day'] / 24)
    df['hour_of_day_cos'] = np.cos(2 * np.pi * df['hour_of_day'] / 24)
    df['day_of_week_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
    df['day_of_week_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
    
    # Reorder columns to match training
    final_columns = [c for c in FEATURE_COLUMNS if c not in ['hour_of_day', 'day_of_week']]
    final_columns.extend(['hour_of_day_sin', 'hour_of_day_cos', 'day_of_week_sin', 'day_of_week_cos'])
    
    return df[final_columns]


# =============================================================================
# MODEL LOADER STATE
# =============================================================================

model_loader: Optional[ModelLoader] = None
current_model_version: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for model loading"""
    global model_loader, current_model_version
    
    # Startup: Initialize model loader
    logger.info("Initializing model loader...")
    
    config = ModelLoaderConfig(
        store_type=os.getenv("MODEL_STORE_TYPE", "local"),
        s3_bucket=os.getenv("S3_MODEL_BUCKET", "cargobit-ml-models"),
        s3_prefix=os.getenv("S3_MODEL_PREFIX", "suggestion-scoring"),
        local_base_path=os.getenv("LOCAL_MODEL_PATH", "/tmp/ml-models"),
        registry_enabled=os.getenv("REGISTRY_ENABLED", "false").lower() == "true",
        registry_db_connection=os.getenv("REGISTRY_DB_CONNECTION"),
        cache_enabled=True,
        cache_ttl_seconds=int(os.getenv("CACHE_TTL_SECONDS", "3600")),
        model_type=os.getenv("MODEL_TYPE", "lightgbm")
    )
    
    model_loader = ModelLoader(config)
    
    # Pre-load the active model
    try:
        model, _ = model_loader.load_model()
        info = model_loader.get_model_info()
        current_model_version = info.get('version', 'unknown')
        MODEL_INFO.labels(version=current_model_version, model_type=config.model_type).set(1)
        logger.info(f"Loaded model version: {current_model_version}")
        MODEL_LOAD_COUNT.labels(status='success').inc()
    except Exception as e:
        logger.error(f"Failed to load initial model: {e}")
        MODEL_LOAD_COUNT.labels(status='failure').inc()
    
    yield
    
    # Shutdown: Cleanup
    logger.info("Shutting down model loader...")
    model_loader = None


# =============================================================================
# FASTAPI APP
# =============================================================================

app = FastAPI(
    title="CargoBit ML Inference Service",
    description="Production ML inference API for suggestion scoring",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# MIDDLEWARE
# =============================================================================

@app.middleware("http")
async def add_metrics(request: Request, call_next):
    """Add Prometheus metrics to requests"""
    start_time = time.time()
    
    response = await call_next(request)
    
    # Record metrics
    duration = time.time() - start_time
    endpoint = request.url.path
    status = response.status_code
    
    REQUEST_COUNT.labels(endpoint=endpoint, status=status).observe(duration)
    REQUEST_LATENCY.labels(endpoint=endpoint).observe(duration)
    
    return response


# =============================================================================
# ENDPOINTS
# =============================================================================

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint"""
    if model_loader is None:
        raise HTTPException(status_code=503, detail="Model loader not initialized")
    
    health = model_loader.health_check()
    
    return HealthResponse(
        status=health['status'],
        model_loader=health,
        timestamp=datetime.utcnow().isoformat()
    )


@app.get("/ready", tags=["Health"])
async def readiness_check():
    """Readiness check for Kubernetes"""
    if model_loader is None:
        raise HTTPException(status_code=503, detail="Model loader not initialized")
    
    # Check if model is loaded
    try:
        model_loader.load_model()
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Model not available: {e}")


@app.get("/metrics", tags=["Monitoring"])
async def get_metrics():
    """Prometheus metrics endpoint"""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )


@app.post("/score", response_model=ScoreResponse, tags=["Inference"])
async def score_suggestions(request: ScoreRequest):
    """
    Score multiple suggestions for a transport.
    
    Returns ML scores, heuristic scores (optional), and final hybrid scores.
    Suggestions are ranked by final score.
    """
    if model_loader is None:
        raise HTTPException(status_code=503, detail="Model loader not initialized")
    
    start_time = time.time()
    
    try:
        # Load model
        model, _ = model_loader.load_model()
        model_info = model_loader.get_model_info()
        model_version = model_info.get('version', 'unknown')
        
        # Prepare features
        df = features_to_dataframe(request.suggestions)
        
        # Get ML predictions
        predictions = model.predict(df, num_iteration=model.best_iteration)
        
        # Prepare results
        results = []
        for i, (suggestion, ml_score) in enumerate(zip(request.suggestions, predictions)):
            heuristic = suggestion.heuristic_score / 100.0 if request.return_heuristic else None
            
            # Hybrid scoring: final = alpha * heuristic + (1-alpha) * ml
            if request.return_heuristic:
                final_score = request.alpha * heuristic + (1 - request.alpha) * ml_score
            else:
                final_score = ml_score
            
            results.append({
                'suggestion_index': i,
                'ml_score': float(ml_score),
                'heuristic_score': heuristic,
                'final_score': float(final_score),
                'rank': 0  # Will be set after sorting
            })
        
        # Sort by final score and assign ranks
        results.sort(key=lambda x: x['final_score'], reverse=True)
        for rank, result in enumerate(results, 1):
            result['rank'] = rank
        
        # Record metrics
        processing_time = (time.time() - start_time) * 1000
        PREDICTION_COUNT.labels(model_version=model_version).inc(len(results))
        
        return ScoreResponse(
            transport_id=request.transport_id,
            model_version=model_version,
            scored_suggestions=[ScoredSuggestion(**r) for r in results],
            processing_time_ms=processing_time,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Scoring error: {e}")
        raise HTTPException(status_code=500, detail=f"Scoring failed: {str(e)}")


@app.post("/explain", response_model=ExplainResponse, tags=["Inference"])
async def explain_prediction(request: ExplainRequest):
    """
    Explain a prediction using SHAP values.
    
    Returns the top positive and negative feature contributors.
    """
    if model_loader is None:
        raise HTTPException(status_code=503, detail="Model loader not initialized")
    
    start_time = time.time()
    
    try:
        # Load model and explainer
        model, explainer = model_loader.load_model()
        model_info = model_loader.get_model_info()
        model_version = model_info.get('version', 'unknown')
        
        # Prepare features
        df = features_to_dataframe(request.features)
        
        # Get prediction
        prediction = model.predict(df, num_iteration=model.best_iteration)[0]
        
        # Compute SHAP values
        shap_start = time.time()
        shap_values = explainer.shap_values(df)[0]
        if isinstance(shap_values, list):
            shap_values = shap_values[1]  # Binary classification, positive class
        SHAP_COMPUTATION_TIME.observe(time.time() - shap_start)
        
        # Get feature names
        feature_names = df.columns.tolist()
        
        # Build contributions list
        contributions = []
        for name, value, shap_val in zip(feature_names, df.iloc[0].values, shap_values):
            contributions.append({
                'feature_name': name,
                'feature_value': float(value),
                'contribution': float(shap_val),
                'direction': 'positive' if shap_val > 0 else 'negative'
            })
        
        # Sort by absolute contribution
        contributions.sort(key=lambda x: abs(x['contribution']), reverse=True)
        
        # Get baseline (expected value)
        baseline = float(explainer.expected_value)
        if isinstance(baseline, np.ndarray):
            baseline = float(baseline[1]) if len(baseline) > 1 else float(baseline[0])
        
        # Split into positive and negative
        positive_contributors = [c for c in contributions if c['direction'] == 'positive'][:request.top_k]
        negative_contributors = [c for c in contributions if c['direction'] == 'negative'][:request.top_k]
        
        processing_time = (time.time() - start_time) * 1000
        
        return ExplainResponse(
            predicted_score=float(prediction),
            baseline_value=baseline,
            top_positive_contributors=[FeatureContribution(**c) for c in positive_contributors],
            top_negative_contributors=[FeatureContribution(**c) for c in negative_contributors],
            all_contributions=[FeatureContribution(**c) for c in contributions] if request.include_baseline else None,
            model_version=model_version,
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        logger.error(f"Explanation error: {e}")
        raise HTTPException(status_code=500, detail=f"Explanation failed: {str(e)}")


@app.get("/model/info", response_model=ModelInfoResponse, tags=["Model"])
async def get_model_info():
    """Get information about the currently loaded model"""
    if model_loader is None:
        raise HTTPException(status_code=503, detail="Model loader not initialized")
    
    try:
        info = model_loader.get_model_info()
        metadata = info.get('metadata', {})
        
        return ModelInfoResponse(
            version=info.get('version', 'unknown'),
            model_type=info.get('model_type', 'unknown'),
            feature_names=metadata.get('feature_names', []),
            metrics=metadata.get('metrics', {}),
            status=info.get('registry', {}).get('status', 'unknown'),
            created_at=metadata.get('created_at', 'unknown'),
            cached=info.get('cached', False)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get model info: {e}")


@app.get("/models", tags=["Model"])
async def list_models():
    """List all available model versions"""
    if model_loader is None:
        raise HTTPException(status_code=503, detail="Model loader not initialized")
    
    try:
        versions = model_loader.list_available_versions()
        return {"versions": versions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list models: {e}")


@app.post("/model/reload", tags=["Model"])
async def reload_model(version: Optional[str] = None):
    """
    Reload the model (optionally a specific version).
    
    This invalidates the cache and loads the specified model version.
    """
    if model_loader is None:
        raise HTTPException(status_code=503, detail="Model loader not initialized")
    
    global current_model_version
    
    try:
        # Invalidate cache
        model_loader.invalidate_cache()
        
        # Load model
        model, _ = model_loader.load_model(version)
        info = model_loader.get_model_info(version)
        current_model_version = info.get('version', 'unknown')
        
        MODEL_INFO.labels(version=current_model_version, model_type=info.get('model_type', 'unknown')).set(1)
        MODEL_LOAD_COUNT.labels(status='success').inc()
        
        return {
            "status": "success",
            "version": current_model_version,
            "message": f"Model reloaded successfully"
        }
    except Exception as e:
        MODEL_LOAD_COUNT.labels(status='failure').inc()
        raise HTTPException(status_code=500, detail=f"Failed to reload model: {e}")


@app.post("/model/invalidate-cache", tags=["Model"])
async def invalidate_cache():
    """Invalidate the model cache"""
    if model_loader is None:
        raise HTTPException(status_code=503, detail="Model loader not initialized")
    
    model_loader.invalidate_cache()
    return {"status": "success", "message": "Cache invalidated"}


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "inference_api:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        workers=int(os.getenv("WORKERS", "4")),
        log_level="info"
    )
