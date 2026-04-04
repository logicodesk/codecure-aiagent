# ============================================================
# validator.py — Strict SMILES + Descriptor Validation
# ============================================================
from __future__ import annotations
from typing import Optional
from rdkit import Chem
from rdkit.Chem import Descriptors, rdMolDescriptors


def validate_and_info(smiles: str) -> dict:
    """
    Validate SMILES with RDKit. Returns:
    { valid, mol, formula, mw, atom_count, error }
    """
    if not smiles or not smiles.strip():
        return {"valid": False, "mol": None, "error": "Empty SMILES string."}
    try:
        mol = Chem.MolFromSmiles(smiles.strip())
    except Exception as e:
        return {"valid": False, "mol": None, "error": f"RDKit exception: {e}"}

    if mol is None:
        return {"valid": False, "mol": None,
                "error": f"RDKit could not parse SMILES: '{smiles}'"}

    return {
        "valid": True,
        "mol": mol,
        "formula": rdMolDescriptors.CalcMolFormula(mol),
        "mw": round(Descriptors.MolWt(mol), 3),
        "atom_count": mol.GetNumAtoms(),
        "error": None,
    }
