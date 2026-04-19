"""
CargoBit ML Training Pipeline with SHAP Integration
====================================================

Produktionsreife Training-Pipeline mit:
- LightGBM/XGBoost Model Training
- SHAP TreeExplainer für Offline-Explainability
- Model + Explainer Serialization (S3/DBFS)
- MLflow Model Registry Integration
- Cross-Validation + Hyperparameter Tuning
"""

import os
import io
import json
import pickle
import logging
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict

import numpy as np
import pandas as pd
import lightgbm as lgb
import xgboost as xgb
import shap
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics import (
    roc_auc_score, ndcg_score, precision_recall_fscore_support,
    average_precision_score, log_loss
)
import mlflow
import mlflow.lightgbm
import mlflow.xgboost
import boto3
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class TrainingConfig:
    """Training Pipeline Configuration"""
    # Model settings
    model_type: str = "lightgbm"  # "lightgbm" or "xgboost"
    objective: str = "binary"  # binary, ranking, regression
    metric: str = "auc"  # auc, ndcg, logloss
    
    # Hyperparameters
    num_leaves: int = 31
    max_depth: int = 6
    learning_rate: float = 0.05
    n_estimators: int = 500
    min_child_samples: int = 20
    subsample: float = 0.8
    colsample_bytree: float = 0.8
    reg_alpha: float = 0.1
    reg_lambda: float = 0.1
    
    # Training settings
    n_folds: int = 5
    early_stopping_rounds: int = 50
    random_state: int = 42
    
    # Feature settings
    feature_columns: List[str] = None
    target_column: str = "accepted"
    group_column: str = "transport_id"  # For ranking
    
    # Storage settings
    model_store_type: str = "s3"  # "s3", "dbfs", "local"
    s3_bucket: str = "cargobit-ml-models"
    s3_prefix: str = "suggestion-scoring"
    dbfs_path: str = "/dbfs/ml/suggestion-scoring"
    local_path: str = "/tmp/ml-models"
    
    # MLflow settings
    mlflow_tracking_uri: str = "http://mlflow.cargobit.internal:5000"
    mlflow_experiment_name: str = "suggestion_scoring"
    
    # SHAP settings
    shap_sample_size: int = 1000
    compute_shap_baseline: bool = True


# =============================================================================
# FEATURE DICTIONARY
# =============================================================================

FEATURE_DICTIONARY = {
    # === HEURISTIC FEATURES (Directly from scoring logic) ===
    "heuristic_score": {
        "type": "numeric",
        "description": "Original heuristic matching score (0-100)",
        "source": "suggestion.score",
        "importance_weight": 0.3
    },
    "distance_km": {
        "type": "numeric",
        "description": "Distance between pickup and delivery",
        "source": "transport.distance_km",
        "importance_weight": 0.2
    },
    "price_per_km": {
        "type": "numeric",
        "description": "Normalized price per kilometer",
        "source": "computed: offer.price / transport.distance_km",
        "importance_weight": 0.15
    },
    "vehicle_match_score": {
        "type": "numeric",
        "description": "Vehicle type compatibility score",
        "source": "suggestion.vehicle_match_score",
        "importance_weight": 0.1
    },
    
    # === CONTEXT FEATURES (Situational) ===
    "hour_of_day": {
        "type": "cyclic",
        "description": "Hour of day (0-23)",
        "source": "computed: from transport.pickup_time",
        "importance_weight": 0.05
    },
    "day_of_week": {
        "type": "cyclic",
        "description": "Day of week (0-6)",
        "source": "computed: from transport.pickup_time",
        "importance_weight": 0.05
    },
    "is_weekend": {
        "type": "binary",
        "description": "Weekend indicator",
        "source": "computed: day_of_week in [5, 6]",
        "importance_weight": 0.02
    },
    "is_peak_hour": {
        "type": "binary",
        "description": "Peak hours (7-9, 17-19)",
        "source": "computed: hour_of_day in [7,8,17,18]",
        "importance_weight": 0.03
    },
    
    # === HISTORICAL FEATURES (Driver/Carrier) ===
    "driver_acceptance_rate_7d": {
        "type": "numeric",
        "description": "Driver acceptance rate last 7 days",
        "source": "feature_store: driver_stats.acceptance_rate_7d",
        "importance_weight": 0.15
    },
    "driver_acceptance_rate_30d": {
        "type": "numeric",
        "description": "Driver acceptance rate last 30 days",
        "source": "feature_store: driver_stats.acceptance_rate_30d",
        "importance_weight": 0.1
    },
    "driver_avg_response_time_min": {
        "type": "numeric",
        "description": "Average response time in minutes",
        "source": "feature_store: driver_stats.avg_response_time_min",
        "importance_weight": 0.08
    },
    "driver_completed_jobs_30d": {
        "type": "numeric",
        "description": "Completed jobs in last 30 days",
        "source": "feature_store: driver_stats.completed_jobs_30d",
        "importance_weight": 0.05
    },
    "carrier_reliability_score": {
        "type": "numeric",
        "description": "Carrier overall reliability score",
        "source": "feature_store: carrier_stats.reliability_score",
        "importance_weight": 0.12
    },
    
    # === TRANSPORT FEATURES ===
    "transport_urgency_hours": {
        "type": "numeric",
        "description": "Hours until pickup deadline",
        "source": "computed: (transport.pickup_deadline - now).hours",
        "importance_weight": 0.1
    },
    "cargo_weight_tons": {
        "type": "numeric",
        "description": "Cargo weight in tons",
        "source": "transport.cargo_weight_tons",
        "importance_weight": 0.05
    },
    "requires_special_equipment": {
        "type": "binary",
        "description": "Special equipment requirement",
        "source": "transport.special_equipment_required",
        "importance_weight": 0.03
    },
    "is_international": {
        "type": "binary",
        "description": "International transport flag",
        "source": "transport.is_international",
        "importance_weight": 0.04
    },
    
    # === MARKET FEATURES ===
    "market_demand_score": {
        "type": "numeric",
        "description": "Current market demand in region",
        "source": "feature_store: market_stats.demand_score",
        "importance_weight": 0.08
    },
    "competitor_price_avg": {
        "type": "numeric",
        "description": "Average competitor price for similar route",
        "source": "feature_store: market_stats.competitor_price_avg",
        "importance_weight": 0.06
    },
    "fuel_price_index": {
        "type": "numeric",
        "description": "Current fuel price index",
        "source": "external_api: fuel_api.price_index",
        "importance_weight": 0.03
    },
    
    # === META FEATURES ===
    "suggestion_position": {
        "type": "numeric",
        "description": "Position in suggestion list (0-based)",
        "source": "suggestion.position",
        "importance_weight": 0.1
    },
    "num_competing_suggestions": {
        "type": "numeric",
        "description": "Number of other suggestions for same transport",
        "source": "computed: count of suggestions per transport",
        "importance_weight": 0.05
    },
    "price_rank_in_suggestions": {
        "type": "numeric",
        "description": "Price ranking among suggestions",
        "source": "computed: rank of offer.price within transport",
        "importance_weight": 0.04
    }
}


# =============================================================================
# MODEL TRAINER
# =============================================================================

class ModelTrainer:
    """Production ML Model Trainer with SHAP Integration"""
    
    def __init__(self, config: TrainingConfig):
        self.config = config
        self.model = None
        self.explainer = None
        self.feature_names = None
        self.best_iteration = None
        self.metrics = {}
        self.shap_values = None
        
        # Initialize MLflow
        mlflow.set_tracking_uri(config.mlflow_tracking_uri)
        mlflow.set_experiment(config.mlflow_experiment_name)
        
    def prepare_features(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """Prepare feature matrix and target"""
        logger.info(f"Preparing features from {len(df)} samples")
        
        # Get feature columns
        if self.config.feature_columns:
            feature_cols = self.config.feature_columns
        else:
            # Use all features from dictionary that exist in dataframe
            feature_cols = [col for col in FEATURE_DICTIONARY.keys() 
                          if col in df.columns]
        
        self.feature_names = feature_cols
        logger.info(f"Using {len(feature_cols)} features: {feature_cols}")
        
        X = df[feature_cols].copy()
        y = df[self.config.target_column].copy()
        
        # Handle missing values
        X = X.fillna(0)
        
        # Handle cyclic features
        cyclic_features = ['hour_of_day', 'day_of_week']
        for feat in cyclic_features:
            if feat in X.columns:
                X[f'{feat}_sin'] = np.sin(2 * np.pi * X[feat] / 24)
                X[f'{feat}_cos'] = np.cos(2 * np.pi * X[feat] / 24)
                X = X.drop(columns=[feat])
        
        self.feature_names = list(X.columns)
        
        return X, y
    
    def train_lightgbm(self, X: pd.DataFrame, y: pd.Series,
                       X_val: pd.DataFrame = None, y_val: pd.Series = None) -> lgb.Booster:
        """Train LightGBM model"""
        logger.info("Training LightGBM model...")
        
        params = {
            'objective': self.config.objective,
            'metric': self.config.metric,
            'num_leaves': self.config.num_leaves,
            'max_depth': self.config.max_depth,
            'learning_rate': self.config.learning_rate,
            'min_child_samples': self.config.min_child_samples,
            'subsample': self.config.subsample,
            'colsample_bytree': self.config.colsample_bytree,
            'reg_alpha': self.config.reg_alpha,
            'reg_lambda': self.config.reg_lambda,
            'random_state': self.config.random_state,
            'verbose': -1,
            'n_jobs': -1
        }
        
        train_data = lgb.Dataset(X, label=y, feature_name=self.feature_names)
        
        callbacks = [lgb.log_evaluation(period=100)]
        
        if X_val is not None and y_val is not None:
            val_data = lgb.Dataset(X_val, label=y_val, reference=train_data,
                                   feature_name=self.feature_names)
            callbacks.append(lgb.early_stopping(self.config.early_stopping_rounds))
            
            self.model = lgb.train(
                params,
                train_data,
                num_boost_round=self.config.n_estimators,
                valid_sets=[train_data, val_data],
                valid_names=['train', 'valid'],
                callbacks=callbacks
            )
            self.best_iteration = self.model.best_iteration
        else:
            self.model = lgb.train(
                params,
                train_data,
                num_boost_round=self.config.n_estimators,
                callbacks=callbacks
            )
            self.best_iteration = self.config.n_estimators
        
        return self.model
    
    def train_xgboost(self, X: pd.DataFrame, y: pd.Series,
                      X_val: pd.DataFrame = None, y_val: pd.Series = None) -> xgb.Booster:
        """Train XGBoost model"""
        logger.info("Training XGBoost model...")
        
        params = {
            'objective': 'binary:logistic' if self.config.objective == 'binary' else 'rank:pairwise',
            'eval_metric': 'auc' if self.config.metric == 'auc' else 'ndcg',
            'max_depth': self.config.max_depth,
            'learning_rate': self.config.learning_rate,
            'min_child_weight': self.config.min_child_samples,
            'subsample': self.config.subsample,
            'colsample_bytree': self.config.colsample_bytree,
            'reg_alpha': self.config.reg_alpha,
            'reg_lambda': self.config.reg_lambda,
            'random_state': self.config.random_state,
            'n_jobs': -1
        }
        
        dtrain = xgb.DMatrix(X, label=y)
        
        evals = [(dtrain, 'train')]
        if X_val is not None and y_val is not None:
            dval = xgb.DMatrix(X_val, label=y_val)
            evals.append((dval, 'valid'))
        
        self.model = xgb.train(
            params,
            dtrain,
            num_boost_round=self.config.n_estimators,
            evals=evals,
            early_stopping_rounds=self.config.early_stopping_rounds if X_val is not None else None,
            verbose_eval=100
        )
        
        self.best_iteration = self.model.best_iteration
        
        return self.model
    
    def cross_validate(self, X: pd.DataFrame, y: pd.Series) -> Dict[str, float]:
        """Perform stratified cross-validation"""
        logger.info(f"Running {self.config.n_folds}-fold cross-validation...")
        
        skf = StratifiedKFold(n_splits=self.config.n_folds, 
                              shuffle=True, 
                              random_state=self.config.random_state)
        
        cv_scores = {
            'auc': [],
            'logloss': [],
            'precision': [],
            'recall': []
        }
        
        for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
            X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
            y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
            
            if self.config.model_type == "lightgbm":
                model = self.train_lightgbm(X_train, y_train, X_val, y_val)
                y_pred = model.predict(X_val, num_iteration=model.best_iteration)
            else:
                model = self.train_xgboost(X_train, y_train, X_val, y_val)
                dval = xgb.DMatrix(X_val)
                y_pred = model.predict(dval)
            
            # Compute metrics
            cv_scores['auc'].append(roc_auc_score(y_val, y_pred))
            cv_scores['logloss'].append(log_loss(y_val, y_pred))
            
            y_pred_binary = (y_pred > 0.5).astype(int)
            precision, recall, _, _ = precision_recall_fscore_support(
                y_val, y_pred_binary, average='binary'
            )
            cv_scores['precision'].append(precision)
            cv_scores['recall'].append(recall)
            
            logger.info(f"Fold {fold+1}: AUC={cv_scores['auc'][-1]:.4f}, "
                       f"LogLoss={cv_scores['logloss'][-1]:.4f}")
        
        # Aggregate metrics
        self.metrics = {
            'cv_auc_mean': np.mean(cv_scores['auc']),
            'cv_auc_std': np.std(cv_scores['auc']),
            'cv_logloss_mean': np.mean(cv_scores['logloss']),
            'cv_logloss_std': np.std(cv_scores['logloss']),
            'cv_precision_mean': np.mean(cv_scores['precision']),
            'cv_recall_mean': np.mean(cv_scores['recall'])
        }
        
        logger.info(f"CV Results: AUC={self.metrics['cv_auc_mean']:.4f} +/- {self.metrics['cv_auc_std']:.4f}")
        
        return self.metrics
    
    def compute_shap_values(self, X: pd.DataFrame) -> np.ndarray:
        """Compute SHAP values for model explainability"""
        logger.info("Computing SHAP values...")
        
        # Sample data for SHAP computation
        if len(X) > self.config.shap_sample_size:
            X_sample = X.sample(n=self.config.shap_sample_size, 
                               random_state=self.config.random_state)
        else:
            X_sample = X
        
        # Create SHAP TreeExplainer
        if self.config.model_type == "lightgbm":
            self.explainer = shap.TreeExplainer(self.model)
        else:
            self.explainer = shap.TreeExplainer(self.model)
        
        self.shap_values = self.explainer.shap_values(X_sample)
        
        # Handle binary classification (list of arrays)
        if isinstance(self.shap_values, list):
            self.shap_values = self.shap_values[1]  # Positive class
        
        logger.info(f"SHAP values computed: shape={self.shap_values.shape}")
        
        return self.shap_values
    
    def get_feature_importance(self) -> pd.DataFrame:
        """Get feature importance from model and SHAP values"""
        if self.config.model_type == "lightgbm":
            importance = self.model.feature_importance(importance_type='gain')
            feature_names = self.model.feature_name()
        else:
            importance = self.model.get_score(importance_type='gain')
            feature_names = list(importance.keys())
            importance = list(importance.values())
        
        importance_df = pd.DataFrame({
            'feature': feature_names,
            'importance_gain': importance
        }).sort_values('importance_gain', ascending=False)
        
        # Add SHAP importance if available
        if self.shap_values is not None:
            shap_importance = np.abs(self.shap_values).mean(axis=0)
            importance_df['shap_importance'] = shap_importance
            importance_df = importance_df.sort_values('shap_importance', ascending=False)
        
        return importance_df
    
    def save_model_and_explainer(self, version: str = None) -> Dict[str, str]:
        """Save model and explainer to storage"""
        if version is None:
            version = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        logger.info(f"Saving model version {version}...")
        
        paths = {}
        
        if self.config.model_store_type == "s3":
            paths = self._save_to_s3(version)
        elif self.config.model_store_type == "dbfs":
            paths = self._save_to_dbfs(version)
        else:
            paths = self._save_to_local(version)
        
        # Save metadata
        metadata = {
            'version': version,
            'model_type': self.config.model_type,
            'feature_names': self.feature_names,
            'best_iteration': self.best_iteration,
            'metrics': self.metrics,
            'created_at': datetime.now().isoformat(),
            'config': asdict(self.config)
        }
        
        metadata_path = f"{paths['base_path']}/metadata.json"
        if self.config.model_store_type == "s3":
            s3_client = boto3.client('s3')
            s3_client.put_object(
                Bucket=self.config.s3_bucket,
                Key=f"{self.config.s3_prefix}/{version}/metadata.json",
                Body=json.dumps(metadata, indent=2)
            )
        else:
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
        
        logger.info(f"Model saved to: {paths}")
        
        return paths
    
    def _save_to_s3(self, version: str) -> Dict[str, str]:
        """Save model and explainer to S3"""
        s3_client = boto3.client('s3')
        prefix = f"{self.config.s3_prefix}/{version}"
        
        # Save model
        model_buffer = io.BytesIO()
        if self.config.model_type == "lightgbm":
            self.model.save_model(model_buffer)
        else:
            self.model.save_model(model_buffer)
        model_buffer.seek(0)
        
        s3_client.put_object(
            Bucket=self.config.s3_bucket,
            Key=f"{prefix}/model.txt",
            Body=model_buffer.read()
        )
        
        # Save explainer
        explainer_buffer = io.BytesIO()
        pickle.dump(self.explainer, explainer_buffer)
        explainer_buffer.seek(0)
        
        s3_client.put_object(
            Bucket=self.config.s3_bucket,
            Key=f"{prefix}/explainer.pkl",
            Body=explainer_buffer.read()
        )
        
        return {
            'base_path': f"s3://{self.config.s3_bucket}/{prefix}",
            'model_path': f"s3://{self.config.s3_bucket}/{prefix}/model.txt",
            'explainer_path': f"s3://{self.config.s3_bucket}/{prefix}/explainer.pkl"
        }
    
    def _save_to_dbfs(self, version: str) -> Dict[str, str]:
        """Save model and explainer to DBFS (Databricks)"""
        base_path = f"{self.config.dbfs_path}/{version}"
        os.makedirs(base_path, exist_ok=True)
        
        model_path = f"{base_path}/model.txt"
        if self.config.model_type == "lightgbm":
            self.model.save_model(model_path)
        else:
            self.model.save_model(model_path)
        
        explainer_path = f"{base_path}/explainer.pkl"
        with open(explainer_path, 'wb') as f:
            pickle.dump(self.explainer, f)
        
        return {
            'base_path': base_path,
            'model_path': model_path,
            'explainer_path': explainer_path
        }
    
    def _save_to_local(self, version: str) -> Dict[str, str]:
        """Save model and explainer to local filesystem"""
        base_path = f"{self.config.local_path}/{version}"
        os.makedirs(base_path, exist_ok=True)
        
        model_path = f"{base_path}/model.txt"
        if self.config.model_type == "lightgbm":
            self.model.save_model(model_path)
        else:
            self.model.save_model(model_path)
        
        explainer_path = f"{base_path}/explainer.pkl"
        with open(explainer_path, 'wb') as f:
            pickle.dump(self.explainer, f)
        
        return {
            'base_path': base_path,
            'model_path': model_path,
            'explainer_path': explainer_path
        }
    
    def log_to_mlflow(self, X: pd.DataFrame, y: pd.Series) -> str:
        """Log model, metrics, and artifacts to MLflow"""
        logger.info("Logging to MLflow...")
        
        with mlflow.start_run() as run:
            run_id = run.info.run_id
            
            # Log parameters
            mlflow.log_params({
                'model_type': self.config.model_type,
                'num_leaves': self.config.num_leaves,
                'max_depth': self.config.max_depth,
                'learning_rate': self.config.learning_rate,
                'n_estimators': self.config.n_estimators,
                'min_child_samples': self.config.min_child_samples,
                'subsample': self.config.subsample,
                'colsample_bytree': self.config.colsample_bytree,
                'reg_alpha': self.config.reg_alpha,
                'reg_lambda': self.config.reg_lambda,
                'n_folds': self.config.n_folds
            })
            
            # Log metrics
            mlflow.log_metrics(self.metrics)
            
            # Log model
            if self.config.model_type == "lightgbm":
                mlflow.lightgbm.log_model(
                    self.model,
                    "model",
                    registered_model_name="suggestion_scoring_model"
                )
            else:
                mlflow.xgboost.log_model(
                    self.model,
                    "model",
                    registered_model_name="suggestion_scoring_model"
                )
            
            # Log feature importance
            importance_df = self.get_feature_importance()
            importance_path = "/tmp/feature_importance.csv"
            importance_df.to_csv(importance_path, index=False)
            mlflow.log_artifact(importance_path, "feature_importance")
            
            # Log SHAP summary plot
            if self.shap_values is not None:
                import matplotlib.pyplot as plt
                plt.figure(figsize=(10, 8))
                shap.summary_plot(self.shap_values, X[:len(self.shap_values)], 
                                  show=False, plot_type="bar")
                shap_path = "/tmp/shap_summary.png"
                plt.savefig(shap_path, bbox_inches='tight')
                mlflow.log_artifact(shap_path, "shap")
                plt.close()
            
            logger.info(f"MLflow run ID: {run_id}")
            
            return run_id


# =============================================================================
# MODEL REGISTRY CLIENT
# =============================================================================

class ModelRegistryClient:
    """Client for interacting with PostgreSQL model registry"""
    
    def __init__(self, db_connection_string: str):
        self.db_connection_string = db_connection_string
        
    def register_model(self, version: str, model_path: str, explainer_path: str,
                       metrics: Dict[str, float], run_id: str) -> int:
        """Register a new model version in the database"""
        import psycopg2
        from psycopg2.extras import Json
        
        with psycopg2.connect(self.db_connection_string) as conn:
            with conn.cursor() as cur:
                # First, set any existing ACTIVE models to ROLLED_BACK
                cur.execute("""
                    UPDATE ml_model_registry 
                    SET status = 'ROLLED_BACK', 
                        updated_at = NOW()
                    WHERE status = 'ACTIVE'
                """)
                
                # Insert new model as CANDIDATE
                cur.execute("""
                    INSERT INTO ml_model_registry 
                    (version, model_path, explainer_path, metrics, mlflow_run_id, 
                     status, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, 'CANDIDATE', NOW(), NOW())
                    RETURNING id
                """, (version, model_path, explainer_path, Json(metrics), run_id))
                
                model_id = cur.fetchone()[0]
                conn.commit()
        
        logger.info(f"Registered model version {version} with ID {model_id}")
        return model_id
    
    def promote_model(self, version: str) -> bool:
        """Promote a model from CANDIDATE to ACTIVE"""
        import psycopg2
        
        with psycopg2.connect(self.db_connection_string) as conn:
            with conn.cursor() as cur:
                # Set current ACTIVE to ROLLED_BACK
                cur.execute("""
                    UPDATE ml_model_registry 
                    SET status = 'ROLLED_BACK', updated_at = NOW()
                    WHERE status = 'ACTIVE'
                """)
                
                # Promote specified version to ACTIVE
                cur.execute("""
                    UPDATE ml_model_registry 
                    SET status = 'ACTIVE', updated_at = NOW()
                    WHERE version = %s AND status = 'CANDIDATE'
                    RETURNING id
                """, (version,))
                
                result = cur.fetchone()
                conn.commit()
                
                if result:
                    logger.info(f"Promoted model version {version} to ACTIVE")
                    return True
                else:
                    logger.warning(f"Model version {version} not found or not in CANDIDATE status")
                    return False
    
    def get_active_model(self) -> Optional[Dict]:
        """Get the currently active model"""
        import psycopg2
        
        with psycopg2.connect(self.db_connection_string) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, version, model_path, explainer_path, metrics, 
                           mlflow_run_id, status, created_at
                    FROM ml_model_registry
                    WHERE status = 'ACTIVE'
                    ORDER BY created_at DESC
                    LIMIT 1
                """)
                
                row = cur.fetchone()
                if row:
                    return {
                        'id': row[0],
                        'version': row[1],
                        'model_path': row[2],
                        'explainer_path': row[3],
                        'metrics': row[4],
                        'mlflow_run_id': row[5],
                        'status': row[6],
                        'created_at': row[7]
                    }
        
        return None


# =============================================================================
# MAIN TRAINING PIPELINE
# =============================================================================

def run_training_pipeline(
    training_data_path: str,
    config: TrainingConfig = None,
    promote_after_training: bool = False,
    db_connection_string: str = None
) -> Dict[str, Any]:
    """
    Run the complete training pipeline.
    
    Args:
        training_data_path: Path to training data (CSV or Parquet)
        config: Training configuration
        promote_after_training: Whether to auto-promote model to ACTIVE
        db_connection_string: PostgreSQL connection string for model registry
    
    Returns:
        Dictionary with training results
    """
    logger.info("Starting ML training pipeline...")
    
    if config is None:
        config = TrainingConfig()
    
    # Load data
    if training_data_path.endswith('.parquet'):
        df = pd.read_parquet(training_data_path)
    else:
        df = pd.read_csv(training_data_path)
    
    logger.info(f"Loaded {len(df)} training samples")
    
    # Initialize trainer
    trainer = ModelTrainer(config)
    
    # Prepare features
    X, y = trainer.prepare_features(df)
    
    # Cross-validation
    cv_metrics = trainer.cross_validate(X, y)
    
    # Train final model on all data
    if config.model_type == "lightgbm":
        trainer.train_lightgbm(X, y)
    else:
        trainer.train_xgboost(X, y)
    
    # Compute SHAP values
    trainer.compute_shap_values(X)
    
    # Get feature importance
    feature_importance = trainer.get_feature_importance()
    
    # Save model and explainer
    version = datetime.now().strftime("%Y%m%d_%H%M%S")
    paths = trainer.save_model_and_explainer(version)
    
    # Log to MLflow
    run_id = trainer.log_to_mlflow(X, y)
    
    # Register in model registry
    model_id = None
    if db_connection_string:
        registry = ModelRegistryClient(db_connection_string)
        model_id = registry.register_model(
            version=version,
            model_path=paths['model_path'],
            explainer_path=paths['explainer_path'],
            metrics=cv_metrics,
            run_id=run_id
        )
        
        if promote_after_training:
            registry.promote_model(version)
    
    results = {
        'version': version,
        'run_id': run_id,
        'model_id': model_id,
        'metrics': cv_metrics,
        'feature_importance': feature_importance.to_dict('records'),
        'paths': paths
    }
    
    logger.info(f"Training pipeline completed. Version: {version}")
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Train CargoBit ML Model")
    parser.add_argument("--data", required=True, help="Path to training data")
    parser.add_argument("--config", help="Path to config JSON")
    parser.add_argument("--promote", action="store_true", help="Auto-promote model")
    parser.add_argument("--db", help="PostgreSQL connection string")
    
    args = parser.parse_args()
    
    config = TrainingConfig()
    if args.config:
        with open(args.config) as f:
            config_dict = json.load(f)
            config = TrainingConfig(**config_dict)
    
    results = run_training_pipeline(
        training_data_path=args.data,
        config=config,
        promote_after_training=args.promote,
        db_connection_string=args.db
    )
    
    print(json.dumps(results, indent=2, default=str))
