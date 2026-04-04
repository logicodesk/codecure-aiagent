# ============================================================
# evaluation.py — metrics, threshold tuning, overfitting check
# ============================================================

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os

from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix, roc_curve,
    precision_recall_curve, average_precision_score,
    matthews_corrcoef, balanced_accuracy_score,
)
from config import PLOT_DIR, DECISION_THRESHOLD


# ── Full evaluation ───────────────────────────────────────────

def evaluate_model(name: str, model, X_test, y_test,
                   threshold: float = DECISION_THRESHOLD) -> dict:
    """
    Evaluate with custom probability threshold.
    Returns metrics dict and prints a formatted summary.
    """
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= threshold).astype(int)

    metrics = {
        "Model":           name,
        "Accuracy":        round(accuracy_score(y_test, y_pred), 4),
        "Bal. Accuracy":   round(balanced_accuracy_score(y_test, y_pred), 4),
        "Precision":       round(precision_score(y_test, y_pred, zero_division=0), 4),
        "Recall":          round(recall_score(y_test, y_pred, zero_division=0), 4),
        "F1":              round(f1_score(y_test, y_pred, zero_division=0), 4),
        "MCC":             round(matthews_corrcoef(y_test, y_pred), 4),
        "ROC-AUC":         round(roc_auc_score(y_test, y_prob), 4),
        "PR-AUC":          round(average_precision_score(y_test, y_prob), 4),
    }

    print(f"\n{'='*54}")
    print(f"  {name}  (threshold={threshold})")
    print(f"{'='*54}")
    for k, v in metrics.items():
        if k != "Model":
            print(f"  {k:<18}: {v}")
    return metrics


# ── Overfitting detection ─────────────────────────────────────

def check_overfitting(name: str, model, X_train, y_train,
                      X_test, y_test) -> dict:
    """
    Compare train vs test ROC-AUC.
    A large gap (>0.10) indicates overfitting.
    """
    train_auc = roc_auc_score(y_train, model.predict_proba(X_train)[:, 1])
    test_auc  = roc_auc_score(y_test,  model.predict_proba(X_test)[:, 1])
    gap = train_auc - test_auc
    status = "⚠ OVERFIT" if gap > 0.10 else "✓ OK"
    print(f"  [{name}] Train AUC={train_auc:.4f}  Test AUC={test_auc:.4f}  "
          f"Gap={gap:.4f}  {status}")
    return {"train_auc": train_auc, "test_auc": test_auc, "gap": gap}


# ── Threshold tuning ──────────────────────────────────────────

def find_best_threshold(model, X_test, y_test,
                        metric: str = "f1") -> float:
    """
    Find threshold maximising F1 (default) or recall on the test set.
    Also prints a threshold sensitivity table.
    """
    y_prob = model.predict_proba(X_test)[:, 1]
    prec, rec, thresholds = precision_recall_curve(y_test, y_prob)
    f1s = 2 * prec * rec / (prec + rec + 1e-9)

    print("\n  Threshold sensitivity:")
    print(f"  {'Threshold':>10}  {'Precision':>10}  {'Recall':>8}  {'F1':>8}")
    for t, p, r, f in zip(thresholds[::max(1, len(thresholds)//8)],
                           prec[::max(1, len(thresholds)//8)],
                           rec[::max(1, len(thresholds)//8)],
                           f1s[::max(1, len(thresholds)//8)]):
        print(f"  {t:>10.3f}  {p:>10.4f}  {r:>8.4f}  {f:>8.4f}")

    best_idx = np.argmax(f1s)
    best_t = float(thresholds[best_idx]) if best_idx < len(thresholds) else 0.5
    print(f"\n  → Best threshold: {best_t:.3f}  (F1={f1s[best_idx]:.4f})")
    return best_t


# ── Confidence scoring ────────────────────────────────────────

def confidence_score(probability: float) -> dict:
    """
    Convert raw probability into a confidence percentage and level.
    Used by the inference API and demo.
    """
    dist = abs(probability - 0.5)          # distance from decision boundary
    confidence_pct = round(dist * 200, 1)  # 0–100%
    if confidence_pct >= 70:
        level = "High"
    elif confidence_pct >= 40:
        level = "Medium"
    else:
        level = "Low"
    return {
        "probability":      round(probability, 4),
        "confidence_pct":   confidence_pct,
        "confidence_level": level,
        "toxic":            probability >= DECISION_THRESHOLD,
    }


# ── Plots ─────────────────────────────────────────────────────

def plot_confusion_matrix(name: str, model, X_test, y_test,
                          threshold: float = DECISION_THRESHOLD):
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= threshold).astype(int)
    cm = confusion_matrix(y_test, y_pred)

    fig, ax = plt.subplots(figsize=(5, 4))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                xticklabels=["Non-toxic", "Toxic"],
                yticklabels=["Non-toxic", "Toxic"], ax=ax)
    ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
    ax.set_title(f"Confusion Matrix — {name}")
    plt.tight_layout()
    path = os.path.join(PLOT_DIR, f"cm_{name.replace(' ','_')}.png")
    plt.savefig(path, dpi=150); plt.close()
    print(f"[Plot] {path}")


def plot_roc_curves(models_dict: dict, X_test, y_test):
    fig, ax = plt.subplots(figsize=(8, 6))
    colors = plt.cm.tab10(np.linspace(0, 1, len(models_dict)))
    for (name, model), color in zip(models_dict.items(), colors):
        y_prob = model.predict_proba(X_test)[:, 1]
        fpr, tpr, _ = roc_curve(y_test, y_prob)
        auc = roc_auc_score(y_test, y_prob)
        ax.plot(fpr, tpr, label=f"{name} (AUC={auc:.3f})", color=color, lw=2)
    ax.plot([0, 1], [0, 1], "k--", lw=1)
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title("ROC Curves — All Models")
    ax.legend(loc="lower right", fontsize=8)
    plt.tight_layout()
    path = os.path.join(PLOT_DIR, "roc_curves.png")
    plt.savefig(path, dpi=150); plt.close()
    print(f"[Plot] {path}")


def plot_pr_curves(models_dict: dict, X_test, y_test):
    """Precision-Recall curves — more informative under class imbalance."""
    fig, ax = plt.subplots(figsize=(8, 6))
    colors = plt.cm.tab10(np.linspace(0, 1, len(models_dict)))
    for (name, model), color in zip(models_dict.items(), colors):
        y_prob = model.predict_proba(X_test)[:, 1]
        prec, rec, _ = precision_recall_curve(y_test, y_prob)
        ap = average_precision_score(y_test, y_prob)
        ax.plot(rec, prec, label=f"{name} (AP={ap:.3f})", color=color, lw=2)
    ax.set_xlabel("Recall"); ax.set_ylabel("Precision")
    ax.set_title("Precision-Recall Curves — All Models")
    ax.legend(loc="upper right", fontsize=8)
    plt.tight_layout()
    path = os.path.join(PLOT_DIR, "pr_curves.png")
    plt.savefig(path, dpi=150); plt.close()
    print(f"[Plot] {path}")


def plot_threshold_curve(model, X_test, y_test, model_name: str):
    """Plot F1, Precision, Recall vs threshold — helps pick optimal cutoff."""
    y_prob = model.predict_proba(X_test)[:, 1]
    thresholds = np.linspace(0.1, 0.9, 80)
    f1s, precs, recs = [], [], []
    for t in thresholds:
        y_pred = (y_prob >= t).astype(int)
        f1s.append(f1_score(y_test, y_pred, zero_division=0))
        precs.append(precision_score(y_test, y_pred, zero_division=0))
        recs.append(recall_score(y_test, y_pred, zero_division=0))

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(thresholds, f1s,   label="F1",        lw=2, color="steelblue")
    ax.plot(thresholds, precs, label="Precision",  lw=2, color="tomato")
    ax.plot(thresholds, recs,  label="Recall",     lw=2, color="seagreen")
    ax.axvline(DECISION_THRESHOLD, color="gray", linestyle="--",
               label=f"Default ({DECISION_THRESHOLD})")
    ax.set_xlabel("Threshold"); ax.set_ylabel("Score")
    ax.set_title(f"Threshold Sensitivity — {model_name}")
    ax.legend(); plt.tight_layout()
    path = os.path.join(PLOT_DIR, f"threshold_{model_name.replace(' ','_')}.png")
    plt.savefig(path, dpi=150); plt.close()
    print(f"[Plot] {path}")


def print_comparison_table(results: list):
    df = pd.DataFrame(results).set_index("Model")
    print("\n" + "=" * 72)
    print("  MODEL COMPARISON SUMMARY")
    print("=" * 72)
    print(df.to_string())
    print("=" * 72)
    best = df["ROC-AUC"].idxmax()
    print(f"\n  Best model by ROC-AUC : {best} ({df.loc[best,'ROC-AUC']})")
    best_f1 = df["F1"].idxmax()
    print(f"  Best model by F1      : {best_f1} ({df.loc[best_f1,'F1']})")


def plot_multi_target_heatmap(multi_results: dict):
    df = pd.DataFrame(multi_results).T
    fig, ax = plt.subplots(figsize=(max(8, len(df.columns) * 1.5),
                                    max(5, len(df) * 0.6)))
    sns.heatmap(df.astype(float), annot=True, fmt=".3f", cmap="YlOrRd",
                vmin=0.5, vmax=1.0, ax=ax, linewidths=0.5)
    ax.set_title("ROC-AUC Across All Tox21 Targets")
    ax.set_xlabel("Model"); ax.set_ylabel("Target")
    plt.tight_layout()
    path = os.path.join(PLOT_DIR, "multi_target_heatmap.png")
    plt.savefig(path, dpi=150); plt.close()
    print(f"[Plot] {path}")
