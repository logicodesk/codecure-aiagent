import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.resolver import resolve
from backend.descriptor import compute
from backend.ai_engine import build_explanation
from rdkit import Chem

tests = ['aspirin', 'carbon monoxide', 'glucose', 'benzene', 'CO2', 'invalid_xyz_compound']
for t in tests:
    r = resolve(t)
    if r['success']:
        mol = Chem.MolFromSmiles(r['smiles'])
        d = compute(mol)
        print(f"OK  {t:<25} -> MW={d['MolWeight']} source={r['source']}")
    else:
        print(f"ERR {t:<25} -> {r['error'][:70]}")
