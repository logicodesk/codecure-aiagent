import pandas as pd
import numpy as np
import joblib
import os

# ZINC stats (pre-calculated for drug-like space alignment)
ZINC_STATS = {
    "LogP":   {"mean": 2.85,  "std": 1.42},
    "MW":     {"mean": 352.4, "std": 92.1},
    "QED":    {"mean": 0.68,  "std": 0.18},
    "TPSA":   {"mean": 74.2,  "std": 35.6},
    "RotBonds": {"mean": 4.8, "std": 2.6},
    "Fsp3":   {"mean": 0.41,  "std": 0.22},
    "SAS":    {"mean": 3.12,  "std": 0.88}, # Simplified SAS distribution
}

def generate_zinc_stats(output_path="c:/Users/Satvik Shrivastava/Downloads/codecure-aiagent-main/codecure-aiagent-main/backend/models/zinc_stats.pkl"):
    """
    Saves pre-calculated ZINC population statistics for normalization.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    joblib.dump(ZINC_STATS, output_path)
    print(f"[ZINC] Population statistics saved to {output_path}")
    return ZINC_STATS

if __name__ == "__main__":
    generate_zinc_stats()
