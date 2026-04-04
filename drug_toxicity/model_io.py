# ============================================================
# model_io.py — save / load / single-SMILES inference
# ============================================================

import os, joblib
import numpy as np
from config import (
    MODEL_DIR, USE_MORGAN_FP, MORGAN_RADIUS, MORGAN_NBITS,
    USE_MACCS, USE_RDKIT_FP, RDKIT_FP_NBITS,
    USE_CHEMBL_ENRICHMENT,
)


def save_model(model, name: str) -> str:
    path = os.path.join(MODEL_DIR, f"{name.replace(' ','_')}.pkl")
    joblib.dump(model, path)
    print(f"[Save] {name} → {path}")
    return path


def load_model(name: str):
    path = os.path.join(MODEL_DIR, f"{name.replace(' ','_')}.pkl")
    if not os.path.exists(path):
        raise FileNotFoundError(f"No model at: {path}")
    return joblib.load(path)


def save_scaler(scaler, filename: str = "scaler.pkl"):
    path = os.path.join(MODEL_DIR, filename)
    joblib.dump(scaler, path)
    print(f"[Save] scaler → {path}")


def load_scaler(filename: str = "scaler.pkl"):
    return joblib.load(os.path.join(MODEL_DIR, filename))


def save_kept_indices(indices: list, filename: str = "indices.pkl"):
    path = os.path.join(MODEL_DIR, filename)
    joblib.dump(indices, path)
    print(f"[Save] indices → {path}")


def load_kept_indices(filename: str = "indices.pkl") -> list:
    path = os.path.join(MODEL_DIR, filename)
    if os.path.exists(path):
        return joblib.load(path)
    return []


def predict_toxicity(smiles: str,
                     model_name: str = "Stacking_Ensemble",
                     threshold: float = 0.35) -> dict:
    """
    Load saved model + scaler and predict toxicity for one SMILES.

    Returns a dict with:
      - toxic            (bool)
      - probability      (float 0–1)
      - confidence_pct   (float 0–100)
      - confidence_level ("High" / "Medium" / "Low")
      - model_used       (str)
      - feature_count    (int)
    """
    from features import smiles_to_descriptors
    from evaluation import confidence_score

    feat = smiles_to_descriptors(
        smiles,
        use_morgan=USE_MORGAN_FP,
        morgan_radius=MORGAN_RADIUS,
        morgan_nbits=MORGAN_NBITS,
        use_maccs=USE_MACCS,
        use_rdkit_fp=USE_RDKIT_FP,
        rdkit_fp_nbits=RDKIT_FP_NBITS,
    )
    if feat is None:
        return {"error": "Invalid SMILES", "smiles": smiles}

    scaler = load_scaler()
    model  = load_model(model_name)

    # Handle feature dimension mismatch gracefully
    # (e.g. model trained before RDKit FP was added or with feature selection)
    X = feat.reshape(1, -1)
    try:
        X_sc = scaler.transform(X)
        # Apply feature selection if indices were saved
        indices = load_kept_indices()
        if indices:
            X_sc = X_sc[:, indices]
    except ValueError as e:
        return {"error": f"Feature mismatch: {e}", "smiles": smiles}

    prob   = float(model.predict_proba(X_sc)[0, 1])
    result = confidence_score(prob)
    result["smiles"]        = smiles
    result["model_used"]    = model_name
    result["threshold"]     = threshold
    result["feature_count"] = int(feat.shape[0])
    return result
