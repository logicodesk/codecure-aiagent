# ============================================================
# smiles_resolver.py — Master SMILES Resolution Pipeline
# ============================================================
# Delegates to resolver.py for the full multi-source chain.
# Kept as a thin compatibility shim.
# ============================================================
from backend.resolver import resolve, SYNONYM_DB, FORMULA_DB, detect_input_type, validate_smiles

__all__ = ["resolve", "SYNONYM_DB", "FORMULA_DB", "detect_input_type", "validate_smiles"]
