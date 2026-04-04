# ============================================================
# main.py — Full Enhanced Drug Toxicity ML Pipeline
# ============================================================
# Run:  python drug_toxicity/main.py
#
# Feature set (all on):
#   47 scalar descriptors (physicochemical + drug-likeness +
#      ring systems + EState + structural alerts / toxicophores)
#  167 MACCS keys
#  256 Morgan ECFP4
#  200 RDKit topological FP
#  ─── Total: ~670 raw features (after selection: ~400-500)
#
# Toggle USE_PUBCHEM_ENRICHMENT=True in config.py to add
# PubChem-fetched properties (XLogP, Complexity, etc.)
# ============================================================

import sys, os, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(__file__))

from preprocessing import load_single_target, load_multi_target
from models import (
    get_logistic_regression, get_random_forest, get_extra_trees,
    get_xgboost, get_lightgbm, get_mlp,
    get_voting_ensemble, get_stacking_ensemble,
    tune_random_forest, tune_xgboost, tune_lightgbm,
    cross_validate_model,
)
from evaluation import (
    evaluate_model, find_best_threshold, check_overfitting,
    plot_confusion_matrix, plot_roc_curves, plot_pr_curves,
    plot_threshold_curve, print_comparison_table,
    plot_multi_target_heatmap,
)
from visualization import (
    plot_feature_importance, plot_shap_summary, plot_shap_bar,
    plot_shap_waterfall, plot_shap_dependence,
    plot_toxicophore_importance,
    plot_descriptor_distributions, plot_correlation_heatmap,
)
from model_io import save_model, save_scaler, predict_toxicity
from config import DATA_PATH, USE_TDC, USE_TOXRIC, TOXRIC_PATHS, TDC_ENDPOINTS_USE
from sklearn.metrics import roc_auc_score


def section(title: str):
    print(f"\n{'='*64}\n  {title}\n{'='*64}")


# ── Single-target pipeline ────────────────────────────────────

def run_single_target(tune: bool = False):
    """
    Full pipeline on the primary Tox21 target (SR-ARE):

      1.  Preprocessing (impute → outlier removal → scale →
                         scaffold/random split → feature selection → SMOTE)
      2.  Train 6 base models (LR, RF, ET, XGB, LGBM, MLP)
      3.  K-Fold cross-validation (overfitting check)
      4.  Optional hyperparameter tuning (RandomizedSearchCV)
      5.  Ensemble: Voting (RF+ET+XGB+LGBM) + Stacking (calibrated LR meta)
      6.  Overfitting detection (train vs test AUC gap)
      7.  Threshold tuning (maximise F1)
      8.  Full evaluation (Accuracy, Precision, Recall, F1, MCC, ROC-AUC, PR-AUC)
      9.  ROC + PR curves
     10.  Feature importance (RF, XGB, LGBM)
     11.  SHAP: beeswarm, bar, waterfall, dependence, toxicophore
     12.  Save all models
    """

    section("STEP 1 — Preprocessing")
    X_tr, X_te, y_tr, y_te, scaler, feat_names, kept_indices = load_single_target(DATA_PATH)
    save_scaler(scaler)
    from model_io import save_kept_indices
    save_kept_indices(kept_indices)

    # Descriptor distributions + correlation heatmap
    plot_descriptor_distributions(X_tr, y_tr, feat_names)
    plot_correlation_heatmap(X_tr, feat_names)

    # ── Train base models ─────────────────────────────────────
    section("STEP 2 — Training Base Models")
    lr   = get_logistic_regression(); lr.fit(X_tr, y_tr);   print("[✓] Logistic Regression")
    rf   = get_random_forest();       rf.fit(X_tr, y_tr);   print("[✓] Random Forest")
    et   = get_extra_trees();         et.fit(X_tr, y_tr);   print("[✓] Extra Trees")
    xgb  = get_xgboost();             xgb.fit(X_tr, y_tr);  print("[✓] XGBoost")
    lgbm = get_lightgbm();            lgbm.fit(X_tr, y_tr); print("[✓] LightGBM")
    mlp  = get_mlp();                 mlp.fit(X_tr, y_tr);  print("[✓] MLP")

    # ── Cross-validation ──────────────────────────────────────
    section("STEP 3 — Stratified K-Fold Cross-Validation (Train AUC)")
    for name, model in [("Logistic Regression", lr), ("Random Forest", rf),
                         ("Extra Trees", et), ("XGBoost", xgb),
                         ("LightGBM", lgbm)]:
        cross_validate_model(name, model, X_tr, y_tr, cv=5)

    # ── Hyperparameter tuning ─────────────────────────────────
    section("STEP 4 — Hyperparameter Tuning")
    if tune:
        rf_t   = tune_random_forest(X_tr, y_tr)
        xgb_t  = tune_xgboost(X_tr, y_tr)
        lgbm_t = tune_lightgbm(X_tr, y_tr)
    else:
        print("  [Skipped] Set tune=True for full RandomizedSearchCV")
        rf_t, xgb_t, lgbm_t = rf, xgb, lgbm

    # ── Ensemble models ───────────────────────────────────────
    section("STEP 5 — Ensemble Models (Voting + Stacking)")
    voting   = get_voting_ensemble(rf_t, xgb_t, lgbm_t, et)
    stacking = get_stacking_ensemble(rf_t, xgb_t, lgbm_t, et)
    voting.fit(X_tr, y_tr);   print("[✓] Voting Ensemble  (RF + ET + XGB + LGBM)")
    stacking.fit(X_tr, y_tr); print("[✓] Stacking Ensemble (calibrated LR meta)")

    # ── Overfitting check ─────────────────────────────────────
    section("STEP 6 — Overfitting Detection (Train vs Test AUC)")
    for name, model in [("Random Forest", rf_t), ("Extra Trees", et),
                         ("XGBoost", xgb_t), ("LightGBM", lgbm_t),
                         ("Voting Ensemble", voting),
                         ("Stacking Ensemble", stacking)]:
        check_overfitting(name, model, X_tr, y_tr, X_te, y_te)

    # ── Threshold tuning ──────────────────────────────────────
    section("STEP 7 — Threshold Tuning (Stacking Ensemble)")
    best_threshold = find_best_threshold(stacking, X_te, y_te)
    plot_threshold_curve(stacking, X_te, y_te, "Stacking Ensemble")

    # ── Full evaluation ───────────────────────────────────────
    section("STEP 8 — Model Evaluation")
    all_models = {
        "Logistic Regression": lr,
        "Random Forest":       rf_t,
        "Extra Trees":         et,
        "XGBoost":             xgb_t,
        "LightGBM":            lgbm_t,
        "MLP":                 mlp,
        "Voting Ensemble":     voting,
        "Stacking Ensemble":   stacking,
    }
    results = []
    for name, model in all_models.items():
        thr     = best_threshold if name == "Stacking Ensemble" else 0.35
        metrics = evaluate_model(name, model, X_te, y_te, threshold=thr)
        results.append(metrics)
        plot_confusion_matrix(name, model, X_te, y_te, threshold=thr)

    print_comparison_table(results)

    # ── ROC + PR curves ───────────────────────────────────────
    section("STEP 9 — ROC & PR Curves")
    plot_roc_curves(all_models, X_te, y_te)
    plot_pr_curves(all_models, X_te, y_te)

    # ── Feature importance ────────────────────────────────────
    section("STEP 10 — Feature Importance")
    for name, model in [("Random Forest", rf_t),
                         ("Extra Trees",   et),
                         ("XGBoost",       xgb_t),
                         ("LightGBM",      lgbm_t)]:
        plot_feature_importance(name, model, feat_names)

    # ── SHAP interpretability ─────────────────────────────────
    section("STEP 11 — SHAP Interpretability")
    # Beeswarm: direction + magnitude per feature
    plot_shap_summary(xgb_t, X_te, feat_names, "XGBoost")
    # Bar: global ranking with direction (red=toxic, blue=safe)
    plot_shap_bar(xgb_t, X_te, feat_names, "XGBoost")
    # Waterfall: explain one individual prediction
    plot_shap_waterfall(xgb_t, X_te[:50], feat_names, "XGBoost", sample_idx=0)
    # Dependence: feature value vs SHAP for top-3 features
    plot_shap_dependence(xgb_t, X_te, feat_names, "XGBoost", top_n=3)
    # Toxicophore: structural alert fragment importance
    plot_toxicophore_importance(xgb_t, X_te, feat_names, "XGBoost")

    # ── Save all models ───────────────────────────────────────
    section("STEP 12 — Save Models")
    for name, model in all_models.items():
        save_model(model, name)

    return all_models, X_te, y_te, feat_names


# ── Multi-target pipeline ─────────────────────────────────────

def run_multi_target():
    """Train RF / XGB / LGBM on all 12 Tox21 endpoints."""
    section("MULTI-TARGET — All 12 Tox21 Endpoints")
    target_data, scaler, feat_names = load_multi_target(DATA_PATH)
    multi_results = {}

    for tgt, (X_tr, X_te, y_tr, y_te) in target_data.items():
        print(f"\n  ── {tgt} ──")
        aucs = {}
        rf   = get_random_forest();  rf.fit(X_tr, y_tr)
        xgb  = get_xgboost();        xgb.fit(X_tr, y_tr)
        lgbm = get_lightgbm();       lgbm.fit(X_tr, y_tr)

        for name, m in [("RF", rf), ("XGB", xgb), ("LGBM", lgbm)]:
            auc = roc_auc_score(y_te, m.predict_proba(X_te)[:, 1])
            aucs[name] = round(auc, 4)
            print(f"    {name}: ROC-AUC={auc:.4f}")

        multi_results[tgt] = aucs
        best_name  = max(aucs, key=aucs.get)
        best_model = {"RF": rf, "XGB": xgb, "LGBM": lgbm}[best_name]
        save_model(best_model, f"{tgt}_{best_name}")

    plot_multi_target_heatmap(multi_results)
    return multi_results


# ── Demo inference ────────────────────────────────────────────

def run_demo_inference():
    """Predict toxicity for example molecules with confidence scores."""
    section("DEMO — Single-Molecule Inference with Confidence Scores")
    examples = [
        ("CC(=O)Oc1ccccc1C(=O)O",        "Aspirin"),
        ("ClCCl",                          "Dichloromethane"),
        ("CN1C=NC2=C1C(=O)N(C(=O)N2C)C", "Caffeine"),
        ("c1ccc(cc1)N",                    "Aniline (toxic)"),
        ("Clc1ccc(cc1Cl)c1cc(Cl)ccc1Cl",  "PCB (toxic)"),
        ("CC(C)Cc1ccc(cc1)C(C)C(=O)O",    "Ibuprofen"),
        ("CC(=O)Nc1ccc(O)cc1",             "Paracetamol"),
        ("[N+](=O)[O-]c1ccccc1",           "Nitrobenzene (alert: nitro)"),
        ("O=Cc1ccccc1",                    "Benzaldehyde (alert: aldehyde)"),
    ]
    print(f"\n  {'Molecule':<32} {'Result':<12} {'Prob':>6}  "
          f"{'Confidence':>10}  {'Level'}")
    print("  " + "-" * 70)
    for smi, name in examples:
        r = predict_toxicity(smi, model_name="Stacking_Ensemble")
        if "error" in r:
            print(f"  {name:<32} ERROR: {r['error']}")
            continue
        status = "TOXIC" if r["toxic"] else "non-toxic"
        print(f"  {name:<32} {status:<12} {r['probability']:>6.4f}  "
              f"{r['confidence_pct']:>9.1f}%  {r['confidence_level']}")


# ── TDC benchmark pipeline ────────────────────────────────────

def run_tdc_benchmark(endpoints: list = None):
    """
    Train and evaluate on TDC benchmark endpoints.
    Uses scaffold splits (same as TDC leaderboard).
    Reports ROC-AUC per endpoint for leaderboard comparison.
    """
    section("TDC BENCHMARK — Multi-Endpoint Evaluation")

    try:
        from data_sources import load_tdc_endpoint, dataset_summary
    except ImportError as e:
        print(f"[TDC] data_sources not available: {e}")
        return {}

    if endpoints is None:
        endpoints = TDC_ENDPOINTS_USE

    benchmark_results = {}

    for ep in endpoints:
        print(f"\n  ── TDC: {ep.upper()} ──")
        try:
            df = load_tdc_endpoint(ep, split="scaffold")
        except Exception as e:
            print(f"  [Skip] {ep}: {e}")
            continue

        # Featurize
        from features import build_feature_matrix, get_feature_names
        from preprocessing import _impute_features, _apply_smote
        from sklearn.preprocessing import StandardScaler
        from sklearn.model_selection import train_test_split

        # Use 'smiles' column, 'label' column
        df_ep = df.dropna(subset=["smiles", "label"]).copy()
        df_ep["label"] = df_ep["label"].astype(int)

        X, mask = build_feature_matrix(
            df_ep, smiles_col="smiles",
            use_morgan=True, morgan_radius=2, morgan_nbits=512,
            use_maccs=True, use_rdkit_fp=True, rdkit_fp_nbits=256,
        )
        y = df_ep["label"].values[mask]
        X = _impute_features(X)

        # Use scaffold split if available, else stratified random
        train_mask = df_ep["split"].values[mask] == "train"
        test_mask  = df_ep["split"].values[mask] == "test"

        if train_mask.sum() > 50 and test_mask.sum() > 10:
            X_tr, X_te = X[train_mask], X[test_mask]
            y_tr, y_te = y[train_mask], y[test_mask]
        else:
            X_tr, X_te, y_tr, y_te = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y)

        scaler = StandardScaler()
        X_tr   = scaler.fit_transform(X_tr)
        X_te   = scaler.transform(X_te)

        if y_tr.sum() < 10:
            print(f"  [Skip] {ep}: too few positives ({y_tr.sum()})")
            continue

        X_tr, y_tr = _apply_smote(X_tr, y_tr, ep)

        # Train XGBoost (fast, strong baseline)
        xgb = get_xgboost()
        xgb.fit(X_tr, y_tr)
        auc = roc_auc_score(y_te, xgb.predict_proba(X_te)[:, 1])

        # Also train RF for comparison
        rf = get_random_forest()
        rf.fit(X_tr, y_tr)
        auc_rf = roc_auc_score(y_te, rf.predict_proba(X_te)[:, 1])

        print(f"  XGBoost ROC-AUC: {auc:.4f}  |  RF ROC-AUC: {auc_rf:.4f}  "
              f"| Train: {len(X_tr)}  Test: {len(X_te)}")
        benchmark_results[ep] = {"XGBoost": round(auc, 4), "RF": round(auc_rf, 4)}

    if benchmark_results:
        section("TDC BENCHMARK RESULTS")
        print(f"  {'Endpoint':<20} {'XGBoost':>10} {'RF':>10}")
        print("  " + "-" * 42)
        for ep, scores in benchmark_results.items():
            print(f"  {ep:<20} {scores['XGBoost']:>10.4f} {scores['RF']:>10.4f}")

    return benchmark_results


# ── Entry point ───────────────────────────────────────────────

if __name__ == "__main__":
    # Single-target full pipeline (tune=False for speed)
    run_single_target(tune=False)

    # Multi-target across all 12 Tox21 endpoints
    run_multi_target()

    # TDC benchmark (runs only if USE_TDC=True or PyTDC installed)
    if USE_TDC:
        run_tdc_benchmark()
    else:
        print("\n[TDC] Skipped — set USE_TDC=True in config.py to enable")
        print("      Install: pip install PyTDC")

    # Demo inference with confidence scores
    run_demo_inference()

    print("\n[Done] Plots → drug_toxicity/plots/")
    print("[Done] Models → drug_toxicity/models/")
    if USE_TOXRIC:
        print("[Done] TOXRIC descriptors merged into feature matrix")
    print("\nTo enable TDC/TOXRIC:")
    print("  1. pip install PyTDC")
    print("  2. Set USE_TDC=True in drug_toxicity/config.py")
    print("  3. For TOXRIC: download CSVs from https://toxric.bioinforai.tech/download")
    print("     then set USE_TOXRIC=True and TOXRIC_PATHS in config.py")
