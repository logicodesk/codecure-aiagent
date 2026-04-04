# ============================================================
# ames_pipeline.py — Ames Mutagenicity Multi-Task Pipeline
# ============================================================
# Spec:
#   pandas.read_csv('ames_mutagenicity.csv')
#   Drop undefined labels (-1)
#   80/10/10 split, random_state=42
#   StandardScaler on numeric feats, fillna(0)
#   Primary target: df['Overall'] (1=mutagenic)
#   Multi-task: per-strain (TA98..TA1538) + Overall
# ============================================================
import sys, os, warnings
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(__file__))

import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.feature_selection import VarianceThreshold
from sklearn.metrics import (
    roc_auc_score, f1_score, accuracy_score,
    precision_score, recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from config import MODEL_DIR

AMES_CSV        = "ames_mutagenicity.csv"
OVERALL_COL     = "Overall"
AMES_STRAINS    = ["TA98", "TA100", "TA1535", "TA1537", "TA1538"]
ALL_TARGETS     = AMES_STRAINS + [OVERALL_COL]
UNDEFINED_LABEL = -1
RANDOM_STATE    = 42
THRESHOLD       = 0.35

# ── XGBoost spec (exact as requested) ────────────────────────
XGB_BASE_PARAMS = dict(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.1,
    random_state=RANDOM_STATE,
    eval_metric="logloss",
    n_jobs=1,
)
CV_FOLDS       = 5
AUC_BENCHMARK  = 0.85   # historical benchmark — warn if below

STRAIN_INFO = {
    "TA98":    {"mechanism": "frameshift mutations",           "sensitivity": "aromatic amines, nitro compounds"},
    "TA100":   {"mechanism": "base-pair substitutions",        "sensitivity": "alkylating agents, oxidants"},
    "TA1535":  {"mechanism": "base-pair substitutions (hisG)", "sensitivity": "direct-acting mutagens"},
    "TA1537":  {"mechanism": "frameshift mutations (hisC)",    "sensitivity": "intercalating agents"},
    "TA1538":  {"mechanism": "frameshift mutations (hisD)",    "sensitivity": "aromatic amines"},
    "Overall": {"mechanism": "overall mutagenicity",           "sensitivity": "any mutagenic mechanism"},
}

def _find_csv(path):
    if os.path.exists(path):
        return path
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    alt  = os.path.join(root, path)
    if os.path.exists(alt):
        return alt
    raise FileNotFoundError(
        f"Dataset not found: '{path}'\n"
        "Download from: https://data.mendeley.com/datasets/xhf4bnmzxb/1\n"
        "Place as 'ames_mutagenicity.csv' in the project root."
    )


def load_ames_csv(path=AMES_CSV):
    """pandas.read_csv('ames_mutagenicity.csv') with column normalisation."""
    path = _find_csv(path)
    df   = pd.read_csv(path)
    print(f"[Ames] Loaded {len(df)} rows x {len(df.columns)} cols")
    df.columns = [c.strip() for c in df.columns]
    for c in list(df.columns):
        if c.lower() in ("smiles", "canonical_smiles", "smi", "structure") and c != "smiles":
            df = df.rename(columns={c: "smiles"})
            break
    col_map = {}
    for c in df.columns:
        for t in ALL_TARGETS:
            if c.upper() == t.upper() and c != t:
                col_map[c] = t
    if col_map:
        df = df.rename(columns=col_map)
    return df


def drop_undefined(df, target_col):
    """Drop rows where target_col == -1 (undefined label)."""
    if target_col not in df.columns:
        raise ValueError(f"Column '{target_col}' not found. Available: {list(df.columns)[:15]}")
    before = len(df)
    df     = df[df[target_col] != UNDEFINED_LABEL].copy()
    df[target_col] = df[target_col].astype(int)
    pos = int(df[target_col].sum())
    neg = len(df) - pos
    print(f"[Ames:{target_col}] Dropped {before-len(df)} undefined. "
          f"Remaining: {len(df)} | Mutagenic: {pos} | Non-mutagenic: {neg} | Ratio: {neg/max(pos,1):.1f}:1")
    return df


def _feature_cols(df):
    exclude = {c.lower() for c in (ALL_TARGETS + ["smiles", "name", "cas", "id", "index"])}
    return [c for c in df.columns
            if c.lower() not in exclude and pd.api.types.is_numeric_dtype(df[c])]


def extract_features(df):
    """Use Mordred descriptors from CSV if >= 50 numeric cols, else RDKit. fillna(0)."""
    fcols = _feature_cols(df)
    if len(fcols) >= 50:
        print(f"[Ames] Using {len(fcols)} Mordred descriptors (fillna=0)")
        return df[fcols].fillna(0).values.astype(np.float32), fcols
    print(f"[Ames] Only {len(fcols)} numeric cols — computing RDKit features from SMILES")
    from features import build_feature_matrix, get_feature_names as _gfn
    from config import (USE_MORGAN_FP, MORGAN_RADIUS, MORGAN_NBITS,
                        USE_MACCS, USE_RDKIT_FP, RDKIT_FP_NBITS)
    X, _ = build_feature_matrix(df, smiles_col="smiles",
                                 use_morgan=USE_MORGAN_FP, morgan_radius=MORGAN_RADIUS,
                                 morgan_nbits=MORGAN_NBITS, use_maccs=USE_MACCS,
                                 use_rdkit_fp=USE_RDKIT_FP, rdkit_fp_nbits=RDKIT_FP_NBITS)
    feat_names = _gfn(use_morgan=USE_MORGAN_FP, morgan_nbits=MORGAN_NBITS,
                      use_maccs=USE_MACCS, use_rdkit_fp=USE_RDKIT_FP, rdkit_fp_nbits=RDKIT_FP_NBITS)
    return np.where(np.isfinite(X), X, 0.0), feat_names


def split_80_10_10(X, y):
    """80/10/10 split, random_state=42. Stratified ONLY if possible."""
    counts = np.bincount(y)
    can_stratify = len(counts) > 1 and np.min(counts) > 1
    
    st_y = y if can_stratify else None
    X_tr, X_tmp, y_tr, y_tmp = train_test_split(X, y, test_size=0.20,
                                                  random_state=RANDOM_STATE, stratify=st_y)
    
    # Check if tmp sets can be stratified
    tmp_counts = np.bincount(y_tmp)
    can_stratify_tmp = len(tmp_counts) > 1 and np.min(tmp_counts) > 1
    st_tmp = y_tmp if can_stratify_tmp else None
    
    X_val, X_te, y_val, y_te = train_test_split(X_tmp, y_tmp, test_size=0.50,
                                                  random_state=RANDOM_STATE, stratify=st_tmp)
    print(f"[Split] Train: {len(X_tr)} | Val: {len(X_val)} | Test: {len(X_te)} (Stratified: {can_stratify})")
    return X_tr, X_val, X_te, y_tr, y_val, y_te


def preprocess(X_tr, X_val, X_te, feat_names):
    """StandardScaler (fit on train only) + variance filter."""
    vt    = VarianceThreshold(threshold=0.0)
    X_tr  = vt.fit_transform(X_tr)
    X_val = vt.transform(X_val)
    X_te  = vt.transform(X_te)
    feat_names = [f for f, k in zip(feat_names, vt.get_support()) if k]
    print(f"[Preprocess] {X_tr.shape[1]} features after variance filter")
    scaler = StandardScaler()
    X_tr   = scaler.fit_transform(X_tr)
    X_val  = scaler.transform(X_val)
    X_te   = scaler.transform(X_te)
    return X_tr, X_val, X_te, scaler, feat_names

def _build_xgb(params: dict = None) -> XGBClassifier:
    """
    XGBClassifier with exact spec:
      n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42
    Optionally override with tuned params from Optuna.
    """
    p = {**XGB_BASE_PARAMS, **(params or {})}
    return XGBClassifier(**p)


def _build_ensemble(xgb_params: dict = None) -> VotingClassifier:
    """
    Soft-voting ensemble: XGBoost (primary) + RF + LGBM.
    XGBoost uses exact spec params unless overridden by Optuna.
    """
    xgb  = _build_xgb(xgb_params)
    rf   = RandomForestClassifier(n_estimators=200, class_weight="balanced",
                                   random_state=RANDOM_STATE, n_jobs=1)
    lgbm = LGBMClassifier(n_estimators=200, max_depth=5, learning_rate=0.05,
                           class_weight="balanced", random_state=RANDOM_STATE,
                           n_jobs=1, verbose=-1)
    return VotingClassifier(
        estimators=[("xgb", xgb), ("rf", rf), ("lgbm", lgbm)],
        voting="soft", n_jobs=1,
    )


# ── 5-fold CV with ROC-AUC benchmark ─────────────────────────

def cross_validate_xgb(X_tr: np.ndarray, y_tr: np.ndarray,
                        target: str, xgb_params: dict = None) -> dict:
    """
    5-fold stratified CV on XGBoost (exact spec).
    Reports mean ± std ROC-AUC and flags if below 0.85 benchmark.
    Fast on CPU (~5s for 5k samples).
    """
    xgb = _build_xgb(xgb_params)
    min_class = min(np.bincount(y_tr)) if len(y_tr) > 0 else 0
    if min_class < 2:
        print(f"  [CV:{target:10s}] Warning: Too few samples for CV ({min_class} positive).")
        return {"target": target, "cv_mean_auc": 0.0, "cv_std_auc": 0.0, "cv_scores": [0.0], "benchmark_ok": False, "benchmark": AUC_BENCHMARK}
    n_splits = min(CV_FOLDS, min_class)
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_STATE)
    scores = cross_val_score(xgb, X_tr, y_tr, cv=skf,
                              scoring="roc_auc", n_jobs=1)
    mean_auc = float(scores.mean())
    std_auc  = float(scores.std())
    benchmark_ok = mean_auc >= AUC_BENCHMARK

    status = "[OK]" if benchmark_ok else f"[WARN] below {AUC_BENCHMARK} benchmark"
    print(f"  [CV:{target:10s}] {CV_FOLDS}-fold ROC-AUC: "
          f"{mean_auc:.4f} ± {std_auc:.4f}  "
          f"[min={scores.min():.4f} max={scores.max():.4f}]  {status}")

    return {
        "target":       target,
        "cv_mean_auc":  round(mean_auc, 4),
        "cv_std_auc":   round(std_auc, 4),
        "cv_scores":    [round(s, 4) for s in scores.tolist()],
        "benchmark_ok": benchmark_ok,
        "benchmark":    AUC_BENCHMARK,
    }


# ── Optuna hyperparameter optimisation ───────────────────────

def optimize_xgb_optuna(X_tr: np.ndarray, y_tr: np.ndarray,
                         target: str, n_trials: int = 30,
                         timeout: int = 120) -> dict:
    """
    Optuna-based XGBoost hyperparameter search.
    Search space covers the key parameters for tabular chemical data.
    Returns best_params dict ready to pass to _build_xgb().

    n_trials=30 completes in ~60-120s on CPU for 5k samples.
    Set timeout (seconds) as a hard cap.
    """
    try:
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)
    except ImportError:
        print("  [Optuna] Not installed. Run: pip install optuna")
        print("  [Optuna] Falling back to base XGBoost params.")
        return XGB_BASE_PARAMS.copy()

    min_class = min(np.bincount(y_tr)) if len(y_tr) > 0 else 0
    if min_class < 2:
        return XGB_BASE_PARAMS.copy()
    n_splits = min(CV_FOLDS, min_class)
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_STATE)

    def objective(trial):
        params = {
            "n_estimators":     trial.suggest_int("n_estimators", 100, 500),
            "max_depth":        trial.suggest_int("max_depth", 3, 9),
            "learning_rate":    trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample":        trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "gamma":            trial.suggest_float("gamma", 0.0, 1.0),
            "reg_alpha":        trial.suggest_float("reg_alpha", 1e-4, 10.0, log=True),
            "reg_lambda":       trial.suggest_float("reg_lambda", 1e-4, 10.0, log=True),
            "eval_metric":      "logloss",
            "random_state":     RANDOM_STATE,
            "n_jobs":           1,
        }
        model  = XGBClassifier(**params)
        scores = cross_val_score(model, X_tr, y_tr, cv=skf,
                                  scoring="roc_auc", n_jobs=1)
        return scores.mean()

    study = optuna.create_study(
        direction="maximize",
        sampler=optuna.samplers.TPESampler(seed=RANDOM_STATE),
        pruner=optuna.pruners.MedianPruner(n_startup_trials=5),
    )
    study.optimize(objective, n_trials=n_trials, timeout=timeout, show_progress_bar=False)

    best = study.best_params
    best_auc = study.best_value
    print(f"  [Optuna:{target}] Best CV AUC: {best_auc:.4f} "
          f"(+{best_auc - AUC_BENCHMARK:+.4f} vs benchmark) "
          f"after {len(study.trials)} trials")
    print(f"  [Optuna:{target}] Best params: n_est={best.get('n_estimators')} "
          f"depth={best.get('max_depth')} lr={best.get('learning_rate'):.4f} "
          f"sub={best.get('subsample'):.2f}")

    return best


def _evaluate(model, X, y, split_name, target):
    prob = model.predict_proba(X)[:, 1]
    pred = (prob >= THRESHOLD).astype(int)
    auc_val = 0.0
    if len(np.unique(y)) > 1:
        auc_val = round(roc_auc_score(y, prob), 4)
    m = {
        "split": split_name, "target": target,
        "auc":       auc_val,
        "f1":        round(f1_score(y, pred, zero_division=0), 4),
        "accuracy":  round(accuracy_score(y, pred), 4),
        "precision": round(precision_score(y, pred, zero_division=0), 4),
        "recall":    round(recall_score(y, pred, zero_division=0), 4),
        "n_pos": int(y.sum()), "n_total": len(y),
    }
    print(f"  [{target:10s}|{split_name:5s}] "
          f"AUC={m['auc']:.4f}  F1={m['f1']:.4f}  "
          f"Acc={m['accuracy']:.4f}  Prec={m['precision']:.4f}  Rec={m['recall']:.4f}")
    return m


def train_single_target(X_tr, X_val, X_te, y_tr, y_val, y_te, target,
                         use_optuna: bool = False, optuna_trials: int = 30):
    """
    Train for one target:
      1. 5-fold CV on base XGBoost (n_est=200, depth=6, lr=0.1)
      2. Optional Optuna tuning (use_optuna=True)
      3. Final ensemble: tuned XGBoost + RF + LGBM
      4. Evaluate on val + test
    """
    # Step 1: CV benchmark
    cv_result = cross_validate_xgb(X_tr, y_tr, target)

    # Step 2: Optuna (optional)
    xgb_params = None
    if use_optuna:
        print(f"  [Optuna] Optimising XGBoost for {target}...")
        xgb_params = optimize_xgb_optuna(X_tr, y_tr, target, n_trials=optuna_trials)
        # Re-run CV with tuned params to confirm improvement
        cv_tuned = cross_validate_xgb(X_tr, y_tr, f"{target}(tuned)", xgb_params)
        cv_result["tuned"] = cv_tuned

    # Step 3: Train final ensemble
    model = _build_ensemble(xgb_params)
    model.fit(X_tr, y_tr)

    return {
        "model":      model,
        "cv":         cv_result,
        "xgb_params": xgb_params or XGB_BASE_PARAMS,
        "val":        _evaluate(model, X_val, y_val, "val",  target),
        "test":       _evaluate(model, X_te,  y_te,  "test", target),
        "target":     target,
    }


def run_ames_pipeline(path=AMES_CSV, save_models=True,
                       use_optuna=False, optuna_trials=30):
    """
    Full multi-task Ames pipeline.
    - XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)
    - 5-fold CV ROC-AUC benchmark (>0.85 target)
    - Optional Optuna tuning per target (use_optuna=True)
    - Ensemble: tuned XGBoost + RF + LGBM
    - Saves per-target models + scalers
    """
    print("\n" + "="*60)
    print("  AMES MUTAGENICITY MULTI-TASK PIPELINE")
    print(f"  XGBoost: n_est=200 depth=6 lr=0.1  CV={CV_FOLDS}-fold  "
          f"Optuna={'ON' if use_optuna else 'OFF'}")
    print("="*60)
    df = load_ames_csv(path)
    available = [t for t in ALL_TARGETS if t in df.columns]
    if not available:
        raise ValueError(f"No target columns found. Expected: {ALL_TARGETS}")
    print(f"[Ames] Targets: {available}")
    X_all, feat_names = extract_features(df)
    print(f"[Ames] Feature matrix: {X_all.shape}")

    results      = {}
    summary_rows = []

    for target in available:
        print(f"\n── Target: {target} ──")
        valid_mask = df[target] != UNDEFINED_LABEL
        y   = df.loc[valid_mask, target].astype(int).values
        X_t = X_all[valid_mask.values]
        if y.sum() < 1:
            print(f"  [{target}] Skipped — only {y.sum()} positives")
            continue

        X_tr, X_val, X_te, y_tr, y_val, y_te = split_80_10_10(X_t, y)
        X_tr, X_val, X_te, scaler, fn = preprocess(X_tr, X_val, X_te, feat_names[:])

        res = train_single_target(X_tr, X_val, X_te, y_tr, y_val, y_te,
                                   target, use_optuna=use_optuna,
                                   optuna_trials=optuna_trials)
        results[target] = res

        cv = res["cv"]
        summary_rows.append({
            "target":       target,
            "cv_auc":       cv["cv_mean_auc"],
            "cv_std":       cv["cv_std_auc"],
            "benchmark_ok": cv["benchmark_ok"],
            "val_auc":      res["val"]["auc"],
            "test_auc":     res["test"]["auc"],
            "val_f1":       res["val"]["f1"],
            "test_f1":      res["test"]["f1"],
            "n_mutagenic":  int(y.sum()),
            "n_total":      len(y),
        })

        if save_models:
            joblib.dump(res["model"],      os.path.join(MODEL_DIR, f"Ames_{target}.pkl"))
            joblib.dump(scaler,            os.path.join(MODEL_DIR, f"Ames_{target}_scaler.pkl"))
            joblib.dump(fn,                os.path.join(MODEL_DIR, f"Ames_{target}_features.pkl"))
            joblib.dump(res["xgb_params"], os.path.join(MODEL_DIR, f"Ames_{target}_xgb_params.pkl"))
            print(f"  [Saved] Ames_{target}.pkl")

    # ── Summary table ─────────────────────────────────────────
    print("\n" + "="*60)
    print("  MULTI-TASK SUMMARY")
    print("="*60)
    print(f"  {'Target':10s}  {'CV AUC':>8}  {'±':>6}  {'BM':>3}  "
          f"{'Val AUC':>8}  {'Test AUC':>9}  {'Test F1':>8}  {'N+':>5}")
    print("  " + "-"*70)
    for r in summary_rows:
        bm = "OK" if r["benchmark_ok"] else "FAIL"
        print(f"  {r['target']:10s}  {r['cv_auc']:>8.4f}  "
              f"±{r['cv_std']:>5.4f}  {bm:>3}  "
              f"{r['val_auc']:>8.4f}  {r['test_auc']:>9.4f}  "
              f"{r['test_f1']:>8.4f}  {r['n_mutagenic']:>5}")

    n_pass = sum(1 for r in summary_rows if r["benchmark_ok"])
    print(f"\n  Benchmark (AUC ≥ {AUC_BENCHMARK}): {n_pass}/{len(summary_rows)} targets passed")
    return results

def predict_ames(smiles):
    """Predict Ames mutagenicity for a SMILES string across all strains."""
    from features import smiles_to_descriptors
    from config import (USE_MORGAN_FP, MORGAN_RADIUS, MORGAN_NBITS,
                        USE_MACCS, USE_RDKIT_FP, RDKIT_FP_NBITS)
    predictions = {}
    for target in ALL_TARGETS:
        model_path  = os.path.join(MODEL_DIR, f"Ames_{target}.pkl")
        scaler_path = os.path.join(MODEL_DIR, f"Ames_{target}_scaler.pkl")
        feat_path   = os.path.join(MODEL_DIR, f"Ames_{target}_features.pkl")
        if not os.path.exists(model_path):
            continue
        model      = joblib.load(model_path)
        scaler     = joblib.load(scaler_path)
        feat_names = joblib.load(feat_path)
        feat = smiles_to_descriptors(smiles,
                                      use_morgan=USE_MORGAN_FP, morgan_radius=MORGAN_RADIUS,
                                      morgan_nbits=MORGAN_NBITS, use_maccs=USE_MACCS,
                                      use_rdkit_fp=USE_RDKIT_FP, rdkit_fp_nbits=RDKIT_FP_NBITS)
        if feat is None:
            return {"error": f"Invalid SMILES: '{smiles}'"}
        n = scaler.n_features_in_
        if feat.shape[0] > n:
            feat = feat[:n]
        elif feat.shape[0] < n:
            feat = np.pad(feat, (0, n - feat.shape[0]))
        X    = scaler.transform(feat.reshape(1, -1))
        prob = float(model.predict_proba(X)[0, 1])
        predictions[target] = {
            "probability": round(prob, 4),
            "mutagenic":   prob >= THRESHOLD,
            "mechanism":   STRAIN_INFO[target]["mechanism"],
            "sensitivity": STRAIN_INFO[target]["sensitivity"],
        }
    if not predictions:
        return {"error": "Ames models not trained. Run: python drug_toxicity/ames_pipeline.py"}
    active = [s for s in AMES_STRAINS if predictions.get(s, {}).get("mutagenic")]
    overall_prob = predictions.get(OVERALL_COL, {}).get("probability")
    return {
        "smiles":         smiles,
        "strains":        predictions,
        "active_strains": active,
        "consensus_prob": overall_prob,
        "mutagenic":      bool(active) or (overall_prob is not None and overall_prob >= THRESHOLD),
        "strain_count":   len(active),
        "interpretation": _interpret_ames(active, predictions),
    }


def _interpret_ames(active_strains, predictions):
    if not active_strains:
        return "No Ames mutagenicity predicted across tested strains. Favorable genotoxicity profile."
    parts = []
    for s in active_strains:
        info = STRAIN_INFO.get(s, {})
        prob = predictions.get(s, {}).get("probability", 0)
        parts.append(f"{s} ({round(prob*100)}%): {info.get('mechanism','?')} — "
                     f"sensitive to {info.get('sensitivity','?')}")
    return (f"Ames mutagenicity predicted in {len(active_strains)} strain(s): "
            + "; ".join(parts) + ". "
            "Genotoxicity testing (in-vitro Ames assay) is strongly recommended.")


def predict_combined(smiles):
    """Tox21 (60%) + Ames Overall (40%) weighted ensemble."""
    from model_io import predict_toxicity as tox21_predict
    tox21 = tox21_predict(smiles, model_name="Voting_Ensemble")
    ames  = predict_ames(smiles)
    if "error" in ames:
        return {"smiles": smiles, "tox21": tox21, "ames": ames,
                "combined_score": tox21.get("probability", 0),
                "combined_toxic": tox21.get("toxic", False)}
    t_prob   = tox21.get("probability", 0)
    a_prob   = ames.get("consensus_prob") or 0
    combined = round(t_prob * 0.6 + a_prob * 0.4, 4)
    return {
        "smiles":         smiles,
        "tox21":          tox21,
        "ames":           ames,
        "combined_score": combined,
        "combined_toxic": combined >= THRESHOLD,
        "confidence":     round(abs(combined - 0.5) * 2, 4),
        "summary": (
            f"Combined ToxScout AI score: {round(combined*100)}% toxicity risk. "
            f"Tox21: {'TOXIC' if tox21.get('toxic') else 'non-toxic'} ({round(t_prob*100)}%). "
            f"Ames: {'MUTAGENIC' if ames.get('mutagenic') else 'non-mutagenic'} "
            f"({len(ames.get('active_strains',[]))} active strain(s)). "
            + ("High concern — both endpoints flagged."
               if tox21.get("toxic") and ames.get("mutagenic")
               else "Partial concern — review individual endpoints.")
        ),
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Ames Mutagenicity Multi-Task Pipeline")
    parser.add_argument("--csv",     default=AMES_CSV,  help="Path to ames_mutagenicity.csv")
    parser.add_argument("--optuna",  action="store_true", help="Run Optuna hyperparameter search")
    parser.add_argument("--trials",  type=int, default=30, help="Optuna trials per target (default: 30)")
    parser.add_argument("--no-save", action="store_true",  help="Skip saving models")
    args = parser.parse_args()

    AMES_PATH = args.csv
    if not os.path.exists(AMES_PATH):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        AMES_PATH = os.path.join(root, args.csv)

    if not os.path.exists(AMES_PATH):
        print(f"\n[Ames] '{args.csv}' not found — generating demo dataset...")
        demo = pd.DataFrame({
            "smiles":  ["c1ccc(cc1)N", "c1ccc([N+](=O)[O-])cc1",
                        "CC(=O)Oc1ccccc1C(=O)O", "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
                        "c1ccc2ccccc2c1", "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
                        "c1ccc(cc1)c1ccccc1", "O=Cc1ccccc1",
                        "c1ccc(cc1)N", "c1ccc([N+](=O)[O-])cc1",
                        "CC(=O)Oc1ccccc1C(=O)O", "CN1C=NC2=C1C(=O)N(C(=O)N2C)C"],
            "TA98":    [1,1,0,0,0,0,0,0,1,1,0,0],
            "TA100":   [1,1,0,0,1,0,0,1,1,1,0,0],
            "TA1535":  [0,1,0,0,0,0,0,0,0,1,0,0],
            "TA1537":  [1,0,0,0,0,0,0,0,1,0,0,0],
            "TA1538":  [1,1,0,0,0,0,0,0,1,1,0,0],
            "Overall": [1,1,0,0,1,0,0,1,1,1,0,0],
        })
        demo.to_csv(AMES_PATH, index=False)
        print(f"[Ames] Demo dataset saved: {AMES_PATH}")

    results = run_ames_pipeline(
        AMES_PATH,
        save_models=not args.no_save,
        use_optuna=args.optuna,
        optuna_trials=args.trials,
    )

    print("\n── Inference Demo ──")
    for smi, name in [("c1ccc(cc1)N", "Aniline"),
                       ("CC(=O)Oc1ccccc1C(=O)O", "Aspirin"),
                       ("c1ccc([N+](=O)[O-])cc1", "Nitrobenzene")]:
        r = predict_ames(smi)
        if "error" in r:
            print(f"  {name}: {r['error']}")
        else:
            label = "MUTAGENIC" if r["mutagenic"] else "non-mutagenic"
            print(f"  {name}: {label} | active: {r['active_strains']}")
