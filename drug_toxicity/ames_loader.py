# ============================================================
# ames_loader.py — Ames Mutagenicity Dataset Loader
# ============================================================
# Supports the Mendeley Data Ames dataset:
#   - 5,536 compounds
#   - 1,360 Mordred descriptors (pre-computed)
#   - SMILES column
#   - Labels: TA98, TA100, TA1535, TA1537, TA1538 strains
#             + overall consensus mutagenicity label
#
# Also supports the Hansen Ames benchmark (6,512 compounds)
# and the Kazius/Bursi dataset (4,337 compounds).
#
# If no CSV is found, falls back to computing RDKit descriptors
# from SMILES using