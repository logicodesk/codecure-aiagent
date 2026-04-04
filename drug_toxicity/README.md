# Drug Toxicity Prediction — ML Pipeline

Predicts whether a chemical compound is **toxic (1)** or **non-toxic (0)**
using molecular descriptors and Morgan fingerprints derived from SMILES strings.

## Project Structure

```
drug_toxicity/
├── config.py           # Central settings (paths, constants)
├── data_generator.py   # Synthetic Tox21-like dataset generator
├── features.py         # RDKit SMILES → numerical features
├── preprocessing.py    # Load, clean, scale, split data
├── models.py           # LR / RF / XGBoost + hyperparameter tuning
├── evaluation.py       # Metrics, confusion matrix, ROC curves
├── visualization.py    # Feature importance + SHAP plots
├── model_io.py         # Save/load models, single-SMILES inference
├── main.py             # Full pipeline orchestrator
├── requirements.txt
└── README.md
```

## Setup

### Option A — conda (recommended for RDKit)
```bash
conda create -n tox python=3.10
conda activate tox
conda install -c conda-forge rdkit
pip install -r requirements.txt
```

### Option B — pip only
```bash
pip install rdkit-pypi
pip install -r requirements.txt
```

## Run

```bash
cd drug_toxicity
python main.py
```

Set `tune=False` in `main.py` for a quick run without hyperparameter search.

## Features Extracted per Molecule

| Feature | Description |
|---|---|
| MolWeight | Molecular weight |
| LogP | Lipophilicity |
| HBD | H-bond donors |
| HBA | H-bond acceptors |
| TPSA | Topological polar surface area |
| RotBonds | Rotatable bonds |
| NumRings | Total ring count |
| AromaticRings | Aromatic ring count |
| Fsp3 | Fraction of sp3 carbons |
| Morgan_0..127 | 128-bit Morgan fingerprint |

## Outputs

- `plots/` — confusion matrices, ROC curves, feature importance, SHAP
- `models/` — saved `.pkl` files for each trained model

## Single-molecule Inference

```python
from model_io import predict_toxicity
result = predict_toxicity("CC(=O)Oc1ccccc1C(=O)O", model_name="XGBoost")
print(result)
# {'smiles': '...', 'toxic': False, 'probability': 0.12, 'label': 0}
```
