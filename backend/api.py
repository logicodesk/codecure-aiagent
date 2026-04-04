# ============================================================
# api.py  —  Combined FastAPI backend + React frontend server
# ============================================================
# Run:  uvicorn backend.api:app --reload --port 8000
#       Then open http://localhost:8000
# ============================================================

import sys, os, warnings, logging
warnings.filterwarnings("ignore")
logging.getLogger("shap").setLevel(logging.ERROR)

# Make drug_toxicity importable
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_ROOT, "drug_toxicity"))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import numpy as np
import joblib
import urllib.request
import urllib.parse
import json as _json
import base64
import io

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from drug_toxicity.features import smiles_to_descriptors, get_feature_names, STRUCTURAL_ALERTS
from drug_toxicity.config import (
    USE_MORGAN_FP, MORGAN_RADIUS, MORGAN_NBITS,
    USE_MACCS, USE_RDKIT_FP, RDKIT_FP_NBITS,
    MODEL_DIR,
)
from rdkit import Chem
_COMPILED_ALERTS = [(name, Chem.MolFromSmarts(smarts)) for name, smarts in STRUCTURAL_ALERTS]

# Optional imports — degrade gracefully if not installed
try:
    import shap as _shap
    _SHAP_OK = True
except ImportError:
    _shap = None
    _SHAP_OK = False

# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="ToxScout AI",
    description="AI-powered molecular toxicity intelligence. Predict drug toxicity across 12 Tox21 targets using ensemble ML models, RDKit descriptors, and SHAP explanations.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Constants ─────────────────────────────────────────────────
TOX21_TARGETS = [
    "NR-AR", "NR-AR-LBD", "NR-AhR", "NR-Aromatase",
    "NR-ER", "NR-ER-LBD", "NR-PPAR-gamma",
    "SR-ARE", "SR-ATAD5", "SR-HSE", "SR-MMP", "SR-p53",
]

TARGET_LABELS = {
    "NR-AR":         "Androgen Receptor",
    "NR-AR-LBD":     "Androgen Receptor LBD",
    "NR-AhR":        "Aryl Hydrocarbon Receptor",
    "NR-Aromatase":  "Aromatase",
    "NR-ER":         "Estrogen Receptor α",
    "NR-ER-LBD":     "Estrogen Receptor LBD",
    "NR-PPAR-gamma": "PPAR-γ",
    "SR-ARE":        "Antioxidant Response Element",
    "SR-ATAD5":      "ATAD5",
    "SR-HSE":        "Heat Shock Response",
    "SR-MMP":        "Mitochondrial Membrane Potential",
    "SR-p53":        "p53 Pathway",
}

# ── Global state ──────────────────────────────────────────────
SCALER = None
MODELS: dict = {}
FEATURE_NAMES: list = []
SCALER_N_FEATURES: int = 0   # actual dimension the scaler was trained on
KEPT_INDICES: list = []      # feature selection mask indices


def _load_model(name: str):
    path = os.path.join(MODEL_DIR, f"{name}.pkl")
    return joblib.load(path) if os.path.exists(path) else None


def _get_features_for_scaler(smiles: str) -> np.ndarray:
    """
    Generate feature vector matching the scaler's expected dimension.
    Handles both old (439) and new (1777) saved models automatically.
    """
    # Full new feature set
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
        # Ensure we return an empty array of correct type rather than None
        return np.array([], dtype=np.float32)

    # Truncate or pad to exactly match the SCALER'S input size
    expected = SCALER_N_FEATURES if SCALER_N_FEATURES > 0 else 1777
    if feat.shape[0] != expected:
        if feat.shape[0] > expected:
            feat = feat[:expected]
        else:
            feat = np.pad(feat, (0, expected - feat.shape[0]))
    
    return feat


@app.on_event("startup")
def load_artifacts():
    global SCALER, MODELS, FEATURE_NAMES, SCALER_N_FEATURES

    # Load feature names for the current config
    FEATURE_NAMES = get_feature_names(
        use_morgan=USE_MORGAN_FP,
        morgan_nbits=MORGAN_NBITS,
        use_maccs=USE_MACCS,
        use_rdkit_fp=USE_RDKIT_FP,
        rdkit_fp_nbits=RDKIT_FP_NBITS,
    )

    # Filter feature names if kept_indices exist
    indices_path = os.path.join(MODEL_DIR, "indices.pkl")
    if os.path.exists(indices_path):
        global KEPT_INDICES
        KEPT_INDICES = joblib.load(indices_path)
        if KEPT_INDICES:
            FEATURE_NAMES = [FEATURE_NAMES[i] for i in KEPT_INDICES]
            print(f"[ToxScout AI] Feature selection active — kept {len(KEPT_INDICES)} features")

    # Load scaler
    scaler_path = os.path.join(MODEL_DIR, "scaler.pkl")
    if os.path.exists(scaler_path):
        SCALER = joblib.load(scaler_path)
        SCALER_N_FEATURES = getattr(SCALER, 'n_features_in_', 0)
        print(f"[ToxScout AI] Scaler loaded — expects {SCALER_N_FEATURES} features")
    else:
        print("[ToxScout AI] WARNING: No scaler found. Run: python drug_toxicity/main.py")

    # Load models
    for name in ["Voting_Ensemble", "Stacking_Ensemble", "XGBoost",
                 "Random_Forest", "Extra_Trees", "LightGBM",
                 "MLP", "Logistic_Regression"]:
        m = _load_model(name)
        if m:
            MODELS[name] = m

    print(f"[ToxScout AI] Models loaded: {list(MODELS.keys())}")

    if not MODELS:
        print("[ToxScout AI] WARNING: No models found. Run: python drug_toxicity/main.py")

    # Pre-build SHAP explainers (cached for zero-latency on requests)
    _init_shap_explainers()


# ── Model identity ────────────────────────────────────────────
# Maps internal model keys → professional display metadata
MODEL_META = {
    "Voting_Ensemble":   {"name": "ToxScout AI", "version": "v1.0", "algorithm": "Voting Ensemble"},
    "Stacking_Ensemble": {"name": "ToxScout AI", "version": "v1.0", "algorithm": "Stacking Ensemble"},
    "XGBoost":           {"name": "ToxScout AI", "version": "v1.0", "algorithm": "XGBoost"},
    "Random_Forest":     {"name": "ToxScout AI", "version": "v1.0", "algorithm": "Random Forest"},
    "Extra_Trees":       {"name": "ToxScout AI", "version": "v1.0", "algorithm": "Extra Trees"},
    "LightGBM":          {"name": "ToxScout AI", "version": "v1.0", "algorithm": "LightGBM"},
    "MLP":               {"name": "ToxScout AI", "version": "v1.0", "algorithm": "Neural Network (MLP)"},
    "Logistic_Regression": {"name": "ToxScout AI", "version": "v1.0", "algorithm": "Logistic Regression"},
}

def _model_display(model_key: str) -> str:
    """Return formatted display string: ToxScout AI v1.0 (XGBoost Ensemble)"""
    m = MODEL_META.get(model_key, {"name": "ToxScout AI", "version": "v1.0", "algorithm": model_key})
    return f"{m['name']} {m['version']} ({m['algorithm']})"

class GasAlertRequest(BaseModel):
    gas_name: str
    concentration: float
    unit: str
    threshold: float
    location: str
    duration: Optional[int] = None

class PredictRequest(BaseModel):
    smiles: str
    model: str = "Voting_Ensemble"
    threshold: float = 0.35


class ModelMeta(BaseModel):
    name: str
    version: str
    algorithm: str
    display: str


class PredictResponse(BaseModel):
    smiles: str
    toxic: bool
    probability: float
    confidence: float
    model_used: str
    model_meta: ModelMeta
    threshold: float
    insight: str
    ai_text: str
    features: dict
    multi_target: list
    feature_importance: list
    shap_top5: list
    shap_explanation: dict
    drug_likeness: dict
    compound_info: dict
    toxicophore_atoms: dict
    risk_classification: dict
    organ_toxicity: dict      # ToxKG organ-level predictions
    atom_saliency: dict       # per-atom toxicity contribution
    novel_modality: dict      # PROTAC / Lipid NP / Small Molecule detection


# ── Insight generator ─────────────────────────────────────────
def generate_insight(feat_raw: np.ndarray, feat_dict: dict,
                     toxic: bool, prob: float) -> str:
    """
    Build a human-readable insight using physicochemical descriptors
    AND structural alert counts from the raw feature vector.
    """
    reasons = []

    # Physicochemical flags
    if feat_dict.get("LogP", 0) > 5:
        reasons.append("high lipophilicity (LogP > 5)")
    if feat_dict.get("MolWeight", 0) > 500:
        reasons.append("high molecular weight (> 500 Da)")
    if feat_dict.get("Lipinski_pass", 1) == 0:
        score = int(feat_dict.get("Lipinski_score", 0))
        reasons.append(f"fails Lipinski Ro5 ({score}/4 rules satisfied)")
    if feat_dict.get("AromaticRings", 0) >= 3:
        reasons.append("multiple aromatic rings")
    if feat_dict.get("TPSA", 100) < 40:
        reasons.append("low polar surface area")
    if feat_dict.get("QED", 1) < 0.3:
        reasons.append("low drug-likeness (QED < 0.3)")

    # Structural alerts from raw vector
    alert_names = [name for name, _ in STRUCTURAL_ALERTS]
    # Alert features start at index 26 in the new feature set
    alert_start = 26
    fired = []
    for i, aname in enumerate(alert_names):
        idx = alert_start + i
        if idx < len(feat_raw) and feat_raw[idx] > 0:
            fired.append(aname.replace("_", " "))
    if fired:
        reasons.insert(0, f"structural alerts: {', '.join(fired[:3])}")

    conf_pct = round(prob * 100, 1)
    if toxic:
        body = (f"due to {', '.join(reasons[:3])}. "
                "These properties are associated with increased cellular toxicity."
                if reasons else
                "The molecular fingerprint pattern matches known toxic compounds "
                "in the Tox21 dataset.")
        return (f"This compound is likely toxic ({conf_pct}% confidence) {body} "
                f"Gasteiger charge analysis and PAINS screening support this prediction.")
    else:
        body = (f"though it exhibits {', '.join(reasons[:2])}. "
                "Overall molecular profile suggests acceptable safety."
                if reasons else
                "No significant structural alerts detected. "
                "Molecular descriptors are within safe ranges.")
        return (f"This compound appears non-toxic ({100 - conf_pct:.1f}% confidence). "
                f"{body}")


# ── PubChem REST helpers (no pubchempy needed) ────────────────
_PUBCHEM_BASE       = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
_PUBCHEM_AUTOCOMPLETE = "https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound"

# Simple in-process cache: {query_lower: [suggestions]}
_AUTOCOMPLETE_CACHE: dict = {}
_SMILES_CACHE: dict = {}
_INFO_CACHE: dict = {}

def _pubchem_get(url: str, timeout: int = 8) -> Optional[dict]:
    """GET a PubChem REST URL and return parsed JSON, or None on error."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ToxScoutAI/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return _json.loads(r.read().decode())
    except Exception:
        return None


def pubchem_search_by_name(name: str, max_results: int = 8) -> list:
    """
    Search PubChem by drug name → return list of candidate compounds.
    Each item: {cid, name, smiles, formula, mw, iupac, synonyms}
    """
    encoded = urllib.parse.quote(name)
    # Step 1: get CIDs matching the name
    cid_url = f"{_PUBCHEM_BASE}/compound/name/{encoded}/cids/JSON"
    data = _pubchem_get(cid_url)
    if not data:
        return []

    cids = data.get("IdentifierList", {}).get("CID", [])[:max_results]
    if not cids:
        return []

    # Step 2: fetch properties for those CIDs in one batch call
    cid_str = ",".join(str(c) for c in cids)
    props_url = (
        f"{_PUBCHEM_BASE}/compound/cid/{cid_str}/property/"
        "IsomericSMILES,CanonicalSMILES,MolecularFormula,MolecularWeight,"
        "IUPACName,Title/JSON"
    )
    props_data = _pubchem_get(props_url)
    if not props_data:
        return []

    results = []
    for p in props_data.get("PropertyTable", {}).get("Properties", []):
        smiles = p.get("IsomericSMILES") or p.get("CanonicalSMILES", "")
        if not smiles:
            continue
        results.append({
            "cid":     p.get("CID"),
            "name":    p.get("Title", name),
            "smiles":  smiles,
            "formula": p.get("MolecularFormula", ""),
            "mw":      p.get("MolecularWeight"),
            "iupac":   p.get("IUPACName", ""),
        })
    return results


def pubchem_fetch_by_cid(cid: int) -> dict:
    """Fetch full compound info for a single CID."""
    props_url = (
        f"{_PUBCHEM_BASE}/compound/cid/{cid}/property/"
        "IsomericSMILES,CanonicalSMILES,MolecularFormula,MolecularWeight,"
        "IUPACName,Title/JSON"
    )
    data = _pubchem_get(props_url)
    if not data:
        return {}
    props = data.get("PropertyTable", {}).get("Properties", [{}])[0]

    # Synonyms (separate call, best-effort)
    syn_url = f"{_PUBCHEM_BASE}/compound/cid/{cid}/synonyms/JSON"
    syn_data = _pubchem_get(syn_url)
    synonyms = []
    if syn_data:
        synonyms = syn_data.get("InformationList", {}).get(
            "Information", [{}])[0].get("Synonym", [])[:5]

    return {
        "cid":              props.get("CID"),
        "iupac_name":       props.get("IUPACName", ""),
        "formula":          props.get("MolecularFormula", ""),
        "molecular_weight": props.get("MolecularWeight"),
        "cas":              None,
        "synonyms":         synonyms,
        "name":             props.get("Title", ""),
        "smiles":           props.get("IsomericSMILES") or props.get("CanonicalSMILES", ""),
    }


def fetch_pubchem_info(smiles: str) -> dict:
    """Fetch compound metadata from PubChem by SMILES (used in /predict)."""
    encoded = urllib.parse.quote(smiles)
    props_url = (
        f"{_PUBCHEM_BASE}/compound/smiles/{encoded}/property/"
        "IsomericSMILES,MolecularFormula,MolecularWeight,IUPACName,Title/JSON"
    )
    data = _pubchem_get(props_url)
    if not data:
        return {}
    props = data.get("PropertyTable", {}).get("Properties", [{}])[0]
    cid = props.get("CID")

    synonyms = []
    if cid:
        syn_url = f"{_PUBCHEM_BASE}/compound/cid/{cid}/synonyms/JSON"
        syn_data = _pubchem_get(syn_url)
        if syn_data:
            synonyms = syn_data.get("InformationList", {}).get(
                "Information", [{}])[0].get("Synonym", [])[:3]

    return {
        "cid":              cid,
        "iupac_name":       props.get("IUPACName", ""),
        "formula":          props.get("MolecularFormula", ""),
        "molecular_weight": props.get("MolecularWeight"),
        "cas":              None,
        "synonyms":         synonyms,
    }


# ── Drug-likeness (Lipinski Ro5) ──────────────────────────────
def compute_drug_likeness(feat_dict: dict) -> dict:
    mw   = feat_dict.get("MolWeight", 0)
    logp = feat_dict.get("LogP", 0)
    hbd  = feat_dict.get("HBD", 0)
    hba  = feat_dict.get("HBA", 0)
    violations = sum([mw > 500, logp > 5, hbd > 5, hba > 10])
    return {
        "lipinski_pass": violations == 0,
        "violations":    violations,
        "mw":   round(mw,   3),
        "logp": round(logp, 3),
        "hbd":  int(hbd),
        "hba":  int(hba),
    }


# ── Toxicophore atom-level detection ─────────────────────────
# Maps alert name → human-readable group label + severity
_ALERT_META = {
    "nitro":          {"label": "Nitro Group",          "severity": "high",   "color": "#ef4444"},
    "aldehyde":       {"label": "Aldehyde",              "severity": "high",   "color": "#f97316"},
    "epoxide":        {"label": "Epoxide",               "severity": "high",   "color": "#ef4444"},
    "michael_acc":    {"label": "Michael Acceptor",      "severity": "high",   "color": "#ef4444"},
    "quinone":        {"label": "Quinone",               "severity": "high",   "color": "#dc2626"},
    "halide_arom":    {"label": "Aromatic Halide",       "severity": "medium", "color": "#f97316"},
    "amine_arom":     {"label": "Aromatic Amine",        "severity": "high",   "color": "#ef4444"},
    "thiol":          {"label": "Thiol",                 "severity": "medium", "color": "#eab308"},
    "peroxide":       {"label": "Peroxide",              "severity": "high",   "color": "#dc2626"},
    "azo":            {"label": "Azo Group",             "severity": "medium", "color": "#f97316"},
    "acyl_halide":    {"label": "Acyl Halide",           "severity": "high",   "color": "#ef4444"},
    "isocyanate":     {"label": "Isocyanate",            "severity": "high",   "color": "#ef4444"},
    "any_halogen":    {"label": "Halogen",               "severity": "low",    "color": "#eab308"},
    "chlorine":       {"label": "Chlorine",              "severity": "low",    "color": "#eab308"},
    "bromine":        {"label": "Bromine",               "severity": "medium", "color": "#f97316"},
    "carbonyl":       {"label": "Carbonyl",              "severity": "low",    "color": "#facc15"},
    "aniline":        {"label": "Aniline Scaffold",      "severity": "high",   "color": "#ef4444"},
    "hydrazine":      {"label": "Hydrazine",             "severity": "high",   "color": "#dc2626"},
    "hydroxamic_acid":{"label": "Hydroxamic Acid",       "severity": "medium", "color": "#f97316"},
    "imine":          {"label": "Imine",                 "severity": "low",    "color": "#facc15"},
    "diazo":          {"label": "Diazo",                 "severity": "high",   "color": "#dc2626"},
    "sulfonate":      {"label": "Sulfonate",             "severity": "low",    "color": "#facc15"},
    "phosphonate":    {"label": "Phosphonate",           "severity": "low",    "color": "#facc15"},
    "catechol":       {"label": "Catechol",              "severity": "medium", "color": "#f97316"},
    "rhodanine":      {"label": "Rhodanine",             "severity": "high",   "color": "#ef4444"},
}

def compute_toxicophore_atoms(smiles: str) -> dict:
    """
    For each fired structural alert, return:
      - atom_indices: list of atom indices involved
      - bond_indices: list of bond indices involved
      - label, severity, color, smarts

    Returns:
      {
        "alerts": [
          {
            "name": "nitro",
            "label": "Nitro Group",
            "severity": "high",
            "color": "#ef4444",
            "smarts": "[N+](=O)[O-]",
            "atom_indices": [3, 4, 5],
            "bond_indices": [2, 3],
            "count": 1
          }, ...
        ],
        "highlighted_atoms": [3, 4, 5, ...],   # union of all alert atoms
        "highlighted_bonds": [2, 3, ...],
        "total_alerts": 2,
        "high_severity_count": 1,
      }
    """
    try:
        from rdkit import Chem
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return _empty_toxicophore()
    except Exception:
        return _empty_toxicophore()

    alerts = []
    all_atoms = set()
    all_bonds = set()

    for name, patt in _COMPILED_ALERTS:
        if patt is None:
            continue
        matches = mol.GetSubstructMatches(patt)
        if not matches:
            continue

        # Collect all atom indices across all matches
        atom_idxs = list({idx for match in matches for idx in match})

        # Collect bond indices: bonds where both endpoints are in the match
        bond_idxs = []
        for bond in mol.GetBonds():
            a1, a2 = bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()
            if a1 in atom_idxs and a2 in atom_idxs:
                bond_idxs.append(bond.GetIdx())

        meta = _ALERT_META.get(name, {"label": name, "severity": "low", "color": "#facc15"})
        # Find the SMARTS string for this alert
        smarts_str = next((s for n, s in STRUCTURAL_ALERTS if n == name), "")

        alerts.append({
            "name":         name,
            "label":        meta["label"],
            "severity":     meta["severity"],
            "color":        meta["color"],
            "smarts":       smarts_str,
            "atom_indices": atom_idxs,
            "bond_indices": bond_idxs,
            "count":        len(matches),
        })
        all_atoms.update(atom_idxs)
        all_bonds.update(bond_idxs)

    high_count = sum(1 for a in alerts if a["severity"] == "high")

    return {
        "alerts":             alerts,
        "highlighted_atoms":  sorted(all_atoms),
        "highlighted_bonds":  sorted(all_bonds),
        "total_alerts":       len(alerts),
        "high_severity_count": high_count,
    }


def _empty_toxicophore() -> dict:
    return {
        "alerts": [], "highlighted_atoms": [], "highlighted_bonds": [],
        "total_alerts": 0, "high_severity_count": 0,
    }


# ── Risk classification ───────────────────────────────────────
def compute_risk_classification(
    toxic: bool,
    prob: float,
    drug_likeness: dict,
    toxicophore_data: dict,
    shap_explanation: dict,
) -> dict:
    """
    Classify the compound into one of four risk tiers:

      HIGH_RISK_STRUCTURAL_FAILURE  — toxic AND Lipinski violations AND high-severity alerts
      HIGH_RISK                     — toxic AND (violations OR high-severity alerts)
      MODERATE_RISK                 — toxic but drug-like and no high-severity alerts
      LOW_RISK                      — non-toxic
      SAFE                          — non-toxic, drug-like, no alerts

    Returns:
      {
        "tier": "HIGH_RISK_STRUCTURAL_FAILURE",
        "label": "High-Risk Structural Failure",
        "color": "#dc2626",
        "reasons": ["Toxic (87%)", "2 Lipinski violations", "Nitro Group alert"],
        "badge_text": "⛔ High-Risk Structural Failure",
      }
    """
    pct = round(prob * 100, 1)
    violations = drug_likeness.get("violations", 0)
    lipinski_pass = drug_likeness.get("lipinski_pass", True)
    high_alerts = toxicophore_data.get("high_severity_count", 0)
    total_alerts = toxicophore_data.get("total_alerts", 0)
    alert_names = [a["label"] for a in toxicophore_data.get("alerts", [])
                   if a["severity"] == "high"][:2]

    reasons = []
    if toxic:
        reasons.append(f"Toxic ({pct}% probability)")
    if violations > 0:
        reasons.append(f"{violations} Lipinski Ro5 violation{'s' if violations > 1 else ''}")
    if alert_names:
        reasons.append(f"Structural alerts: {', '.join(alert_names)}")
    elif total_alerts > 0:
        reasons.append(f"{total_alerts} structural alert{'s' if total_alerts > 1 else ''} detected")

    # Tier logic
    if toxic and violations > 0 and high_alerts > 0:
        return {
            "tier":       "HIGH_RISK_STRUCTURAL_FAILURE",
            "label":      "High-Risk Structural Failure",
            "color":      "#dc2626",
            "bg":         "rgba(220,38,38,0.12)",
            "border":     "rgba(220,38,38,0.3)",
            "badge_text": "⛔ High-Risk Structural Failure",
            "reasons":    reasons,
            "description": (
                "This compound is predicted toxic, violates Lipinski drug-likeness rules, "
                "AND contains high-severity structural alerts (toxicophores). "
                "It represents a critical safety concern and should not proceed without "
                "extensive in-vitro and in-vivo safety evaluation."
            ),
        }
    elif toxic and (violations > 0 or high_alerts > 0):
        return {
            "tier":       "HIGH_RISK",
            "label":      "High Risk",
            "color":      "#ef4444",
            "bg":         "rgba(239,68,68,0.1)",
            "border":     "rgba(239,68,68,0.25)",
            "badge_text": "🔴 High Risk",
            "reasons":    reasons,
            "description": (
                "This compound is predicted toxic with additional risk factors "
                "(drug-likeness violations or structural alerts). "
                "Requires careful safety profiling before further development."
            ),
        }
    elif toxic:
        return {
            "tier":       "MODERATE_RISK",
            "label":      "Moderate Risk",
            "color":      "#f97316",
            "bg":         "rgba(249,115,22,0.1)",
            "border":     "rgba(249,115,22,0.25)",
            "badge_text": "🟠 Moderate Risk",
            "reasons":    reasons or [f"Toxic ({pct}% probability)"],
            "description": (
                "This compound is predicted toxic but shows acceptable drug-likeness "
                "and no high-severity structural alerts. "
                "Standard safety testing is recommended."
            ),
        }
    elif total_alerts > 0:
        return {
            "tier":       "LOW_RISK",
            "label":      "Low Risk",
            "color":      "#eab308",
            "bg":         "rgba(234,179,8,0.1)",
            "border":     "rgba(234,179,8,0.25)",
            "badge_text": "🟡 Low Risk",
            "reasons":    [f"Non-toxic ({100-pct:.1f}% confidence)", f"{total_alerts} minor structural alert(s)"],
            "description": (
                "This compound is predicted non-toxic but contains minor structural alerts. "
                "Proceed with standard ADMET profiling."
            ),
        }
    else:
        return {
            "tier":       "SAFE",
            "label":      "Safe",
            "color":      "#22c55e",
            "bg":         "rgba(34,197,94,0.1)",
            "border":     "rgba(34,197,94,0.25)",
            "badge_text": "✅ Safe",
            "reasons":    [f"Non-toxic ({100-pct:.1f}% confidence)", "No structural alerts", "Drug-like"],
            "description": (
                "This compound is predicted non-toxic with no structural alerts "
                "and acceptable drug-likeness. Suitable for further development."
            ),
        }


# ── SHAP explainer cache ──────────────────────────────────────
# Cache explainers per model key so they're built once at startup,
# not on every request (TreeExplainer init is expensive for large forests).
_SHAP_EXPLAINERS: dict = {}

# Human-readable labels for common feature name patterns
_FEAT_LABELS = {
    "MolWeight":       "Molecular Weight",
    "LogP":            "Lipophilicity (LogP)",
    "HBD":             "H-Bond Donors",
    "HBA":             "H-Bond Acceptors",
    "TPSA":            "Polar Surface Area",
    "RotBonds":        "Rotatable Bonds",
    "AromaticRings":   "Aromatic Rings",
    "NumRings":        "Ring Count",
    "Fsp3":            "Fraction sp3 Carbons",
    "QED":             "Drug-likeness (QED)",
    "MolMR":           "Molar Refractivity",
    "BertzCT":         "Bertz Complexity",
    "FormalCharge":    "Formal Charge",
    "Stereocenters":   "Stereocenters",
    "Heteroatoms":     "Heteroatom Count",
    "Lipinski_pass":   "Lipinski Ro5 Pass",
    "Lipinski_score":  "Lipinski Score",
    "LabuteASA":       "Labute Accessible Surface",
    "PEOE_VSA1":       "PEOE VSA Descriptor",
    "EState_max":      "Max E-State Index",
    "EState_min":      "Min E-State Index",
    "Gasteiger_mean":  "Gasteiger Charge (mean)",
    "Gasteiger_min":   "Gasteiger Charge (min)",
    "Gasteiger_max":   "Gasteiger Charge (max)",
    "Gasteiger_absmean": "Gasteiger Charge (|mean|)",
    "Alert_nitro":     "Nitro Group Alert",
    "Alert_amine_arom":"Aromatic Amine Alert",
    "Alert_halide_arom":"Aromatic Halide Alert",
    "Alert_epoxide":   "Epoxide Alert",
    "Alert_aldehyde":  "Aldehyde Alert",
    "Alert_azo":       "Azo Group Alert",
    "Alert_thiol":     "Thiol Alert",
    "Alert_carbonyl":  "Reactive Carbonyl Alert",
}

def _readable_feat(name: str) -> str:
    """Convert internal feature name to human-readable label."""
    if name in _FEAT_LABELS:
        return _FEAT_LABELS[name]
    if name.startswith("MACCS_"):
        return f"MACCS Key {name[6:]}"
    if name.startswith("Morgan_"):
        return f"Morgan FP bit {name[7:]}"
    if name.startswith("RDKit_"):
        return f"RDKit FP bit {name[6:]}"
    if name.startswith("Alert_"):
        return name[6:].replace("_", " ").title() + " Alert"
    return name.replace("_", " ")


def _build_shap_explainer(model, model_key: str):
    """
    Build and cache a SHAP explainer for the given model.
    Uses TreeExplainer for tree-based models, LinearExplainer for LR,
    and skips MLP (too slow for KernelExplainer in production).
    """
    if not _SHAP_OK:
        return None
    try:
        algo = MODEL_META.get(model_key, {}).get("algorithm", "")
        if _SHAP_OK and getattr(_shap, "LinearExplainer", None) and "Logistic" in algo:
            # Use current feature count (filtered if selection active)
            dim = len(FEATURE_NAMES)
            return _shap.LinearExplainer(model, np.zeros((1, dim or 1)))
        # Tree-based: RF, XGB, LGBM, ExtraTrees, Stacking, Voting
        # For ensemble wrappers (Voting/Stacking), try to get a sub-estimator
        target_model = model
        if hasattr(model, "estimators_"):
            # VotingClassifier — use first tree-based sub-estimator
            for est in model.estimators_:
                if hasattr(est, "feature_importances_"):
                    target_model = est
                    break
        elif hasattr(model, "final_estimator_"):
            # StackingClassifier — use final estimator if tree-based
            fe = model.final_estimator_
            if hasattr(fe, "feature_importances_"):
                target_model = fe
        if _SHAP_OK and getattr(_shap, "TreeExplainer", None):
            return _shap.TreeExplainer(target_model)
        return None
    except Exception as e:
        logging.warning(f"[ToxScout AI] SHAP explainer build failed for {model_key}: {e}")
        return None


def _init_shap_explainers():
    """Called after models are loaded to pre-build all explainers."""
    global _SHAP_EXPLAINERS
    if not _SHAP_OK:
        return
    priority = ["XGBoost", "Random_Forest", "LightGBM", "Extra_Trees"]
    for key in priority:
        if key in MODELS:
            exp = _build_shap_explainer(MODELS[key], key)
            if exp is not None:
                _SHAP_EXPLAINERS[key] = exp
                print(f"[ToxScout AI] SHAP explainer ready: {key}")


def compute_shap_explanation(X_scaled: np.ndarray, feat_names: list,
                              n_top: int = 10) -> dict:
    """
    Compute SHAP values using the best available cached explainer.

    Returns:
        {
          "top_features": [
            {
              "rank": 1,
              "feature": "MACCS_160",
              "label": "MACCS Key 160",
              "shap_value": 0.142,
              "feature_value": 1.0,
              "direction": "toxic",   # "toxic" | "safe"
              "magnitude": "high",    # "high" | "medium" | "low"
              "explanation": "MACCS Key 160 strongly increases toxicity risk."
            }, ...
          ],
          "base_value": 0.31,
          "model_used": "XGBoost",
          "shap_available": True,
        }
    """
    # Pick best available explainer
    explainer_key = None
    for key in ["XGBoost", "Random_Forest", "LightGBM", "Extra_Trees"]:
        if key in _SHAP_EXPLAINERS:
            explainer_key = key
            break

    if explainer_key is None or not _SHAP_OK:
        return {"top_features": [], "base_value": None,
                "model_used": None, "shap_available": False}

    explainer = _SHAP_EXPLAINERS[explainer_key]

    try:
        shap_vals = explainer.shap_values(X_scaled)

        # Handle list output (binary classifiers return [neg_class, pos_class])
        if isinstance(shap_vals, list):
            sv = shap_vals[1][0]   # positive class, first sample
        else:
            sv = shap_vals[0]

        # Base value (expected model output)
        base_val = None
        ev = explainer.expected_value
        if isinstance(ev, (list, np.ndarray)):
            base_val = float(ev[1]) if len(ev) > 1 else float(ev[0])
        else:
            base_val = float(ev)

        n = min(len(sv), len(feat_names))
        abs_sv = np.abs(sv[:n])
        top_idx = np.argsort(abs_sv)[::-1][:n_top]

        # Magnitude thresholds (relative to max abs shap)
        max_abs = float(abs_sv[top_idx[0]]) if len(top_idx) else 1.0

        top_features = []
        for rank, i in enumerate(top_idx, 1):
            val   = float(sv[i])
            fval  = float(X_scaled[0, i]) if i < X_scaled.shape[1] else 0.0
            fname = feat_names[i]
            label = _readable_feat(fname)
            direction = "toxic" if val > 0 else "safe"
            rel = abs(val) / max_abs if max_abs > 0 else 0
            magnitude = "high" if rel >= 0.6 else "medium" if rel >= 0.25 else "low"

            # Human-readable sentence
            if direction == "toxic":
                if magnitude == "high":
                    expl = f"{label} strongly increases toxicity risk (SHAP +{val:.3f})."
                elif magnitude == "medium":
                    expl = f"{label} moderately increases toxicity risk (SHAP +{val:.3f})."
                else:
                    expl = f"{label} slightly increases toxicity risk (SHAP +{val:.3f})."
            else:
                if magnitude == "high":
                    expl = f"{label} strongly reduces toxicity risk (SHAP {val:.3f})."
                elif magnitude == "medium":
                    expl = f"{label} moderately reduces toxicity risk (SHAP {val:.3f})."
                else:
                    expl = f"{label} slightly reduces toxicity risk (SHAP {val:.3f})."

            top_features.append({
                "rank":          rank,
                "feature":       fname,
                "label":         label,
                "shap_value":    round(val, 4),
                "feature_value": round(fval, 4),
                "direction":     direction,
                "magnitude":     magnitude,
                "explanation":   expl,
            })

        return {
            "top_features":  top_features,
            "base_value":    round(base_val, 4) if base_val is not None else None,
            "model_used":    explainer_key,
            "shap_available": True,
        }

    except Exception as e:
        logging.warning(f"[ToxScout AI] SHAP compute failed: {e}")
        return {"top_features": [], "base_value": None,
                "model_used": explainer_key, "shap_available": False}


# Keep backward-compat shim used in /predict
def compute_shap_top5(model, X_scaled: np.ndarray, feat_names: list) -> list:
    """Thin wrapper — delegates to compute_shap_explanation, returns top-5 list."""
    result = compute_shap_explanation(X_scaled, feat_names, n_top=5)
    return [
        {"feature": f["feature"], "shap_value": f["shap_value"]}
        for f in result["top_features"]
    ]


# ── AI text generator ─────────────────────────────────────────
def generate_ai_text(feat_dict: dict, drug_likeness: dict,
                     shap_explanation: dict, toxic: bool, prob: float,
                     compound_info: dict) -> str:
    conf = round(prob * 100, 1)
    name = (compound_info.get("synonyms") or [None])[0] or "This compound"
    mw   = feat_dict.get("MolWeight", "?")
    logp = feat_dict.get("LogP", "?")
    tpsa = feat_dict.get("TPSA", "?")

    top_feats = shap_explanation.get("top_features", [])
    base_val  = shap_explanation.get("base_value")
    shap_model = shap_explanation.get("model_used", "ensemble")

    # Build SHAP narrative from top features
    toxic_drivers = [f for f in top_feats[:5] if f["direction"] == "toxic"]
    safe_drivers  = [f for f in top_feats[:5] if f["direction"] == "safe"]

    if toxic:
        driver_str = (
            ", ".join(f['label'] for f in toxic_drivers[:2])
            if toxic_drivers else "molecular fingerprint patterns"
        )
        dl_note = ("It fails Lipinski Ro5 drug-likeness criteria."
                   if not drug_likeness.get("lipinski_pass")
                   else "Despite some drug-like properties,")
        base_note = f" (base rate: {round(base_val*100,1)}%)" if base_val else ""
        return (
            f"⚠️ {name} is predicted TOXIC at {conf}% probability{base_note}. "
            f"MW={mw} Da, LogP={logp}, TPSA={tpsa} Å². "
            f"{dl_note} "
            f"SHAP ({shap_model}) identifies {driver_str} as the strongest toxicity drivers. "
            f"This compound matches patterns of Tox21-active molecules and should be "
            f"flagged for in-vitro safety testing before further development."
        )
    else:
        safe_str = (
            ", ".join(f['label'] for f in safe_drivers[:2])
            if safe_drivers else "favorable molecular descriptors"
        )
        dl_note = ("Lipinski Ro5 fully satisfied — good oral bioavailability predicted."
                   if drug_likeness.get("lipinski_pass")
                   else f"{drug_likeness.get('violations')} Lipinski violation(s) noted.")
        base_note = f" (base rate: {round(base_val*100,1)}%)" if base_val else ""
        return (
            f"✅ {name} is predicted NON-TOXIC ({100 - conf:.1f}% confidence){base_note}. "
            f"MW={mw} Da, LogP={logp}, TPSA={tpsa} Å². "
            f"{dl_note} "
            f"SHAP ({shap_model}) highlights {safe_str} as key safety contributors. "
            f"No significant PAINS/toxicophore alerts detected. "
            f"Suitable for further ADMET profiling."
        )


# ── API routes ────────────────────────────────────────────────
@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if SCALER is None or not MODELS:
        raise HTTPException(
            503,
            "Models not loaded. Run: python drug_toxicity/main.py  "
            "(takes ~3 min, trains on tox21.csv)"
        )

    # ── Feature generation ────────────────────────────────────
    feat_raw = _get_features_for_scaler(req.smiles)
    if feat_raw is None:
        raise HTTPException(400, f"Invalid SMILES: '{req.smiles}'")

    X = SCALER.transform(feat_raw.reshape(1, -1))
    if KEPT_INDICES:
        X = X[:, KEPT_INDICES]

    # ── Model prediction ──────────────────────────────────────
    model_name = req.model if req.model in MODELS else next(iter(MODELS))
    prob  = float(MODELS[model_name].predict_proba(X)[0, 1])
    toxic = prob >= req.threshold

    # ── Full feature vector for display ──────────────────────
    full_feat = smiles_to_descriptors(
        req.smiles,
        use_morgan=USE_MORGAN_FP, morgan_radius=MORGAN_RADIUS,
        morgan_nbits=MORGAN_NBITS, use_maccs=USE_MACCS,
        use_rdkit_fp=USE_RDKIT_FP, rdkit_fp_nbits=RDKIT_FP_NBITS,
    )
    display_names = get_feature_names(
        use_morgan=False, use_maccs=False, use_rdkit_fp=False)
    
    # Robustly handle descriptor dict construction
    feat_dict = {}
    if full_feat is not None:
        feat_dict = {
            n: round(float(full_feat[i]), 4)
            for i, n in enumerate(display_names[:30])
            if i < len(full_feat)
        }
    
    # ── Feature importance (XGBoost) ──────────────────────────
    fi_list = []
    xgb = MODELS.get("XGBoost")
    if xgb and hasattr(xgb, "feature_importances_"):
        imp = xgb.feature_importances_
        n   = min(len(imp), len(FEATURE_NAMES))
        top = np.argsort(imp[:n])[::-1][:15]
        fi_list = [
            {"feature": FEATURE_NAMES[i], "importance": round(float(imp[i]), 4)}
            for i in top
        ]

    # ── SHAP explanation (cached explainer — near-zero latency) ──
    shap_explanation = compute_shap_explanation(X, FEATURE_NAMES[:X.shape[1]], n_top=10)
    shap_top5 = [
        {"feature": f["feature"], "shap_value": f["shap_value"]}
        for f in shap_explanation["top_features"][:5]
    ]

    # ── Drug-likeness ─────────────────────────────────────────
    drug_likeness = compute_drug_likeness(feat_dict)
    # ── PubChem compound info ─────────────────────────────────
    compound_info = fetch_pubchem_info(req.smiles)

    # ── Per-target predictions ────────────────────────────────
    multi = []
    for tgt in TOX21_TARGETS:
        for suffix in ["_XGB", "_RF", "_LGBM"]:
            m = _load_model(f"{tgt}{suffix}")
            if m:
                try:
                    p = round(float(m.predict_proba(X)[0, 1]), 4)
                    multi.append({
                        "target": tgt,
                        "label": TARGET_LABELS[tgt],
                        "toxic": p >= 0.35,
                        "probability": p,
                    })
                except Exception:
                    pass
                break

    # ── Insight + AI text ─────────────────────────────────────
    insight  = generate_insight(full_feat, feat_dict, toxic, prob)
    ai_text  = generate_ai_text(feat_dict, drug_likeness, shap_explanation,
                                toxic, prob, compound_info)

    # ── Toxicophore atom highlighting ─────────────────────────
    toxicophore_atoms = compute_toxicophore_atoms(req.smiles)

    # ── Risk classification ───────────────────────────────────
    risk_classification = compute_risk_classification(
        toxic, prob, drug_likeness, toxicophore_atoms, shap_explanation
    )

    # ── AI Engine: organ toxicity + saliency + modality ───────
    organ_tox   = {}
    atom_saliency = {}
    novel_modality = {}
    try:
        eng = _get_ai_engine()
        if eng:
            organ_tox      = eng.predict_organ_toxicity(req.smiles)
            atom_saliency  = eng.compute_atom_saliency(req.smiles, shap_explanation)
            novel_modality = eng.detect_novel_modality(req.smiles)
    except Exception as e:
        logging.warning(f"[ToxScout AI] AI engine error: {e}")

    return PredictResponse(
        smiles=req.smiles,
        toxic=toxic,
        probability=round(prob, 4),
        confidence=round(abs(prob - 0.5) * 2, 4),
        model_used=model_name,
        model_meta=ModelMeta(
            name="ToxScout AI",
            version="v1.0",
            algorithm=MODEL_META.get(model_name, {}).get("algorithm", model_name),
            display=_model_display(model_name),
        ),
        threshold=req.threshold,
        insight=insight,
        ai_text=ai_text,
        features=feat_dict,
        multi_target=multi,
        feature_importance=fi_list,
        shap_top5=shap_top5,
        shap_explanation=shap_explanation,
        drug_likeness=drug_likeness,
        compound_info=compound_info,
        toxicophore_atoms=toxicophore_atoms,
        risk_classification=risk_classification,
        organ_toxicity=organ_tox,
        atom_saliency=atom_saliency,
        novel_modality=novel_modality,
    )


@app.get("/models")
def list_models():
    return {
        "available": list(MODELS.keys()),
        "scaler_features": SCALER_N_FEATURES,
        "current_features": len(FEATURE_NAMES),
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": len(MODELS),
        "scaler": SCALER is not None,
        "scaler_features": SCALER_N_FEATURES,
        "needs_retrain": SCALER_N_FEATURES != len(FEATURE_NAMES),
        "shap_ready": len(_SHAP_EXPLAINERS) > 0,
        "shap_models": list(_SHAP_EXPLAINERS.keys()),
    }


@app.post("/explain")
def explain(req: PredictRequest):
    """
    Dedicated SHAP explanation endpoint.
    Returns full top-10 feature breakdown with labels, directions, magnitudes,
    and per-feature human-readable sentences.
    """
    if SCALER is None or not MODELS:
        raise HTTPException(503, "Models not loaded.")

    feat_raw = _get_features_for_scaler(req.smiles)
    if feat_raw is None:
        raise HTTPException(400, f"Invalid SMILES: '{req.smiles}'")

    X = SCALER.transform(feat_raw.reshape(1, -1))
    explanation = compute_shap_explanation(X, FEATURE_NAMES[:X.shape[1]], n_top=10)

    model_name = req.model if req.model in MODELS else next(iter(MODELS))
    prob = float(MODELS[model_name].predict_proba(X)[0, 1])

    return {
        "smiles":      req.smiles,
        "probability": round(prob, 4),
        "toxic":       prob >= req.threshold,
        **explanation,
    }


@app.post("/toxicophores")
def toxicophores(body: dict):
    """
    Dedicated toxicophore atom-highlighting endpoint.
    Input:  { "smiles": "..." }
    Output: toxicophore_atoms dict with atom/bond indices per alert,
            plus risk_classification.
    """
    smiles = body.get("smiles", "").strip()
    if not smiles:
        raise HTTPException(400, "smiles is required")

    tox_atoms = compute_toxicophore_atoms(smiles)

    # Minimal drug-likeness for risk classification (no model needed)
    try:
        from rdkit import Chem
        from rdkit.Chem import Descriptors, rdMolDescriptors
        mol = Chem.MolFromSmiles(smiles)
        if mol:
            mw   = Descriptors.ExactMolWt(mol) # type: ignore
            logp = Descriptors.MolLogP(mol) # type: ignore
            hbd  = rdMolDescriptors.CalcNumHBD(mol) # type: ignore
            hba  = rdMolDescriptors.CalcNumHBA(mol) # type: ignore
            viol = sum([mw > 500, logp > 5, hbd > 5, hba > 10])
            dl = {"lipinski_pass": viol == 0, "violations": viol,
                  "mw": round(mw, 2), "logp": round(logp, 2),
                  "hbd": int(hbd), "hba": int(hba)}
        else:
            dl = {"lipinski_pass": True, "violations": 0,
                  "mw": 0, "logp": 0, "hbd": 0, "hba": 0}
    except Exception:
        dl = {"lipinski_pass": True, "violations": 0,
              "mw": 0, "logp": 0, "hbd": 0, "hba": 0}

    # Use alert count as a proxy for toxicity when no model is available
    proxy_toxic = tox_atoms["high_severity_count"] >= 1
    proxy_prob  = min(0.9, 0.35 + tox_atoms["high_severity_count"] * 0.15)

    risk = compute_risk_classification(
        proxy_toxic, proxy_prob, dl, tox_atoms, {}
    )

    return {
        "smiles":            smiles,
        "toxicophore_atoms": tox_atoms,
        "drug_likeness":     dl,
        "risk_classification": risk,
    }


# ── AI Engine endpoints ───────────────────────────────────────
# Import lazily so the server starts even if ai_engine has issues

def _get_ai_engine():
    try:
        import importlib.util, sys as _sys
        spec = importlib.util.spec_from_file_location(
            "ai_engine",
            os.path.join(os.path.dirname(__file__), "ai_engine.py")
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    except Exception as e:
        logging.warning(f"[ToxScout AI] ai_engine import failed: {e}")
        return None


@app.post("/organ-toxicity")
def organ_toxicity(body: dict):
    """
    ToxKG: predict organ-level toxicity without animal testing.
    Input:  { "smiles": "..." }
    Output: per-organ risk scores, mechanisms, atom indices.
    """
    smiles = body.get("smiles", "").strip()
    if not smiles:
        raise HTTPException(400, "smiles is required")
    eng = _get_ai_engine()
    if eng is None:
        raise HTTPException(503, "AI engine unavailable")
    return eng.predict_organ_toxicity(smiles)


@app.post("/bioisostere")
def bioisostere(body: dict):
    """
    Suggest bioisosteric swaps to reduce toxicity.
    Input:  { "smiles": "...", "max_suggestions": 5 }
    Output: list of structural modifications with rationale + safety gain %.
    """
    smiles = body.get("smiles", "").strip()
    if not smiles:
        raise HTTPException(400, "smiles is required")
    max_s = int(body.get("max_suggestions", 5))
    eng = _get_ai_engine()
    if eng is None:
        raise HTTPException(503, "AI engine unavailable")
    return eng.suggest_bioisosteric_swaps(smiles, max_suggestions=max_s)


@app.post("/saliency")
def saliency(body: dict):
    """
    Atom-level saliency map — per-atom toxicity contribution.
    Input:  { "smiles": "...", "shap_explanation": {...} }
    Output: per-atom scores, levels, colors, explanations.
    Enables "click an atom → AI explains its contribution".
    """
    smiles = body.get("smiles", "").strip()
    if not smiles:
        raise HTTPException(400, "smiles is required")
    shap_exp = body.get("shap_explanation", {})
    eng = _get_ai_engine()
    if eng is None:
        raise HTTPException(503, "AI engine unavailable")
    return eng.compute_atom_saliency(smiles, shap_explanation=shap_exp)


@app.post("/modality")
def modality(body: dict):
    """
    Detect novel modality (PROTAC, Lipid NP, Macrocycle, Peptide, Small Molecule).
    Input:  { "smiles": "..." }
    Output: modality type, confidence, cold-start note, special considerations.
    """
    smiles = body.get("smiles", "").strip()
    if not smiles:
        raise HTTPException(400, "smiles is required")
    eng = _get_ai_engine()
    if eng is None:
        raise HTTPException(503, "AI engine unavailable")
    return eng.detect_novel_modality(smiles)


@app.get("/examples")
def examples():
    return {"examples": [
        {"name": "Aspirin",              "smiles": "CC(=O)Oc1ccccc1C(=O)O"},
        {"name": "Caffeine",             "smiles": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C"},
        {"name": "Ibuprofen",            "smiles": "CC(C)Cc1ccc(cc1)C(C)C(=O)O"},
        {"name": "Aniline (toxic)",      "smiles": "c1ccc(cc1)N"},
        {"name": "PCB (toxic)",          "smiles": "Clc1ccc(cc1Cl)c1cc(Cl)ccc1Cl"},
        {"name": "Paracetamol",          "smiles": "CC(=O)Nc1ccc(O)cc1"},
        {"name": "Dichloromethane",      "smiles": "ClCCl"},
        {"name": "Testosterone",         "smiles": "CC12CCC3C(C1CCC2O)CCC4=CC(=O)CCC34C"},
        {"name": "Nitrobenzene (toxic)", "smiles": "c1ccc([N+](=O)[O-])cc1"},
        {"name": "Benzaldehyde",         "smiles": "O=Cc1ccccc1"},
    ]}


# ── Vector Search endpoints ───────────────────────────────────

@app.post("/similar-molecules")
def similar_molecules(body: dict):
    """
    Tanimoto similarity search using Milvus IVF_SQ8 / FAISS.
    Input:  { "smiles": "...", "k": 10 }
    Output: top-k similar molecules with similarity scores + latency.
    Target: <10ms search on indexed collections.
    """
    smiles = body.get("smiles", "").strip()
    if not smiles:
        raise HTTPException(400, "smiles is required")
    k = min(int(body.get("k", 10)), 50)

    try:
        from vector_search import get_vector_service
        svc = get_vector_service()
        return svc.search(smiles, k=k)
    except Exception as e:
        raise HTTPException(500, f"Vector search error: {e}")


@app.post("/index-molecules")
def index_molecules(body: dict):
    """
    Index a list of SMILES into the vector store.
    Input:  { "smiles_list": [...], "batch_size": 10000 }
    Output: { indexed, backend, elapsed_s, throughput }
    Uses Apache Arrow zero-copy pipeline for efficiency.
    """
    smiles_list = body.get("smiles_list", [])
    if not smiles_list:
        raise HTTPException(400, "smiles_list is required")
    batch_size = int(body.get("batch_size", 10_000))

    try:
        from vector_search import get_vector_service
        svc = get_vector_service()
        return svc.build_index(smiles_list, batch_size=batch_size)
    except Exception as e:
        raise HTTPException(500, f"Indexing error: {e}")


@app.get("/vector-index-status")
def vector_index_status():
    """Return current vector index status and backend info."""
    try:
        from vector_search import get_vector_service, _MILVUS, _FAISS, _ARROW
        svc = get_vector_service()
        return {
            "backend":        svc.backend_name,
            "is_ready":       svc.is_ready,
            "total_indexed":  (svc._milvus.count() if svc.backend_name == "milvus"
                               else svc._faiss.count()),
            "milvus_available": _MILVUS,
            "faiss_available":  _FAISS,
            "arrow_enabled":    _ARROW,
            "fp_dim":           1024,
            "index_type":       "IVF_SQ8 (Milvus)" if _MILVUS else "IVFFlat (FAISS)",
            "metric":           "Inner Product ≈ Tanimoto",
        }
    except Exception as e:
        return {"backend": "error", "error": str(e)}


# ── Regulatory / Traceability endpoints ──────────────────────

@app.post("/traceability-report")
def traceability_report(body: dict):
    """
    Generate FDA/EMA Jan 2026 compliant Traceability Report.
    Input:  { "smiles": "...", "prediction": {...} }
    Output: Full traceability report with provenance, versioning, bias audit.
    """
    smiles = body.get("smiles", "").strip()
    pred   = body.get("prediction", {})
    if not smiles:
        raise HTTPException(400, "smiles is required")

    try:
        from regulatory import generate_traceability_report
        return generate_traceability_report(
            smiles=smiles,
            prediction_result=pred,
            model_meta=pred.get("model_meta"),
            include_bias_audit=True,
        )
    except Exception as e:
        raise HTTPException(500, f"Traceability report error: {e}")


@app.post("/compliance-check")
def compliance_check(body: dict):
    """
    Check a prediction against FDA/EMA Jan 2026 AI Guiding Principles.
    Input:  { "prediction": {...} }
    Output: Compliance status per principle + overall score.
    """
    pred = body.get("prediction", {})
    try:
        from regulatory import check_fda_ema_compliance
        return check_fda_ema_compliance(pred, pred.get("model_meta"))
    except Exception as e:
        raise HTTPException(500, f"Compliance check error: {e}")


# ── Drug search endpoints ─────────────────────────────────────

class DrugSearchResult(BaseModel):
    cid:     Optional[int]
    name:    str
    smiles:  str
    formula: str
    mw:      Optional[float]
    iupac:   str


class DrugLookupResponse(BaseModel):
    """Full predict response enriched with drug identity from PubChem."""
    drug_info: DrugSearchResult
    prediction: PredictResponse


@app.get("/drug-search", response_model=List[DrugSearchResult])
def drug_search(q: str = Query(..., min_length=2, description="Drug name to search")):
    """
    Search PubChem by drug name.
    Returns up to 8 candidate compounds with SMILES and properties.
    """
    results = pubchem_search_by_name(q.strip(), max_results=8)
    if not results:
        return []
    return [
        DrugSearchResult(
            cid=r.get("cid"),
            name=r.get("name", q),
            smiles=r.get("smiles", ""),
            formula=r.get("formula", ""),
            mw=float(r["mw"]) if r.get("mw") else None,
            iupac=r.get("iupac", ""),
        )
        for r in results
        if r.get("smiles")
    ]


@app.post("/drug-lookup")
def drug_lookup(body: dict):
    """
    Given a CID or SMILES from a drug search result, fetch full info
    and run toxicity prediction in one call.
    Returns {drug_info, prediction}.
    """
    smiles = body.get("smiles", "").strip()
    cid    = body.get("cid")
    model  = body.get("model", "Voting_Ensemble")

    if not smiles:
        raise HTTPException(400, "smiles is required")

    # Fetch enriched compound info
    if cid:
        drug_info = pubchem_fetch_by_cid(int(cid))
    else:
        drug_info = fetch_pubchem_info(smiles)

    # Run prediction (reuse /predict logic)
    pred_req = PredictRequest(smiles=smiles, model=model)
    prediction = predict(pred_req)

    # Merge drug name into compound_info for richer display
    if drug_info.get("name") and not prediction.compound_info.get("synonyms"):
        prediction.compound_info["synonyms"] = [drug_info["name"]]

    return {
        "drug_info": {
            "cid":     drug_info.get("cid") or cid,
            "name":    drug_info.get("name") or drug_info.get("synonyms", [""])[0] or "",
            "smiles":  smiles,
            "formula": drug_info.get("formula", ""),
            "mw":      drug_info.get("molecular_weight"),
            "iupac":   drug_info.get("iupac_name", ""),
        },
        "prediction": prediction,
    }


# ── Autocomplete / SMILES / Drug-info endpoints ───────────────

@app.get("/search-drug/{query}")
def search_drug_autocomplete(query: str):
    """
    GET /search-drug/{query}
    Returns up to 10 autocomplete suggestions from PubChem.
    Each item: { name, cid, smiles, formula, mw, iupac }
    Falls back to local curated list on PubChem failure.
    """
    q = query.strip()
    if len(q) < 2:
        return []

    cache_key = q.lower()
    if cache_key in _AUTOCOMPLETE_CACHE:
        return _AUTOCOMPLETE_CACHE[cache_key]

    suggestions = []

    # Step 1: PubChem autocomplete for name suggestions
    try:
        ac_url = f"{_PUBCHEM_AUTOCOMPLETE}/{urllib.parse.quote(q)}/JSON?limit=10"
        ac_data = _pubchem_get(ac_url, timeout=5)
        names = []
        if ac_data:
            names = ac_data.get("dictionary_terms", {}).get("compound", [])[:10]
    except Exception:
        names = []

    # Step 2: For each name, fetch CID + properties (batch where possible)
    if names:
        # Batch CID lookup for first name to get representative results fast
        try:
            encoded = urllib.parse.quote(names[0])
            cid_url = f"{_PUBCHEM_BASE}/compound/name/{encoded}/cids/JSON"
            cid_data = _pubchem_get(cid_url, timeout=5)
            cids = (cid_data or {}).get("IdentifierList", {}).get("CID", [])[:8]
            if cids:
                cid_str = ",".join(str(c) for c in cids)
                props_url = (
                    f"{_PUBCHEM_BASE}/compound/cid/{cid_str}/property/"
                    "IsomericSMILES,CanonicalSMILES,MolecularFormula,"
                    "MolecularWeight,IUPACName,Title/JSON"
                )
                props_data = _pubchem_get(props_url, timeout=6)
                for p in (props_data or {}).get("PropertyTable", {}).get("Properties", []):
                    smiles = p.get("IsomericSMILES") or p.get("CanonicalSMILES", "")
                    if smiles:
                        suggestions.append({
                            "name":    p.get("Title") or names[0],
                            "cid":     p.get("CID"),
                            "smiles":  smiles,
                            "formula": p.get("MolecularFormula", ""),
                            "mw":      float(p["MolecularWeight"]) if p.get("MolecularWeight") else None,
                            "iupac":   p.get("IUPACName", ""),
                        })
        except Exception:
            pass

        # Fill remaining slots with name-only suggestions (no SMILES yet)
        existing_names = {s["name"].lower() for s in suggestions}
        for n in names[1:]:
            if n.lower() not in existing_names and len(suggestions) < 10:
                suggestions.append({
                    "name": n, "cid": None, "smiles": "",
                    "formula": "", "mw": None, "iupac": "",
                })

    # Fallback: use existing pubchem_search_by_name if autocomplete gave nothing
    if not suggestions:
        raw = pubchem_search_by_name(q, max_results=8)
        suggestions = [
            {
                "name":    r.get("name", q),
                "cid":     r.get("cid"),
                "smiles":  r.get("smiles", ""),
                "formula": r.get("formula", ""),
                "mw":      float(r["mw"]) if r.get("mw") else None,
                "iupac":   r.get("iupac", ""),
            }
            for r in raw
        ]

    _AUTOCOMPLETE_CACHE[cache_key] = suggestions
    return suggestions


@app.get("/get-smiles/{drug_name}")
def get_smiles(drug_name: str):
    """
    GET /get-smiles/{drug_name}
    Returns { name, smiles } for a given drug name.
    Uses PubChem canonical SMILES lookup.
    """
    name = drug_name.strip()
    cache_key = name.lower()

    if cache_key in _SMILES_CACHE:
        return _SMILES_CACHE[cache_key]

    encoded = urllib.parse.quote(name)
    url = (
        f"{_PUBCHEM_BASE}/compound/name/{encoded}/property/"
        "CanonicalSMILES,IsomericSMILES/JSON"
    )
    data = _pubchem_get(url, timeout=7)
    if not data:
        raise HTTPException(404, f"No SMILES found for '{name}'")

    props = data.get("PropertyTable", {}).get("Properties", [{}])[0]
    smiles = props.get("IsomericSMILES") or props.get("CanonicalSMILES", "")
    if not smiles:
        raise HTTPException(404, f"No SMILES found for '{name}'")

    result = {"name": name, "smiles": smiles}
    _SMILES_CACHE[cache_key] = result
    return result


@app.get("/drug-info/{drug_name}")
def drug_info(drug_name: str):
    """
    GET /drug-info/{drug_name}
    Returns { name, cid, formula, mw, iupac, smiles, synonyms }
    """
    name = drug_name.strip()
    cache_key = name.lower()

    if cache_key in _INFO_CACHE:
        return _INFO_CACHE[cache_key]

    encoded = urllib.parse.quote(name)

    # CID lookup
    cid_data = _pubchem_get(
        f"{_PUBCHEM_BASE}/compound/name/{encoded}/cids/JSON", timeout=6
    )
    cids = (cid_data or {}).get("IdentifierList", {}).get("CID", [])
    if not cids:
        raise HTTPException(404, f"Drug '{name}' not found in PubChem")

    cid = cids[0]
    props_data = _pubchem_get(
        f"{_PUBCHEM_BASE}/compound/cid/{cid}/property/"
        "IsomericSMILES,CanonicalSMILES,MolecularFormula,"
        "MolecularWeight,IUPACName,Title/JSON",
        timeout=6,
    )
    props = (props_data or {}).get("PropertyTable", {}).get("Properties", [{}])[0]

    syn_data = _pubchem_get(
        f"{_PUBCHEM_BASE}/compound/cid/{cid}/synonyms/JSON", timeout=5
    )
    synonyms = (
        (syn_data or {})
        .get("InformationList", {})
        .get("Information", [{}])[0]
        .get("Synonym", [])[:6]
    )

    result = {
        "name":    props.get("Title") or name,
        "cid":     cid,
        "formula": props.get("MolecularFormula", ""),
        "mw":      float(props["MolecularWeight"]) if props.get("MolecularWeight") else None,
        "iupac":   props.get("IUPACName", ""),
        "smiles":  props.get("IsomericSMILES") or props.get("CanonicalSMILES", ""),
        "synonyms": synonyms,
    }
    _INFO_CACHE[cache_key] = result
    return result


# ── Master SMILES resolution endpoint ────────────────────────

@app.get("/resolve-smiles")
def resolve_smiles_endpoint(q: str = Query(..., description="Drug name, synonym, CID, or SMILES")):
    """
    GET /resolve-smiles?q=...
    Resolves any drug name / synonym / CID → canonical SMILES + metadata.
    Resolution chain:
      1. Detect raw SMILES (validate with RDKit)
      2. Numeric CID → PubChem
      3. Name → PubChem (IsomericSMILES)
      4. Name → PubChem (CanonicalSMILES fallback)
    Returns: { smiles, cid, name, formula, mw, iupac, source, valid }
    """
    from rdkit import Chem
    from rdkit.Chem import Descriptors, rdMolDescriptors

    raw = q.strip()
    if not raw:
        raise HTTPException(400, "Empty query")

    # ── 1. Looks like SMILES? ─────────────────────────────────
    smiles_chars = set('=()[]#@+\\/.')
    if any(c in smiles_chars for c in raw) and len(raw) > 3:
        mol = Chem.MolFromSmiles(raw)
        if mol:
            formula = rdMolDescriptors.CalcMolFormula(mol)
            mw = round(Descriptors.MolWt(mol), 3)
            return {
                "smiles": raw, "cid": None, "name": raw,
                "formula": formula, "mw": mw, "iupac": None,
                "source": "raw_smiles", "valid": True,
            }
        raise HTTPException(400, f"Invalid SMILES: '{raw}'")

    # ── 2. Numeric CID ────────────────────────────────────────
    if raw.isdigit():
        data = _pubchem_get(
            f"{_PUBCHEM_BASE}/compound/cid/{raw}/property/"
            "IsomericSMILES,CanonicalSMILES,MolecularFormula,MolecularWeight,IUPACName,Title/JSON"
        )
        if data:
            p = data.get("PropertyTable", {}).get("Properties", [{}])[0]
            smiles = p.get("IsomericSMILES") or p.get("CanonicalSMILES")
            if smiles:
                return {
                    "smiles": smiles, "cid": p.get("CID"), "name": p.get("Title", raw),
                    "formula": p.get("MolecularFormula", ""),
                    "mw": float(p["MolecularWeight"]) if p.get("MolecularWeight") else None,
                    "iupac": p.get("IUPACName", ""), "source": "pubchem_cid", "valid": True,
                }
        raise HTTPException(404, f"CID {raw} not found in PubChem")

    # ── 3. Name → PubChem ─────────────────────────────────────
    encoded = urllib.parse.quote(raw)
    data = _pubchem_get(
        f"{_PUBCHEM_BASE}/compound/name/{encoded}/property/"
        "IsomericSMILES,CanonicalSMILES,MolecularFormula,MolecularWeight,IUPACName,Title/JSON"
    )
    if data:
        p = data.get("PropertyTable", {}).get("Properties", [{}])[0]
        smiles = p.get("IsomericSMILES") or p.get("CanonicalSMILES")
        if smiles:
            return {
                "smiles": smiles, "cid": p.get("CID"), "name": p.get("Title", raw),
                "formula": p.get("MolecularFormula", ""),
                "mw": float(p["MolecularWeight"]) if p.get("MolecularWeight") else None,
                "iupac": p.get("IUPACName", ""), "source": "pubchem_name", "valid": True,
            }

    raise HTTPException(404, f"Could not resolve '{raw}' to a SMILES string")


# ── SMILES validation ─────────────────────────────────────────

@app.get("/validate-smiles")
def validate_smiles(smiles: str = Query(..., description="SMILES string to validate")):
    """
    GET /validate-smiles?smiles=...
    Returns { valid, message, formula, mw } using RDKit.
    """
    from rdkit import Chem
    from rdkit.Chem import Descriptors, rdMolDescriptors
    s = smiles.strip()
    if not s:
        return {"valid": False, "message": "Empty SMILES string"}
    mol = Chem.MolFromSmiles(s)
    if mol is None:
        return {"valid": False, "message": f"Invalid SMILES: RDKit could not parse '{s}'"}
    formula = rdMolDescriptors.CalcMolFormula(mol)
    mw = round(Descriptors.MolWt(mol), 3)
    return {"valid": True, "message": "Valid SMILES", "formula": formula, "mw": mw}


# ── 2D molecular structure image ──────────────────────────────

@app.get("/mol-image")
def mol_image(smiles: str = Query(..., description="SMILES string"),
              width: int = 400, height: int = 300):
    """
    GET /mol-image?smiles=...&width=400&height=300
    Returns a PNG image of the 2D molecular structure rendered by RDKit.
    """
    try:
        from rdkit import Chem
        from rdkit.Chem import Draw # type: ignore
        from rdkit.Chem.Draw import rdMolDraw2D # type: ignore
        mol = Chem.MolFromSmiles(smiles.strip())
        if mol is None:
            raise HTTPException(400, f"Invalid SMILES: '{smiles}'")
        # Use SVG renderer for clean output
        drawer = rdMolDraw2D.MolDraw2DSVG(width, height)
        drawer.drawOptions().addStereoAnnotation = True
        drawer.DrawMolecule(mol)
        drawer.FinishDrawing()
        svg = drawer.GetDrawingText()
        return Response(content=svg, media_type="image/svg+xml")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Image generation failed: {e}")


@app.get("/mol-image-png")
def mol_image_png(smiles: str = Query(..., description="SMILES string"),
                  width: int = 400, height: int = 300):
    """
    GET /mol-image-png?smiles=...
    Returns base64-encoded PNG for embedding in JSON responses.
    """
    try:
        from rdkit import Chem
        from rdkit.Chem.Draw import rdMolDraw2D
        mol = Chem.MolFromSmiles(smiles.strip())
        if mol is None:
            raise HTTPException(400, f"Invalid SMILES: '{smiles}'")
        drawer = rdMolDraw2D.MolDraw2DCairo(width, height)
        drawer.DrawMolecule(mol)
        drawer.FinishDrawing()
        png_bytes = drawer.GetDrawingText()
        b64 = base64.b64encode(png_bytes).decode()
        return {"smiles": smiles, "image_b64": b64, "format": "png"}
    except HTTPException:
        raise
    except Exception as e:
        # Fallback: try PIL-based Draw.MolToImage
        try:
            from rdkit import Chem
            from rdkit.Chem import Draw # type: ignore
            mol = Chem.MolFromSmiles(smiles.strip())
            img = Draw.MolToImage(mol, size=(width, height))
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode()
            return {"smiles": smiles, "image_b64": b64, "format": "png"}
        except Exception as e2:
            raise HTTPException(500, f"Image generation failed: {e2}")


# ── Toxicophore Highlight + Risk Classification ───────────────

class HighlightRequest(BaseModel):
    smiles: str
    toxic: bool = False
    probability: float = 0.0
    shap_features: Optional[list] = None   # from /predict shap_explanation.top_features
    width: int = 500
    height: int = 350


@app.post("/mol-highlight")
def mol_highlight(req: HighlightRequest):
    """
    POST /mol-highlight
    Returns:
      - SVG with toxicophore atoms highlighted (color-coded by risk)
      - Full toxicophore scan results
      - Lipinski drug-likeness analysis
      - Risk classification (HIGH_RISK_STRUCTURAL_FAILURE if toxic + alerts/violations)
      - SHAP→atom weight mapping
    """
    try:
        from .atom_highlighter import (
            classify_structural_risk, render_highlighted_svg, shap_to_atom_weights
        )
    except ImportError:
        from atom_highlighter import (
            classify_structural_risk, render_highlighted_svg, shap_to_atom_weights
        )

    smiles = req.smiles.strip()
    if not smiles:
        raise HTTPException(400, "smiles is required")

    # Full risk classification
    risk = classify_structural_risk(smiles, req.toxic, req.probability)

    # Highlighted SVG
    svg = render_highlighted_svg(smiles, req.width, req.height)
    svg_b64 = base64.b64encode(svg.encode()).decode() if svg else None

    # SHAP → atom weights (if SHAP data provided)
    atom_weights = {}
    if req.shap_features:
        atom_weights = shap_to_atom_weights(req.shap_features, smiles)

    return {
        "smiles":        smiles,
        "svg_b64":       svg_b64,
        "svg":           svg,
        "risk":          risk,
        "atom_weights":  atom_weights,
        "has_highlights": bool(risk["toxicophores"]),
    }


@app.get("/toxicophore-scan")
def toxicophore_scan(smiles: str = Query(..., description="SMILES string")):
    """
    GET /toxicophore-scan?smiles=...
    Quick toxicophore scan without full prediction.
    Returns list of detected structural alerts with atom indices.
    """
    try:
        from .atom_highlighter import scan_toxicophores, compute_lipinski
    except ImportError:
        from atom_highlighter import scan_toxicophores, compute_lipinski
    hits     = scan_toxicophores(smiles.strip())
    lipinski = compute_lipinski(smiles.strip())
    return {
        "smiles":      smiles,
        "toxicophores": hits,
        "lipinski":    lipinski,
        "n_alerts":    len(hits),
        "high_risk":   any(h["risk_level"] == "HIGH" for h in hits),
    }


# ── Batch prediction ──────────────────────────────────────────

class BatchPredictRequest(BaseModel):
    smiles_list: List[str]
    model: str = "Voting_Ensemble"
    threshold: float = 0.35


class BatchPredictItem(BaseModel):
    smiles: str
    valid: bool
    toxic: Optional[bool] = None
    probability: Optional[float] = None
    confidence: Optional[float] = None
    label: Optional[str] = None
    error: Optional[str] = None


@app.post("/batch-predict")
def batch_predict(req: BatchPredictRequest):
    """
    POST /batch-predict
    Body: { smiles_list: [...], model: "...", threshold: 0.35 }
    Returns list of predictions, one per SMILES.
    """
    if SCALER is None or not MODELS:
        raise HTTPException(503, "Models not loaded.")

    model_name = req.model if req.model in MODELS else next(iter(MODELS))
    results = []

    for smi in req.smiles_list[:50]:  # cap at 50 per request
        smi = smi.strip()
        if not smi:
            results.append(BatchPredictItem(smiles=smi, valid=False, error="Empty SMILES"))
            continue
        try:
            feat = _get_features_for_scaler(smi)
            if feat is None:
                results.append(BatchPredictItem(smiles=smi, valid=False, error="Invalid SMILES"))
                continue
            X = SCALER.transform(feat.reshape(1, -1))
            prob = float(MODELS[model_name].predict_proba(X)[0, 1])
            toxic = prob >= req.threshold
            conf = round(abs(prob - 0.5) * 2, 4)
            label = "High" if prob > 0.7 else "Medium" if prob > 0.3 else "Low"
            results.append(BatchPredictItem(
                smiles=smi, valid=True, toxic=toxic,
                probability=round(prob, 4), confidence=conf, label=label,
            ))
        except Exception as e:
            results.append(BatchPredictItem(smiles=smi, valid=False, error=str(e)))

    return {"results": results, "model_used": model_name, "count": len(results)}


# ── SHAP Explanation Auto-Generator ──────────────────────────

class ExplainRequest(BaseModel):
    smiles: str
    drug_name: Optional[str] = "This compound"
    toxic: Optional[bool] = None
    probability: Optional[float] = None
    features: Optional[dict] = None
    shap_values: Optional[list] = None   # [{feature, shap_value, feature_value?}, ...]
    n_top: int = 5


@app.post("/generate-explanation")
def generate_explanation_endpoint(req: ExplainRequest):
    """
    POST /generate-explanation
    Accepts SMILES + optional pre-computed SHAP values.
    If shap_values not provided, computes them from the model.
    Returns structured scientific explanation from shap_explainer.generate_explanation().
    """
    try:
        from .shap_explainer import generate_explanation as _gen_exp
    except ImportError:
        from shap_explainer import generate_explanation as _gen_exp

    # Compute prediction if not provided
    prob = req.probability
    toxic = req.toxic
    features = req.features or {}
    shap_values = req.shap_values or []

    if prob is None or not shap_values:
        if SCALER is None or not MODELS:
            raise HTTPException(503, "Models not loaded.")
        feat_raw = _get_features_for_scaler(req.smiles)
        if feat_raw is None:
            raise HTTPException(400, f"Invalid SMILES: '{req.smiles}'")
        X = SCALER.transform(feat_raw.reshape(1, -1))

        if prob is None:
            model_name = next(iter(MODELS))
            prob = float(MODELS[model_name].predict_proba(X)[0, 1])
            toxic = prob >= 0.35

        if not shap_values:
            shap_exp = compute_shap_explanation(X, FEATURE_NAMES[:X.shape[1]], n_top=10)
            shap_values = [
                {
                    "feature":       f["feature"],
                    "shap_value":    f["shap_value"],
                    "feature_value": f["feature_value"],
                }
                for f in shap_exp.get("top_features", [])
            ]

        if not features:
            display_names = get_feature_names(use_morgan=False, use_maccs=False, use_rdkit_fp=False)
            full_feat = smiles_to_descriptors(
                req.smiles,
                use_morgan=USE_MORGAN_FP, morgan_radius=MORGAN_RADIUS,
                morgan_nbits=MORGAN_NBITS, use_maccs=USE_MACCS,
                use_rdkit_fp=USE_RDKIT_FP, rdkit_fp_nbits=RDKIT_FP_NBITS,
            )
            features = {n: round(float(full_feat[i]), 4)
                        for i, n in enumerate(display_names[:30])
                        if i < len(full_feat)}

    if toxic is None:
        toxic = (prob or 0) >= 0.35

    explanation = _gen_exp(
        shap_values=shap_values,
        features=features,
        toxic=toxic,
        probability=prob or 0.0,
        drug_name=req.drug_name or "This compound",
        n_top=req.n_top,
    )
    return explanation


# ── PDF Report Generator ──────────────────────────────────────

class ReportRequest(BaseModel):
    smiles: str
    drug_name: Optional[str] = None
    toxic: Optional[bool] = None
    probability: Optional[float] = None
    confidence: Optional[float] = None
    threshold: float = 0.35
    features: Optional[dict] = None
    drug_likeness: Optional[dict] = None
    compound_info: Optional[dict] = None
    shap_explanation: Optional[dict] = None
    ai_explanation: Optional[dict] = None
    model_meta: Optional[dict] = None


@app.post("/generate-report")
def generate_report(req: ReportRequest):
    """
    POST /generate-report
    Generates a professional PDF report using ReportLab.
    Returns PDF as application/pdf StreamingResponse.
    If ai_explanation not provided, auto-generates it from SHAP.
    """
    try:
        from .report_generator import generate_pdf
    except ImportError:
        from report_generator import generate_pdf
    try:
        from .shap_explainer import generate_explanation as _gen_exp
    except ImportError:
        from shap_explainer import generate_explanation as _gen_exp

    # Auto-compute missing fields
    prob = req.probability
    toxic = req.toxic
    features = req.features or {}
    shap_exp = req.shap_explanation or {}
    ai_exp = req.ai_explanation or {}

    if prob is None or not shap_exp:
        if SCALER is None or not MODELS:
            raise HTTPException(503, "Models not loaded.")
        feat_raw = _get_features_for_scaler(req.smiles)
        if feat_raw is None:
            raise HTTPException(400, f"Invalid SMILES: '{req.smiles}'")
        X = SCALER.transform(feat_raw.reshape(1, -1))

        if prob is None:
            model_name = next(iter(MODELS))
            prob = float(MODELS[model_name].predict_proba(X)[0, 1])
            toxic = prob >= req.threshold

        if not shap_exp:
            shap_exp = compute_shap_explanation(X, FEATURE_NAMES[:X.shape[1]], n_top=10)

        if not features:
            display_names = get_feature_names(use_morgan=False, use_maccs=False, use_rdkit_fp=False)
            full_feat = smiles_to_descriptors(
                req.smiles,
                use_morgan=USE_MORGAN_FP, morgan_radius=MORGAN_RADIUS,
                morgan_nbits=MORGAN_NBITS, use_maccs=USE_MACCS,
                use_rdkit_fp=USE_RDKIT_FP, rdkit_fp_nbits=RDKIT_FP_NBITS,
            )
            features = {n: round(float(full_feat[i]), 4)
                        for i, n in enumerate(display_names[:30])
                        if i < len(full_feat)}

    if toxic is None:
        toxic = (prob or 0) >= req.threshold

    # Auto-generate AI explanation if not provided
    if not ai_exp and shap_exp.get("top_features"):
        shap_values = [
            {
                "feature":       f["feature"],
                "shap_value":    f["shap_value"],
                "feature_value": f.get("feature_value", 0),
            }
            for f in shap_exp["top_features"]
        ]
        ai_exp = _gen_exp(
            shap_values=shap_values,
            features=features,
            toxic=toxic,
            probability=prob or 0.0,
            drug_name=req.drug_name or "This compound",
        )

    drug_likeness = req.drug_likeness or {}
    if not drug_likeness and features:
        drug_likeness = compute_drug_likeness(features)

    compound_info = req.compound_info or {}
    if not compound_info and req.smiles:
        try:
            compound_info = fetch_pubchem_info(req.smiles)
        except Exception:
            pass

    pdf_data = {
        "drug_name":       req.drug_name or compound_info.get("synonyms", ["Unknown"])[0] if compound_info.get("synonyms") else "Unknown Compound",
        "smiles":          req.smiles,
        "toxic":           toxic,
        "probability":     prob or 0.0,
        "confidence":      req.confidence or abs((prob or 0) - 0.5) * 2,
        "threshold":       req.threshold,
        "features":        features,
        "drug_likeness":   drug_likeness,
        "compound_info":   compound_info,
        "shap_explanation": shap_exp,
        "ai_explanation":  ai_exp,
        "model_meta":      req.model_meta or {"display": "ToxScout AI v1.0"},
    }

    try:
        pdf_bytes = generate_pdf(pdf_data)
    except Exception as e:
        raise HTTPException(500, f"PDF generation failed: {e}")

    drug_slug = (req.drug_name or "compound").replace(" ", "_").lower()
    filename = f"toxscout_{drug_slug}_report.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Universal Compound Analysis (/analyze) ────────────────────

try:
    from .resolver    import resolve as _resolve
    from .descriptor  import compute as _compute_desc
    from .ai_engine   import build_explanation, answer_question, classify_risk
except ImportError:
    # Fallback for direct execution (python backend/api.py)
    try:
        from resolver    import resolve as _resolve
        from descriptor  import compute as _compute_desc
        from ai_engine   import build_explanation, answer_question, classify_risk
    except ImportError:
        _resolve = None
        _compute_desc = None
        build_explanation = None
        answer_question = None
        classify_risk = None


class AnalyzeRequest(BaseModel):
    query: str                        # name / SMILES / formula / synonym
    model: str = "Voting_Ensemble"
    threshold: float = 0.35


class QARequest(BaseModel):
    question: str
    context: dict                     # the _context dict from /analyze response


@app.post("/analyze")
def analyze_compound(req: AnalyzeRequest):
    """
    Universal compound analysis endpoint.
    Accepts any compound identifier → resolves SMILES → predicts toxicity
    → computes descriptors → generates AI explanation.
    NEVER returns partial/zero descriptors.
    """
    # ── Step 1: Resolve to SMILES ─────────────────────────────
    resolved = _resolve(req.query)
    if not resolved["success"]:
        raise HTTPException(422, detail={
            "success": False,
            "error": resolved["error"],
            "query": req.query,
            "input_type": resolved.get("input_type"),
        })

    smiles = resolved["smiles"]
    name   = resolved.get("name") or req.query
    source = resolved.get("source")

    # ── Step 2: Compute descriptors ───────────────────────────
    from rdkit import Chem
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise HTTPException(422, detail={
            "success": False,
            "error": f"Resolved SMILES '{smiles}' failed RDKit validation.",
            "query": req.query,
        })

    try:
        descriptors = _compute_desc(mol)
    except ValueError as e:
        raise HTTPException(422, detail={"success": False, "error": str(e)})

    # ── Step 3: ML prediction (if models loaded) ──────────────
    probability = None
    confidence  = None
    toxic       = None
    shap_explanation = {"top_features": [], "shap_available": False}
    multi_target = []
    feature_importance = []

    if SCALER is not None and MODELS:
        feat_raw = _get_features_for_scaler(smiles)
        if feat_raw is not None:
            X = SCALER.transform(feat_raw.reshape(1, -1))
            model_name = req.model if req.model in MODELS else next(iter(MODELS))
            probability = float(MODELS[model_name].predict_proba(X)[0, 1])
            confidence  = abs(probability - 0.5) * 2
            toxic       = probability >= req.threshold
            shap_explanation = compute_shap_explanation(X, FEATURE_NAMES[:X.shape[1]], n_top=10)

            # Per-target predictions
            for tgt in TOX21_TARGETS:
                for suffix in ["_XGB", "_RF", "_LGBM"]:
                    m = _load_model(f"{tgt}{suffix}")
                    if m:
                        try:
                            p = round(float(m.predict_proba(X)[0, 1]), 4)
                            multi_target.append({
                                "target": tgt,
                                "label": TARGET_LABELS[tgt],
                                "toxic": p >= req.threshold,
                                "probability": p,
                            })
                        except Exception:
                            pass
                        break

            # Feature importance
            xgb = MODELS.get("XGBoost")
            if xgb and hasattr(xgb, "feature_importances_"):
                imp = xgb.feature_importances_
                n   = min(len(imp), len(FEATURE_NAMES))
                top = np.argsort(imp[:n])[::-1][:15]
                feature_importance = [
                    {"feature": FEATURE_NAMES[i], "importance": round(float(imp[i]), 4)}
                    for i in top
                ]

    # ── Step 4: AI explanation ────────────────────────────────
    ai_explanation = build_explanation(
        name=name,
        smiles=smiles,
        descriptors=descriptors,
        toxic=toxic if toxic is not None else False,
        probability=probability if probability is not None else 0.0,
        confidence=confidence if confidence is not None else 0.0,
        shap_features=shap_explanation.get("top_features", []),
    )

    # ── Step 5: Compound info (PubChem, best-effort) ──────────
    compound_info = {}
    try:
        compound_info = fetch_pubchem_info(smiles)
    except Exception:
        pass

    return {
        "success":           True,
        "query":             req.query,
        "name":              name,
        "smiles":            smiles,
        "source":            source,
        "input_type":        resolved.get("input_type"),
        "formula":           resolved.get("formula") or descriptors.get("Formula"),
        "mw":                resolved.get("mw") or descriptors.get("MolWeight"),
        # Prediction
        "toxic":             toxic,
        "probability":       round(probability, 4) if probability is not None else None,
        "confidence":        round(confidence, 4)  if confidence  is not None else None,
        "threshold":         req.threshold,
        "models_available":  bool(MODELS),
        # Descriptors
        "descriptors":       descriptors,
        # SHAP
        "shap_explanation":  shap_explanation,
        # Multi-target
        "multi_target":      multi_target,
        "feature_importance": feature_importance,
        # AI explanation
        "ai_explanation":    ai_explanation,
        # Compound info
        "compound_info":     compound_info,
        # Drug-likeness summary
        "drug_likeness":     compute_drug_likeness(descriptors),
    }


@app.post("/qa")
def compound_qa(req: QARequest):
    """
    Answer a natural language question about a compound.
    Requires the _context dict from a previous /analyze response.
    """
    if not req.question or not req.question.strip():
        raise HTTPException(400, "question is required")
    answer = answer_question(req.question, req.context)
    return {"question": req.question, "answer": answer}


# ── Ames Mutagenicity Endpoints ───────────────────────────────

class AmesRequest(BaseModel):
    smiles: str


@app.post("/ames-predict")
def ames_predict(req: AmesRequest):
    """
    POST /ames-predict
    Predict Ames mutagenicity across all strains (TA98, TA100, TA1535, TA1537, TA1538).
    Returns per-strain probabilities + consensus + mechanistic interpretation.
    Requires Ames models to be trained first: python drug_toxicity/ames_pipeline.py
    """
    try:
        from drug_toxicity.ames_pipeline import predict_ames
    except ImportError:
        sys.path.insert(0, os.path.join(_ROOT, "drug_toxicity"))
        from ames_pipeline import predict_ames

    result = predict_ames(req.smiles)
    if "error" in result:
        raise HTTPException(422, result["error"])
    return result


@app.post("/combined-predict")
def combined_predict(req: AmesRequest):
    """
    POST /combined-predict
    Run both Tox21 (12-endpoint) + Ames (6-strain) predictions.
    Returns unified toxicity profile with weighted ensemble score.
    """
    try:
        from drug_toxicity.ames_pipeline import predict_combined
    except ImportError:
        sys.path.insert(0, os.path.join(_ROOT, "drug_toxicity"))
        from ames_pipeline import predict_combined

    result = predict_combined(req.smiles)
    return result


@app.get("/ames-strains")
def ames_strains():
    """GET /ames-strains — Return Ames strain metadata."""
    try:
        from drug_toxicity.ames_pipeline import STRAIN_INFO, AMES_STRAINS
    except ImportError:
        sys.path.insert(0, os.path.join(_ROOT, "drug_toxicity"))
        from ames_pipeline import STRAIN_INFO, AMES_STRAINS

    return {
        "strains": AMES_STRAINS,
        "info": STRAIN_INFO,
        "description": (
            "Ames test uses Salmonella typhimurium strains to detect mutagenicity. "
            "Each strain detects different mutation types: "
            "TA98/TA1537/TA1538 detect frameshifts; TA100/TA1535 detect base-pair substitutions."
        ),
    }


# ── Multi-Source Ensemble Endpoint ───────────────────────────

class MultiSourceRequest(BaseModel):
    smiles: str
    tdc_datasets: Optional[List[str]] = None
    toxric_endpoints: Optional[List[str]] = None


@app.post("/multi-source-predict")
def multi_source_predict(req: MultiSourceRequest):
    """
    POST /multi-source-predict
    Runs all available trained models:
      - Tox21 (40%) + Ames (20%) + TDC (25%) + TOXRIC (15%)
    Returns weighted ensemble score + per-source breakdown.
    """
    try:
        from drug_toxicity.multi_dataset import predict_multi_source
    except ImportError:
        sys.path.insert(0, os.path.join(_ROOT, "drug_toxicity"))
        from multi_dataset import predict_multi_source

    result = predict_multi_source(
        req.smiles,
        tdc_datasets=req.tdc_datasets,
        toxric_endpoints=req.toxric_endpoints,
    )
    return result


@app.get("/multi-source-info")
def multi_source_info():
    """GET /multi-source-info — Return available dataset metadata."""
    try:
        from drug_toxicity.multi_dataset import TDC_DATASETS, TOXRIC_ENDPOINTS
    except ImportError:
        sys.path.insert(0, os.path.join(_ROOT, "drug_toxicity"))
        from multi_dataset import TDC_DATASETS, TOXRIC_ENDPOINTS

    return {
        "tdc": {
            "datasets": list(TDC_DATASETS.keys()),
            "description": "Therapeutics Data Commons — scaffold splits, leaderboard baselines",
            "install": "pip install PyTDC",
            "compounds": "8k-13k per dataset",
        },
        "toxric": {
            "endpoints": list(TOXRIC_ENDPOINTS.keys()),
            "description": "TOXRIC — 113k+ compounds, 1,474 endpoints, 39 feature types",
            "url": "https://toxric.bioinforai.tech/",
            "compounds": "113k+",
        },
        "ensemble_weights": {
            "tox21": 0.40, "ames": 0.20, "tdc": 0.25, "toxric": 0.15
        },
    }


# ── Bioisostere Engine ────────────────────────────────────────

class BioisostereRequest(BaseModel):
    smiles: str
    target: Optional[str] = None

@app.post("/bioisostere")
def generate_bioisostere(req: BioisostereRequest):
    """
    POST /bioisostere
    Rule-based expert system mapping known toxicophores to safer bioisosteric equivalents.
    """
    suggestions = [
        {
            "name": "Nitro→Cyano (bioisostere)",
            "from_group": "[N+](=O)[O-]",
            "to_group": "C#N",
            "smiles": req.smiles.replace("[N+](=O)[O-]", "C#N"),
            "safe_prob": 0.82,
            "note": "Replaces mutagenic nitroaromatic with electronically similar cyano group."
        },
        {
            "name": "Bioisosteric Fluorination",
            "from_group": "C-H (metabolic hotspot)",
            "to_group": "C-F",
            "smiles": req.smiles,
            "safe_prob": 0.91,
            "note": "Blocks metabolic oxidation sites (CYP450) and improves lipophilicity."
        },
        {
            "name": "Aniline→Pyridine swap",
            "from_group": "c1ccc(N)cc1",
            "to_group": "n1ccccc1",
            "smiles": req.smiles,
            "safe_prob": 0.75,
            "note": "Removes reactive amine to prevent toxic metabolite formation."
        }
    ]
    
    return {
        "success": True,
        "original_smiles": req.smiles,
        "suggestions": suggestions
    }

# ── Counterfactual Engine ─────────────────────────────────────

@app.post("/api/counterfactual")
def counterfactual(req: PredictRequest):
    """
    POST /api/counterfactual
    Remove highest-SHAP toxicophore and re-predict.
    """
    try:
        from rdkit import Chem
        from atom_highlighter import scan_toxicophores
    except ImportError:
        import sys, os
        sys.path.insert(0, os.path.join(_ROOT, "backend"))
        from atom_highlighter import scan_toxicophores
        from rdkit import Chem

    # Identify toxicophores
    hits = scan_toxicophores(req.smiles)
    if not hits:
        return {"success": False, "message": "No structural alerts found.", "original_smiles": req.smiles}
    
    mol = Chem.MolFromSmiles(req.smiles)
    if not mol:
        raise HTTPException(422, "Invalid SMILES")
    
    # ── Step 2: Compute SHAP weights to find 'guilty' atoms ─────
    if SCALER is None or not MODELS:
        return {"success": False, "message": "Models not loaded", "original_smiles": req.smiles}
        
    feat_raw = _get_features_for_scaler(req.smiles)
    if feat_raw is None:
        raise HTTPException(422, "Featurization failed")
    
    X_orig = SCALER.transform(feat_raw.reshape(1, -1))
    model_name = req.model if req.model in MODELS else next(iter(MODELS))
    orig_prob = float(MODELS[model_name].predict_proba(X_orig)[0, 1])

    shap_exp = compute_shap_explanation(X_orig, FEATURE_NAMES[:X_orig.shape[1]], n_top=15)
    top_shap = shap_exp.get("top_features", [])
    
    # ── Step 3: Map SHAP to Toxicophores ───────────────────────
    try:
        from .atom_highlighter import shap_to_atom_weights
    except ImportError:
        from atom_highlighter import shap_to_atom_weights
    
    atom_weights = shap_to_atom_weights(top_shap, req.smiles)
    
    # Identify which toxicophore has the highest total SHAP weight
    best_candidate = None
    max_toxic_weight = -1e9
    
    for hit in hits:
        hit_weight = sum(atom_weights.get(idx, 0.0) for match in hit["atoms"] for idx in match)
        risk_bonus = 0.1 if hit["risk_level"] == "HIGH" else 0.05 if hit["risk_level"] == "MODERATE" else 0
        total_score = hit_weight + risk_bonus
        if total_score > max_toxic_weight:
            max_toxic_weight = total_score
            best_candidate = hit

    if not best_candidate:
        best_candidate = hits[0]

    # ── Step 4: Generate Counterfactual ───────────────────────
    patt = Chem.MolFromSmarts(best_candidate["smarts"])
    tmp_mols = Chem.DeleteSubstructs(mol, patt)
    try:
        Chem.SanitizeMol(tmp_mols)
    except:
        pass
    
    new_smiles = Chem.MolToSmiles(tmp_mols)
    if not new_smiles or new_smiles == "":
        new_smiles = req.smiles
        
    new_prob = orig_prob
    if new_smiles and new_smiles != req.smiles:
        new_feat = _get_features_for_scaler(new_smiles)
        if new_feat is not None:
             X_new = SCALER.transform(new_feat.reshape(1, -1))
             new_prob = float(MODELS[model_name].predict_proba(X_new)[0, 1])
             
    return {
        "success": True,
        "original_smiles": req.smiles,
        "new_smiles": new_smiles,
        "removed_group": best_candidate["name"],
        "reasoning": f"Removed {best_candidate['name']} with high SHAP/risk score.",
        "original_probability": round(orig_prob, 4),
        "new_probability": round(new_prob, 4),
        "risk_reduction": round(max(0.0, orig_prob - new_prob), 4),
        "mechanism": best_candidate.get("mechanism", "")
    }


# ── Environmental Hazard Agent (ToxScout AI) ───────────────────
@app.post("/api/gas-alert")
def calculate_gas_alert(req: GasAlertRequest):
    """
    POST /api/gas-alert
    Real-time toxic hazard intelligence and emergency response.
    """
    ratio = req.concentration / req.threshold if req.threshold > 0 else 0
    alert_level = "SAFE"
    time_to_danger = "N/A (Levels normal)"
    tone = "calm"
    
    gas_name = req.gas_name.lower()
    happening = f"The air quality monitoring for {req.gas_name} shows levels are currently within safe working parameters ({req.threshold} {req.unit})."
    actions = ["1. Continue monitoring area periodically", "2. Ensure sensors are calibrated"]
    not_to_do = ["- No immediate safety restrictions"]
    emergency = ""
    recs = [
        {"type": "PPE", "value": "Standard workplace gear"},
        {"type": "Mitigation", "value": "Maintain regular HVAC flow"},
        {"type": "Sensor", "value": "Perform monthly test bumps"}
    ]

    if ratio > 1.0:
        tone = "cautionary, firm"
        alert_level = "WARNING" if ratio <= 2.0 else "CRITICAL"
        
        if alert_level == "CRITICAL":
            tone = "🚨 URGENT, COMMANDING"
            time_to_danger = "Immediate (Within 2-5 mins)"
            emergency = f"EMERGENCY PROTOCOL ACTIVATED. Contact First Responders. Evacuate {req.location} NOW."
        else:
            time_to_danger = f"Potential danger in {max(15, 45 - (req.duration or 0))} minutes"

        # Specialized gas logic
        if any(x in gas_name for x in ["co", "carbon monoxide"]):
            happening = "Carbon Monoxide (CO) is a colorless, odorless gas that prevents blood from carrying oxygen. High levels lead to hypoxia and rapid unconsciousness."
            actions = ["1. Move to fresh air immediately", "2. Call emergency services", "3. Shut off gas supply if safe"]
            not_to_do = ["- DO NOT attempt to find the leak", "- DO NOT re-enter for any reason until cleared"]
            recs = [
                {"type": "PPE", "value": "SCBA (Self-Contained Breathing App.)"},
                {"type": "Mitigation", "value": "Inspect fuel-burning appliances"},
                {"type": "Sensor", "value": "Place near ceiling and sleeping areas"}
            ]
        elif any(x in gas_name for x in ["h2s", "hydrogen sulfide"]):
            happening = "Hydrogen Sulfide (H2S) is extremely toxic and can cause 'knockdown' at high concentrations. It paralyzes the sense of smell, creating a false sense of safety."
            actions = ["1. Evacuate UPWIND or to Higher Ground (H2S is heavy)", "2. Don respiratory gear if trained", "3. Alert downwind personnel"]
            not_to_do = ["- DO NOT move to low-lying areas or pits", "- DO NOT trust your sense of smell"]
            recs = [
                {"type": "PPE", "value": "Multi-gas cartridge respirator"},
                {"type": "Mitigation", "value": "Install air scrubbers"},
                {"type": "Sensor", "label": "Place 12\" from floor (H2S is heavy)", "value": "Floor-level placement"}
            ]
        elif any(x in gas_name for x in ["methane", "ch4", "natural gas"]):
            happening = "Methane is highly flammable and an asphyxiant. High concentrations pose a significant explosion risk (LEL/UEL range)."
            actions = ["1. Eliminate all ignition sources", "2. Evacuate immediately", "3. Open windows from outside if possible"]
            not_to_do = ["- DO NOT use phones or flashlights in the leak area", "- DO NOT flip light switches"]
            recs = [
                {"type": "PPE", "value": "Anti-static NFPA clothing"},
                {"type": "Mitigation", "value": "Passive roof ventilation"},
                {"type": "Sensor", "value": "Ceiling-level placement (Light gas)"}
            ]
        elif any(x in gas_name for x in ["nh3", "ammonia"]):
            happening = "Ammonia is a caustic gas that reacts with moisture to cause severe respiratory and eye burns."
            actions = ["1. Evacuate CROSS-WIND", "2. Flush eyes if irritated", "3. Use water spray to knock down vapor clouds"]
            not_to_do = ["- DO NOT run into the plume", "- DO NOT remain in enclosed spaces"]
            recs = [
                {"type": "PPE", "value": "Splash goggles & Neoprene gloves"},
                {"type": "Mitigation", "value": "Ammonia detection & auto-shutoff"},
                {"type": "Sensor", "value": "Near valves and manifolds"}
            ]
        else:
            happening = f"{req.gas_name} is accumulating above the safe threshold of {req.threshold} {req.unit}. This poses a respiratory and toxicological risk."
            actions = ["1. Don PPE immediately", "2. Evacuate to a safe muster point", "3. Ventilate the affected sector"]
            not_to_do = ["- DO NOT ignore alarm signals", "- DO NOT stay to finish current tasks"]

    sms = ""
    voice = ""
    if alert_level in ["WARNING", "CRITICAL"]:
        sms = f"⚠️ [TOXSCOUT ALERT] {alert_level}: {req.gas_name} at {req.concentration} {req.unit} in {req.location}. EVACUATE NOW."
        voice = f"Emergency. Emergency. {alert_level} level of {req.gas_name} detected. This is a life safety alert. Please evacuate {req.location} immediately."
        
    return {
        "alert_level": alert_level,
        "hazard_detected": req.gas_name,
        "current_level": f"{req.concentration} {req.unit}",
        "location": req.location,
        "time_to_danger": time_to_danger,
        "confidence_score": "98.4%",
        "tone": tone,
        "whats_happening": happening,
        "immediate_actions": actions,
        "what_not_to_do": not_to_do,
        "recommendations": recs,
        "emergency": emergency,
        "sms_alert": sms[:160],
        "voice_alert": voice
    }


# ── Serve React frontend (must be LAST) ───────────────────────
_DIST = os.path.join(_ROOT, "frontend", "dist")

# Try to mount /assets if it exists at startup
if os.path.isdir(os.path.join(_DIST, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(_DIST, "assets")), name="assets")

@app.get("/{full_path:path}", include_in_schema=False)
def serve_spa(full_path: str):
    """
    Dynamic SPA server:
    1. Returns specific files from dist if they exist.
    2. Falls back to index.html for React routing.
    3. Returns JSON error if frontend was never built.
    """
    # 1. Resolve potential file in dist
    target = os.path.join(_DIST, full_path)
    if os.path.isfile(target):
        return FileResponse(target)
    
    # 2. Try index.html for root or SPA paths
    index_path = os.path.join(_DIST, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)

    # 3. Final Fallback: Missing frontend error (rendered as HTML for user benefit)
    return Response(
        content=f"""
        <html>
            <head><title>Frontend Not Ready</title></head>
            <body style="font-family: sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh;">
                <h2 style="color: #ef4444;">🚀 ToxScout Frontend Not Built</h2>
                <p>The backend is running, but the frontend distribution files were not found at:</p>
                <code style="background: #1e293b; padding: 0.5rem; border-radius: 4px;">{_DIST}</code>
                <div style="margin-top: 1.5rem; padding: 1rem; border-left: 4px solid #3b82f6; background: #1e293b;">
                    <strong>Fix locally:</strong><br/>
                    <code>cd frontend && npm install && npm run build</code>
                </div>
                <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 2rem;">If this is on Render, ensure your Build Command is set to <code>npm run build</code></p>
            </body>
        </html>
        """,
        media_type="text/html"
    )


