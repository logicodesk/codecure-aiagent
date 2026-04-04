import logging
import requests
import pubchempy as pcp
from rdkit import Chem
from rdkit.Chem import Descriptors, Crippen
from typing import Optional, Dict, Any

# ── LOGGING CONFIGURATION ───────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ToxiGuardAI")

# ── CONSTANTS ──────────────────────────────────────────────────
CIR_URL = "https://cactus.nci.nih.gov/chemical/structure/{}/smiles"
PUBCHEM_REST_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{}/property/IsomericSMILES/JSON"

# ── STEP 1: INPUT DETECTION ─────────────────────────────────────
def detect_input_type(query: str) -> str:
    """Detects if input is likely a SMILES string or a name/formula."""
    query = query.strip()
    # Simple SMILES heuristic: contains common SMILES characters and is not just letters/numbers
    smiles_chars = set("#=@()[]/\\+-%")
    if any(c in smiles_chars for c in query) and len(query) > 2:
        return "SMILES"
    return "NAME_OR_FORMULA"

# ── STEP 3: STRICT VALIDATION ────────────────────────────────────
def validate_smiles(smiles: str) -> Optional[Chem.Mol]:
    """Validates SMILES using RDKit and returns a Mol object if valid."""
    if not smiles:
        return None
    try:
        mol = Chem.MolFromSmiles(smiles.strip())
        if mol:
            logger.info(f"✔ SMILES Validated: {smiles}")
            return mol
    except Exception as e:
        logger.error(f"✘ RDKit Validation Failed for {smiles}: {e}")
    return None

# ── STEP 2: MULTI-SOURCE RESOLUTION ──────────────────────────────
def resolve_name_to_smiles(query: str) -> Optional[str]:
    """Tries multiple sources to resolve a name/formula to SMILES."""
    logger.info(f"🔍 Attempting to resolve: '{query}'")

    # 1. PubChemPy (Primary)
    try:
        logger.info("Attempting Source 1: PubChemPy...")
        compounds = pcp.get_compounds(query, 'name')
        if compounds and compounds[0].isomeric_smiles:
            smiles = compounds[0].isomeric_smiles
            if validate_smiles(smiles):
                logger.info("✔ Resolved via PubChemPy")
                return smiles
    except Exception as e:
        logger.warning(f"⚠ PubChemPy failed: {e}")

    # 2. PubChem REST API (Secondary)
    try:
        logger.info("Attempting Source 2: PubChem REST API...")
        response = requests.get(PUBCHEM_REST_URL.format(query), timeout=10)
        if response.status_code == 200:
            data = response.json()
            smiles = data['PropertyTable']['Properties'][0]['IsomericSMILES']
            if validate_smiles(smiles):
                logger.info("✔ Resolved via PubChem REST")
                return smiles
    except Exception as e:
        logger.warning(f"⚠ PubChem REST failed: {e}")

    # 3. CIR (NCI Resolver)
    try:
        logger.info("Attempting Source 3: CIR (NCI)...")
        response = requests.get(CIR_URL.format(query), timeout=10)
        if response.status_code == 200 and response.text.strip():
            smiles = response.text.strip().split('\n')[0]
            if validate_smiles(smiles):
                logger.info("✔ Resolved via CIR")
                return smiles
    except Exception as e:
        logger.warning(f"⚠ CIR failed: {e}")

    return None

# ── STEP 4: DESCRIPTOR ENGINE (SAFE) ────────────────────────────
def compute_descriptors(mol: Chem.Mol) -> Dict[str, Any]:
    """Computes descriptors ONLY if mol is valid. No 0-defaults for errors."""
    if mol is None:
        return {}

    return {
        "MolecularWeight": round(Descriptors.MolWt(mol), 2),
        "LogP": round(Crippen.MolLogP(mol), 2),
        "TPSA": round(Descriptors.TPSA(mol), 2),
        "H_Bond_Donors": Descriptors.NumHDonors(mol),
        "H_Bond_Acceptors": Descriptors.NumHAcceptors(mol)
    }

# ── STEP 5 & 7: MAIN ANALYZE FUNCTION ────────────────────────────
def analyze_compound(input_query: str) -> Dict[str, Any]:
    """Main entry point for ToxiGuard AI Universal Resolver."""
    logger.info(f"🚀 Processing Input: {input_query}")
    
    input_type = detect_input_type(input_query)
    smiles = None
    mol = None

    if input_type == "SMILES":
        logger.info("Input detected as SMILES pattern.")
        mol = validate_smiles(input_query)
        if mol:
            smiles = input_query
    else:
        logger.info("Input detected as Name/Formula.")
        smiles = resolve_name_to_smiles(input_query)
        if smiles:
            mol = validate_smiles(smiles)

    if mol:
        descriptors = compute_descriptors(mol)
        return {
            "success": True,
            "input": input_query,
            "smiles": smiles,
            "descriptors": descriptors
        }

    # ── STEP 5: FAIL-SAFE SYSTEM ────────────────────────────────
    return {
        "success": False,
        "error": f"Compound '{input_query}' not found or invalid. Please enter a valid chemical name, formula, or SMILES."
    }

# ── EXAMPLE TEST INPUTS ──────────────────────────────────────────
if __name__ == "__main__":
    test_cases = [
        "aspirin",          # Common Name
        "glucose",          # Common Name
        "CO2",              # Formula
        "carbon monoxide",  # Edge Case
        "CCO",              # SMILES (Ethanol)
        "InvalidCompound99" # Failure Case
    ]

    for tc in test_cases:
        print("\n" + "="*50)
        result = analyze_compound(tc)
        print(f"RESULT FOR '{tc}':")
        print(result)
