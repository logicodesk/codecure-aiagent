# ============================================================
# preprocessing.py — load, enrich, clean, featurize, select, split
# ============================================================

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.feature_selection import VarianceThreshold

from features import build_feature_matrix, get_feature_names, N_SCALAR_FEATURES
from config import (
    SMILES_COL, LABEL_COL, TOX21_TARGETS,
    TEST_SIZE, RANDOM_STATE, USE_SMOTE,
    USE_MORGAN_FP, MORGAN_RADIUS, MORGAN_NBITS, USE_MACCS,
    USE_RDKIT_FP, RDKIT_FP_NBITS,
    OUTLIER_IQR_FACTOR, VARIANCE_THRESHOLD, CORRELATION_THRESHOLD,
    USE_SCAFFOLD_SPLIT, USE_PUBCHEM_ENRICHMENT, PUBCHEM_CACHE_PATH,
    USE_CHEMBL_ENRICHMENT, CHEMBL_PART1, CHEMBL_PART2, CHEMBL_CACHE,
    USE_TDC, TDC_ENDPOINTS_USE, TDC_SPLIT_METHOD,
    USE_TOXRIC, TOXRIC_PATHS,
    AUGMENT_DRUG_LIKENESS, FLAG_HIGH_RISK,
)


# ── 1. Missing value imputation ───────────────────────────────

def _impute_features(X: np.ndarray) -> np.ndarray:
    """Replace NaN / Inf with column median."""
    col_medians = np.nanmedian(X, axis=0)
    bad = ~np.isfinite(X)
    X[bad] = np.take(col_medians, np.where(bad)[1])
    return X


# ── 2. Outlier removal (IQR, scalar features only) ───────────

def _remove_outliers(X: np.ndarray, y: np.ndarray,
                     smiles: np.ndarray = None) -> tuple:
    """Remove rows where any scalar feature is an extreme outlier."""
    if OUTLIER_IQR_FACTOR is None:
        return (X, y, smiles) if smiles is not None else (X, y)

    k    = OUTLIER_IQR_FACTOR
    phys = X[:, :N_SCALAR_FEATURES]
    Q1   = np.percentile(phys, 25, axis=0)
    Q3   = np.percentile(phys, 75, axis=0)
    IQR  = Q3 - Q1
    lo, hi = Q1 - k * IQR, Q3 + k * IQR
    mask = np.all((phys >= lo) & (phys <= hi), axis=1)
    removed = (~mask).sum()
    if removed:
        print(f"[Outliers] Removed {removed} rows ({removed/len(X)*100:.1f}%)")

    if smiles is not None:
        return X[mask], y[mask], smiles[mask]
    return X[mask], y[mask]


# ── 3. Feature selection ──────────────────────────────────────

def _select_features(X_train: np.ndarray, X_test: np.ndarray,
                     feat_names: list) -> tuple:
    """
    Two-step selection (fit on train only — no leakage):
      a) Drop near-zero-variance features
      b) Drop one of each highly-correlated scalar pair
    """
    indices = list(range(X_train.shape[1]))
    # a) Variance threshold
    vt = VarianceThreshold(threshold=VARIANCE_THRESHOLD)
    X_train = vt.fit_transform(X_train)
    X_test  = vt.transform(X_test)
    
    support = vt.get_support()
    feat_names = [f for f, keep in zip(feat_names, support) if keep]
    indices    = [i for i, keep in zip(indices, support) if keep]
    print(f"[FeatSel] After variance filter: {X_train.shape[1]} features")

    # b) Correlation filter on scalar features only
    n_scalar = min(N_SCALAR_FEATURES, X_train.shape[1])
    corr     = np.corrcoef(X_train[:, :n_scalar].T)
    drop_idx = set()
    for i in range(n_scalar):
        for j in range(i + 1, n_scalar):
            if abs(corr[i, j]) > CORRELATION_THRESHOLD and j not in drop_idx:
                drop_idx.add(j)
    if drop_idx:
        keep       = [i for i in range(X_train.shape[1]) if i not in drop_idx]
        X_train    = X_train[:, keep]
        X_test     = X_test[:, keep]
        feat_names = [feat_names[i] for i in keep]
        indices    = [indices[i] for i in keep]
        print(f"[FeatSel] After correlation filter: {X_train.shape[1]} features "
              f"(dropped {len(drop_idx)} correlated)")

    return X_train, X_test, feat_names, indices


# ── 4. SMOTE oversampling ─────────────────────────────────────

def _apply_smote(X: np.ndarray, y: np.ndarray, label: str) -> tuple:
    """Oversample minority class with SMOTE (training set only)."""
    try:
        from imblearn.over_sampling import SMOTE
        sm = SMOTE(random_state=RANDOM_STATE, k_neighbors=5)
        X_r, y_r = sm.fit_resample(X, y)
        print(f"[SMOTE:{label}] {y.sum()} → {y_r.sum()} toxic samples")
        return X_r, y_r
    except Exception as e:
        print(f"[SMOTE] Skipped ({e})")
        return X, y


# ── 5. Scaffold-based split ───────────────────────────────────

def scaffold_split(smiles_list: list,
                   test_size: float = TEST_SIZE,
                   random_state: int = RANDOM_STATE) -> tuple:
    """
    Bemis-Murcko scaffold split — prevents leakage from similar structures.
    Returns (train_indices, test_indices).
    """
    try:
        from rdkit.Chem.Scaffolds import MurckoScaffold
        from rdkit import Chem
    except ImportError:
        print("[ScaffoldSplit] RDKit unavailable — falling back to random split")
        idx = np.arange(len(smiles_list))
        np.random.seed(random_state)
        np.random.shuffle(idx)
        cut = int(len(idx) * (1 - test_size))
        return idx[:cut].tolist(), idx[cut:].tolist()

    scaffold_map = {}
    for i, smi in enumerate(smiles_list):
        mol = Chem.MolFromSmiles(smi)
        if mol is None:
            scaffold = "__invalid__"
        else:
            try:
                scaffold = MurckoScaffold.MurckoScaffoldSmiles(
                    mol=mol, includeChirality=False)
            except Exception:
                scaffold = "__invalid__"
        scaffold_map.setdefault(scaffold, []).append(i)

    groups = sorted(scaffold_map.values(), key=len, reverse=True)
    n_test_target = int(len(smiles_list) * test_size)
    train_idx, test_idx = [], []
    rng = np.random.default_rng(random_state)
    order = list(range(len(groups)))
    rng.shuffle(order)

    for gi in order:
        g = groups[gi]
        if len(test_idx) < n_test_target:
            test_idx.extend(g)
        else:
            train_idx.extend(g)

    print(f"[ScaffoldSplit] Train: {len(train_idx)} | Test: {len(test_idx)} | "
          f"Unique scaffolds: {len(groups)}")
    return train_idx, test_idx


# ── 6. ChEMBL enrichment ──────────────────────────────────────

def _enrich_with_chembl(df: pd.DataFrame) -> pd.DataFrame:
    """
    Merge ChEMBL pre-computed descriptors into the Tox21 DataFrame.
    Adds columns: chembl_alogp, chembl_qed, chembl_np_score,
                  chembl_targets, chembl_bioactivities,
                  chembl_lipinski_pass, chembl_approved,
                  chembl_clinical, chembl_withdrawn, etc.

    Only compounds whose SMILES appear in ChEMBL get enriched values;
    the rest get NaN (imputed later with column median).
    """
    from chembl_loader import load_chembl, get_chembl_feature_names

    print("[ChEMBL] Loading compound data for enrichment...")
    chembl_df = load_chembl(
        CHEMBL_PART1, CHEMBL_PART2,
        cache_path=CHEMBL_CACHE,
    )

    feat_cols = get_chembl_feature_names()
    available = [c for c in feat_cols if c in chembl_df.columns]

    # Merge on SMILES (left join — keep all Tox21 rows)
    merged = df.merge(
        chembl_df[['smiles'] + available],
        left_on=SMILES_COL, right_on='smiles',
        how='left',
    )
    # Drop duplicate smiles column from right side if present
    if 'smiles_y' in merged.columns:
        merged = merged.drop(columns=['smiles_y'])
        merged = merged.rename(columns={'smiles_x': SMILES_COL})

    n_matched = merged[available[0]].notna().sum() if available else 0
    print(f"[ChEMBL] Matched {n_matched}/{len(merged)} Tox21 compounds in ChEMBL")
    return merged


# ── Single-target pipeline ────────────────────────────────────

def augment_with_zinc_statistics(zinc_path, feat_names):
    """Use ZINC250k to build population-level feature distributions for LogP, QED, and TPSA."""
    zinc_df = pd.read_csv(zinc_path)
    # Compute RDKit features on ZINC250k
    from rdkit import Chem
    from rdkit.Chem import Descriptors, QED
    from rdkit.Chem.rdMolDescriptors import CalcTPSA
    
    logp_vals = []
    qed_vals = []
    tpsa_vals = [] # Substituting SAS with TPSA 
    
    for smi in zinc_df["smiles"].dropna().head(5000): # Cap to 5000 for speed
        mol = Chem.MolFromSmiles(smi)
        if mol:
            logp_vals.append(Descriptors.MolLogP(mol))
            qed_vals.append(QED.qed(mol))
            tpsa_vals.append(CalcTPSA(mol))
            
    stats = {}
    if logp_vals:
        stats["LogP"] = (np.mean(logp_vals), np.std(logp_vals) + 1e-8)
        stats["QED"] = (np.mean(qed_vals), np.std(qed_vals) + 1e-8)
        stats["TPSA"] = (np.mean(tpsa_vals), np.std(tpsa_vals) + 1e-8)
        
    return stats

def load_single_target(data_path: str):
    """
    Full preprocessing pipeline for one Tox21 target (LABEL_COL).

    Steps:
      1. Load CSV
      2. Optional ChEMBL enrichment (adds 16 extra features)
      3. Optional PubChem enrichment
      4. Featurize (74 scalar + MACCS 167 + Morgan 1024 + RDKit 512)
      5. Impute NaN/Inf
      6. Outlier removal
      7. Scale (StandardScaler)
      8. Train/test split (scaffold or stratified random)
      9. Feature selection (variance + correlation)
     10. SMOTE on training set

    Returns: X_train, X_test, y_train, y_test, scaler, feature_names
    """
    df = pd.read_csv(data_path)
    print(f"[Preprocess] Loaded {len(df)} rows | target: '{LABEL_COL}'")

    df = df.dropna(subset=[SMILES_COL, LABEL_COL])
    df[LABEL_COL] = df[LABEL_COL].astype(int)
    counts = df[LABEL_COL].value_counts()
    print(f"[Preprocess] Toxic: {counts.get(1,0)}  Non-toxic: {counts.get(0,0)}  "
          f"Ratio: {counts.get(0,0)/max(counts.get(1,1),1):.1f}:1")

    # ── TDC + TOXRIC augmentation ─────────────────────────────
    try:
        from data_sources import merge_sources, augment_drug_likeness, flag_high_risk, dataset_summary
        df = merge_sources(
            tox21_path=data_path,
            use_tdc=USE_TDC,
            use_toxric=USE_TOXRIC,
            toxric_paths=TOXRIC_PATHS if USE_TOXRIC else None,
            tdc_endpoints=TDC_ENDPOINTS_USE,
            dedup=True,
        )
        # Re-filter for valid label
        df = df.dropna(subset=[SMILES_COL, LABEL_COL])
        df[LABEL_COL] = df[LABEL_COL].astype(int)

        # Drug-likeness augmentation (adds dl_* columns)
        if AUGMENT_DRUG_LIKENESS:
            df = augment_drug_likeness(df, smiles_col=SMILES_COL)

        # High-Risk Structural Failure flagging
        if FLAG_HIGH_RISK:
            df = flag_high_risk(df, label_col=LABEL_COL, smiles_col=SMILES_COL)

        dataset_summary(df, label_col=LABEL_COL)
    except Exception as e:
        print(f"[DataSources] Augmentation failed ({e}) — using local Tox21 only")

    counts = df[LABEL_COL].value_counts()
    print(f"[Preprocess] Final — Toxic: {counts.get(1,0)}  Non-toxic: {counts.get(0,0)}")

    # Optional enrichments
    if USE_CHEMBL_ENRICHMENT:
        try:
            df = _enrich_with_chembl(df)
        except Exception as e:
            print(f"[ChEMBL] Enrichment failed ({e}) — continuing without it")

    if USE_PUBCHEM_ENRICHMENT:
        try:
            from pubchem_enrichment import enrich_dataframe
            df = enrich_dataframe(df, smiles_col=SMILES_COL,
                                  cache_path=PUBCHEM_CACHE_PATH)
        except Exception as e:
            print(f"[PubChem] Enrichment failed ({e}) — continuing without it")

    # Featurize
    X, mask = build_feature_matrix(
        df, smiles_col=SMILES_COL,
        use_morgan=USE_MORGAN_FP, morgan_radius=MORGAN_RADIUS,
        morgan_nbits=MORGAN_NBITS, use_maccs=USE_MACCS,
        use_rdkit_fp=USE_RDKIT_FP, rdkit_fp_nbits=RDKIT_FP_NBITS,
    )
    y          = df[LABEL_COL].values[mask]
    smiles_arr = df[SMILES_COL].values[mask]
    feat_names = get_feature_names(
        use_morgan=USE_MORGAN_FP, morgan_nbits=MORGAN_NBITS,
        use_maccs=USE_MACCS, use_rdkit_fp=USE_RDKIT_FP,
        rdkit_fp_nbits=RDKIT_FP_NBITS,
    )

    # Append ChEMBL scalar features if enrichment was done
    if USE_CHEMBL_ENRICHMENT:
        try:
            from chembl_loader import get_chembl_feature_names
            chembl_cols = get_chembl_feature_names()
            available   = [c for c in chembl_cols if c in df.columns]
            if available:
                chembl_X = df[available].values[mask].astype(np.float32)
                X = np.hstack([X, chembl_X])
                feat_names = feat_names + available
                print(f"[ChEMBL] Appended {len(available)} ChEMBL features")
        except Exception as e:
            print(f"[ChEMBL] Feature append failed ({e})")

    # Impute
    X = _impute_features(X)
    print(f"[Preprocess] Feature matrix: {X.shape}")

    # Outlier removal
    X, y, smiles_arr = _remove_outliers(X, y, smiles=smiles_arr)

    # Scale
    scaler = StandardScaler()
    scaler.fit(X)
    X_sc = scaler.transform(X)
    
    try:
        from config import ZINC_DATA_PATH
        if os.path.exists(ZINC_DATA_PATH):
            print(f"[ZINC] Normalizing LogP, QED, TPSA against population statistics from ZINC250k")
            zinc_stats = augment_with_zinc_statistics(ZINC_DATA_PATH, feat_names)
            for feat_name, (z_mean, z_std) in zinc_stats.items():
                if feat_name in feat_names:
                    idx = feat_names.index(feat_name)
                    scaler.mean_[idx] = z_mean
                    scaler.scale_[idx] = z_std
                    # Re-scale that specific column based on ZINC distribution
                    X_sc[:, idx] = (X[:, idx] - z_mean) / z_std
    except Exception as e:
        print(f"[ZINC] Augmentation skipped: {e}")

    # Split
    if USE_SCAFFOLD_SPLIT:
        train_idx, test_idx = scaffold_split(smiles_arr.tolist())
        X_tr, X_te = X_sc[train_idx], X_sc[test_idx]
        y_tr, y_te = y[train_idx],    y[test_idx]
    else:
        X_tr, X_te, y_tr, y_te = train_test_split(
            X_sc, y, test_size=TEST_SIZE,
            random_state=RANDOM_STATE, stratify=y)

    # Feature selection
    X_tr, X_te, feat_names, kept_indices = _select_features(X_tr, X_te, feat_names)

    # SMOTE
    if USE_SMOTE:
        X_tr, y_tr = _apply_smote(X_tr, y_tr, LABEL_COL)

    print(f"[Preprocess] Train: {len(X_tr)} | Test: {len(X_te)} | "
          f"Features: {X_tr.shape[1]}")
    return X_tr, X_te, y_tr, y_te, scaler, feat_names, kept_indices


# ── Multi-target pipeline ─────────────────────────────────────

def load_multi_target(data_path: str):
    """
    Featurize once, return per-target splits for all Tox21 targets
    with ≥50 positives.
    """
    df = pd.read_csv(data_path)
    print(f"[MultiTarget] Loaded {len(df)} rows")

    X_all, mask = build_feature_matrix(
        df, smiles_col=SMILES_COL,
        use_morgan=USE_MORGAN_FP, morgan_radius=MORGAN_RADIUS,
        morgan_nbits=MORGAN_NBITS, use_maccs=USE_MACCS,
        use_rdkit_fp=USE_RDKIT_FP, rdkit_fp_nbits=RDKIT_FP_NBITS,
    )
    X_all      = _impute_features(X_all)
    feat_names = get_feature_names(
        use_morgan=USE_MORGAN_FP, morgan_nbits=MORGAN_NBITS,
        use_maccs=USE_MACCS, use_rdkit_fp=USE_RDKIT_FP,
        rdkit_fp_nbits=RDKIT_FP_NBITS,
    )

    scaler   = StandardScaler()
    X_sc     = scaler.fit_transform(X_all)
    df_valid = df[mask].reset_index(drop=True)

    target_data = {}
    for tgt in TOX21_TARGETS:
        if tgt not in df_valid.columns:
            continue
        sub = df_valid[tgt].dropna()
        idx = sub.index
        y   = sub.astype(int).values
        if y.sum() < 50:
            print(f"[MultiTarget] Skipping {tgt} — only {y.sum()} positives")
            continue

        X_t = X_sc[idx]
        if USE_SCAFFOLD_SPLIT:
            sub_smiles = df_valid[SMILES_COL].iloc[idx].tolist()
            tr_idx_sub, te_idx_sub = scaffold_split(sub_smiles)
            X_tr, X_te = X_t[tr_idx_sub], X_t[te_idx_sub]
            y_tr, y_te = y[tr_idx_sub],    y[te_idx_sub]
        else:
            X_tr, X_te, y_tr, y_te = train_test_split(
                X_t, y, test_size=TEST_SIZE,
                random_state=RANDOM_STATE, stratify=y)

        if USE_SMOTE:
            X_tr, y_tr = _apply_smote(X_tr, y_tr, tgt)

        target_data[tgt] = (X_tr, X_te, y_tr, y_te)
        print(f"[MultiTarget] {tgt:20s} train={len(X_tr):5d}  "
              f"test={len(X_te):4d}  pos={y_te.sum():3d}")

    return target_data, scaler, feat_names
