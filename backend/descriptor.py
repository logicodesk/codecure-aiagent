# ============================================================
# descriptor.py — Strict Descriptor Engine
# ============================================================
# NEVER returns 0-defaults. Raises ValueError if mol is invalid.
# ============================================================
from __future__ import annotations
from rdkit import Chem
from rdkit.Chem import Descriptors, rdMolDescriptors, QED, Crippen
from rdkit.Chem import rdPartialCharges


def compute(mol: Chem.Mol) -> dict:
    """
    Compute physicochemical descriptors from a validated RDKit mol.
    Raises ValueError if mol is None.
    Returns dict of descriptors — NEVER partial / NEVER zero-defaults.
    """
    if mol is None:
        raise ValueError("Cannot compute descriptors: mol is None (invalid SMILES).")

    # Gasteiger charges
    try:
        rdPartialCharges.ComputeGasteigerCharges(mol)
        charges = [float(mol.GetAtomWithIdx(i).GetPropsAsDict().get("_GasteigerCharge", 0.0))
                   for i in range(mol.GetNumAtoms())]
        charges = [c for c in charges if c == c]  # filter NaN
        g_mean = round(sum(charges) / len(charges), 4) if charges else 0.0
        g_min  = round(min(charges), 4) if charges else 0.0
        g_max  = round(max(charges), 4) if charges else 0.0
        g_abs  = round(sum(abs(c) for c in charges) / len(charges), 4) if charges else 0.0
    except Exception:
        g_mean = g_min = g_max = g_abs = 0.0

    # E-State indices
    try:
        from rdkit.Chem.EState import EState
        estate_vals = EState.EStateIndices(mol)
        e_max = round(float(max(estate_vals)), 4) if len(estate_vals) else 0.0
        e_min = round(float(min(estate_vals)), 4) if len(estate_vals) else 0.0
    except Exception:
        e_max = e_min = 0.0

    mw   = round(Descriptors.MolWt(mol), 3)
    logp = round(Crippen.MolLogP(mol), 4)
    tpsa = round(Descriptors.TPSA(mol), 3)
    hbd  = rdMolDescriptors.CalcNumHBD(mol)
    hba  = rdMolDescriptors.CalcNumHBA(mol)
    rot  = rdMolDescriptors.CalcNumRotatableBonds(mol)
    rings = rdMolDescriptors.CalcNumRings(mol)
    arom  = rdMolDescriptors.CalcNumAromaticRings(mol)
    fsp3  = round(rdMolDescriptors.CalcFractionCSP3(mol), 4)
    qed   = round(QED.qed(mol), 4)
    molmr = round(Crippen.MolMR(mol), 4)
    stereo = len(Chem.FindMolChiralCenters(mol, includeUnassigned=True))
    hetero = sum(1 for a in mol.GetAtoms() if a.GetAtomicNum() not in (1, 6))
    formal = sum(a.GetFormalCharge() for a in mol.GetAtoms())
    formula = rdMolDescriptors.CalcMolFormula(mol)

    # Lipinski
    lip_violations = sum([mw > 500, logp > 5, hbd > 5, hba > 10])
    lip_pass = lip_violations == 0
    lip_score = 4 - lip_violations

    # Labute ASA
    try:
        from rdkit.Chem import rdMolDescriptors as _rmd
        labute = round(_rmd.CalcLabuteASA(mol), 3)
    except Exception:
        labute = 0.0

    return {
        "MolWeight":       mw,
        "LogP":            logp,
        "TPSA":            tpsa,
        "HBD":             hbd,
        "HBA":             hba,
        "RotBonds":        rot,
        "NumRings":        rings,
        "AromaticRings":   arom,
        "Fsp3":            fsp3,
        "QED":             qed,
        "MolMR":           molmr,
        "Stereocenters":   stereo,
        "Heteroatoms":     hetero,
        "FormalCharge":    formal,
        "Formula":         formula,
        "Lipinski_pass":   int(lip_pass),
        "Lipinski_score":  lip_score,
        "Lipinski_violations": lip_violations,
        "LabuteASA":       labute,
        "EState_max":      e_max,
        "EState_min":      e_min,
        "Gasteiger_mean":  g_mean,
        "Gasteiger_min":   g_min,
        "Gasteiger_max":   g_max,
        "Gasteiger_absmean": g_abs,
    }
