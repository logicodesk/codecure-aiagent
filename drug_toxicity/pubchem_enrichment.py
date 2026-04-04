# ============================================================
# pubchem_enrichment.py — Fetch extra compound data from PubChem
# ============================================================
# Adds per-compound properties from PubChem REST API:
#   XLogP, TPSA, HeavyAtomCount, Complexity, Charge,
#   IsotopeAtomCount, CID, IUPACName
#
# Results are cached to a CSV so the network is only hit once.
# ============================================================

import os
import time
import requests
import pandas as pd
import numpy as np
from typing import Optional

PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"

# Properties to fetch (PubChem property names)
PUBCHEM_PROPS = [
    "XLogP",
    "TPSA",
    "HeavyAtomCount",
    "Complexity",
    "Charge",
    "IsotopeAtomCount",
    "IUPACName",
    "MolecularFormula",
]

# Columns added to the dataset after enrichment
ENRICHED_COLS = [
    "pc_XLogP",
    "pc_TPSA",
    "pc_HeavyAtomCount",
    "pc_Complexity",
    "pc_Charge",
    "pc_IsotopeAtomCount",
]


def _fetch_cid(smiles: str, timeout: int = 8) -> Optional[int]:
    """Resolve SMILES → PubChem CID."""
    try:
        url = f"{PUBCHEM_BASE}/compound/smiles/{requests.utils.quote(smiles)}/cids/JSON"
        r = requests.get(url, timeout=timeout)
        if r.status_code == 200:
            data = r.json()
            cids = data.get("IdentifierList", {}).get("CID", [])
            return int(cids[0]) if cids else None
    except Exception:
        pass
    return None


def _fetch_properties(cid: int, timeout: int = 8) -> dict:
    """Fetch property dict for a given CID."""
    props_str = ",".join(PUBCHEM_PROPS)
    try:
        url = f"{PUBCHEM_BASE}/compound/cid/{cid}/property/{props_str}/JSON"
        r = requests.get(url, timeout=timeout)
        if r.status_code == 200:
            props = r.json().get("PropertyTable", {}).get("Properties", [{}])[0]
            return props
    except Exception:
        pass
    return {}


def enrich_dataframe(df: pd.DataFrame,
                     smiles_col: str = "smiles",
                     cache_path: Optional[str] = None,
                     delay: float = 0.25,
                     max_compounds: int = 2000) -> pd.DataFrame:
    """
    Enrich a DataFrame with PubChem properties.

    For each unique SMILES (up to max_compounds):
      1. Resolve to CID
      2. Fetch properties
      3. Merge back into df

    Results are cached at cache_path (CSV) to avoid re-fetching.

    Parameters
    ----------
    df           : input DataFrame with a SMILES column
    smiles_col   : name of the SMILES column
    cache_path   : path to cache CSV (None = no caching)
    delay        : seconds between API calls (be polite to PubChem)
    max_compounds: cap on how many unique SMILES to query

    Returns
    -------
    df with extra columns: pc_XLogP, pc_TPSA, pc_HeavyAtomCount,
                           pc_Complexity, pc_Charge, pc_IsotopeAtomCount
    """
    # Load cache if available
    cache = {}
    if cache_path and os.path.exists(cache_path):
        cached_df = pd.read_csv(cache_path)
        for _, row in cached_df.iterrows():
            cache[row["smiles"]] = row.to_dict()
        print(f"[PubChem] Loaded {len(cache)} cached entries from {cache_path}")

    unique_smiles = df[smiles_col].dropna().unique()[:max_compounds]
    to_fetch = [s for s in unique_smiles if s not in cache]

    print(f"[PubChem] {len(unique_smiles)} unique SMILES | "
          f"{len(cache)} cached | {len(to_fetch)} to fetch")

    # Fetch missing entries
    for i, smi in enumerate(to_fetch):
        if i % 50 == 0 and i > 0:
            print(f"[PubChem] Progress: {i}/{len(to_fetch)}")

        cid = _fetch_cid(smi)
        if cid:
            props = _fetch_properties(cid)
            cache[smi] = {
                "smiles":             smi,
                "pc_cid":             cid,
                "pc_XLogP":           props.get("XLogP"),
                "pc_TPSA":            props.get("TPSA"),
                "pc_HeavyAtomCount":  props.get("HeavyAtomCount"),
                "pc_Complexity":      props.get("Complexity"),
                "pc_Charge":          props.get("Charge"),
                "pc_IsotopeAtomCount":props.get("IsotopeAtomCount"),
                "pc_IUPACName":       props.get("IUPACName", ""),
                "pc_Formula":         props.get("MolecularFormula", ""),
            }
        else:
            cache[smi] = {"smiles": smi}

        time.sleep(delay)

    # Save updated cache
    if cache_path:
        pd.DataFrame(list(cache.values())).to_csv(cache_path, index=False)
        print(f"[PubChem] Cache saved → {cache_path}")

    # Build lookup DataFrame and merge
    lookup = pd.DataFrame(list(cache.values()))
    enriched = df.merge(
        lookup[[c for c in lookup.columns if c != smiles_col or c == smiles_col]],
        left_on=smiles_col, right_on="smiles", how="left"
    )

    # Fill numeric enriched cols with median (for missing / not-found)
    for col in ENRICHED_COLS:
        if col in enriched.columns:
            enriched[col] = pd.to_numeric(enriched[col], errors="coerce")
            enriched[col] = enriched[col].fillna(enriched[col].median())

    n_enriched = enriched[ENRICHED_COLS[0]].notna().sum() if ENRICHED_COLS[0] in enriched.columns else 0
    print(f"[PubChem] Enriched {n_enriched}/{len(enriched)} compounds")
    return enriched


def get_enriched_feature_names() -> list:
    """Names of the PubChem-derived numeric columns added to the feature matrix."""
    return ENRICHED_COLS
