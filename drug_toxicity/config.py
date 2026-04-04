# ============================================================
# config.py — Central configuration
# ============================================================
import os

# ── Paths ─────────────────────────────────────────────────────
_HERE          = os.path.dirname(__file__)
DATA_PATH      = os.path.join(_HERE, "..", "tox21.csv")
ZINC_DATA_PATH = os.path.join(_HERE, "..", "250k_rndm_zinc_drugs_clean_3.csv")
MODEL_DIR      = os.path.join(_HERE, "models")
PLOT_DIR       = os.path.join(_HERE, "plots")

# ChEMBL compound export files (semicolon-delimited)
CHEMBL_PART1   = os.path.join(_HERE, "..", "DOWNLOAD-heRwUfDRJj-nAMSjmA31y8RyPmnAG6YgOpVpkx4anHU_eq_.csv")
CHEMBL_PART2   = os.path.join(_HERE, "..", "DOWNLOAD-heRwUfDRJj-nAMSjmA31y8RyPmnAG6YgOpVpkx4anHU_eq__part2.csv")
CHEMBL_CACHE   = os.path.join(_HERE, "chembl_cache.parquet")

# ── Dataset columns ───────────────────────────────────────────
SMILES_COL = "smiles"

# All 12 Tox21 toxicity targets
TOX21_TARGETS = [
    "NR-AR", "NR-AR-LBD", "NR-AhR", "NR-Aromatase",
    "NR-ER", "NR-ER-LBD", "NR-PPAR-gamma",
    "SR-ARE", "SR-ATAD5", "SR-HSE", "SR-MMP", "SR-p53",
]

# Primary single-target label
LABEL_COL = "SR-ARE"

# ── Fingerprint / feature settings ───────────────────────────
MORGAN_RADIUS  = 2
MORGAN_NBITS   = 1024    # upgraded from 256 — richer structural encoding
USE_MORGAN_FP  = True
USE_MACCS      = True
USE_RDKIT_FP   = True
RDKIT_FP_NBITS = 512     # upgraded from 200

# ── Train/test split ──────────────────────────────────────────
TEST_SIZE    = 0.2
RANDOM_STATE = 42

# ── Class imbalance ───────────────────────────────────────────
USE_SMOTE = True

# ── Outlier removal — IQR multiplier (None = disable) ────────
OUTLIER_IQR_FACTOR = 3.0

# ── Decision threshold ────────────────────────────────────────
DECISION_THRESHOLD = 0.35

# ── Feature selection ─────────────────────────────────────────
VARIANCE_THRESHOLD    = 0.01
CORRELATION_THRESHOLD = 0.97

# ── Scaffold-based splitting ──────────────────────────────────
USE_SCAFFOLD_SPLIT = True

# ── PubChem enrichment (slow — network calls) ─────────────────
USE_PUBCHEM_ENRICHMENT = False
PUBCHEM_CACHE_PATH     = os.path.join(_HERE, "pubchem_cache.csv")

# ── ChEMBL enrichment ─────────────────────────────────────────
USE_CHEMBL_ENRICHMENT = True

# ── TDC (Therapeutics Data Commons) integration ───────────────
# pip install PyTDC
# Augments training data with ClinTox, hERG, AMES, DILI endpoints
USE_TDC             = False   # set True to augment with TDC data
TDC_ENDPOINTS_USE   = ["tox21", "herg", "ames", "dili"]  # endpoints to load
TDC_SPLIT_METHOD    = "scaffold"   # 'scaffold' | 'random' | 'cold_drug'
TDC_CACHE_DIR       = os.path.join(_HERE, "data_cache")

# ── TOXRIC integration ────────────────────────────────────────
# Download CSVs from https://toxric.bioinforai.tech/download
# Set USE_TOXRIC=True and provide paths to downloaded files
USE_TOXRIC          = True   # enabled — file is in workspace
TOXRIC_PATHS        = {
    # Acute oral toxicity (mouse, intraperitoneal, LD50)
    # 35,299 compounds · continuous log10(mmol/kg) LD50
    # Binarized: LD50 < 2.3 (≈200 mg/kg) → toxic=1
    "acute_ld50": os.path.join(_HERE, "toxric_acute_ld50.csv"),
}

# ── Drug-likeness augmentation ────────────────────────────────
# Adds dl_* columns (QED, Lipinski score, Veber, lead-likeness)
# and risk_flag ('HIGH_RISK_STRUCTURAL_FAILURE', etc.)
AUGMENT_DRUG_LIKENESS = True
FLAG_HIGH_RISK        = True

os.makedirs(MODEL_DIR,   exist_ok=True)
os.makedirs(PLOT_DIR,    exist_ok=True)
os.makedirs(TDC_CACHE_DIR, exist_ok=True)
