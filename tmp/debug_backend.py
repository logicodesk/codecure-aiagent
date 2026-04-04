import sys, os
project_root = r"c:\Users\Satvik Shrivastava\Downloads\codecure-aiagent-main"
sys.path.append(project_root)
sys.path.append(os.path.join(project_root, "backend"))

import os
# Mock some env vars if needed
os.environ["MODEL_DIR"] = os.path.join(project_root, "backend", "models")

import joblib
import numpy as np
from backend import api

# Initialize backend artifacts manually if needed
api.load_artifacts()

try:
    smiles = "CC(=O)Oc1ccccc1C(=O)O" # aspirin
    feat = api._get_features_for_scaler(smiles)
    print(f"Feat shape: {feat.shape}")
    
    if api.SCALER is None:
        print("SCALER is None!")
        sys.exit(1)
        
    X = api.SCALER.transform(feat.reshape(1, -1))
    print(f"X shape: {X.shape}")
    
    model_name = 'Voting_Ensemble'
    if model_name not in api.MODELS:
        model_name = next(iter(api.MODELS))
    
    model = api.MODELS[model_name]
    prob = model.predict_proba(X)
    print(f"Prob: {prob}")
    
    expl = api.compute_shap_explanation(X, api.FEATURE_NAMES[:X.shape[1]])
    print("SHAP explanation success")
    print(f"Top features: {len(expl.get('top_features', []))}")
    
except Exception as e:
    import traceback
    traceback.print_exc()
