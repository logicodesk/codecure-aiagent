# ============================================================
# multi_dataset.py — TDC + TOXRIC Multi-Dataset Loader
# ============================================================
# Source 1: TDC (Therapeutics Data Commons)
#   pip install PyTDC
#   from tdc.single_pred import Tox
#   Datasets: Tox21, ClinTox, hERG, AMES, DILIst
#   ~8k-13k compounds, scaffold splits, leaderboard baselines
#
# Source 2: TOXRIC
#   113k+ compounds, 1,474 endpoints, 39 feature types
#   Pre-computed descriptors, direct CSV download (no login)
#   https://toxric.bioinforai.tech/
# ============================================================
import sys, os, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(__file__))

import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.feature_selection import VarianceThreshold
from sklearn.metrics import roc_auc_score, f1_score, accuracy_score
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from config import MODEL_DIR, RANDOM_STATE

THRESHOLD     = 0.35
CV_FOLDS      = 5
AUC_BENCHMARK = 0.85

TDC_DATASETS = {
    "Tox21":   {"label": "Y", "endpoints": 12},
    "ClinTox": {"label": "Y", "endpoints": 2},
    "hERG":    {"label": "Y", "endpoints": 1},
    "AMES":    {"label": "Y", "endpoints": 1},
    "DILIst":  {"label": "Y", "endpoints": 1},
}

TOXRIC_BASE_URL = "https://toxric.bioinforai.tech/"
TOXRIC_ENDPOINTS = {
    "acute_oral_toxicity":   "download/endpoint/acute_oral_toxicity.csv",
    "ames_mutagenicity":     "download/endpoint/ames_mutagenicity.csv",
    "carcinogenicity":       "download/endpoint/carcinogenicity.csv",
    "herg_inhibition":       "download/endpoint/herg_inhibition.csv",
    "hepatotoxicity":        "download/endpoint/hepatotoxicity.csv",
    "skin_sensitization":    "download/endpoint/skin_sensitization.csv",
    "eye_irritation":        "download/endpoint/eye_irritation.csv",
    "reproductive_toxicity": "download/endpoint/reproductive_toxicity.csv",
    "neurotoxicity":         "download/endpoint/neurotoxicity.csv",
    "bbb_penetration":       "download/endpoint/bbb_penetration.csv",
}


# ── Shared helpers ────────────────────────────────────────────

def _preprocess(X_tr, X_val, X_te, feat_names):
    """StandardScaler + variance filter, fit on train only."""
    vt    = VarianceThreshold(threshold=0.0)
    X_tr  = vt.fit_transform(X_tr)
    X_val = vt.transform(X_val)
    X_te  = vt.transform(X_te)
    feat_names = [f for f, k in zip(feat_names, vt.get_support()) if k]
    scaler = StandardScaler()
    X_tr   = scaler.fit_transform(X_tr)
    X_val  = scaler.transform(X_val)
    X_te   = scaler.transform(X_te)
    print(f"[Preprocess] {X_tr.shape[1]} features after variance filter")
    return X_tr, X_val, X_te, scaler, feat_names


def _build_xgb(params=None):
    """XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)."""
    base = dict(n_estimators=200, max_depth=6, learning_rate=0.1,
                random_state=RANDOM_STATE, eval_metric="logloss", n_jobs=1)
    return XGBClassifier(**{**base, **(params or {})})


def _build_ensemble(xgb_params=None):
    """XGBoost (primary) + RF + LGBM soft-voting ensemble."""
    return VotingClassifier(
        estimators=[
            ("xgb",  _build_xgb(xgb_params)),
            ("rf",   RandomForestClassifier(n_estimators=200, class_weight="balanced",
                                             random_state=RANDOM_STATE, n_jobs=1)),
            ("lgbm", LGBMClassifier(n_estimators=200, max_depth=5, learning_rate=0.05,
                                     class_weight="balanced", random_state=RANDOM_STATE,
                                     n_jobs=1, verbose=-1)),
        ],
        voting="soft", n_jobs=1)


def _cv_xgb(X_tr, y_tr, target, xgb_params=None):
    """5-fold stratified CV on XGBoost, reports ROC-AUC vs 0.85 benchmark."""
    skf    = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    scores = cross_val_score(_build_xgb(xgb_params), X_tr, y_tr,
                              cv=skf, scoring="roc_auc", n_jobs=1)
    mean, std = float(scores.mean()), float(scores.std())
    ok = mean >= AUC_BENCHMARK
    print(f"  [CV:{target:15s}] {CV_FOLDS}-fold AUC: {mean:.4f} ± {std:.4f}  "
          f"{'✓' if ok else f'⚠ below {AUC_BENCHMARK}'}")
    return {"cv_mean_auc": round(mean, 4), "cv_std_auc": round(std, 4),
            "benchmark_ok": ok, "cv_scores": scores.tolist()}


def _evaluate(model, X, y, split_name, target):
    prob = model.predict_proba(X)[:, 1]
    pred = (prob >= THRESHOLD).astype(int)
    return {
        "split": split_name, "target": target,
        "auc":      round(roc_auc_score(y, prob), 4),
        "f1":       round(f1_score(y, pred, zero_division=0), 4),
        "accuracy": round(accuracy_score(y, pred), 4),
        "n_pos": int(y.sum()), "n_total": len(y),
    }


def train_endpoint(X_tr, X_val, X_te, y_tr, y_val, y_te,
                    target, xgb_params=None, save=True, prefix=""):
    """Train XGBoost ensemble for one endpoint with 5-fold CV."""
    cv  = _cv_xgb(X_tr, y_tr, target, xgb_params)
    mdl = _build_ensemble(xgb_params)
    mdl.fit(X_tr, y_tr)
    val_m  = _evaluate(mdl, X_val, y_val, "val",  target)
    test_m = _evaluate(mdl, X_te,  y_te,  "test", target)
    print(f"  [{target:15s}|val ] AUC={val_m['auc']:.4f}  F1={val_m['f1']:.4f}")
    print(f"  [{target:15s}|test] AUC={test_m['auc']:.4f}  F1={test_m['f1']:.4f}")
    res = {"model": mdl, "cv": cv, "val": val_m, "test": test_m,
           "target": target, "xgb_params": xgb_params or {}}
    if save:
        slug = f"{prefix}_{target}".strip("_").replace(" ", "_")
        joblib.dump(mdl, os.path.join(MODEL_DIR, f"{slug}.pkl"))
        print(f"  [Saved] {slug}.pkl")
    return res


# ── TDC loader ────────────────────────────────────────────────

def _check_tdc():
    try:
        import tdc  # noqa
        return True
    except ImportError:
        return False


def load_tdc_dataset(name, split="scaffold"):
    """
    Load one TDC toxicity dataset via PyTDC one-liner API.
    from tdc.single_pred import Tox; data = Tox(name=name)
    Returns dict with train_df, val_df, test_df (scaffold split by default).
    """
    if not _check_tdc():
        raise ImportError("PyTDC not installed. Run: pip install PyTDC")
    from tdc.single_pred import Tox
    print(f"[TDC] Loading '{name}' ({split} split)...")
    data   = Tox(name=name)
    splits = data.get_split(method=split if split == "scaffold"
                             else "random", seed=RANDOM_STATE)
    train_df, val_df, test_df = splits["train"], splits["valid"], splits["test"]
    for df in [train_df, val_df, test_df]:
        if "Drug" in df.columns and "smiles" not in df.columns:
            df.rename(columns={"Drug": "smiles"}, inplace=True)
    print(f"[TDC:{name}] Train:{len(train_df)} Val:{len(val_df)} Test:{len(test_df)}")
    return {"name": name, "train_df": train_df, "val_df": val_df, "test_df": test_df,
            "n_train": len(train_df), "n_val": len(val_df), "n_test": len(test_df),
            "label_col": "Y", "split_type": split}


def featurize_tdc(df, smiles_col="smiles"):
    """Compute RDKit features for a TDC DataFrame."""
    from features import build_feature_matrix, get_feature_names
    from config import (USE_MORGAN_FP, MORGAN_RADIUS, MORGAN_NBITS,
                        USE_MACCS, USE_RDKIT_FP, RDKIT_FP_NBITS)
    X, mask = build_feature_matrix(df, smiles_col=smiles_col,
                                    use_morgan=USE_MORGAN_FP, morgan_radius=MORGAN_RADIUS,
                                    morgan_nbits=MORGAN_NBITS, use_maccs=USE_MACCS,
                                    use_rdkit_fp=USE_RDKIT_FP, rdkit_fp_nbits=RDKIT_FP_NBITS)
    feat_names = get_feature_names(use_morgan=USE_MORGAN_FP, morgan_nbits=MORGAN_NBITS,
                                    use_maccs=USE_MACCS, use_rdkit_fp=USE_RDKIT_FP,
                                    rdkit_fp_nbits=RDKIT_FP_NBITS)
    return np.where(np.isfinite(X), X, 0.0), mask, feat_names


def run_tdc_pipeline(datasets=None, split="scaffold", save_models=True):
    """
    Full TDC multi-dataset pipeline.
    Loads each dataset, featurizes with RDKit, trains XGBoost ensemble,
    5-fold CV, evaluates on scaffold test split.
    """
    print("\n" + "="*60)
    print("  TDC MULTI-DATASET PIPELINE")
    print(f"  Datasets: {datasets or list(TDC_DATASETS.keys())}")
    print(f"  Split: {split}  |  XGBoost: n_est=200 depth=6 lr=0.1")
    print("="*60)
    if not _check_tdc():
        print("[TDC] PyTDC not installed. Run: pip install PyTDC")
        return {}

    all_results, summary = {}, []
    for name in (datasets or list(TDC_DATASETS.keys())):
        print(f"\n── Dataset: {name} ──")
        try:
            d = load_tdc_dataset(name, split=split)
        except Exception as e:
            print(f"  [TDC:{name}] Load failed: {e}")
            continue

        label = d["label_col"]
        X_tr, mask_tr, fn = featurize_tdc(d["train_df"])
        X_val, mask_val, _ = featurize_tdc(d["val_df"])
        X_te,  mask_te,  _ = featurize_tdc(d["test_df"])
        y_tr  = d["train_df"][label].values[mask_tr].astype(int)
        y_val = d["val_df"][label].values[mask_val].astype(int)
        y_te  = d["test_df"][label].values[mask_te].astype(int)

        X_tr, X_val, X_te, scaler, fn = _preprocess(X_tr, X_val, X_te, fn)
        res = train_endpoint(X_tr, X_val, X_te, y_tr, y_val, y_te,
                              target=name, save=save_models, prefix="TDC")
        if save_models:
            joblib.dump(scaler, os.path.join(MODEL_DIR, f"TDC_{name}_scaler.pkl"))
            joblib.dump(fn,     os.path.join(MODEL_DIR, f"TDC_{name}_features.pkl"))

        all_results[name] = res
        summary.append({"dataset": name,
                         "cv_auc": res["cv"]["cv_mean_auc"],
                         "cv_std": res["cv"]["cv_std_auc"],
                         "bm": "✓" if res["cv"]["benchmark_ok"] else "✗",
                         "val_auc": res["val"]["auc"],
                         "test_auc": res["test"]["auc"],
                         "test_f1": res["test"]["f1"],
                         "n_train": d["n_train"]})

    print("\n" + "="*60)
    print("  TDC SUMMARY")
    print("="*60)
    print(f"  {'Dataset':12s}  {'CV AUC':>8}  {'±':>6}  BM  "
          f"{'Val AUC':>8}  {'Test AUC':>9}  {'Test F1':>8}  {'N_train':>8}")
    print("  " + "-"*72)
    for r in summary:
        print(f"  {r['dataset']:12s}  {r['cv_auc']:>8.4f}  "
              f"±{r['cv_std']:>5.4f}  {r['bm']:>2}  "
              f"{r['val_auc']:>8.4f}  {r['test_auc']:>9.4f}  "
              f"{r['test_f1']:>8.4f}  {r['n_train']:>8}")
    n_pass = sum(1 for r in summary if r["bm"] == "✓")
    print(f"\n  Benchmark (AUC ≥ {AUC_BENCHMARK}): {n_pass}/{len(summary)} passed")
    return all_results


# ── TOXRIC loader ─────────────────────────────────────────────

def download_toxric_endpoint(endpoint, cache_dir=None, timeout=30):
    """
    Download a TOXRIC endpoint CSV directly (no login required).
    Caches locally. endpoint = key from TOXRIC_ENDPOINTS or full URL.
    """
    import urllib.request
    if cache_dir is None:
        cache_dir = os.path.join(os.path.dirname(__file__), "data", "toxric")
    os.makedirs(cache_dir, exist_ok=True)

    if endpoint.startswith("http"):
        url, fname = endpoint, endpoint.split("/")[-1]
    elif endpoint in TOXRIC_ENDPOINTS:
        url   = TOXRIC_BASE_URL + TOXRIC_ENDPOINTS[endpoint]
        fname = f"toxric_{endpoint}.csv"
    else:
        raise ValueError(f"Unknown endpoint: '{endpoint}'. "
                         f"Available: {list(TOXRIC_ENDPOINTS.keys())}")

    cache_path = os.path.join(cache_dir, fname)
    if os.path.exists(cache_path):
        print(f"[TOXRIC] Loading cached: {cache_path}")
        return pd.read_csv(cache_path)

    print(f"[TOXRIC] Downloading: {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ToxScoutAI/2.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            content = r.read().decode("utf-8", errors="replace")
        df = pd.read_csv(pd.io.common.StringIO(content))
        df.to_csv(cache_path, index=False)
        print(f"[TOXRIC] {len(df)} rows → cached at {cache_path}")
        return df
    except Exception as e:
        raise ConnectionError(f"TOXRIC download failed: {e}\nURL: {url}")


def load_toxric_csv(path):
    """Load a local TOXRIC CSV, normalise SMILES + label column names."""
    df = pd.read_csv(path)
    print(f"[TOXRIC] Loaded {len(df)} rows x {len(df.columns)} cols from '{path}'")
    df.columns = [c.strip() for c in df.columns]
    for c in list(df.columns):
        if c.lower() in ("smiles", "canonical_smiles", "smi") and c != "smiles":
            df = df.rename(columns={c: "smiles"}); break
    for c in list(df.columns):
        if c.lower() in ("label", "activity", "toxic", "class", "y") and c != "label":
            df = df.rename(columns={c: "label"}); break
    return df


def extract_toxric_features(df, feature_type="auto"):
    """
    Extract pre-computed TOXRIC descriptor columns.
    TOXRIC provides 39 feature types — use all numeric cols by default.
    fillna(0) applied (113k+ compounds, 1,474 endpoints).
    """
    exclude = {"smiles", "label", "name", "cas", "id", "index", "inchi", "inchikey"}
    if feature_type == "auto":
        fcols = [c for c in df.columns
                 if c.lower() not in exclude
                 and pd.api.types.is_numeric_dtype(df[c])]
    else:
        fcols = [c for c in df.columns
                 if c.lower().startswith(feature_type.lower())
                 and pd.api.types.is_numeric_dtype(df[c])]
    if not fcols:
        raise ValueError(f"No numeric feature columns found. Cols: {list(df.columns)[:20]}")
    print(f"[TOXRIC] Using {len(fcols)} pre-computed descriptors (fillna=0)")
    X = df[fcols].fillna(0).values.astype(np.float32)
    label_col = "label" if "label" in df.columns else None
    return X, fcols, label_col


def split_toxric(df, X, label_col="label", test_size=0.2, val_size=0.1):
    """80/10/10 stratified split, drops undefined labels (-1 or NaN)."""
    valid = df[label_col].notna() & (df[label_col] != -1)
    y     = df.loc[valid, label_col].astype(int).values
    X_v   = X[valid.values]
    pos, neg = y.sum(), len(y) - y.sum()
    print(f"[TOXRIC] {len(y)} rows | Pos:{pos} Neg:{neg} Ratio:{neg/max(pos,1):.1f}:1")
    X_tr, X_tmp, y_tr, y_tmp = train_test_split(
        X_v, y, test_size=test_size + val_size,
        random_state=RANDOM_STATE, stratify=y)
    X_val, X_te, y_val, y_te = train_test_split(
        X_tmp, y_tmp, test_size=test_size / (test_size + val_size),
        random_state=RANDOM_STATE, stratify=y_tmp)
    print(f"[TOXRIC] Train:{len(X_tr)} Val:{len(X_val)} Test:{len(X_te)}")
    return X_tr, X_val, X_te, y_tr, y_val, y_te


def run_toxric_pipeline(csv_path=None, endpoint=None,
                         feature_type="auto", save_models=True):
    """
    Full TOXRIC pipeline.
    Loads pre-computed descriptors (no recomputation needed),
    trains XGBoost ensemble, 5-fold CV, 80/10/10 split.
    """
    print("\n" + "="*60)
    print("  TOXRIC PIPELINE")
    print(f"  Feature type: {feature_type}  |  XGBoost: n_est=200 depth=6 lr=0.1")
    print("="*60)
    if csv_path and os.path.exists(csv_path):
        df = load_toxric_csv(csv_path)
    elif endpoint:
        df = download_toxric_endpoint(endpoint)
    else:
        raise ValueError("Provide csv_path or endpoint name.")

    X, feat_names, label_col = extract_toxric_features(df, feature_type)
    if label_col is None:
        raise ValueError("No label column found in TOXRIC data.")

    X_tr, X_val, X_te, y_tr, y_val, y_te = split_toxric(df, X, label_col)
    X_tr, X_val, X_te, scaler, fn = _preprocess(X_tr, X_val, X_te, feat_names)

    target = endpoint or os.path.basename(csv_path or "toxric").replace(".csv", "")
    res = train_endpoint(X_tr, X_val, X_te, y_tr, y_val, y_te,
                          target=target, save=save_models, prefix="TOXRIC")
    if save_models:
        joblib.dump(scaler, os.path.join(MODEL_DIR, f"TOXRIC_{target}_scaler.pkl"))
        joblib.dump(fn,     os.path.join(MODEL_DIR, f"TOXRIC_{target}_features.pkl"))
    return res


# ── Production multi-source ensemble ─────────────────────────

def predict_multi_source(smiles, tdc_datasets=None, toxric_endpoints=None):
    """
    Run all available trained models (Tox21 + Ames + TDC + TOXRIC).
    Weights: Tox21=40%, Ames=20%, TDC=25%, TOXRIC=15%.
    """
    from features import smiles_to_descriptors
    from config import (USE_MORGAN_FP, MORGAN_RADIUS, MORGAN_NBITS,
                        USE_MACCS, USE_RDKIT_FP, RDKIT_FP_NBITS)

    def _pred(key):
        mp = os.path.join(MODEL_DIR, f"{key}.pkl")
        sp = os.path.join(MODEL_DIR, f"{key}_scaler.pkl")
        fp = os.path.join(MODEL_DIR, f"{key}_features.pkl")
        if not all(os.path.exists(p) for p in [mp, sp, fp]):
            return None
        feat = smiles_to_descriptors(smiles,
                                      use_morgan=USE_MORGAN_FP, morgan_radius=MORGAN_RADIUS,
                                      morgan_nbits=MORGAN_NBITS, use_maccs=USE_MACCS,
                                      use_rdkit_fp=USE_RDKIT_FP, rdkit_fp_nbits=RDKIT_FP_NBITS)
        if feat is None:
            return None
        scaler = joblib.load(sp)
        n = scaler.n_features_in_
        feat = feat[:n] if feat.shape[0] > n else np.pad(feat, (0, max(0, n - feat.shape[0])))
        return float(joblib.load(mp).predict_proba(scaler.transform(feat.reshape(1, -1)))[0, 1])

    preds = {}

    # Tox21
    try:
        from model_io import predict_toxicity
        preds["tox21"] = predict_toxicity(smiles, model_name="Voting_Ensemble").get("probability", 0)
    except Exception:
        preds["tox21"] = None

    # Ames
    try:
        from ames_pipeline import predict_ames
        preds["ames"] = predict_ames(smiles).get("consensus_prob")
    except Exception:
        preds["ames"] = None

    # TDC
    tdc_probs = []
    for name in (tdc_datasets or list(TDC_DATASETS.keys())):
        p = _pred(f"TDC_{name}")
        if p is not None:
            tdc_probs.append(p)
            preds[f"tdc_{name.lower()}"] = round(p, 4)
    preds["tdc_avg"] = round(float(np.mean(tdc_probs)), 4) if tdc_probs else None

    # TOXRIC
    toxric_probs = []
    for ep in (toxric_endpoints or list(TOXRIC_ENDPOINTS.keys())):
        p = _pred(f"TOXRIC_{ep}")
        if p is not None:
            toxric_probs.append(p)
            preds[f"toxric_{ep}"] = round(p, 4)
    preds["toxric_avg"] = round(float(np.mean(toxric_probs)), 4) if toxric_probs else None

    # Weighted ensemble
    weights, scores = [], []
    for key, w in [("tox21", 0.40), ("ames", 0.20), ("tdc_avg", 0.25), ("toxric_avg", 0.15)]:
        if preds.get(key) is not None:
            weights.append(w); scores.append(preds[key])

    combined = round(sum(s * w for s, w in zip(scores, weights)) / sum(weights), 4) if scores else 0.0
    return {
        "smiles":         smiles,
        "combined_score": combined,
        "combined_toxic": combined >= THRESHOLD,
        "confidence":     round(abs(combined - 0.5) * 2, 4),
        "predictions":    preds,
        "sources_used":   len(scores),
        "summary": (
            f"Multi-source ToxScout AI: {round(combined*100)}% toxicity risk "
            f"({len(scores)} source(s)). "
            + ("HIGH CONCERN." if combined >= 0.70
               else "MODERATE CONCERN." if combined >= 0.35
               else "LOW CONCERN.")
        ),
    }


# ── CLI ───────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="TDC + TOXRIC Multi-Dataset Pipeline")
    p.add_argument("--tdc",      action="store_true")
    p.add_argument("--toxric",   type=str, default=None,
                   help="TOXRIC CSV path or endpoint name")
    p.add_argument("--datasets", nargs="+", default=None)
    p.add_argument("--split",    default="scaffold", choices=["scaffold", "random"])
    p.add_argument("--no-save",  action="store_true")
    args = p.parse_args()

    if args.tdc:
        run_tdc_pipeline(datasets=args.datasets, split=args.split,
                          save_models=not args.no_save)
    if args.toxric:
        if os.path.exists(args.toxric):
            run_toxric_pipeline(csv_path=args.toxric, save_models=not args.no_save)
        else:
            run_toxric_pipeline(endpoint=args.toxric, save_models=not args.no_save)
    if not args.tdc and not args.toxric:
        print("Usage:")
        print("  python multi_dataset.py --tdc")
        print("  python multi_dataset.py --tdc --datasets Tox21 ClinTox hERG")
        print("  python multi_dataset.py --toxric ames_mutagenicity")
        print("  python multi_dataset.py --toxric /path/to/file.csv")
        print(f"\nTDC datasets:      {list(TDC_DATASETS.keys())}")
        print(f"TOXRIC endpoints:  {list(TOXRIC_ENDPOINTS.keys())}")
