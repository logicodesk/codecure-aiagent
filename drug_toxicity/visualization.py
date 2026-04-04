# ============================================================
# visualization.py — feature importance, SHAP, distributions
# ============================================================

import numpy as np
import matplotlib.pyplot as plt
import os
from config import PLOT_DIR


# ── Feature importance bar chart ─────────────────────────────

def plot_feature_importance(name: str, model, feature_names: list,
                             top_n: int = 25):
    """Horizontal bar chart of top-N feature importances."""
    importances = model.feature_importances_
    idx       = np.argsort(importances)[::-1][:top_n]
    top_names = [feature_names[i] for i in idx]
    top_vals  = importances[idx]

    fig, ax = plt.subplots(figsize=(11, 7))
    colors = plt.cm.viridis(np.linspace(0.15, 0.85, top_n))
    ax.barh(top_names[::-1], top_vals[::-1], color=colors[::-1])
    ax.set_xlabel("Importance Score")
    ax.set_title(f"Top {top_n} Feature Importances — {name}")
    plt.tight_layout()
    path = os.path.join(PLOT_DIR, f"feat_imp_{name.replace(' ','_')}.png")
    plt.savefig(path, dpi=150); plt.close()
    print(f"[Plot] {path}")

    print(f"\n[{name}] Top 10 features:")
    for i in range(min(10, top_n)):
        print(f"  {i+1:>2}. {top_names[i]:<22} {top_vals[i]:.4f}")


# ── SHAP beeswarm ─────────────────────────────────────────────

def plot_shap_summary(model, X_test: np.ndarray,
                      feature_names: list, model_name: str):
    """
    SHAP beeswarm — direction + magnitude per feature.
    Red = pushes toward toxic, Blue = pushes toward non-toxic.
    """
    try:
        import shap
        print(f"\n[SHAP] Computing values for {model_name}...")
        explainer   = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_test)
        sv = shap_values[1] if isinstance(shap_values, list) else shap_values

        plt.figure(figsize=(11, 7))
        shap.summary_plot(sv, X_test, feature_names=feature_names,
                          show=False, max_display=20)
        plt.title(f"SHAP Beeswarm — {model_name}")
        plt.tight_layout()
        path = os.path.join(PLOT_DIR, f"shap_{model_name.replace(' ','_')}.png")
        plt.savefig(path, dpi=150, bbox_inches="tight"); plt.close()
        print(f"[SHAP] {path}")
    except ImportError:
        print("[SHAP] Not installed — run: pip install shap")
    except Exception as e:
        print(f"[SHAP] Error: {e}")


# ── SHAP global bar chart ─────────────────────────────────────

def plot_shap_bar(model, X_test: np.ndarray,
                  feature_names: list, model_name: str):
    """
    SHAP mean |value| bar chart — global feature importance
    ranked by average impact across all test samples.
    Also prints which features increase vs decrease toxicity.
    """
    try:
        import shap
        explainer   = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_test)
        sv = shap_values[1] if isinstance(shap_values, list) else shap_values

        mean_abs    = np.abs(sv).mean(axis=0)
        mean_signed = sv.mean(axis=0)
        idx   = np.argsort(mean_abs)[::-1][:20]
        names = [feature_names[i] for i in idx]
        vals  = mean_abs[idx]

        fig, ax = plt.subplots(figsize=(10, 6))
        bar_colors = ["tomato" if mean_signed[i] > 0 else "steelblue"
                      for i in idx]
        ax.barh(names[::-1], vals[::-1], color=bar_colors[::-1])
        ax.set_xlabel("Mean |SHAP value|")
        ax.set_title(f"SHAP Global Importance — {model_name}\n"
                     f"(Red = increases toxicity, Blue = decreases)")
        plt.tight_layout()
        path = os.path.join(PLOT_DIR,
                            f"shap_bar_{model_name.replace(' ','_')}.png")
        plt.savefig(path, dpi=150); plt.close()
        print(f"[SHAP] Bar chart: {path}")

        # Print ranked features with direction
        print(f"\n[SHAP] Top 10 features driving toxicity ({model_name}):")
        for rank, i in enumerate(idx[:10], 1):
            direction = "↑ TOXIC" if mean_signed[i] > 0 else "↓ safe"
            print(f"  {rank:>2}. {feature_names[i]:<26} "
                  f"mean|SHAP|={vals[rank-1]:.4f}  {direction}")

    except Exception as e:
        print(f"[SHAP bar] Error: {e}")


# ── SHAP waterfall for a single prediction ───────────────────

def plot_shap_waterfall(model, X_sample: np.ndarray,
                        feature_names: list, model_name: str,
                        sample_idx: int = 0):
    """
    Waterfall plot explaining one individual prediction.
    Shows exactly which features pushed the score up or down.
    """
    try:
        import shap
        explainer = shap.TreeExplainer(model)
        sv = explainer(X_sample)

        plt.figure(figsize=(10, 6))
        shap.plots.waterfall(sv[sample_idx], max_display=15, show=False)
        plt.title(f"SHAP Waterfall — {model_name} (sample {sample_idx})")
        plt.tight_layout()
        path = os.path.join(PLOT_DIR,
                            f"shap_waterfall_{model_name.replace(' ','_')}.png")
        plt.savefig(path, dpi=150, bbox_inches="tight"); plt.close()
        print(f"[SHAP] Waterfall: {path}")
    except Exception as e:
        print(f"[SHAP waterfall] Error: {e}")


# ── SHAP dependence plot ──────────────────────────────────────

def plot_shap_dependence(model, X_test: np.ndarray,
                         feature_names: list, model_name: str,
                         top_n: int = 3):
    """
    SHAP dependence plots for the top-N most important features.
    Shows how each feature value relates to its SHAP contribution,
    coloured by the most interacting feature.
    """
    try:
        import shap
        explainer   = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_test)
        sv = shap_values[1] if isinstance(shap_values, list) else shap_values

        mean_abs = np.abs(sv).mean(axis=0)
        top_idx  = np.argsort(mean_abs)[::-1][:top_n]

        fig, axes = plt.subplots(1, top_n, figsize=(6 * top_n, 5))
        if top_n == 1:
            axes = [axes]

        for ax, feat_idx in zip(axes, top_idx):
            feat_name = feature_names[feat_idx]
            shap.dependence_plot(
                feat_idx, sv, X_test,
                feature_names=feature_names,
                ax=ax, show=False,
                title=f"{feat_name}",
            )

        plt.suptitle(f"SHAP Dependence Plots — {model_name}", fontsize=12)
        plt.tight_layout()
        path = os.path.join(PLOT_DIR,
                            f"shap_dep_{model_name.replace(' ','_')}.png")
        plt.savefig(path, dpi=150, bbox_inches="tight"); plt.close()
        print(f"[SHAP] Dependence: {path}")
    except Exception as e:
        print(f"[SHAP dependence] Error: {e}")


# ── Toxicophore fragment importance ──────────────────────────

def plot_toxicophore_importance(model, X_test: np.ndarray,
                                feature_names: list, model_name: str):
    """
    Bar chart focused on structural alert (toxicophore) fragment features.
    Highlights which chemical substructures most drive toxicity predictions.
    """
    try:
        import shap
        explainer   = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_test)
        sv = shap_values[1] if isinstance(shap_values, list) else shap_values

        # Find fragment feature indices
        frag_idx = [i for i, n in enumerate(feature_names)
                    if n.startswith("Frag_")]
        if not frag_idx:
            print("[Toxicophore] No Frag_ features found — skipping")
            return

        mean_abs    = np.abs(sv[:, frag_idx]).mean(axis=0)
        mean_signed = sv[:, frag_idx].mean(axis=0)
        frag_names  = [feature_names[i] for i in frag_idx]

        order = np.argsort(mean_abs)[::-1]
        fig, ax = plt.subplots(figsize=(9, 5))
        bar_colors = ["tomato" if mean_signed[i] > 0 else "steelblue"
                      for i in order]
        ax.barh([frag_names[i] for i in order[::-1]],
                [mean_abs[i] for i in order[::-1]],
                color=bar_colors[::-1])
        ax.set_xlabel("Mean |SHAP value|")
        ax.set_title(f"Toxicophore Fragment Importance — {model_name}\n"
                     f"(Red = increases toxicity)")
        plt.tight_layout()
        path = os.path.join(PLOT_DIR,
                            f"toxicophore_{model_name.replace(' ','_')}.png")
        plt.savefig(path, dpi=150); plt.close()
        print(f"[Plot] Toxicophore: {path}")
    except Exception as e:
        print(f"[Toxicophore plot] Error: {e}")


# ── Descriptor distributions ─────────────────────────────────

def plot_descriptor_distributions(X_train, y_train, feature_names: list):
    """
    Overlapping histograms of the 16 core physicochemical descriptors
    split by class — shows which features separate toxic from non-toxic.
    """
    physchem = feature_names[:16]
    n        = len(physchem)
    cols, rows = 4, (n + 3) // 4

    fig, axes = plt.subplots(rows, cols, figsize=(cols * 4, rows * 3))
    axes = axes.flatten()

    for i, feat in enumerate(physchem):
        ax = axes[i]
        for cls, label, color in [(0, "Non-toxic", "steelblue"),
                                   (1, "Toxic",     "tomato")]:
            vals = X_train[y_train == cls, i]
            ax.hist(vals, bins=30, alpha=0.6, label=label,
                    color=color, density=True)
        ax.set_title(feat, fontsize=9)
        ax.legend(fontsize=7)

    for j in range(i + 1, len(axes)):
        axes[j].set_visible(False)

    plt.suptitle("Descriptor Distributions: Toxic vs Non-toxic", fontsize=12)
    plt.tight_layout()
    path = os.path.join(PLOT_DIR, "descriptor_distributions.png")
    plt.savefig(path, dpi=150); plt.close()
    print(f"[Plot] {path}")


# ── Correlation heatmap ───────────────────────────────────────

def plot_correlation_heatmap(X_train, feature_names: list):
    """
    Pearson correlation heatmap for the 16 core physicochemical
    descriptors — identifies redundant features before selection.
    """
    try:
        import seaborn as sns
        n    = min(16, len(feature_names))
        corr = np.corrcoef(X_train[:, :n].T)
        fig, ax = plt.subplots(figsize=(10, 8))
        sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm",
                    xticklabels=feature_names[:n],
                    yticklabels=feature_names[:n],
                    vmin=-1, vmax=1, ax=ax, linewidths=0.3)
        ax.set_title("Feature Correlation Matrix (Physicochemical)")
        plt.tight_layout()
        path = os.path.join(PLOT_DIR, "correlation_heatmap.png")
        plt.savefig(path, dpi=150); plt.close()
        print(f"[Plot] {path}")
    except Exception as e:
        print(f"[Correlation plot] Error: {e}")
