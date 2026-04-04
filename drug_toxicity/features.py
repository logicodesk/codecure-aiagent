# ============================================================
# features.py  —  SMILES → comprehensive numerical feature vector
# ============================================================
#
# Feature groups (in order):
#
#  GROUP 1 — Basic physicochemical          (5)
#  GROUP 2 — Structural descriptors         (8)
#  GROUP 3 — Electronic / charge            (7)   ← Gasteiger charges NEW
#  GROUP 4 — Drug-likeness rules            (6)   ← Lipinski pass/count NEW
#  GROUP 5 — Toxicity-related alerts       (16)   ← PAINS + toxicophores NEW
#  GROUP 6 — Extended descriptors           (9)
#  GROUP 7 — Ring system breakdown          (5)
#  GROUP 8 — EState indices                 (6)
#  GROUP 9 — Surface & shape               (3)   ← LabuteASA, TPSA, MolVol NEW
#  GROUP 10 — MACCS keys                  (167)
#  GROUP 11 — Morgan ECFP4               (1024)   ← upgraded from 256
#  GROUP 12 — RDKit topological FP        (512)   ← upgraded from 200
#  GROUP 13 — ZINC Normalized features     (7)
#
#  Total raw: ~1784 features (before selection)
# ============================================================

import numpy as np
import pandas as pd
from typing import Optional, Tuple

try:
    from rdkit import Chem, RDLogger
    from rdkit.Chem import (
        Descriptors, rdMolDescriptors, AllChem,
        MACCSkeys, QED, Crippen, rdchem,
    )
    from rdkit.Chem.rdMolDescriptors import (
        CalcTPSA, CalcNumHBD, CalcNumHBA,
        CalcNumRotatableBonds, CalcNumRings,
        CalcNumAromaticRings, CalcFractionCSP3,
        CalcNumAtomStereoCenters, CalcNumHeteroatoms,
        CalcNumAliphaticRings, CalcNumSaturatedRings,
        CalcNumAromaticCarbocycles, CalcNumAromaticHeterocycles,
        CalcNumAmideBonds, CalcNumBridgeheadAtoms,
        CalcNumSpiroAtoms, CalcLabuteASA,
    )
    from rdkit.Chem import GraphDescriptors, EState
    from rdkit.Chem.rdPartialCharges import ComputeGasteigerCharges
    RDLogger.DisableLog('rdApp.*')
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False
    print("[WARNING] RDKit not found.")


# ── PAINS / structural alert SMARTS library ───────────────────
# Covers: toxicophores + PAINS (Pan-Assay INterference compoundS)
# Each entry: (name, SMARTS_pattern)
STRUCTURAL_ALERTS = [
    # Classic toxicophores
    ("nitro",           "[N+](=O)[O-]"),
    ("aldehyde",        "[CX3H1](=O)"),
    ("epoxide",         "C1OC1"),
    ("michael_acc",     "[CX3]=[CX3][CX3]=O"),
    ("quinone",         "O=C1C=CC(=O)C=C1"),
    ("halide_arom",     "c[F,Cl,Br,I]"),
    ("amine_arom",      "cN"),
    ("thiol",           "[SH]"),
    ("peroxide",        "OO"),
    ("azo",             "N=N"),
    ("acyl_halide",     "[CX3](=O)[F,Cl,Br,I]"),
    ("isocyanate",      "N=C=O"),
    # Halogen counts (toxicity-relevant)
    ("any_halogen",     "[F,Cl,Br,I]"),
    ("chlorine",        "[Cl]"),
    ("bromine",         "[Br]"),
    # Carbonyl groups
    ("carbonyl",        "[CX3]=O"),
    # PAINS-like alerts
    ("aniline",         "c1ccccc1N"),
    ("hydrazine",       "NN"),
    ("hydroxamic_acid", "C(=O)NO"),
    ("imine",           "[CX3]=[NX2]"),
    ("diazo",           "[N]=[N+]=[N-]"),
    ("sulfonate",       "S(=O)(=O)O"),
    ("phosphonate",     "P(=O)(O)O"),
    ("catechol",        "c1ccc(O)c(O)c1"),
    ("rhodanine",       "O=C1CSC(=S)N1"),
]

# Pre-compile SMARTS patterns once at import time
_COMPILED_ALERTS = []
for _name, _sma in STRUCTURAL_ALERTS:
    _patt = Chem.MolFromSmarts(_sma) if RDKIT_AVAILABLE else None
    _COMPILED_ALERTS.append((_name, _patt))


# ── GROUP 3: Gasteiger partial charges ───────────────────────

def _gasteiger_features(mol) -> list:
    """
    Compute Gasteiger partial charges and return statistics:
    [mean, max, min, std, abs_mean, positive_fraction]

    Gasteiger charges encode the electronic environment of each atom —
    important for reactivity and toxicity prediction.
    """
    try:
        mol_h = Chem.AddHs(mol)
        ComputeGasteigerCharges(mol_h)
        charges = [
            float(a.GetDoubleProp('_GasteigerCharge'))
            for a in mol_h.GetAtoms()
            if a.GetAtomicNum() != 1  # exclude H
        ]
        if not charges:
            return [0.0] * 6
        arr = np.array(charges, dtype=np.float32)
        # Replace inf/nan (can occur for unusual valences)
        arr = np.where(np.isfinite(arr), arr, 0.0)
        return [
            float(arr.mean()),
            float(arr.max()),
            float(arr.min()),
            float(arr.std()),
            float(np.abs(arr).mean()),
            float((arr > 0).sum() / len(arr)),  # fraction positive
        ]
    except Exception:
        return [0.0] * 6


# ── GROUP 4: Drug-likeness rules ─────────────────────────────

def _drug_likeness_features(mol) -> list:
    """
    Rule-based drug-likeness features:
      - Lipinski Ro5: MW≤500, LogP≤5, HBD≤5, HBA≤10
      - lipinski_pass (binary: 1 = passes all 4 rules)
      - lipinski_score (0–4: count of rules satisfied)
      - Veber violations (rotatable bonds + TPSA)
      - Lead-likeness violations (MW≤350, LogP≤3.5, HBD≤3, HBA≤7)
    """
    mw   = Descriptors.MolWt(mol)
    logp = Descriptors.MolLogP(mol)
    hbd  = CalcNumHBD(mol)
    hba  = CalcNumHBA(mol)
    rotb = CalcNumRotatableBonds(mol)
    tpsa = CalcTPSA(mol)

    # Lipinski
    ro5_pass = [mw <= 500, logp <= 5, hbd <= 5, hba <= 10]
    lipinski_score = sum(ro5_pass)
    lipinski_pass  = int(all(ro5_pass))

    # Veber (oral bioavailability)
    veber_viol = int(rotb > 10) + int(tpsa > 140)

    # Lead-likeness
    lead_viol = (int(mw > 350) + int(logp > 3.5) +
                 int(hbd > 3)  + int(hba > 7))

    return [lipinski_pass, lipinski_score, veber_viol, lead_viol,
            int(mw <= 500), int(logp <= 5)]   # individual Ro5 flags


# ── GROUP 5: Structural alerts ────────────────────────────────

def _structural_alert_features(mol) -> list:
    """
    Count occurrences of each structural alert / toxicophore SMARTS.
    Returns a list of integers (match counts).
    """
    counts = []
    for _name, patt in _COMPILED_ALERTS:
        if patt is None:
            counts.append(0)
        else:
            counts.append(len(mol.GetSubstructMatches(patt)))
    return counts


# ── GROUP 8: EState indices ───────────────────────────────────

def _estate_features(mol) -> list:
    """EState index statistics: [min, max, mean, std, sum, n_positive]."""
    try:
        vals = EState.EStateIndices(mol)
        if len(vals) == 0:
            return [0.0] * 6
        arr = np.array(vals, dtype=np.float32)
        return [
            float(arr.min()), float(arr.max()),
            float(arr.mean()), float(arr.std()),
            float(arr.sum()), float((arr > 0).sum()),
        ]
    except Exception:
        return [0.0] * 6


# ── GROUP 9: Surface & shape ──────────────────────────────────

def _surface_shape_features(mol) -> list:
    """
    Surface and shape descriptors:
      - LabuteASA: approximate molecular surface area (Å²)
      - TPSA: topological polar surface area (already in group 1,
              repeated here for the shape group completeness)
      - MolVol: estimated molecular volume via Van der Waals radii
                (RDKit doesn't have a direct volume function, so we
                 use heavy atom count × avg atomic volume ≈ 17 Å³/atom)
    """
    labute_asa = CalcLabuteASA(mol)
    tpsa       = CalcTPSA(mol)
    # Approximate volume: sum of atomic contributions
    # RDKit doesn't expose 3D volume without conformer generation,
    # so we use the empirical formula: V ≈ 1.5 × LabuteASA^1.5 / 4π
    mol_vol_approx = 1.5 * (labute_asa ** 1.5) / (4 * np.pi)
    return [labute_asa, tpsa, mol_vol_approx]


# ── GROUP 13: ZINC Normalization ──────────────────────────────

def _zinc_normalized_features(mol) -> list:
    """
    Normalizes LogP, MW, QED, TPSA, RotBonds, Fsp3, and SAS using 
    ZINC250k drug-like population statistics.
    Provides a standardized 'drug-likeness intensity' metric.
    """
    try:
        # These match ZINC_STATS in zinc_stats.py
        stats = {
            "LogP":   {"mean": 2.85,  "std": 1.42},
            "MW":     {"mean": 352.4, "std": 92.1},
            "QED":    {"mean": 0.68,  "std": 0.18},
            "TPSA":   {"mean": 74.2,  "std": 35.6},
            "RotBonds": {"mean": 4.8, "std": 2.6},
            "Fsp3":   {"mean": 0.41,  "std": 0.22},
            "SAS":    {"mean": 3.12,  "std": 0.88},
        }
        
        # Calculate raw values
        mw   = Descriptors.MolWt(mol)
        logp = Descriptors.MolLogP(mol)
        qed  = QED.qed(mol)
        tpsa = CalcTPSA(mol)
        rotb = CalcNumRotatableBonds(mol)
        fsp3 = CalcFractionCSP3(mol)
        # SAS heuristic: combination of complexity and MW
        sas_raw = 0.5 * (mw/100.0) + 0.3 * (1.1 - fsp3) + 0.2 * (Descriptors.BertzCT(mol)/1000.0)
        sas_raw = max(1.0, min(10.0, sas_raw * 5.0)) # Scale to ~1-10

        normalized = []
        for key, val in [("LogP", logp), ("MW", mw), ("QED", qed), 
                        ("TPSA", tpsa), ("RotBonds", rotb), ("Fsp3", fsp3), ("SAS", sas_raw)]:
            z_score = (val - stats[key]["mean"]) / stats[key]["std"]
            normalized.append(float(z_score))
        return normalized
    except Exception:
        return [0.0] * 7


# ── Main featurizer ───────────────────────────────────────────

def smiles_to_descriptors(smiles: str,
                           use_morgan: bool = True,
                           morgan_radius: int = 2,
                           morgan_nbits: int = 1024,
                           use_maccs: bool = True,
                           use_rdkit_fp: bool = True,
                           rdkit_fp_nbits: int = 512) -> Optional[np.ndarray]:
    """
    Convert a SMILES string into a comprehensive flat feature vector.
    Returns None for invalid SMILES.

    Feature layout:
      [0:5]     Group 1 — Basic physicochemical
      [5:13]    Group 2 — Structural
      [13:20]   Group 3 — Electronic / Gasteiger charges
      [20:26]   Group 4 — Drug-likeness rules
      [26:51]   Group 5 — Structural alerts (25 patterns)
      [51:60]   Group 6 — Extended descriptors
      [60:65]   Group 7 — Ring system breakdown
      [65:71]   Group 8 — EState indices
      [71:74]   Group 9 — Surface & shape
      [74:241]  Group 10 — MACCS keys (167)
      [241:1265] Group 11 — Morgan ECFP4 (1024)
      [1265:1777] Group 12 — RDKit topological FP (512)
      [1777:1784] Group 13 — ZINC Normalized (7)
    """
    if not RDKIT_AVAILABLE:
        raise RuntimeError("RDKit is required.")

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None

    # ── Group 1: Basic physicochemical (5) ───────────────────
    basic = [
        Descriptors.MolWt(mol),          # molecular weight
        Descriptors.MolLogP(mol),         # Wildman-Crippen LogP
        CalcNumHBD(mol),                  # H-bond donors
        CalcNumHBA(mol),                  # H-bond acceptors
        CalcTPSA(mol),                    # topological polar SA
    ]

    # ── Group 2: Structural (8) ───────────────────────────────
    structural = [
        CalcNumRotatableBonds(mol),        # rotatable bonds
        CalcNumRings(mol),                 # total rings
        CalcNumAromaticRings(mol),         # aromatic rings
        Descriptors.HeavyAtomCount(mol),   # heavy atoms
        CalcFractionCSP3(mol),             # fraction sp3 carbons
        Descriptors.ExactMolWt(mol),       # exact monoisotopic MW
        Crippen.MolMR(mol),                # molar refractivity
        Descriptors.BertzCT(mol),          # Bertz complexity
    ]

    # ── Group 3: Electronic / Gasteiger (7) ──────────────────
    electronic = [
        Chem.GetFormalCharge(mol),         # net formal charge
    ] + _gasteiger_features(mol)           # mean, max, min, std, abs_mean, frac_pos

    # ── Group 4: Drug-likeness rules (6) ─────────────────────
    drug_like = _drug_likeness_features(mol)

    # ── Group 5: Structural alerts (25) ──────────────────────
    alerts = _structural_alert_features(mol)

    # ── Group 6: Extended descriptors (9) ────────────────────
    extended = [
        QED.qed(mol),                              # drug-likeness score
        CalcNumAtomStereoCenters(mol),             # stereocenters
        CalcNumHeteroatoms(mol),                   # heteroatoms
        CalcNumAmideBonds(mol),                    # amide bonds
        CalcNumBridgeheadAtoms(mol),               # bridgehead atoms
        CalcNumSpiroAtoms(mol),                    # spiro atoms
        Descriptors.NumValenceElectrons(mol),      # valence electrons
        Descriptors.NumRadicalElectrons(mol),      # radical electrons
        Descriptors.BalabanJ(mol) if CalcNumRings(mol) > 0 else 0.0,  # Balaban J
    ]

    # ── Group 7: Ring system breakdown (5) ───────────────────
    rings = [
        CalcNumAliphaticRings(mol),
        CalcNumSaturatedRings(mol),
        CalcNumAromaticCarbocycles(mol),
        CalcNumAromaticHeterocycles(mol),
        CalcNumBridgeheadAtoms(mol),
    ]

    # ── Group 8: EState indices (6) ──────────────────────────
    estate = _estate_features(mol)

    # ── Group 9: Surface & shape (3) ─────────────────────────
    surface = _surface_shape_features(mol)

    # ── Group 13: ZINC Normalized (7) ────────────────────────
    zinc_norm = _zinc_normalized_features(mol)

    # Combine all scalar features
    scalar = np.array(
        basic + structural + electronic + drug_like +
        alerts + extended + rings + estate + surface + zinc_norm,
        dtype=np.float32
    )

    parts = [scalar]

    # ── Group 10: MACCS keys (167-bit) ───────────────────────
    if use_maccs:
        maccs = MACCSkeys.GenMACCSKeys(mol)
        parts.append(np.array(maccs, dtype=np.float32))

    # ── Group 11: Morgan ECFP4 (1024-bit) ────────────────────
    if use_morgan:
        fp = AllChem.GetMorganFingerprintAsBitVect(
            mol, radius=morgan_radius, nBits=morgan_nbits)
        parts.append(np.array(fp, dtype=np.float32))

    # ── Group 12: RDKit topological FP (512-bit) ─────────────
    if use_rdkit_fp:
        rdkit_fp = Chem.RDKFingerprint(mol, fpSize=rdkit_fp_nbits)
        parts.append(np.array(rdkit_fp, dtype=np.float32))

    return np.concatenate(parts)


def get_feature_names(use_morgan: bool = True,
                      morgan_nbits: int = 1024,
                      use_maccs: bool = True,
                      use_rdkit_fp: bool = True,
                      rdkit_fp_nbits: int = 512) -> list:
    """Return human-readable names matching smiles_to_descriptors output."""

    # Group 1
    basic_names = ["MolWeight", "LogP", "HBD", "HBA", "TPSA"]

    # Group 2
    struct_names = [
        "RotBonds", "NumRings", "AromaticRings", "HeavyAtoms",
        "Fsp3", "ExactMolWt", "MolMR", "BertzCT",
    ]

    # Group 3
    elec_names = [
        "FormalCharge",
        "Gasteiger_mean", "Gasteiger_max", "Gasteiger_min",
        "Gasteiger_std", "Gasteiger_absmean", "Gasteiger_fracpos",
    ]

    # Group 4
    drug_names = [
        "Lipinski_pass", "Lipinski_score", "Veber_viol", "LeadLike_viol",
        "Ro5_MW_ok", "Ro5_LogP_ok",
    ]

    # Group 5
    alert_names = [f"Alert_{name}" for name, _ in STRUCTURAL_ALERTS]

    # Group 6
    ext_names = [
        "QED", "Stereocenters", "Heteroatoms", "AmideBonds",
        "BridgeheadAtoms", "SpiroAtoms", "ValenceElectrons",
        "RadicalElectrons", "BalabanJ",
    ]

    # Group 7
    ring_names = [
        "AliphaticRings", "SaturatedRings",
        "AromaticCarbocycles", "AromaticHeterocycles",
        "BridgeheadAtoms2",
    ]

    # Group 8
    estate_names = [
        "EState_min", "EState_max", "EState_mean",
        "EState_std", "EState_sum", "EState_npos",
    ]

    # Group 9
    surface_names = ["LabuteASA", "TPSA2", "MolVol_approx"]

    # Group 13
    zinc_names = ["ZINC_LogP_norm", "ZINC_MW_norm", "ZINC_QED_norm",
                  "ZINC_TPSA_norm", "ZINC_RotBonds_norm", "ZINC_Fsp3_norm", "ZINC_SAS_norm"]

    # Fingerprints
    maccs_names  = [f"MACCS_{i}"  for i in range(167)] if use_maccs  else []
    morgan_names = [f"Morgan_{i}" for i in range(morgan_nbits)] if use_morgan else []
    rdkit_names  = [f"RDKit_{i}"  for i in range(rdkit_fp_nbits)] if use_rdkit_fp else []

    return (basic_names + struct_names + elec_names + drug_names +
            alert_names + ext_names + ring_names + estate_names +
            surface_names + zinc_names + maccs_names + morgan_names + rdkit_names)


# ── Number of scalar features (non-fingerprint) ──────────────
N_SCALAR_FEATURES = (5 + 8 + 7 + 6 + len(STRUCTURAL_ALERTS) + 9 + 5 + 6 + 3 + 7)
# = 5+8+7+6+25+9+5+6+3+7 = 81


def build_feature_matrix(df: pd.DataFrame,
                          smiles_col: str = "smiles",
                          use_morgan: bool = True,
                          morgan_radius: int = 2,
                          morgan_nbits: int = 1024,
                          use_maccs: bool = True,
                          use_rdkit_fp: bool = True,
                          rdkit_fp_nbits: int = 512) -> Tuple[np.ndarray, np.ndarray]:
    """
    Featurize all SMILES in a DataFrame.
    Returns (X, valid_mask) — invalid SMILES are excluded via the mask.
    """
    features, valid_mask = [], []
    for smi in df[smiles_col]:
        feat = smiles_to_descriptors(
            str(smi),
            use_morgan=use_morgan,
            morgan_radius=morgan_radius,
            morgan_nbits=morgan_nbits,
            use_maccs=use_maccs,
            use_rdkit_fp=use_rdkit_fp,
            rdkit_fp_nbits=rdkit_fp_nbits,
        )
        if feat is not None:
            features.append(feat)
            valid_mask.append(True)
        else:
            valid_mask.append(False)

    valid_mask = np.array(valid_mask)
    X = np.array(features, dtype=np.float32)
    n_bad = (~valid_mask).sum()
    if n_bad:
        print(f"[Features] Dropped {n_bad} invalid SMILES ({n_bad/len(df)*100:.1f}%)")
    return X, valid_mask
