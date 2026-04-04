"""
data_generator.py
=================
Loads the curated drug dataset (curated_drugs.csv) and generates a
Tox21-compatible binary-label CSV for training ToxScout AI models.

Toxicity mapping:
  Safe     → 0
  Moderate → 0  (borderline; treated as non-toxic for binary classification)
  Toxic    → 1

Usage:
  python drug_toxicity/data_generator.py
  → writes drug_toxicity/data/curated_tox_dataset.csv
"""

import os
import pandas as pd
import numpy as np

# ── Paths ─────────────────────────────────────────────────────
_HERE        = os.path.dirname(os.path.abspath(__file__))
CURATED_CSV  = os.path.join(_HERE, "curated_drugs.csv")
OUTPUT_DIR   = os.path.join(_HERE, "data")
OUTPUT_CSV   = os.path.join(OUTPUT_DIR, "curated_tox_dataset.csv")

SMILES_COL   = "smiles"
LABEL_COL    = "label"

# ── Toxicity label → binary ───────────────────────────────────
LABEL_MAP = {
    "Safe":     0,
    "Moderate": 0,   # conservative: treat moderate as non-toxic
    "Toxic":    1,
}


def load_curated(path: str = CURATED_CSV) -> pd.DataFrame:
    """Load curated_drugs.csv and return with binary label column."""
    df = pd.read_csv(path)
    required = {"name", "smiles", "drug_class", "toxicity_label"}
    missing  = required - set(df.columns)
    if missing:
        raise ValueError(f"curated_drugs.csv is missing columns: {missing}")

    df[LABEL_COL] = df["toxicity_label"].map(LABEL_MAP)
    unmapped = df[df[LABEL_COL].isna()]["toxicity_label"].unique()
    if len(unmapped):
        raise ValueError(f"Unknown toxicity_label values: {unmapped}")

    df[LABEL_COL] = df[LABEL_COL].astype(int)
    return df


def validate_smiles(df: pd.DataFrame) -> pd.DataFrame:
    """Drop rows with invalid SMILES (requires RDKit)."""
    try:
        from rdkit import Chem
        before = len(df)
        mask   = df[SMILES_COL].apply(lambda s: Chem.MolFromSmiles(str(s)) is not None)
        df     = df[mask].reset_index(drop=True)
        dropped = before - len(df)
        if dropped:
            print(f"[DataGen] Dropped {dropped} rows with invalid SMILES.")
    except ImportError:
        print("[DataGen] RDKit not available — skipping SMILES validation.")
    return df


def generate_dataset(
    output_path: str = OUTPUT_CSV,
    augment: bool = False,
    augment_to: int = 500,
    random_seed: int = 42,
) -> pd.DataFrame:
    """
    Load curated dataset, validate SMILES, optionally augment by
    repeating rows with small label noise, and save to CSV.

    Parameters
    ----------
    output_path : destination CSV path
    augment     : if True, repeat rows to reach augment_to samples
    augment_to  : target row count when augmenting
    random_seed : numpy random seed for reproducibility
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    np.random.seed(random_seed)

    df = load_curated()
    df = validate_smiles(df)

    print(f"[DataGen] Loaded {len(df)} curated compounds.")
    print(f"[DataGen] Class distribution (binary):\n"
          f"{df[LABEL_COL].value_counts().rename({0: 'Non-toxic (0)', 1: 'Toxic (1)'}).to_string()}")
    print(f"[DataGen] Drug class coverage ({df['drug_class'].nunique()} classes):\n"
          f"{df['drug_class'].value_counts().to_string()}")

    if augment and len(df) < augment_to:
        extra_needed = augment_to - len(df)
        extra = df.sample(n=extra_needed, replace=True, random_state=random_seed)
        df = pd.concat([df, extra], ignore_index=True)
        print(f"[DataGen] Augmented to {len(df)} rows.")

    # Output columns: smiles + label (Tox21-compatible) + metadata
    out_cols = [SMILES_COL, LABEL_COL, "name", "drug_class",
                "primary_use", "toxicity_label", "molecular_weight", "logP"]
    out_cols = [c for c in out_cols if c in df.columns]
    df[out_cols].to_csv(output_path, index=False)
    print(f"[DataGen] Dataset saved -> {output_path}")
    return df[out_cols]


# ── Legacy pool (kept for backward compatibility) ─────────────
SMILES_POOL = [
    "CC(=O)Oc1ccccc1C(=O)O",
    "CC12CCC3C(C1CCC2O)CCC4=CC(=O)CCC34C",
    "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
    "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
    "CC(=O)Nc1ccc(O)cc1",
    "c1ccc(cc1)N",
    "Clc1ccc(cc1Cl)c1cc(Cl)ccc1Cl",
    "ClCCl",
    "c1ccc([N+](=O)[O-])cc1",
    "O=Cc1ccccc1",
]

SMILES_COL = "smiles"
LABEL_COL  = "label"


if __name__ == "__main__":
    generate_dataset()

