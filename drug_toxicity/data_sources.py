# ============================================================
# data_sources.py — TDC + TOXRIC dataset loaders
# ============================================================
# Provides unified loaders for:
#   1. TDC (Therapeutics Data Commons) — Tox21, ClinTox, hERG, AMES, DILI
#   2. TOXRIC — 113k+ compounds, 1474 endpoints, 39 feature types
#
# Both return a standardised DataFrame with columns:
#   smiles, label, source, endpoint
#
# Usage:
#   from data_sources import load_tdc_multi, load_toxric, merge_sources
# ============================================================

import os, warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

_HERE     = os.path.dirname(__file__)
_CACHE    = os.path.join(_HERE, "data_cache")
os.makedirs(_CACHE, exist_ok=True)

# Import config lazily to avoid circular imports
def _get_label_col():
    try:
        from config import LABEL_COL
        return LABEL_COL
    except Exception:
        return "SR-ARE"

# ── TDC endpoint registry ─────────────────────────────────────
# Maps friendly name → (TDC class path, dataset name, label column)
TDC_ENDPOINTS = {
    # Multi-label Tox21 (12 targets)
    "tox21":    ("tdc.single_pred", "Tox21",   "Y"),
    # ClinTox: clinical trial toxicity (2 endpoints)
    "clintox":  ("tdc.single_pred", "ClinTox", "Y"),
    # hERG cardiotoxicity (binary)
    "herg":     ("tdc.single_pred", "hERG",    "Y"),
    # Ames mutagenicity
    "ames":     ("tdc.single_pred", "AMES",    "Y"),
    # Drug-induced liver injury
    "dili":     ("tdc.single_pred", "DILI",    "Y"),
}

# TOXRIC direct download URL (no login required)
TOXRIC_BASE_URL = "https://toxric.bioinforai.tech/download"


# ── 1. TDC loaders ───────────────────────────────────────────

def _tdc_available() -> bool:
    try:
        import tdc  # noqa
        return True
    except ImportError:
        return False


def load_tdc_endpoint(name: str, split: str = "scaffold") -> pd.DataFrame:
    """
    Load a single TDC endpoint.

    Args:
        name:  key from TDC_ENDPOINTS (e.g. 'tox21', 'herg')
        split: 'scaffold' | 'random' | 'cold_drug'

    Returns:
        DataFrame with columns: smiles, label, source, endpoint, split
    """
    if not _tdc_available():
        raise ImportError(
            "PyTDC not installed. Run: pip install PyTDC"
        )

    if name not in TDC_ENDPOINTS:
        raise ValueError(f"Unknown TDC endpoint '{name}'. "
                         f"Available: {list(TDC_ENDPOINTS.keys())}")

    module_path, dataset_name, label_col = TDC_ENDPOINTS[name]
    cache_path = os.path.join(_CACHE, f"tdc_{name}.parquet")

    # Use cached version if available
    if os.path.exists(cache_path):
        print(f"[TDC:{name}] Loading from cache: {cache_path}")
        return pd.read_parquet(cache_path)

    print(f"[TDC:{name}] Downloading {dataset_name} from TDC...")
    try:
        import importlib
        mod = importlib.import_module(module_path)
        DataClass = getattr(mod, dataset_name)
        data = DataClass(name=dataset_name, path=_CACHE)
        split_data = data.get_split(method=split)
    except Exception as e:
        raise RuntimeError(f"TDC download failed for {name}: {e}")

    frames = []
    for split_name, df in split_data.items():
        # TDC returns DataFrames with 'Drug' (SMILES) and 'Y' (label)
        smiles_col = "Drug" if "Drug" in df.columns else "smiles"
        sub = pd.DataFrame({
            "smiles":   df[smiles_col].values,
            "label":    df[label_col].values,
            "source":   f"TDC_{dataset_name}",
            "endpoint": name,
            "split":    split_name,
        })
        frames.append(sub)

    result = pd.concat(frames, ignore_index=True)
    result = result.dropna(subset=["smiles", "label"])
    result["label"] = result["label"].astype(float)

    result.to_parquet(cache_path, index=False)
    print(f"[TDC:{name}] {len(result)} compounds cached → {cache_path}")
    return result


def load_tdc_multi(endpoints: list = None,
                   split: str = "scaffold") -> pd.DataFrame:
    """
    Load multiple TDC endpoints and concatenate.

    Args:
        endpoints: list of endpoint names (default: all 5)
        split:     split strategy

    Returns:
        Combined DataFrame with columns: smiles, label, source, endpoint, split
    """
    if endpoints is None:
        endpoints = list(TDC_ENDPOINTS.keys())

    frames = []
    for ep in endpoints:
        try:
            df = load_tdc_endpoint(ep, split=split)
            frames.append(df)
            print(f"[TDC] Loaded {ep}: {len(df)} rows")
        except Exception as e:
            print(f"[TDC] Skipping {ep}: {e}")

    if not frames:
        raise RuntimeError("No TDC endpoints loaded successfully.")

    combined = pd.concat(frames, ignore_index=True)
    print(f"[TDC] Total: {len(combined)} rows across {len(frames)} endpoints")
    return combined


def load_tdc_as_tox21(split: str = "scaffold") -> pd.DataFrame:
    """
    Load TDC Tox21 in the same format as the local tox21.csv.
    Returns DataFrame with 'smiles' + 12 Tox21 target columns.
    """
    if not _tdc_available():
        raise ImportError("PyTDC not installed. Run: pip install PyTDC")

    cache_path = os.path.join(_CACHE, "tdc_tox21_wide.parquet")
    if os.path.exists(cache_path):
        print(f"[TDC:tox21] Loading wide format from cache")
        return pd.read_parquet(cache_path)

    print("[TDC:tox21] Downloading Tox21 multi-task dataset...")
    try:
        from tdc.multi_pred import Tox21 as TDCTox21
        data = TDCTox21(name="Tox21", path=_CACHE)
        df   = data.get_data()
    except Exception:
        # Fallback: load via single_pred and pivot
        try:
            df = load_tdc_endpoint("tox21", split=split)
            df.to_parquet(cache_path, index=False)
            return df
        except Exception as e:
            raise RuntimeError(f"TDC Tox21 load failed: {e}")

    # Standardise column names
    if "Drug" in df.columns:
        df = df.rename(columns={"Drug": "smiles"})

    df.to_parquet(cache_path, index=False)
    print(f"[TDC:tox21] {len(df)} compounds, columns: {list(df.columns)}")
    return df


# ── 2. TOXRIC loaders ─────────────────────────────────────────

# Known TOXRIC CSV filenames (from their download page)
TOXRIC_DATASETS = {
    # Core toxicity endpoints
    "acute_oral":      "TOXRIC_AcuteOralToxicity.csv",
    "ames":            "TOXRIC_AMES.csv",
    "herg":            "TOXRIC_hERG.csv",
    "dili":            "TOXRIC_DILI.csv",
    "skin_sensitizer": "TOXRIC_SkinSensitizer.csv",
    "eye_irritation":  "TOXRIC_EyeIrritation.csv",
    "carcinogenicity": "TOXRIC_Carcinogenicity.csv",
    "mutagenicity":    "TOXRIC_Mutagenicity.csv",
    # Multi-endpoint
    "tox21":           "TOXRIC_Tox21.csv",
}

def load_toxric_csv(local_path: str,
                    smiles_col: str = "SMILES",
                    label_col: str = None,
                    endpoint_name: str = "toxric") -> pd.DataFrame:
    """
    Load a TOXRIC CSV file (downloaded manually from toxric.bioinforai.tech).

    TOXRIC CSVs have:
      - SMILES column (usually 'SMILES' or 'smiles')
      - One or more label columns (binary 0/1 or continuous LD50)
      - Pre-computed descriptor columns (39 feature types)

    For continuous LD50 columns (log10 mmol/kg):
      - Values < 2.3  (≈ 200 mg/kg)  → toxic = 1   (high acute toxicity)
      - Values >= 2.3                 → toxic = 0

    Args:
        local_path:    path to the downloaded CSV
        smiles_col:    name of the SMILES column
        label_col:     name of the label column (auto-detected if None)
        endpoint_name: name tag for the 'endpoint' column

    Returns:
        DataFrame with: smiles, label, label_raw, source, endpoint + all descriptor cols
    """
    if not os.path.exists(local_path):
        raise FileNotFoundError(
            f"TOXRIC file not found: {local_path}\n"
            f"Download from: https://toxric.bioinforai.tech/download"
        )

    print(f"[TOXRIC] Loading {local_path}...")
    df = pd.read_csv(local_path, low_memory=False)
    print(f"[TOXRIC] Shape: {df.shape} | Columns: {list(df.columns[:10])}...")

    # Normalise SMILES column name — prefer Canonical SMILES if available
    for candidate in ["Canonical SMILES", "SMILES", "smiles", "Smiles",
                       "canonical_smiles"]:
        if candidate in df.columns:
            df = df.rename(columns={candidate: "smiles"})
            break

    if "smiles" not in df.columns:
        raise ValueError(f"No SMILES column found in {local_path}. "
                         f"Columns: {list(df.columns)}")

    # Auto-detect label column if not specified
    if label_col is None:
        # Priority: binary labels first, then continuous LD50
        for candidate in ["label", "Label", "activity", "Activity",
                          "toxic", "Toxic", "Y", "y", "class", "Class",
                          "toxicity", "Toxicity"]:
            if candidate in df.columns:
                label_col = candidate
                break

        # Fallback: detect LD50 / continuous toxicity columns
        if label_col is None:
            for col in df.columns:
                col_lower = col.lower()
                if any(k in col_lower for k in ["ld50", "lc50", "ec50",
                                                  "toxicity", "toxic"]):
                    label_col = col
                    break

    if label_col and label_col in df.columns:
        raw_vals = pd.to_numeric(df[label_col], errors="coerce")
        df["label_raw"] = raw_vals

        # Detect if continuous (LD50-style) or already binary
        unique_vals = raw_vals.dropna().unique()
        is_binary = set(unique_vals).issubset({0, 1, 0.0, 1.0})

        if is_binary:
            df["label"] = raw_vals.astype("Int64")
            print(f"[TOXRIC] Binary label '{label_col}': "
                  f"{(df['label']==1).sum()} toxic, {(df['label']==0).sum()} non-toxic")
        else:
            # Continuous LD50 (log10 mmol/kg) — binarize
            # Threshold: log10(200 mg/kg / avg_mw) ≈ 2.3 for typical drugs
            # Lower LD50 = more toxic → label=1 if LD50 < threshold
            LD50_THRESHOLD = 2.3
            df["label"] = (raw_vals < LD50_THRESHOLD).astype(int)
            n_toxic = (df["label"] == 1).sum()
            n_safe  = (df["label"] == 0).sum()
            print(f"[TOXRIC] Continuous LD50 '{label_col}' binarized at < {LD50_THRESHOLD}: "
                  f"{n_toxic} toxic ({n_toxic/len(df)*100:.1f}%), "
                  f"{n_safe} non-toxic ({n_safe/len(df)*100:.1f}%)")
    else:
        print(f"[TOXRIC] Warning: no label column found. "
              f"Available: {list(df.columns)}")
        df["label"]     = np.nan
        df["label_raw"] = np.nan

    df["source"]   = "TOXRIC"
    df["endpoint"] = endpoint_name
    df = df.dropna(subset=["smiles"])
    print(f"[TOXRIC] {len(df)} valid compounds loaded")
    return df


def load_toxric_descriptors(local_path: str,
                             smiles_col: str = "SMILES") -> pd.DataFrame:
    """
    Load TOXRIC pre-computed descriptors (39 feature types).
    Returns a DataFrame indexed by SMILES with all descriptor columns.

    TOXRIC provides these descriptor categories:
      - Molecular fingerprints (ECFP, MACCS, RDKit, etc.)
      - Physicochemical properties (MW, LogP, TPSA, etc.)
      - Topological indices (Wiener, Zagreb, etc.)
      - Electronic descriptors (Gasteiger charges, etc.)
      - 3D descriptors (if available)
    """
    df = load_toxric_csv(local_path, smiles_col=smiles_col)

    # Identify descriptor columns (numeric, not SMILES/label/metadata)
    exclude = {"smiles", "label", "source", "endpoint", "split",
               "CAS", "cas", "Name", "name", "ID", "id",
               "InChI", "inchi", "InChIKey", "inchikey"}
    desc_cols = [c for c in df.columns
                 if c not in exclude
                 and pd.api.types.is_numeric_dtype(df[c])]

    print(f"[TOXRIC] Found {len(desc_cols)} descriptor columns")
    return df[["smiles"] + desc_cols]


def merge_toxric_descriptors(tox21_df: pd.DataFrame,
                              toxric_desc_df: pd.DataFrame) -> pd.DataFrame:
    """
    Merge TOXRIC pre-computed descriptors into a Tox21 DataFrame.
    Left-join on SMILES — unmatched rows get NaN (imputed later).

    Args:
        tox21_df:       DataFrame with 'smiles' column (Tox21 data)
        toxric_desc_df: DataFrame from load_toxric_descriptors()

    Returns:
        Enriched DataFrame with TOXRIC descriptor columns appended
    """
    desc_cols = [c for c in toxric_desc_df.columns if c != "smiles"]
    merged = tox21_df.merge(
        toxric_desc_df[["smiles"] + desc_cols],
        on="smiles", how="left", suffixes=("", "_toxric")
    )
    n_matched = merged[desc_cols[0]].notna().sum() if desc_cols else 0
    print(f"[TOXRIC] Merged {n_matched}/{len(merged)} compounds with TOXRIC descriptors "
          f"({len(desc_cols)} features added)")
    return merged


# ── 3. Unified merge ──────────────────────────────────────────

def merge_sources(tox21_path: str,
                  use_tdc: bool = True,
                  use_toxric: bool = False,
                  toxric_paths: dict = None,
                  tdc_endpoints: list = None,
                  dedup: bool = True) -> pd.DataFrame:
    """
    Merge Tox21 CSV + TDC datasets + TOXRIC into one unified DataFrame.

    Strategy:
      1. Load local tox21.csv (always)
      2. Optionally load TDC endpoints and append new compounds
      3. Optionally merge TOXRIC pre-computed descriptors
      4. Deduplicate on SMILES (keep first occurrence)

    Args:
        tox21_path:     path to local tox21.csv
        use_tdc:        whether to augment with TDC data
        use_toxric:     whether to merge TOXRIC descriptors
        toxric_paths:   dict of {endpoint_name: csv_path} for TOXRIC files
        tdc_endpoints:  list of TDC endpoint names to load
        dedup:          deduplicate on SMILES

    Returns:
        Unified DataFrame ready for preprocessing
    """
    # 1. Local Tox21
    print(f"[DataSources] Loading local Tox21: {tox21_path}")
    base_df = pd.read_csv(tox21_path)
    base_df["source"] = "Tox21_local"
    print(f"[DataSources] Local Tox21: {len(base_df)} compounds")

    # 2. TDC augmentation
    if use_tdc and _tdc_available():
        try:
            tdc_df = load_tdc_multi(
                endpoints=tdc_endpoints or ["tox21", "herg", "ames", "dili"],
                split="scaffold"
            )
            # Only add compounds not already in base_df
            existing_smiles = set(base_df["smiles"].dropna().str.strip())
            new_rows = tdc_df[~tdc_df["smiles"].str.strip().isin(existing_smiles)]
            print(f"[DataSources] TDC adds {len(new_rows)} new compounds")

            # Align columns — TDC rows won't have Tox21 target columns
            for col in base_df.columns:
                if col not in new_rows.columns:
                    new_rows = new_rows.copy()
                    new_rows[col] = np.nan

            base_df = pd.concat([base_df, new_rows[base_df.columns]],
                                 ignore_index=True)
        except Exception as e:
            print(f"[DataSources] TDC augmentation failed: {e}")
    elif use_tdc and not _tdc_available():
        print("[DataSources] TDC requested but PyTDC not installed. "
              "Run: pip install PyTDC")

    # 3. TOXRIC augmentation
    if use_toxric and toxric_paths:
        for ep_name, csv_path in toxric_paths.items():
            try:
                toxric_df = load_toxric_csv(csv_path, endpoint_name=ep_name)

                # Check if this file has pre-computed descriptors (many numeric cols)
                # or is purely a compound+label file
                non_meta_cols = [c for c in toxric_df.columns
                                 if c not in {"smiles", "label", "label_raw",
                                              "source", "endpoint", "TAID",
                                              "Pubchem CID", "IUPAC Name",
                                              "InChIKey", "SMILES"}
                                 and pd.api.types.is_numeric_dtype(toxric_df[c])]

                if len(non_meta_cols) > 5:
                    # Has pre-computed descriptors → merge as descriptor enrichment
                    base_df = merge_toxric_descriptors(base_df, toxric_df)
                    print(f"[DataSources] TOXRIC '{ep_name}' merged as descriptors")
                else:
                    # Compound+label file → add new compounds to training set
                    toxric_df["source"] = f"TOXRIC_{ep_name}"
                    existing = set(base_df["smiles"].dropna().str.strip())
                    new_rows = toxric_df[
                        ~toxric_df["smiles"].str.strip().isin(existing)
                    ].copy()

                    if len(new_rows) > 0:
                        # Map TOXRIC label to primary Tox21 target column
                        label_col_name = _get_label_col()
                        new_rows[label_col_name] = new_rows["label"]
                        # Align columns
                        for col in base_df.columns:
                            if col not in new_rows.columns:
                                new_rows[col] = np.nan
                        base_df = pd.concat(
                            [base_df, new_rows[base_df.columns]],
                            ignore_index=True
                        )
                        print(f"[DataSources] TOXRIC '{ep_name}' added "
                              f"{len(new_rows)} new compounds")
                    else:
                        print(f"[DataSources] TOXRIC '{ep_name}': "
                              f"all compounds already in dataset")

            except Exception as e:
                print(f"[DataSources] TOXRIC '{ep_name}' failed: {e}")

    # 4. Deduplicate
    if dedup:
        before = len(base_df)
        base_df = base_df.drop_duplicates(subset=["smiles"], keep="first")
        print(f"[DataSources] Dedup: {before} -> {len(base_df)} compounds")

    print(f"[DataSources] Final dataset: {len(base_df)} compounds, "
          f"{len(base_df.columns)} columns")
    return base_df


# ── 4. Drug-Likeness augmentation from ChEMBL/TDC ────────────

def augment_drug_likeness(df: pd.DataFrame,
                          smiles_col: str = "smiles") -> pd.DataFrame:
    """
    Compute extended Lipinski Ro5 + Veber + QED drug-likeness scores
    for every compound in the DataFrame.

    Adds columns:
      dl_mw, dl_logp, dl_hbd, dl_hba, dl_tpsa, dl_rotbonds,
      dl_qed, dl_lipinski_pass, dl_lipinski_score,
      dl_veber_pass, dl_lead_like,
      dl_risk_flag  ← "High-Risk Structural Failure" if toxic + violations

    This augments the ChEMBL enrichment with per-compound computed values
    (not just matched ChEMBL entries).
    """
    try:
        from rdkit import Chem
        from rdkit.Chem import Descriptors, rdMolDescriptors, QED as RDKitQED
    except ImportError:
        print("[DrugLikeness] RDKit not available — skipping augmentation")
        return df

    rows = []
    for smi in df[smiles_col].fillna(""):
        mol = Chem.MolFromSmiles(smi) if smi else None
        if mol is None:
            rows.append({k: np.nan for k in [
                "dl_mw", "dl_logp", "dl_hbd", "dl_hba", "dl_tpsa",
                "dl_rotbonds", "dl_qed", "dl_lipinski_pass",
                "dl_lipinski_score", "dl_veber_pass", "dl_lead_like",
            ]})
            continue

        mw   = Descriptors.MolWt(mol)
        logp = Descriptors.MolLogP(mol)
        hbd  = rdMolDescriptors.CalcNumHBD(mol)
        hba  = rdMolDescriptors.CalcNumHBA(mol)
        tpsa = rdMolDescriptors.CalcTPSA(mol)
        rotb = rdMolDescriptors.CalcNumRotatableBonds(mol)
        try:
            qed = RDKitQED.qed(mol)
        except Exception:
            qed = np.nan

        ro5 = [mw <= 500, logp <= 5, hbd <= 5, hba <= 10]
        lip_score = sum(ro5)
        lip_pass  = int(all(ro5))
        veber     = int(rotb <= 10 and tpsa <= 140)
        lead      = int(mw <= 350 and logp <= 3.5 and hbd <= 3 and hba <= 7)

        rows.append({
            "dl_mw":             round(mw, 3),
            "dl_logp":           round(logp, 3),
            "dl_hbd":            int(hbd),
            "dl_hba":            int(hba),
            "dl_tpsa":           round(tpsa, 2),
            "dl_rotbonds":       int(rotb),
            "dl_qed":            round(qed, 4) if not np.isnan(qed) else np.nan,
            "dl_lipinski_pass":  lip_pass,
            "dl_lipinski_score": lip_score,
            "dl_veber_pass":     veber,
            "dl_lead_like":      lead,
        })

    dl_df = pd.DataFrame(rows, index=df.index)
    result = pd.concat([df, dl_df], axis=1)
    print(f"[DrugLikeness] Added {len(dl_df.columns)} drug-likeness columns")
    return result


# ── 5. High-Risk Structural Failure flagging ─────────────────

def flag_high_risk(df: pd.DataFrame,
                   label_col: str = "SR-ARE",
                   smiles_col: str = "smiles") -> pd.DataFrame:
    """
    Add a 'risk_flag' column to the DataFrame:
      'HIGH_RISK_STRUCTURAL_FAILURE' — toxic + Lipinski violations + structural alerts
      'HIGH_RISK'                    — toxic + violations OR alerts
      'MODERATE_RISK'                — toxic only
      'LOW_RISK'                     — non-toxic with alerts
      'SAFE'                         — non-toxic, drug-like, no alerts

    Requires dl_lipinski_pass column (from augment_drug_likeness).
    """
    try:
        from rdkit import Chem
        from features import _COMPILED_ALERTS
    except ImportError:
        print("[RiskFlag] RDKit not available — skipping")
        return df

    HIGH_SEVERITY = {
        "nitro", "aldehyde", "epoxide", "michael_acc", "quinone",
        "amine_arom", "aniline", "peroxide", "acyl_halide",
        "isocyanate", "hydrazine", "diazo",
    }

    flags = []
    for _, row in df.iterrows():
        smi   = row.get(smiles_col, "")
        label = row.get(label_col, np.nan)
        lip   = row.get("dl_lipinski_pass", 1)
        lip_s = row.get("dl_lipinski_score", 4)

        toxic    = (label == 1) if not pd.isna(label) else False
        viol     = int(lip == 0)
        high_cnt = 0

        mol = Chem.MolFromSmiles(str(smi)) if smi else None
        if mol:
            for name, patt in _COMPILED_ALERTS:
                if patt and name in HIGH_SEVERITY:
                    if mol.HasSubstructMatch(patt):
                        high_cnt += 1

        if toxic and viol and high_cnt > 0:
            flags.append("HIGH_RISK_STRUCTURAL_FAILURE")
        elif toxic and (viol or high_cnt > 0):
            flags.append("HIGH_RISK")
        elif toxic:
            flags.append("MODERATE_RISK")
        elif high_cnt > 0:
            flags.append("LOW_RISK")
        else:
            flags.append("SAFE")

    df = df.copy()
    df["risk_flag"] = flags
    counts = pd.Series(flags).value_counts()
    print("[RiskFlag] Distribution:")
    for tier, cnt in counts.items():
        print(f"  {tier:<35} {cnt:>6} ({cnt/len(flags)*100:.1f}%)")
    return df


# ── 6. Summary stats ──────────────────────────────────────────

def dataset_summary(df: pd.DataFrame,
                    label_col: str = "label",
                    source_col: str = "source") -> None:
    """Print a summary of the merged dataset."""
    print("\n" + "="*60)
    print("  DATASET SUMMARY")
    print("="*60)
    print(f"  Total compounds : {len(df):,}")
    print(f"  Columns         : {len(df.columns)}")

    if source_col in df.columns:
        print(f"\n  By source:")
        for src, cnt in df[source_col].value_counts().items():
            print(f"    {src:<30} {cnt:>7,}")

    if label_col in df.columns:
        valid = df[label_col].dropna()
        pos   = (valid == 1).sum()
        neg   = (valid == 0).sum()
        print(f"\n  Label distribution ({label_col}):")
        print(f"    Positive (toxic)    : {pos:>7,} ({pos/len(valid)*100:.1f}%)")
        print(f"    Negative (non-toxic): {neg:>7,} ({neg/len(valid)*100:.1f}%)")
        print(f"    Missing             : {df[label_col].isna().sum():>7,}")

    if "risk_flag" in df.columns:
        print(f"\n  Risk tier distribution:")
        for tier, cnt in df["risk_flag"].value_counts().items():
            print(f"    {tier:<35} {cnt:>6,}")

    print("="*60 + "\n")
