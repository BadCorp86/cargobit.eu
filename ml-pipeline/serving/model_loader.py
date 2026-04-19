"""
CargoBit Model Loader - S3/DBFS + Registry Integration
======================================================

Production-ready model loader with:
- S3/DBFS model download with caching
- PostgreSQL model registry lookup
- LightGBM/XGBoost model loading
- SHAP explainer loading
- Thread-safe model cache
- Graceful fallback and error handling
"""

import os
import io
import json
import pickle
import logging
import hashlib
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional, Tuple, Any, Union
from dataclasses import dataclass
from functools import lru_cache

import boto3
from botocore.exceptions import ClientError
import lightgbm as lgb
import xgboost as xgb
import shap

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class ModelLoaderConfig:
    """Model Loader Configuration"""
    # Storage settings
    store_type: str = "s3"  # "s3", "dbfs", "local"
    s3_bucket: str = "cargobit-ml-models"
    s3_prefix: str = "suggestion-scoring"
    dbfs_base_path: str = "/dbfs/ml/suggestion-scoring"
    local_base_path: str = "/tmp/ml-models"
    
    # Cache settings
    cache_enabled: bool = True
    cache_ttl_seconds: int = 3600  # 1 hour
    cache_max_versions: int = 3
    
    # Registry settings
    registry_enabled: bool = True
    registry_db_connection: str = None  # PostgreSQL connection string
    
    # Model settings
    model_type: str = "lightgbm"  # "lightgbm" or "xgboost"
    default_version: str = "latest"
    
    # Retry settings
    max_retries: int = 3
    retry_delay_seconds: int = 1
    
    # Metrics
    metrics_enabled: bool = True


# =============================================================================
# MODEL CACHE (Thread-Safe)
# =============================================================================

class ModelCache:
    """Thread-safe in-memory cache for models and explainers"""
    
    def __init__(self, max_versions: int = 3, ttl_seconds: int = 3600):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()
        self._max_versions = max_versions
        self._ttl_seconds = ttl_seconds
    
    def get(self, version: str) -> Optional[Dict[str, Any]]:
        """Get cached model and explainer"""
        with self._lock:
            entry = self._cache.get(version)
            if entry is None:
                return None
            
            # Check TTL
            if datetime.now() - entry['loaded_at'] > timedelta(seconds=self._ttl_seconds):
                logger.info(f"Cache expired for version {version}")
                del self._cache[version]
                return None
            
            return entry
    
    def set(self, version: str, model: Any, explainer: Any, metadata: Dict = None):
        """Cache model and explainer"""
        with self._lock:
            # Evict oldest if at capacity
            if len(self._cache) >= self._max_versions:
                oldest_version = min(self._cache.keys(), 
                                     key=lambda v: self._cache[v]['loaded_at'])
                logger.info(f"Evicting oldest cached version: {oldest_version}")
                del self._cache[oldest_version]
            
            self._cache[version] = {
                'model': model,
                'explainer': explainer,
                'metadata': metadata or {},
                'loaded_at': datetime.now(),
                'access_count': 0
            }
            
            logger.info(f"Cached model version {version}")
    
    def invalidate(self, version: str = None):
        """Invalidate cache entry or entire cache"""
        with self._lock:
            if version:
                self._cache.pop(version, None)
                logger.info(f"Invalidated cache for version {version}")
            else:
                self._cache.clear()
                logger.info("Invalidated entire model cache")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            return {
                'cached_versions': list(self._cache.keys()),
                'cache_size': len(self._cache),
                'max_versions': self._max_versions,
                'ttl_seconds': self._ttl_seconds
            }


# =============================================================================
# S3 MODEL STORE
# =============================================================================

class S3ModelStore:
    """S3 model storage backend"""
    
    def __init__(self, bucket: str, prefix: str):
        self.bucket = bucket
        self.prefix = prefix
        self._s3_client = None
    
    @property
    def s3_client(self):
        if self._s3_client is None:
            self._s3_client = boto3.client('s3')
        return self._s3_client
    
    def list_versions(self) -> list:
        """List all available model versions"""
        versions = []
        
        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=self.bucket, Prefix=self.prefix + '/')
            
            for page in pages:
                for obj in page.get('Contents', []):
                    key = obj['Key']
                    # Extract version from path: prefix/VERSION/model.txt
                    parts = key.split('/')
                    if len(parts) >= 3:
                        version = parts[len(parts) - 2]
                        if version not in versions and version != self.prefix:
                            versions.append(version)
            
            # Sort by version (newest first)
            versions.sort(reverse=True)
            
        except ClientError as e:
            logger.error(f"Error listing S3 versions: {e}")
            raise
        
        return versions
    
    def get_latest_version(self) -> str:
        """Get the latest model version"""
        versions = self.list_versions()
        if not versions:
            raise ValueError("No model versions found in S3")
        return versions[0]
    
    def download_model(self, version: str, local_path: str = None) -> str:
        """Download model file from S3"""
        key = f"{self.prefix}/{version}/model.txt"
        
        if local_path is None:
            local_path = f"/tmp/model_{version}.txt"
        
        try:
            self.s3_client.download_file(self.bucket, key, local_path)
            logger.info(f"Downloaded model to {local_path}")
            return local_path
        except ClientError as e:
            logger.error(f"Error downloading model from S3: {e}")
            raise
    
    def download_explainer(self, version: str, local_path: str = None) -> str:
        """Download explainer file from S3"""
        key = f"{self.prefix}/{version}/explainer.pkl"
        
        if local_path is None:
            local_path = f"/tmp/explainer_{version}.pkl"
        
        try:
            self.s3_client.download_file(self.bucket, key, local_path)
            logger.info(f"Downloaded explainer to {local_path}")
            return local_path
        except ClientError as e:
            logger.error(f"Error downloading explainer from S3: {e}")
            raise
    
    def download_metadata(self, version: str) -> Dict:
        """Download model metadata from S3"""
        key = f"{self.prefix}/{version}/metadata.json"
        
        try:
            response = self.s3_client.get_object(Bucket=self.bucket, Key=key)
            metadata = json.loads(response['Body'].read().decode('utf-8'))
            logger.info(f"Downloaded metadata for version {version}")
            return metadata
        except ClientError as e:
            logger.warning(f"Metadata not found for version {version}: {e}")
            return {}


# =============================================================================
# DBFS MODEL STORE
# =============================================================================

class DBFSModelStore:
    """DBFS (Databricks File System) model storage backend"""
    
    def __init__(self, base_path: str):
        self.base_path = base_path
    
    def list_versions(self) -> list:
        """List all available model versions"""
        if not os.path.exists(self.base_path):
            raise ValueError(f"DBFS path does not exist: {self.base_path}")
        
        versions = [
            d for d in os.listdir(self.base_path)
            if os.path.isdir(os.path.join(self.base_path, d))
        ]
        
        # Sort by version (newest first)
        versions.sort(reverse=True)
        return versions
    
    def get_latest_version(self) -> str:
        """Get the latest model version"""
        versions = self.list_versions()
        if not versions:
            raise ValueError("No model versions found in DBFS")
        return versions[0]
    
    def get_model_path(self, version: str) -> str:
        """Get path to model file"""
        return os.path.join(self.base_path, version, "model.txt")
    
    def get_explainer_path(self, version: str) -> str:
        """Get path to explainer file"""
        return os.path.join(self.base_path, version, "explainer.pkl")
    
    def get_metadata(self, version: str) -> Dict:
        """Get model metadata"""
        metadata_path = os.path.join(self.base_path, version, "metadata.json")
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                return json.load(f)
        return {}


# =============================================================================
# LOCAL MODEL STORE
# =============================================================================

class LocalModelStore:
    """Local filesystem model storage backend"""
    
    def __init__(self, base_path: str):
        self.base_path = base_path
        os.makedirs(base_path, exist_ok=True)
    
    def list_versions(self) -> list:
        """List all available model versions"""
        versions = [
            d for d in os.listdir(self.base_path)
            if os.path.isdir(os.path.join(self.base_path, d))
        ]
        versions.sort(reverse=True)
        return versions
    
    def get_latest_version(self) -> str:
        """Get the latest model version"""
        versions = self.list_versions()
        if not versions:
            raise ValueError("No model versions found locally")
        return versions[0]
    
    def get_model_path(self, version: str) -> str:
        """Get path to model file"""
        return os.path.join(self.base_path, version, "model.txt")
    
    def get_explainer_path(self, version: str) -> str:
        """Get path to explainer file"""
        return os.path.join(self.base_path, version, "explainer.pkl")


# =============================================================================
# MODEL REGISTRY (PostgreSQL)
# =============================================================================

class ModelRegistry:
    """PostgreSQL-based model registry"""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
    
    def get_active_version(self) -> Optional[str]:
        """Get the currently active model version"""
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            
            with psycopg2.connect(self.connection_string) as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("""
                        SELECT version, model_path, explainer_path, metrics, status
                        FROM ml_model_registry
                        WHERE status = 'ACTIVE'
                        ORDER BY created_at DESC
                        LIMIT 1
                    """)
                    row = cur.fetchone()
                    if row:
                        return row['version']
        except Exception as e:
            logger.warning(f"Could not connect to registry: {e}")
        return None
    
    def get_model_info(self, version: str) -> Optional[Dict]:
        """Get model info for a specific version"""
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            
            with psycopg2.connect(self.connection_string) as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("""
                        SELECT id, version, model_path, explainer_path, metrics, 
                               mlflow_run_id, status, created_at, updated_at
                        FROM ml_model_registry
                        WHERE version = %s
                    """, (version,))
                    row = cur.fetchone()
                    if row:
                        return dict(row)
        except Exception as e:
            logger.warning(f"Could not get model info: {e}")
        return None
    
    def list_models(self, status: str = None) -> list:
        """List all models, optionally filtered by status"""
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            
            with psycopg2.connect(self.connection_string) as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    if status:
                        cur.execute("""
                            SELECT id, version, status, metrics, created_at
                            FROM ml_model_registry
                            WHERE status = %s
                            ORDER BY created_at DESC
                        """, (status,))
                    else:
                        cur.execute("""
                            SELECT id, version, status, metrics, created_at
                            FROM ml_model_registry
                            ORDER BY created_at DESC
                        """)
                    return [dict(row) for row in cur.fetchall()]
        except Exception as e:
            logger.warning(f"Could not list models: {e}")
            return []
    
    def record_prediction(self, version: str, count: int = 1):
        """Record prediction count for metrics"""
        try:
            import psycopg2
            
            with psycopg2.connect(self.connection_string) as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO ml_prediction_metrics (model_version, prediction_count, recorded_at)
                        VALUES (%s, %s, NOW())
                        ON CONFLICT (model_version, recorded_at) 
                        DO UPDATE SET prediction_count = ml_prediction_metrics.prediction_count + %s
                    """, (version, count, count))
                    conn.commit()
        except Exception as e:
            logger.warning(f"Could not record prediction: {e}")


# =============================================================================
# MAIN MODEL LOADER
# =============================================================================

class ModelLoader:
    """
    Production Model Loader with caching and registry integration.
    
    Usage:
        loader = ModelLoader(config)
        
        # Load latest active model
        model, explainer = loader.load_model()
        
        # Load specific version
        model, explainer = loader.load_model(version="20240115_120000")
        
        # Get model info
        info = loader.get_model_info()
    """
    
    def __init__(self, config: ModelLoaderConfig = None):
        self.config = config or ModelLoaderConfig()
        self._cache = ModelCache(
            max_versions=self.config.cache_max_versions,
            ttl_seconds=self.config.cache_ttl_seconds
        )
        self._store = self._init_store()
        self._registry = None
        
        if self.config.registry_enabled and self.config.registry_db_connection:
            self._registry = ModelRegistry(self.config.registry_db_connection)
    
    def _init_store(self) -> Union[S3ModelStore, DBFSModelStore, LocalModelStore]:
        """Initialize the appropriate model store"""
        if self.config.store_type == "s3":
            return S3ModelStore(self.config.s3_bucket, self.config.s3_prefix)
        elif self.config.store_type == "dbfs":
            return DBFSModelStore(self.config.dbfs_base_path)
        else:
            return LocalModelStore(self.config.local_base_path)
    
    def _resolve_version(self, version: str = None) -> str:
        """Resolve version string to actual version"""
        if version is None or version == "latest":
            # First check registry if enabled
            if self._registry:
                active_version = self._registry.get_active_version()
                if active_version:
                    return active_version
            
            # Fall back to store
            return self._store.get_latest_version()
        
        return version
    
    def load_model(self, version: str = None) -> Tuple[Any, Any]:
        """
        Load model and explainer.
        
        Args:
            version: Model version to load. If None or "latest", loads active model.
        
        Returns:
            Tuple of (model, explainer)
        """
        resolved_version = self._resolve_version(version)
        
        # Check cache first
        if self.config.cache_enabled:
            cached = self._cache.get(resolved_version)
            if cached:
                logger.info(f"Loaded model {resolved_version} from cache")
                return cached['model'], cached['explainer']
        
        # Load from store
        logger.info(f"Loading model {resolved_version} from {self.config.store_type}")
        
        if self.config.store_type == "s3":
            model_path = self._store.download_model(resolved_version)
            explainer_path = self._store.download_explainer(resolved_version)
        else:
            model_path = self._store.get_model_path(resolved_version)
            explainer_path = self._store.get_explainer_path(resolved_version)
        
        # Load model
        if self.config.model_type == "lightgbm":
            model = lgb.Booster(model_file=model_path)
        else:
            model = xgb.Booster()
            model.load_model(model_path)
        
        # Load explainer
        with open(explainer_path, 'rb') as f:
            explainer = pickle.load(f)
        
        # Get metadata
        if self.config.store_type == "s3":
            metadata = self._store.download_metadata(resolved_version)
        else:
            metadata = self._store.get_metadata(resolved_version)
        
        # Cache the loaded model
        if self.config.cache_enabled:
            self._cache.set(resolved_version, model, explainer, metadata)
        
        logger.info(f"Successfully loaded model {resolved_version}")
        
        return model, explainer
    
    def load_model_only(self, version: str = None) -> Any:
        """Load only the model (without explainer) for faster inference"""
        resolved_version = self._resolve_version(version)
        
        # Check cache first
        if self.config.cache_enabled:
            cached = self._cache.get(resolved_version)
            if cached:
                return cached['model']
        
        # Load just the model
        if self.config.store_type == "s3":
            model_path = self._store.download_model(resolved_version)
        else:
            model_path = self._store.get_model_path(resolved_version)
        
        if self.config.model_type == "lightgbm":
            model = lgb.Booster(model_file=model_path)
        else:
            model = xgb.Booster()
            model.load_model(model_path)
        
        return model
    
    def get_model_info(self, version: str = None) -> Dict[str, Any]:
        """Get detailed model information"""
        resolved_version = self._resolve_version(version)
        
        info = {
            'version': resolved_version,
            'model_type': self.config.model_type,
            'store_type': self.config.store_type
        }
        
        # Get from registry
        if self._registry:
            registry_info = self._registry.get_model_info(resolved_version)
            if registry_info:
                info['registry'] = registry_info
        
        # Get from store metadata
        if self.config.store_type == "s3":
            info['metadata'] = self._store.download_metadata(resolved_version)
        else:
            info['metadata'] = self._store.get_metadata(resolved_version)
        
        # Get cache info
        if self.config.cache_enabled:
            cached = self._cache.get(resolved_version)
            info['cached'] = cached is not None
        
        return info
    
    def list_available_versions(self) -> list:
        """List all available model versions"""
        versions = self._store.list_versions()
        
        # Enrich with registry info
        if self._registry:
            models = self._registry.list_models()
            registry_versions = {m['version']: m for m in models}
            
            enriched = []
            for v in versions:
                info = {'version': v}
                if v in registry_versions:
                    info['status'] = registry_versions[v]['status']
                    info['metrics'] = registry_versions[v]['metrics']
                enriched.append(info)
            
            return enriched
        
        return [{'version': v} for v in versions]
    
    def invalidate_cache(self, version: str = None):
        """Invalidate model cache"""
        self._cache.invalidate(version)
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return self._cache.get_stats()
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check on model loader"""
        health = {
            'status': 'healthy',
            'store_type': self.config.store_type,
            'cache_enabled': self.config.cache_enabled,
            'registry_enabled': self.config.registry_enabled,
            'checks': {}
        }
        
        # Check store connectivity
        try:
            versions = self._store.list_versions()
            health['checks']['store'] = {
                'status': 'healthy',
                'available_versions': len(versions)
            }
        except Exception as e:
            health['checks']['store'] = {
                'status': 'unhealthy',
                'error': str(e)
            }
            health['status'] = 'unhealthy'
        
        # Check registry connectivity
        if self._registry:
            try:
                active = self._registry.get_active_version()
                health['checks']['registry'] = {
                    'status': 'healthy',
                    'active_version': active
                }
            except Exception as e:
                health['checks']['registry'] = {
                    'status': 'unhealthy',
                    'error': str(e)
                }
                health['status'] = 'degraded'
        
        # Check cache
        health['checks']['cache'] = {
            'status': 'healthy',
            'stats': self._cache.get_stats()
        }
        
        return health


# =============================================================================
# SINGLETON INSTANCE (Optional)
# =============================================================================

_loader_instance: Optional[ModelLoader] = None
_loader_lock = threading.Lock()


def get_model_loader(config: ModelLoaderConfig = None) -> ModelLoader:
    """Get singleton ModelLoader instance"""
    global _loader_instance
    
    with _loader_lock:
        if _loader_instance is None:
            _loader_instance = ModelLoader(config)
        return _loader_instance


def load_model_and_explainer(version: str = None, 
                              config: ModelLoaderConfig = None) -> Tuple[Any, Any]:
    """Convenience function to load model and explainer"""
    loader = get_model_loader(config)
    return loader.load_model(version)


if __name__ == "__main__":
    # Example usage
    config = ModelLoaderConfig(
        store_type="local",
        local_base_path="/tmp/ml-models",
        cache_enabled=True
    )
    
    loader = ModelLoader(config)
    
    # Health check
    print("Health check:", json.dumps(loader.health_check(), indent=2, default=str))
    
    # List versions
    print("Available versions:", loader.list_available_versions())
    
    # Load model
    if loader.list_available_versions():
        model, explainer = loader.load_model()
        print("Model loaded successfully")
        print("Cache stats:", loader.get_cache_stats())
