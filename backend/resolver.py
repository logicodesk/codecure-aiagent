# ============================================================
# resolver.py — Universal Compound Resolution Engine
# ============================================================
from __future__ import annotations
import re, urllib.request, urllib.parse, json, logging
from typing import Optional
from rdkit import Chem
from rdkit.Chem import Descriptors, rdMolDescriptors

log = logging.getLogger(__name__)

# ── Local synonym dictionary ──────────────────────────────────
SYNONYM_DB: dict[str, str] = {
    "aspirin": "CC(=O)Oc1ccccc1C(=O)O",
    "acetylsalicylic acid": "CC(=O)Oc1ccccc1C(=O)O",
    "paracetamol": "CC(=O)Nc1ccc(O)cc1",
    "acetaminophen": "CC(=O)Nc1ccc(O)cc1",
    "tylenol": "CC(=O)Nc1ccc(O)cc1",
    "ibuprofen": "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
    "advil": "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
    "caffeine": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
    "metformin": "CN(C)C(=N)NC(=N)N",
    "morphine": "OC1=CC=C2CC3N(C)CCC34C2=C1OC4",
    "codeine": "COc1ccc2CC3N(C)CCC34c2c1OC4",
    "testosterone": "CC12CCC3C(C1CCC2O)CCC4=CC(=O)CCC34C",
    "penicillin": "CC1(C)SC2C(NC(=O)Cc3ccccc3)C(=O)N2C1C(=O)O",
    "penicillin g": "CC1(C)SC2C(NC(=O)Cc3ccccc3)C(=O)N2C1C(=O)O",
    "amoxicillin": "CC1(C)SC2C(NC(=O)C(N)c3ccc(O)cc3)C(=O)N2C1C(=O)O",
    "diazepam": "CN1C(=O)CN=C(c2ccccc2)c2cc(Cl)ccc21",
    "valium": "CN1C(=O)CN=C(c2ccccc2)c2cc(Cl)ccc21",
    "naproxen": "COc1ccc2cc(C(C)C(=O)O)ccc2c1",
    "omeprazole": "COc1ccc2[nH]c(S(=O)Cc3ncc(C)c(OC)c3C)nc2c1",
    "warfarin": "CC(=O)CC(c1ccccc1)c1c(O)c2ccccc2oc1=O",
    "sildenafil": "CCCC1=NN(C)C(=C1C(=O)N1CCN(CC1)S(=O)(=O)c1ccc(OCC)cc1)c1cc(S(=O)(=O)N(C)C)ccc1OCC",
    "viagra": "CCCC1=NN(C)C(=C1C(=O)N1CCN(CC1)S(=O)(=O)c1ccc(OCC)cc1)c1cc(S(=O)(=O)N(C)C)ccc1OCC",
    "cisplatin": "[NH3][Pt](Cl)(Cl)[NH3]",
    "doxorubicin": "COc1cccc2C(=O)c3c(O)c4CC(O)(CC(=O)CO)Cc4c(O)c3C(=O)c12",
    "remdesivir": "CCC(CC)COC(=O)C(C)NP(=O)(OCC1C(C(C(O1)N1C=CC(=O)NC1=O)O)O)Oc1ccccc1",
    "atorvastatin": "CC(C)c1n(CC(O)CC(O)CC(=O)O)c(C(=O)Nc2ccccc2)c(c1-c1ccc(F)cc1)C(=O)Nc1ccccc1",
    "lipitor": "CC(C)c1n(CC(O)CC(O)CC(=O)O)c(C(=O)Nc2ccccc2)c(c1-c1ccc(F)cc1)C(=O)Nc1ccccc1",
    "benzene": "c1ccccc1",
    "toluene": "Cc1ccccc1",
    "aniline": "c1ccc(cc1)N",
    "nitrobenzene": "c1ccc([N+](=O)[O-])cc1",
    "benzaldehyde": "O=Cc1ccccc1",
    "dichloromethane": "ClCCl",
    "methylene chloride": "ClCCl",
    "chloroform": "ClC(Cl)Cl",
    "formaldehyde": "C=O",
    "acetone": "CC(C)=O",
    "ethanol": "CCO",
    "methanol": "CO",
    "acetic acid": "CC(=O)O",
    "phenol": "Oc1ccccc1",
    "naphthalene": "c1ccc2ccccc2c1",
    "carbon monoxide": "[C-]#[O+]",
    "co": "[C-]#[O+]",
    "carbon dioxide": "O=C=O",
    "co2": "O=C=O",
    "water": "O",
    "h2o": "O",
    "ammonia": "N",
    "nh3": "N",
    "hydrogen peroxide": "OO",
    "h2o2": "OO",
    "nitric oxide": "[N]=O",
    "no": "[N]=O",
    "sulfur dioxide": "O=S=O",
    "so2": "O=S=O",
    "hydrogen cyanide": "C#N",
    "hcn": "C#N",
    "ozone": "[O-][O+]=O",
    "methane": "C",
    "ethane": "CC",
    "propane": "CCC",
    "ethylene": "C=C",
    "acetylene": "C#C",
    "glucose": "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O",
    "d-glucose": "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O",
    "fructose": "OC[C@@H]1OC(O)(CO)[C@@H](O)[C@@H]1O",
    "sucrose": "OC[C@H]1O[C@@](CO)(O[C@H]2O[C@H](CO)[C@@H](O)[C@H](O)[C@H]2O)[C@@H](O)[C@@H]1O",
    "cholesterol": "CC(C)CCCC(C)C1CCC2C1(CCC3C2CC=C4C3(CCC(C4)O)C)C",
    "adrenaline": "CNC(C(c1ccc(O)c(O)c1)O)O",
    "epinephrine": "CNC(C(c1ccc(O)c(O)c1)O)O",
    "dopamine": "NCCc1ccc(O)c(O)c1",
    "serotonin": "NCCc1c[nH]c2ccc(O)cc12",
    "nicotine": "CN1CCC[C@H]1c1cccnc1",
    "cocaine": "COC(=O)C1CC(OC(=O)c2ccccc2)CC1N(C)C",
    "glycine": "NCC(=O)O",
    "alanine": "CC(N)C(=O)O",
    "phenylalanine": "NC(Cc1ccccc1)C(=O)O",
    "tryptophan": "NC(Cc1c[nH]c2ccccc12)C(=O)O",
    "tyrosine": "NC(Cc1ccc(O)cc1)C(=O)O",
    "cysteine": "NC(CS)C(=O)O",
    "lysine": "NCCCCC(N)C(=O)O",
    "pcb": "Clc1ccc(cc1Cl)c1cc(Cl)ccc1Cl",
}

FORMULA_DB: dict[str, str] = {
    "CO": "[C-]#[O+]", "CO2": "O=C=O", "H2O": "O", "NH3": "N",
    "H2O2": "OO", "NO": "[N]=O", "SO2": "O=S=O", "HCN": "C#N",
    "O3": "[O-][O+]=O", "CH4": "C", "C2H6": "CC", "C3H8": "CCC",
    "C4H10": "CCCC", "C2H4": "C=C", "C2H2": "C#C", "C6H6": "c1ccccc1",
    "C7H8": "Cc1ccccc1", "CH2O": "C=O", "CH3OH": "CO", "C2H5OH": "CCO",
    "C3H6O": "CC(C)=O", "CHCl3": "ClC(Cl)Cl", "CH2Cl2": "ClCCl",
    "CCl4": "ClC(Cl)(Cl)Cl", "HCl": "Cl", "H2SO4": "OS(=O)(=O)O",
    "HNO3": "O[N+](=O)[O-]",
}

_SMILES_CHARS = set("=()[]#@+\\/.%")
_FORMULA_RE = re.compile(r"^[A-Z][a-z]?(\d*[A-Z][a-z]?\d*)*\d*$")


def detect_input_type(raw: str) -> str:
    s = raw.strip()
    if any(c in _SMILES_CHARS for c in s) and len(s) > 2:
        return "smiles"
    if _FORMULA_RE.match(s) and any(c.isupper() for c in s) and len(s) <= 20:
        return "formula"
    return "name"


def validate_smiles(smiles: str) -> Optional[Chem.Mol]:
    if not smiles:
        return None
    try:
        return Chem.MolFromSmiles(smiles.strip())
    except Exception:
        return None


def _get(url: str, timeout: int = 8) -> Optional[str]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ToxScoutAI/2.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        log.debug(f"HTTP GET failed {url}: {e}")
        return None


def _pubchem_name(name: str) -> Optional[str]:
    enc = urllib.parse.quote(name.strip())
    body = _get(
        f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/"
        f"{enc}/property/IsomericSMILES,CanonicalSMILES/JSON", 10
    )
    if not body:
        return None
    try:
        p = json.loads(body)["PropertyTable"]["Properties"][0]
        return p.get("IsomericSMILES") or p.get("CanonicalSMILES")
    except Exception:
        return None


def _pubchem_formula(formula: str) -> Optional[str]:
    enc = urllib.parse.quote(formula.strip())
    body = _get(
        f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/formula/"
        f"{enc}/property/IsomericSMILES,CanonicalSMILES/JSON", 10
    )
    if not body:
        return None
    try:
        p = json.loads(body)["PropertyTable"]["Properties"][0]
        return p.get("IsomericSMILES") or p.get("CanonicalSMILES")
    except Exception:
        return None


def _cir(query: str) -> Optional[str]:
    enc = urllib.parse.quote(query.strip())
    body = _get(f"https://cactus.nci.nih.gov/chemical/structure/{enc}/smiles", 8)
    if body and body.strip() and "Page not found" not in body and "<html" not in body.lower():
        return body.strip().split("\n")[0].strip()
    return None


def _opsin(name: str) -> Optional[str]:
    enc = urllib.parse.quote(name.strip())
    body = _get(f"https://opsin.ch.cam.ac.uk/opsin/{enc}.smi", 8)
    if body and body.strip() and len(body.strip()) > 1 and "<" not in body:
        return body.strip()
    return None


def resolve(raw_input: str) -> dict:
    """
    Universal resolver. Returns dict with keys:
    success, smiles, name, formula, mw, source, input_type, error
    """
    if not raw_input or not raw_input.strip():
        return _fail(raw_input, "unknown", "Empty input.")

    raw = raw_input.strip()
    norm = re.sub(r"\s+", " ", raw.lower())
    itype = detect_input_type(raw)

    # Direct SMILES path
    if itype == "smiles":
        mol = validate_smiles(raw)
        if mol:
            return _ok(Chem.MolToSmiles(mol), raw, mol, "direct_smiles", itype)
        return _fail(raw, itype, f"Invalid SMILES: '{raw}'. RDKit could not parse it.")

    # Resolution chain
    candidates: list[tuple[str, str]] = []

    s = SYNONYM_DB.get(norm)
    if s:
        candidates.append((s, "local_db"))

    if itype == "formula":
        s = FORMULA_DB.get(raw.upper())
        if s:
            candidates.append((s, "formula_db"))

    s = _pubchem_name(raw)
    if s:
        candidates.append((s, "pubchem_name"))

    if itype == "formula":
        s = _pubchem_formula(raw)
        if s:
            candidates.append((s, "pubchem_formula"))

    s = _cir(raw)
    if s:
        candidates.append((s, "cir"))

    s = _opsin(raw)
    if s:
        candidates.append((s, "opsin"))

    for smiles_cand, source in candidates:
        mol = validate_smiles(smiles_cand)
        if mol:
            return _ok(Chem.MolToSmiles(mol), raw, mol, source, itype)

    return _fail(
        raw, itype,
        f"Could not resolve '{raw}'. Tried: local DB, PubChem, CIR, OPSIN. "
        "Please try a different name, IUPAC name, formula, or paste SMILES directly."
    )


def _ok(smiles: str, name: str, mol, source: str, itype: str) -> dict:
    return {
        "success": True,
        "smiles": smiles,
        "name": name,
        "formula": rdMolDescriptors.CalcMolFormula(mol),
        "mw": round(Descriptors.MolWt(mol), 3),
        "source": source,
        "input_type": itype,
        "error": None,
    }


def _fail(name: str, itype: str, error: str) -> dict:
    return {
        "success": False,
        "smiles": None,
        "name": name,
        "formula": None,
        "mw": None,
        "source": None,
        "input_type": itype,
        "error": error,
    }
