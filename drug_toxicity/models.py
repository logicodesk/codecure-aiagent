# ============================================================
# models.py — model definitions, ensembles, tuning, CV
# ============================================================

import warnings, os
warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import (
    RandomForestClassifier, ExtraTreesClassifier,
    VotingClassifier, StackingClassifier,
    GradientBoostingClassifier,
)
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold, cross_val_score
from sklearn.neural_network import MLPClassifier
from sklearn.calibration import CalibratedClassifierCV
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from config import RANDOM_STATE


# ── Individual models ─────────────────────────────────────────

def get_logistic_regression():
    """L2-regularised LR with balanced class weights."""
    return LogisticRegression(
        C=1.0, max_iter=1000, solver="lbfgs",
        class_weight="balanced", random_state=RANDOM_STATE)


def get_random_forest():
    """Random Forest — strong baseline, good feature importance."""
    return RandomForestClassifier(
        n_estimators=300, max_depth=None,
        min_samples_split=5, min_samples_leaf=2,
        max_features="sqrt", class_weight="balanced",
        random_state=RANDOM_STATE, n_jobs=1)


def get_extra_trees():
    """
    Extra-Trees — faster than RF, lower variance, good for high-dim FP data.
    Complements RF in the ensemble.
    """
    return ExtraTreesClassifier(
        n_estimators=300, max_depth=None,
        min_samples_split=5, min_samples_leaf=2,
        max_features="sqrt", class_weight="balanced",
        random_state=RANDOM_STATE, n_jobs=1)


def get_xgboost():
    """XGBoost — primary model, handles imbalance via scale_pos_weight."""
    return XGBClassifier(
        n_estimators=300, max_depth=6, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, gamma=0.1,
        min_child_weight=3, reg_alpha=0.1, reg_lambda=1.0,
        eval_metric="logloss", use_label_encoder=False,
        random_state=RANDOM_STATE, n_jobs=1)


def get_lightgbm():
    """LightGBM — fast gradient boosting, good on sparse fingerprints."""
    return LGBMClassifier(
        n_estimators=300, max_depth=6, learning_rate=0.05,
        num_leaves=63, subsample=0.8, colsample_bytree=0.8,
        min_child_samples=20, reg_alpha=0.1, reg_lambda=1.0,
        class_weight="balanced", random_state=RANDOM_STATE,
        n_jobs=1, verbose=-1)


def get_mlp():
    """3-layer MLP with adaptive LR and early stopping."""
    return MLPClassifier(
        hidden_layer_sizes=(512, 256, 128), activation="relu",
        alpha=1e-3, batch_size=128, learning_rate="adaptive",
        max_iter=500, random_state=RANDOM_STATE,
        early_stopping=True, validation_fraction=0.1, n_iter_no_change=15)


def get_gradient_boosting():
    """Sklearn GradientBoosting — well-calibrated probabilities."""
    return GradientBoostingClassifier(
        n_estimators=200, max_depth=4, learning_rate=0.05,
        subsample=0.8, min_samples_leaf=5,
        random_state=RANDOM_STATE)


# ── Calibrated wrappers ───────────────────────────────────────

def get_calibrated(model, method: str = "isotonic", cv: int = 3):
    """
    Wrap any classifier with CalibratedClassifierCV.
    method='isotonic' for large datasets, 'sigmoid' for small.
    Produces reliable probability estimates (not just scores).
    """
    return CalibratedClassifierCV(model, method=method, cv=cv)


# ── Ensemble models ───────────────────────────────────────────

def get_voting_ensemble(rf, xgb, lgbm, et=None):
    """
    Soft-voting ensemble.
    Optionally includes ExtraTrees for extra diversity.
    """
    estimators = [("rf", rf), ("xgb", xgb), ("lgbm", lgbm)]
    if et is not None:
        estimators.append(("et", et))
    return VotingClassifier(estimators=estimators, voting="soft", n_jobs=1)


def get_stacking_ensemble(rf, xgb, lgbm, et=None):
    """
    Stacking: RF + XGBoost + LightGBM (+ optional ExtraTrees) as base,
    calibrated Logistic Regression as meta-learner.

    Uses StratifiedKFold to preserve class balance in each fold.
    passthrough=True feeds original features to meta-learner for richer signal.
    """
    meta = CalibratedClassifierCV(
        LogisticRegression(max_iter=1000, C=0.5, solver="lbfgs"),
        cv=3, method="isotonic")

    estimators = [("rf", rf), ("xgb", xgb), ("lgbm", lgbm)]
    if et is not None:
        estimators.append(("et", et))

    return StackingClassifier(
        estimators=estimators,
        final_estimator=meta,
        cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE),
        n_jobs=1,
        passthrough=False,   # set True for richer meta-features (slower)
    )


# ── Cross-validation ──────────────────────────────────────────

def cross_validate_model(name: str, model, X_train, y_train,
                         cv: int = 5) -> float:
    """
    Stratified k-fold CV — prints mean ± std ROC-AUC.
    Detects overfitting before final evaluation.
    """
    skf    = StratifiedKFold(n_splits=cv, shuffle=True, random_state=RANDOM_STATE)
    scores = cross_val_score(model, X_train, y_train,
                             cv=skf, scoring="roc_auc", n_jobs=1)
    print(f"  [{name}] CV ROC-AUC: {scores.mean():.4f} ± {scores.std():.4f}  "
          f"(min={scores.min():.4f}  max={scores.max():.4f})")
    return scores.mean()


# ── Hyperparameter tuning ─────────────────────────────────────

def tune_random_forest(X_train, y_train):
    param_dist = {
        "n_estimators":      [200, 300, 500],
        "max_depth":         [10, 20, None],
        "min_samples_split": [2, 5, 10],
        "min_samples_leaf":  [1, 2, 4],
        "max_features":      ["sqrt", "log2"],
        "class_weight":      ["balanced", "balanced_subsample"],
    }
    search = RandomizedSearchCV(
        RandomForestClassifier(random_state=RANDOM_STATE, n_jobs=1),
        param_distributions=param_dist, n_iter=15, cv=3,
        scoring="roc_auc", random_state=RANDOM_STATE, n_jobs=1, verbose=0)
    search.fit(X_train, y_train)
    print(f"[Tune RF]   best AUC={search.best_score_:.4f}  "
          f"params={search.best_params_}")
    return search.best_estimator_


def tune_xgboost(X_train, y_train):
    param_dist = {
        "n_estimators":     [200, 300, 400],
        "max_depth":        [3, 5, 7],
        "learning_rate":    [0.03, 0.05, 0.1],
        "subsample":        [0.7, 0.8, 1.0],
        "colsample_bytree": [0.7, 0.8, 1.0],
        "gamma":            [0, 0.1, 0.3],
        "min_child_weight": [1, 3, 5],
        "reg_alpha":        [0, 0.1, 0.5],
    }
    search = RandomizedSearchCV(
        XGBClassifier(eval_metric="logloss",
                      random_state=RANDOM_STATE, n_jobs=1),
        param_distributions=param_dist, n_iter=15, cv=3,
        scoring="roc_auc", random_state=RANDOM_STATE, n_jobs=1, verbose=0)
    search.fit(X_train, y_train)
    print(f"[Tune XGB]  best AUC={search.best_score_:.4f}  "
          f"params={search.best_params_}")
    return search.best_estimator_


def tune_lightgbm(X_train, y_train):
    param_dist = {
        "n_estimators":      [200, 300, 400],
        "max_depth":         [4, 6, -1],
        "learning_rate":     [0.03, 0.05, 0.1],
        "num_leaves":        [31, 63, 127],
        "subsample":         [0.7, 0.8, 1.0],
        "colsample_bytree":  [0.7, 0.8, 1.0],
        "min_child_samples": [10, 20, 50],
        "reg_alpha":         [0, 0.1, 0.5],
    }
    search = RandomizedSearchCV(
        LGBMClassifier(class_weight="balanced",
                       random_state=RANDOM_STATE, n_jobs=1, verbose=-1),
        param_distributions=param_dist, n_iter=15, cv=3,
        scoring="roc_auc", random_state=RANDOM_STATE, n_jobs=1, verbose=0)
    search.fit(X_train, y_train)
    print(f"[Tune LGBM] best AUC={search.best_score_:.4f}  "
          f"params={search.best_params_}")
    return search.best_estimator_
