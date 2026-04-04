# ============================================================
# atom_highlighter.py — SHAP → Atom Highlight + Risk Engine
# ============================================================
# Maps SHAP feature importance back to specific atoms in the
# molecule, highlights toxicophores, and computes Lipinski
# drug-likeness risk classification.
# ============================================================
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "drug_toxicity"))

from typing import Optional
import numpy as np

# ── Toxicophore SMARTS with atom-level metadata ───────────────
# Each entry: (name, smarts, color_hex, risk_level, mechanism)
TOXICOPHORE_DEFS = [
    ("Nitro Group",          "[N+](=O)[O-]",        "#ef4444", "HIGH",
     "Nitroreductase activation → DNA adducts, oxidative stress"),
    ("Aromatic Amine",       "cN",                   "#f97316", "HIGH",
     "N-hydroxylation → nitrenium ions (carcinogen)"),
    ("Aldehyde",             "[CX3H1](=O)",          "#f97316", "HIGH",
     "Schiff base formation with lysine → enzyme inhibition"),
    ("Epoxide",              "C1OC1",                "#ef4444", "HIGH",
     "Direct DNA/protein alkylation (genotoxic)"),
    ("Michael Acceptor",     "[CX3]=[CX3][CX3]=O",  "#ef4444", "HIGH",
     "Covalent cysteine/lysine modification"),
    ("Quinone",              "O=C1C=CC(=O)C=C1",    "#ef4444", "HIGH",
     "Redox cycling → ROS generation"),
    ("Aromatic Halide",      "c[F,Cl,Br,I]",        "#f59e0b", "MODERATE",
     "Nucleophilic aromatic substitution / arene oxide"),
    ("Thiol",                "[SH]",                 "#f59e0b", "MODERATE",
     "Glutathione depletion → oxidative toxicity"),
    ("Peroxide",             "OO",                   "#f97316", "HIGH",
     "ROS generation → oxidative damage"),
    ("Azo Group",            "N=N",                  "#f59e0b", "MODERATE",
     "Azo reduction → aromatic amines"),
    ("Acyl Halide",          "[CX3](=O)[F,Cl,Br,I]","#ef4444", "HIGH",
     "Highly reactive electrophile"),
    ("Isocyanate",           "N=C=O",                "#f97316", "HIGH",
     "Protein carbamylation"),
    ("Hydrazine",            "NN",                   "#f59e0b", "MODERATE",
     "Metabolic activation → reactive intermediates"),
    ("Hydroxamic Acid",      "C(=O)NO",              "#f59e0b", "MODERATE",
     "Metal chelation / HDAC inhibition"),
    ("Diazo",                "[N]=[N+]=[N-]",        "#ef4444", "HIGH",
     "Carbene formation → DNA alkylation"),
    ("Aniline",              "c1ccccc1N",            "#f97316", "HIGH",
     "Metabolic activation → reactive metabolites"),
]

# Risk level ordering
RISK_ORDER = {"HIGH": 3, "MODERATE": 2, "LOW": 1, "NONE": 0}


def scan_toxicophores(smiles: str) -> list[dict]:
    """
    Scan a SMILES string for all toxicophore patterns.
    Returns list of {name, smarts, atoms, color, risk_level, mechanism}.
    atoms = list of atom index tuples (one per match).
    """
    from rdkit import Chem
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return []

    results = []
    for name, smarts, color, risk, mechanism in TOXICOPHORE_DEFS:
        patt = Chem.MolFromSmarts(smarts)
        if patt is None:
            continue
        matches = mol.GetSubstructMatches(patt)
        if matches:
            results.append({
                "name":      name,
                "smarts":    smarts,
                "atoms":     [list(m) for m in matches],
                "color":     color,
                "risk_level": risk,
                "mechanism": mechanism,
                "match_count": len(matches),
            })

    # Sort by risk level descending
    results.sort(key=lambda x: RISK_ORDER.get(x["risk_level"], 0), reverse=True)
    return results


def compute_lipinski(smiles: str) -> dict:
    """
    Compute Lipinski Rule of Five + extended drug-likeness.
    Returns detailed violation analysis.
    """
    from rdkit import Chem
    from rdkit.Chem import Descriptors, rdMolDescriptors, QED, Crippen

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return {"error": "Invalid SMILES"}

    mw   = round(Descriptors.MolWt(mol), 2)
    logp = round(Crippen.MolLogP(mol), 3)
    hbd  = rdMolDescriptors.CalcNumHBD(mol)
    hba  = rdMolDescriptors.CalcNumHBA(mol)
    tpsa = round(Descriptors.TPSA(mol), 2)
    rotb = rdMolDescriptors.CalcNumRotatableBonds(mol)
    qed  = round(QED.qed(mol), 3)
    arom = rdMolDescriptors.CalcNumAromaticRings(mol)
    fsp3 = round(rdMolDescriptors.CalcFractionCSP3(mol), 3)

    # Lipinski Ro5 rules
    rules = [
        {"rule": "MW ≤ 500 Da",  "value": mw,   "limit": 500,  "pass": mw <= 500,   "key": "mw"},
        {"rule": "LogP ≤ 5",     "value": logp,  "limit": 5,    "pass": logp <= 5,   "key": "logp"},
        {"rule": "HBD ≤ 5",      "value": hbd,   "limit": 5,    "pass": hbd <= 5,    "key": "hbd"},
        {"rule": "HBA ≤ 10",     "value": hba,   "limit": 10,   "pass": hba <= 10,   "key": "hba"},
    ]
    violations = [r for r in rules if not r["pass"]]
    n_viol = len(violations)

    # Veber rules (oral bioavailability)
    veber_pass = rotb <= 10 and tpsa <= 140

    return {
        "mw": mw, "logp": logp, "hbd": hbd, "hba": hba,
        "tpsa": tpsa, "rotb": rotb, "qed": qed,
        "aromatic_rings": arom, "fsp3": fsp3,
        "rules": rules,
        "violations": violations,
        "n_violations": n_viol,
        "lipinski_pass": n_viol == 0,
        "veber_pass": veber_pass,
        "lipinski_score": f"{4 - n_viol}/4",
    }


def classify_structural_risk(smiles: str, toxic: bool, probability: float) -> dict:
    """
    Classify compound as High-Risk Structural Failure if:
      - Model predicts toxic AND
      - Has ≥1 HIGH-risk toxicophore OR ≥2 Lipinski violations

    Returns full risk classification with atom highlights.
    """
    tox_hits  = scan_toxicophores(smiles)
    lipinski  = compute_lipinski(smiles)

    high_risk_alerts = [t for t in tox_hits if t["risk_level"] == "HIGH"]
    n_lip_viol = lipinski.get("n_violations", 0)

    # Determine risk classification
    if toxic and (high_risk_alerts or n_lip_viol >= 2):
        risk_class = "HIGH_RISK_STRUCTURAL_FAILURE"
        risk_color = "#ef4444"
        risk_label = "🚨 High-Risk Structural Failure"
        risk_desc  = (
            f"Toxic prediction ({round(probability*100)}%) combined with "
            + (f"{len(high_risk_alerts)} high-risk toxicophore(s)" if high_risk_alerts else "")
            + (" and " if high_risk_alerts and n_lip_viol >= 2 else "")
            + (f"{n_lip_viol} Lipinski violation(s)" if n_lip_viol >= 2 else "")
            + ". This compound presents serious safety and developability concerns."
        )
    elif toxic and tox_hits:
        risk_class = "TOXIC_WITH_ALERTS"
        risk_color = "#f97316"
        risk_label = "⚠ Toxic — Structural Alerts Present"
        risk_desc  = (
            f"Toxic prediction ({round(probability*100)}%) with "
            f"{len(tox_hits)} structural alert(s) detected."
        )
    elif toxic:
        risk_class = "TOXIC_NO_ALERTS"
        risk_color = "#f59e0b"
        risk_label = "⚠ Toxic — Fingerprint-Driven"
        risk_desc  = (
            f"Toxic prediction ({round(probability*100)}%) based on molecular "
            "fingerprint patterns. No classic toxicophores detected."
        )
    elif n_lip_viol >= 2:
        risk_class = "POOR_DRUG_LIKENESS"
        risk_color = "#f59e0b"
        risk_label = "⚠ Poor Drug-Likeness"
        risk_desc  = (
            f"Non-toxic prediction but {n_lip_viol} Lipinski violations. "
            "Poor oral bioavailability expected."
        )
    else:
        risk_class = "LOW_RISK"
        risk_color = "#22c55e"
        risk_label = "✓ Low Risk"
        risk_desc  = (
            f"Non-toxic prediction ({round((1-probability)*100)}% safety) "
            "with no significant structural alerts."
        )

    return {
        "risk_class":       risk_class,
        "risk_color":       risk_color,
        "risk_label":       risk_label,
        "risk_description": risk_desc,
        "toxicophores":     tox_hits,
        "lipinski":         lipinski,
        "n_high_alerts":    len(high_risk_alerts),
        "n_all_alerts":     len(tox_hits),
        "is_structural_failure": risk_class == "HIGH_RISK_STRUCTURAL_FAILURE",
    }


def render_highlighted_svg(smiles: str, width: int = 500, height: int = 350) -> Optional[str]:
    """
    Render a 2D molecular SVG with toxicophore atoms highlighted.
    Returns SVG string or None on failure.

    Color scheme:
      RED   (#ef4444) — HIGH risk toxicophores
      ORANGE (#f97316) — MODERATE risk toxicophores
      YELLOW (#f59e0b) — LOW risk / informational
    """
    try:
        from rdkit import Chem
        from rdkit.Chem.Draw import rdMolDraw2D
        from rdkit.Chem import rdDepictor

        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return None

        # Generate 2D coordinates
        rdDepictor.Compute2DCoords(mol)

        # Collect highlighted atoms and bonds per toxicophore
        highlight_atoms  = {}   # atom_idx → color (RGB tuple 0-1)
        highlight_bonds  = {}   # bond_idx → color
        atom_radii       = {}   # atom_idx → radius

        def hex_to_rgb(h):
            h = h.lstrip("#")
            return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))

        tox_hits = scan_toxicophores(smiles)

        for hit in tox_hits:
            color = hex_to_rgb(hit["color"])
            for match in hit["atoms"]:
                for atom_idx in match:
                    # Higher risk overwrites lower risk color
                    existing_risk = RISK_ORDER.get(
                        next((h["risk_level"] for h in tox_hits
                              if atom_idx in [a for m in h["atoms"] for a in m]), "NONE"), 0)
                    new_risk = RISK_ORDER.get(hit["risk_level"], 0)
                    if atom_idx not in highlight_atoms or new_risk >= existing_risk:
                        highlight_atoms[atom_idx] = color
                        atom_radii[atom_idx] = 0.4

                # Highlight bonds within the match
                for i in range(len(match)):
                    for j in range(i + 1, len(match)):
                        bond = mol.GetBondBetweenAtoms(match[i], match[j])
                        if bond:
                            highlight_bonds[bond.GetIdx()] = color

        # Draw
        drawer = rdMolDraw2D.MolDraw2DSVG(width, height)
        drawer.drawOptions().addStereoAnnotation = True
        drawer.drawOptions().addAtomIndices = False

        if highlight_atoms:
            drawer.DrawMolecule(
                mol,
                highlightAtoms=list(highlight_atoms.keys()),
                highlightAtomColors=highlight_atoms,
                highlightBonds=list(highlight_bonds.keys()),
                highlightBondColors=highlight_bonds,
                highlightAtomRadii=atom_radii,
            )
        else:
            drawer.DrawMolecule(mol)

        drawer.FinishDrawing()
        svg = drawer.GetDrawingText()

        # Inject dark background style
        svg = svg.replace(
            "<svg",
            '<svg style="background:#0f172a;border-radius:12px;"',
            1,
        )
        return svg

    except Exception as e:
        import logging
        logging.warning(f"[Highlight] SVG render failed: {e}")
        return None


def shap_to_atom_weights(shap_features: list, smiles: str) -> dict:
    """
    Map SHAP feature values back to atom-level importance weights.

    Strategy:
      - Alert_ features → map to matched atoms via SMARTS
      - MACCS/Morgan fingerprint features → approximate via substructure
      - Physicochemical features → distribute across all heavy atoms

    Returns {atom_idx: weight} where weight > 0 = increases toxicity.
    """
    try:
        from rdkit import Chem
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return {}

        n_atoms = mol.GetNumAtoms()
        weights = {i: 0.0 for i in range(n_atoms)}

        for feat in shap_features:
            fname  = feat.get("feature", "")
            fval   = feat.get("shap_value", 0.0)
            if abs(fval) < 1e-6:
                continue

            # Alert features → map to specific atoms
            if fname.startswith("Alert_"):
                alert_name = fname[6:]  # strip "Alert_"
                _ALERT_SMARTS = {
                    "nitro": "[N+](=O)[O-]", "aldehyde": "[CX3H1](=O)",
                    "epoxide": "C1OC1", "michael_acc": "[CX3]=[CX3][CX3]=O",
                    "halide_arom": "c[F,Cl,Br,I]", "amine_arom": "cN",
                    "thiol": "[SH]", "azo": "N=N",
                    "aniline": "c1ccccc1N", "carbonyl": "[CX3]=O",
                }
                smarts = _ALERT_SMARTS.get(alert_name)
                if smarts:
                    patt = Chem.MolFromSmarts(smarts)
                    if patt:
                        for match in mol.GetSubstructMatches(patt):
                            for atom_idx in match:
                                weights[atom_idx] += fval / max(len(match), 1)

            # Physicochemical features → distribute across all atoms
            elif fname in ("LogP", "TPSA", "MolWeight", "AromaticRings",
                            "HBD", "HBA", "QED", "Fsp3"):
                per_atom = fval / n_atoms
                for i in range(n_atoms):
                    weights[i] += per_atom

            # Fingerprint features → skip (no direct atom mapping)

        return weights

    except Exception:
        return {}
