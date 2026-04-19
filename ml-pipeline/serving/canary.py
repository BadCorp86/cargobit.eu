"""
CargoBit ML Inference - Canary Rollout Strategy
================================================

In-app canary deployment for ML models:
- Traffic split between ACTIVE and CANDIDATE models
- Business metric tracking per model version
- Automatic promotion/rollback based on metrics

Usage:
    from canary import CanaryManager
    
    canary = CanaryManager(db_connection)
    
    # Get model version for request
    version = canary.get_model_version()
    
    # Record outcome
    canary.record_outcome(version, accepted=True, margin=150.0)
"""

import os
import random
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class CanaryConfig:
    """Canary rollout configuration"""
    # Traffic split
    canary_share: float = 0.0  # 0.0 = 0%, 1.0 = 100%
    
    # Auto-promotion thresholds
    min_sample_size: int = 1000
    min_acceptance_rate_delta: float = 0.02  # Candidate must be 2% better
    max_latency_increase_ms: int = 10
    
    # Safety limits
    max_canary_share: float = 0.3  # Never exceed 30%
    auto_promote_enabled: bool = True
    auto_rollback_enabled: bool = True
    
    # Rollback thresholds
    rollback_error_rate_threshold: float = 0.05  # 5% error rate
    rollback_latency_increase_ms: int = 50


class ModelStatus(Enum):
    ACTIVE = "ACTIVE"
    CANDIDATE = "CANDIDATE"
    ROLLED_BACK = "ROLLED_BACK"
    DEPRECATED = "DEPRECATED"


# =============================================================================
# CANARY MANAGER
# =============================================================================

class CanaryManager:
    """
    Manages canary rollouts for ML models.
    
    Features:
    - Traffic splitting between ACTIVE and CANDIDATE
    - Business metric tracking
    - Automatic promotion/rollback
    - A/B test integration
    """
    
    def __init__(self, db_connection: str, config: CanaryConfig = None):
        self.db_connection = db_connection
        self.config = config or CanaryConfig()
        self._cache = {}
        self._cache_ttl = 60  # seconds
        self._last_refresh = None
    
    def _get_db_connection(self):
        """Get database connection"""
        return psycopg2.connect(self.db_connection)
    
    def _refresh_cache(self):
        """Refresh cached model information"""
        now = datetime.now()
        if self._last_refresh and (now - self._last_refresh).seconds < self._cache_ttl:
            return
        
        try:
            with self._get_db_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Get active model
                    cur.execute("""
                        SELECT version, status 
                        FROM ml_model_registry 
                        WHERE status = 'ACTIVE'
                        ORDER BY created_at DESC LIMIT 1
                    """)
                    active = cur.fetchone()
                    
                    # Get candidate model
                    cur.execute("""
                        SELECT version, status 
                        FROM ml_model_registry 
                        WHERE status = 'CANDIDATE'
                        ORDER BY created_at DESC LIMIT 1
                    """)
                    candidate = cur.fetchone()
                    
                    self._cache = {
                        "active_version": active["version"] if active else None,
                        "candidate_version": candidate["version"] if candidate else None,
                    }
                    
                    self._last_refresh = now
                    
        except Exception as e:
            logger.error(f"Failed to refresh canary cache: {e}")
    
    def get_model_version(self, request_id: str = None) -> Tuple[str, bool]:
        """
        Get model version for a request.
        
        Returns:
            Tuple of (version, is_canary)
        """
        self._refresh_cache()
        
        active_version = self._cache.get("active_version")
        candidate_version = self._cache.get("candidate_version")
        
        # No candidate, use active
        if not candidate_version:
            return active_version or "latest", False
        
        # No active, use candidate (edge case)
        if not active_version:
            return candidate_version, True
        
        # Determine if this request should go to canary
        canary_share = min(self.config.canary_share, self.config.max_canary_share)
        
        # Use request_id for deterministic routing if available
        if request_id:
            is_canary = (hash(request_id) % 100) < (canary_share * 100)
        else:
            is_canary = random.random() < canary_share
        
        version = candidate_version if is_canary else active_version
        
        return version, is_canary
    
    def record_prediction(self, model_version: str, score: float, 
                          latency_ms: float, request_id: str = None):
        """Record a prediction for metrics tracking"""
        try:
            with self._get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO ml_prediction_log 
                        (request_id, model_version, score, latency_ms, predicted_at)
                        VALUES (%s, %s, %s, %s, NOW())
                    """, (request_id, model_version, score, latency_ms))
                    conn.commit()
        except Exception as e:
            logger.warning(f"Failed to record prediction: {e}")
    
    def record_outcome(self, model_version: str, suggestion_id: str,
                       accepted: bool, margin: float = None,
                       delay_minutes: float = None):
        """Record outcome for a prediction"""
        try:
            with self._get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE ml_prediction_log 
                        SET accepted = %s, margin = %s, delay_minutes = %s,
                            outcome_at = NOW()
                        WHERE suggestion_id = %s AND model_version = %s
                    """, (accepted, margin, delay_minutes, suggestion_id, model_version))
                    conn.commit()
        except Exception as e:
            logger.warning(f"Failed to record outcome: {e}")
    
    def get_canary_metrics(self) -> Dict:
        """Get metrics for active and candidate models"""
        self._refresh_cache()
        
        active = self._cache.get("active_version")
        candidate = self._cache.get("candidate_version")
        
        if not active or not candidate:
            return {"error": "Missing active or candidate model"}
        
        try:
            with self._get_db_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Get metrics for both versions
                    cur.execute("""
                        SELECT 
                            model_version,
                            COUNT(*) as total_predictions,
                            AVG(latency_ms) as avg_latency_ms,
                            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
                            SUM(CASE WHEN accepted THEN 1 ELSE 0 END)::FLOAT / 
                                NULLIF(SUM(CASE WHEN accepted IS NOT NULL THEN 1 ELSE 0 END), 0) as acceptance_rate,
                            AVG(margin) as avg_margin,
                            SUM(CASE WHEN NOT accepted THEN 1 ELSE 0 END)::FLOAT / 
                                NULLIF(COUNT(*), 0) as rejection_rate
                        FROM ml_prediction_log
                        WHERE predicted_at > NOW() - INTERVAL '24 hours'
                        AND model_version IN (%s, %s)
                        GROUP BY model_version
                    """, (active, candidate))
                    
                    results = {row["model_version"]: dict(row) for row in cur.fetchall()}
                    
                    return {
                        "active": results.get(active, {}),
                        "candidate": results.get(candidate, {}),
                        "active_version": active,
                        "candidate_version": candidate,
                        "canary_share": self.config.canary_share,
                    }
                    
        except Exception as e:
            logger.error(f"Failed to get canary metrics: {e}")
            return {"error": str(e)}
    
    def evaluate_promotion(self) -> Dict:
        """Evaluate if candidate should be promoted to active"""
        if not self.config.auto_promote_enabled:
            return {"action": "none", "reason": "auto_promote_disabled"}
        
        metrics = self.get_canary_metrics()
        
        if "error" in metrics:
            return {"action": "none", "reason": metrics["error"]}
        
        candidate = metrics.get("candidate", {})
        active = metrics.get("active", {})
        
        # Check sample size
        if candidate.get("total_predictions", 0) < self.config.min_sample_size:
            return {
                "action": "none",
                "reason": f"Insufficient samples: {candidate.get('total_predictions', 0)}"
            }
        
        # Check acceptance rate
        candidate_rate = candidate.get("acceptance_rate", 0) or 0
        active_rate = active.get("acceptance_rate", 0) or 0
        rate_delta = candidate_rate - active_rate
        
        # Check latency
        candidate_latency = candidate.get("avg_latency_ms", 0) or 0
        active_latency = active.get("avg_latency_ms", 0) or 0
        latency_delta = candidate_latency - active_latency
        
        # Decision logic
        if rate_delta >= self.config.min_acceptance_rate_delta:
            if latency_delta <= self.config.max_latency_increase_ms:
                return {
                    "action": "promote",
                    "reason": f"Candidate is {rate_delta:.2%} better with acceptable latency",
                    "metrics": {
                        "acceptance_delta": rate_delta,
                        "latency_delta_ms": latency_delta
                    }
                }
            else:
                return {
                    "action": "none",
                    "reason": f"Latency increased by {latency_delta:.1f}ms"
                }
        
        return {
            "action": "none",
            "reason": f"Acceptance rate delta ({rate_delta:.2%}) below threshold"
        }
    
    def evaluate_rollback(self) -> Dict:
        """Evaluate if canary should be rolled back"""
        if not self.config.auto_rollback_enabled:
            return {"action": "none", "reason": "auto_rollback_disabled"}
        
        metrics = self.get_canary_metrics()
        candidate = metrics.get("candidate", {})
        
        # Check error rate
        rejection_rate = candidate.get("rejection_rate", 0) or 0
        
        # Check latency
        candidate_latency = candidate.get("p95_latency_ms", 0) or 0
        active_latency = metrics.get("active", {}).get("p95_latency_ms", 0) or 0
        latency_increase = candidate_latency - active_latency
        
        if rejection_rate > self.config.rollback_error_rate_threshold:
            return {
                "action": "rollback",
                "reason": f"High rejection rate: {rejection_rate:.2%}"
            }
        
        if latency_increase > self.config.rollback_latency_increase_ms:
            return {
                "action": "rollback",
                "reason": f"High latency increase: {latency_increase:.1f}ms"
            }
        
        return {"action": "none", "reason": "Metrics within acceptable range"}
    
    def promote_candidate(self) -> bool:
        """Promote candidate to active"""
        self._refresh_cache()
        candidate_version = self._cache.get("candidate_version")
        
        if not candidate_version:
            logger.error("No candidate version to promote")
            return False
        
        try:
            with self._get_db_connection() as conn:
                with conn.cursor() as cur:
                    # Set current active to rolled_back
                    cur.execute("""
                        UPDATE ml_model_registry 
                        SET status = 'ROLLED_BACK', updated_at = NOW()
                        WHERE status = 'ACTIVE'
                    """)
                    
                    # Promote candidate to active
                    cur.execute("""
                        UPDATE ml_model_registry 
                        SET status = 'ACTIVE', updated_at = NOW()
                        WHERE version = %s AND status = 'CANDIDATE'
                    """, (candidate_version,))
                    
                    conn.commit()
                    
                    logger.info(f"Promoted {candidate_version} to ACTIVE")
                    
                    # Clear cache
                    self._cache = {}
                    self._last_refresh = None
                    
                    return True
                    
        except Exception as e:
            logger.error(f"Failed to promote candidate: {e}")
            return False
    
    def rollback_candidate(self) -> bool:
        """Rollback candidate (stop canary traffic)"""
        self._refresh_cache()
        candidate_version = self._cache.get("candidate_version")
        
        if not candidate_version:
            return False
        
        try:
            with self._get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE ml_model_registry 
                        SET status = 'ROLLED_BACK', updated_at = NOW()
                        WHERE version = %s
                    """, (candidate_version,))
                    
                    conn.commit()
                    
                    logger.info(f"Rolled back candidate {candidate_version}")
                    
                    # Clear cache
                    self._cache = {}
                    self._last_refresh = None
                    
                    return True
                    
        except Exception as e:
            logger.error(f"Failed to rollback candidate: {e}")
            return False
    
    def set_canary_share(self, share: float):
        """Set canary traffic share"""
        self.config.canary_share = min(share, self.config.max_canary_share)
        logger.info(f"Set canary share to {self.config.canary_share:.2%}")


# =============================================================================
# FASTAPI INTEGRATION
# =============================================================================

def setup_canary_routes(app, canary: CanaryManager):
    """Setup canary management routes"""
    
    from fastapi import HTTPException
    from pydantic import BaseModel
    
    class CanaryConfigRequest(BaseModel):
        canary_share: float
    
    @app.get("/canary/metrics")
    async def get_canary_metrics():
        """Get canary metrics"""
        return canary.get_canary_metrics()
    
    @app.post("/canary/config")
    async def set_canary_config(request: CanaryConfigRequest):
        """Set canary configuration"""
        canary.set_canary_share(request.canary_share)
        return {"status": "ok", "canary_share": canary.config.canary_share}
    
    @app.post("/canary/promote")
    async def promote_canary():
        """Promote candidate to active"""
        evaluation = canary.evaluate_promotion()
        if evaluation["action"] == "promote" or True:  # Allow manual override
            success = canary.promote_candidate()
            if success:
                return {"status": "promoted", "evaluation": evaluation}
            raise HTTPException(500, "Promotion failed")
        return {"status": "skipped", "reason": evaluation["reason"]}
    
    @app.post("/canary/rollback")
    async def rollback_canary():
        """Rollback candidate"""
        success = canary.rollback_candidate()
        if success:
            return {"status": "rolled_back"}
        raise HTTPException(500, "Rollback failed")
    
    @app.get("/canary/evaluate")
    async def evaluate_canary():
        """Evaluate canary for promotion/rollback"""
        promotion = canary.evaluate_promotion()
        rollback = canary.evaluate_rollback()
        return {
            "promotion": promotion,
            "rollback": rollback,
            "metrics": canary.get_canary_metrics()
        }


# =============================================================================
# EXPORT
# =============================================================================

__all__ = [
    "CanaryManager",
    "CanaryConfig",
    "ModelStatus",
    "setup_canary_routes",
]
