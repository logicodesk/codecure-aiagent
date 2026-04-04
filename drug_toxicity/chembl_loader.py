# ============================================================
# chembl_loader.py — Load, merge, and clean ChEMBL compound data
# ============================================================
# Source: ChEMBL compound export (semicolon-delimited, quoted)
# Files:
#   DOWNLOAD-..._eq_.csv       (part 1 — ~1.79M rows, has header)
#   DOWNLOAD-..._eq__part2.csv (part 2 — ~1.09M rows, no header)
#
# Columns used:
#   ChEMBL ID, Smiles, Molecular Weight, AlogP, Polar Surface Area,
#   HBA, HBD, #RO5 Violations, #Rotatable Bonds, QED Weighted,
#   Aromatic Rings, Heavy Atoms, Np Likeness Score,
#   Max Phase, Targets, Bioactivities, Withdrawn Flag,
#   Molecular Formula, Type
#
# Output: cleaned DataFrame with canonical SMILES + ChEMBL features
# ============================================================

import os
import pandas as pd
import numpy as np

# ── Column mapping: ChEMBL name → our internal name ──────────
COL_MAP = {
    'ChEMBL ID':          'chembl_id',
    'Smiles':             'smiles',
    'Molecular Weight':   'chembl_mw',
    'AlogP':              'chembl_alogp',
    'Polar Surface Area': 'chembl_psa',
    'HBA':                'chembl_hba',
    'HBD':                'chembl_hbd',
    '#RO5 Violations':    'chembl_ro5_viol',
    '#Rotatable Bonds':   'chembl_rotbonds',
    'QED Weighted':       'chembl_qed',
    'Aromatic Rings':     'chembl_arom_rings',
    'Heavy Atoms':        'chembl_heavy_atoms',
    'Np Likeness Score':  'chembl_np_score',
    'Max Phase':          'chembl_max_phase',
    'Targets':            'chembl_targets',
    'Bioactivities':      'chembl_bioactivities',
    'Withdrawn Flag':     'chembl_withdrawn',
    'Molecular Formula':  'chembl_formula',
    'Type':               'chembl_type',
}

# Numeric columns to coerce
NUMERIC_COLS = [
    'chembl_mw', 'chembl_alogp', 'chembl_psa',
    'chembl_hba', 'chembl_hbd', 'chembl_ro5_viol',
    'chembl_rotbonds', 'chembl_qed', 'chembl_arom_rings',
    'chembl_heavy_atoms', 'chembl_np_score',
    'chembl_max_phase', 'chembl_targets', 'chembl_bioactivities',
]

# Columns to keep in the final lookup table
KEEP_COLS = ['smiles'] + list(COL_MAP.values())[2:]  # skip chembl_id


def _read_part(path: str, has_header: bool, col_names: list) -> pd.DataFrame:
    """Read one ChEMBL CSV part."""
    if has_header:
        df = pd.read_csv(
            path, sep=';', quotechar='"',
            on_bad_lines='skip', low_memory=False,
            usecols=lambda c: c in COL_MAP,
        )
    else:
        # Part 2 has no header — assign names from part 1
        df = pd.read_csv(
            path, sep=';', quotechar='"',
            on_bad_lines='skip', low_memory=False,
            header=None, names=col_names,
            usecols=lambda c: c in COL_MAP,
        )
    return df


def load_chembl(part1_path: str, part2_path: str,
                cache_path: str = None,
                smiles_only: bool = True,
                max_rows: int = None) -> pd.DataFrame:
    """
    Load and merge both ChEMBL parts into a clean lookup DataFrame.

    Parameters
    ----------
    part1_path  : path to the file with the header row
    part2_path  : path to the continuation file (no header)
    cache_path  : if given, save/load processed parquet cache
    smiles_only : drop rows with missing SMILES
    max_rows    : cap total rows (None = all; use e.g. 500_000 for speed)

    Returns
    -------
    DataFrame with columns: smiles + all chembl_* feature columns
    """
    # ── Load from cache if available ─────────────────────────
    if cache_path and os.path.exists(cache_path):
        print(f"[ChEMBL] Loading from cache: {cache_path}")
        return pd.read_parquet(cache_path)

    print("[ChEMBL] Reading part 1 ...")
    df1 = pd.read_csv(
        part1_path, sep=';', quotechar='"',
        on_bad_lines='skip', low_memory=False,
    )
    part1_cols = list(df1.columns)   # save for part2 header assignment
    print(f"[ChEMBL] Part 1: {len(df1):,} rows, {len(df1.columns)} cols")

    print("[ChEMBL] Reading part 2 ...")
    df2 = pd.read_csv(
        part2_path, sep=';', quotechar='"',
        on_bad_lines='skip', low_memory=False,
        header=None, names=part1_cols,
    )
    print(f"[ChEMBL] Part 2: {len(df2):,} rows")

    # ── Merge ─────────────────────────────────────────────────
    df = pd.concat([df1, df2], ignore_index=True)
    print(f"[ChEMBL] Combined: {len(df):,} rows")

    # ── Keep only useful columns ──────────────────────────────
    keep_raw = [c for c in COL_MAP if c in df.columns]
    df = df[keep_raw].rename(columns=COL_MAP)

    # ── Filter: small molecules with SMILES only ──────────────
    if smiles_only:
        df = df.dropna(subset=['smiles'])
        df = df[df['smiles'].str.strip() != '']

    # Filter to small molecules only (exclude proteins, antibodies, etc.)
    if 'chembl_type' in df.columns:
        df = df[df['chembl_type'].isin(['Small molecule', 'Unknown', ''])]

    # ── Coerce numerics ───────────────────────────────────────
    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # ── Derived features ──────────────────────────────────────
    # Lipinski pass flag (from ChEMBL pre-computed violations)
    if 'chembl_ro5_viol' in df.columns:
        df['chembl_lipinski_pass'] = (df['chembl_ro5_viol'] == 0).astype(int)

    # Drug phase category: approved (4), clinical (1-3), preclinical (-1/NaN)
    if 'chembl_max_phase' in df.columns:
        df['chembl_approved'] = (df['chembl_max_phase'] == 4).astype(int)
        df['chembl_clinical']  = (df['chembl_max_phase'].between(1, 3)).astype(int)

    # Withdrawn flag as int
    if 'chembl_withdrawn' in df.columns:
        df['chembl_withdrawn'] = df['chembl_withdrawn'].astype(int)

    # ── Cap rows ──────────────────────────────────────────────
    if max_rows and len(df) > max_rows:
        df = df.sample(max_rows, random_state=42).reset_index(drop=True)
        print(f"[ChEMBL] Capped to {max_rows:,} rows")

    # ── Deduplicate by SMILES ─────────────────────────────────
    before = len(df)
    df = df.drop_duplicates(subset=['smiles'])
    print(f"[ChEMBL] After dedup: {len(df):,} rows (removed {before-len(df):,} dupes)")

    # ── Save cache ────────────────────────────────────────────
    if cache_path:
        df.to_parquet(cache_path, index=False)
        print(f"[ChEMBL] Cache saved → {cache_path}")

    return df


def get_chembl_feature_names() -> list:
    """
    Names of ChEMBL-derived numeric columns that can be appended
    to the RDKit feature matrix.
    """
    return [
        'chembl_alogp',        # ChEMBL AlogP (cross-validates RDKit LogP)
        'chembl_psa',          # ChEMBL polar surface area
        'chembl_hba',          # H-bond acceptors (ChEMBL)
        'chembl_hbd',          # H-bond donors (ChEMBL)
        'chembl_ro5_viol',     # Lipinski violations count
        'chembl_rotbonds',     # rotatable bonds
        'chembl_qed',          # QED drug-likeness
        'chembl_arom_rings',   # aromatic ring count
        'chembl_heavy_atoms',  # heavy atom count
        'chembl_np_score',     # natural product likeness score
        'chembl_targets',      # number of known targets
        'chembl_bioactivities',# number of bioactivity records
        'chembl_lipinski_pass',# 1 = passes all Ro5
        'chembl_approved',     # 1 = FDA approved (Phase 4)
        'chembl_clinical',     # 1 = in clinical trials
        'chembl_withdrawn',    # 1 = withdrawn from market
    ]


def build_chembl_lookup(part1_path: str, part2_path: str,
                        cache_path: str = None) -> dict:
    """
    Build a SMILES → {feature_dict} lookup for fast per-molecule enrichment.
    Returns a dict keyed by canonical SMILES string.
    """
    df = load_chembl(part1_path, part2_path, cache_path=cache_path)
    feat_cols = get_chembl_feature_names()
    available = [c for c in feat_cols if c in df.columns]

    lookup = {}
    for _, row in df[['smiles'] + available].iterrows():
        smi = str(row['smiles']).strip()
        if smi:
            lookup[smi] = {c: row[c] for c in available}

    print(f"[ChEMBL] Lookup built: {len(lookup):,} entries")
    return lookup
