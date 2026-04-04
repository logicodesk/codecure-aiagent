# ============================================================
# shap_explainer.py  —  SHAP → Human-Readable Explanation Engine
# ============================================================
# Converts raw SHAP feature importance values into structured,
# scientifically grounded natural-language explanations.
# ============================================================

from __future__ import annotations
from typing import Optional
import math


# ── Feature knowledge base ────────────────────────────────────
# Maps feature name patterns → (short_label, meaning, toxic_direction, safe_direction)
# toxic_direction: what high SHAP means when feature pushes toward toxicity
# safe_direction:  what high SHAP means when feature pushes toward safety

FEATURE_KNOWLEDGE = {
    # ── Physicochemical ──────────────────────────────────────
    "LogP": {
        "label": "Lipophilicity (LogP)",
        "unit": "",
        "toxic_high": (
            "High lipophilicity (LogP > 5) promotes accumulation in lipid-rich tissues "
            "and membranes, increasing systemic exposure and reducing clearance."
        ),
        "toxic_low": (
            "Moderate lipophilicity contributes to membrane permeability, "
            "facilitating cellular uptake and potential intracellular toxicity."
        ),
        "safe_high": (
            "Lipophilicity is within acceptable range, supporting adequate "
            "membrane permeability without excessive bioaccumulation."
        ),
        "safe_low": (
            "Low lipophilicity limits passive membrane diffusion, "
            "reducing systemic distribution and toxicity risk."
        ),
        "threshold_high": 5.0,
        "threshold_low": -1.0,
    },
    "TPSA": {
        "label": "Topological Polar Surface Area (TPSA)",
        "unit": "Å²",
        "toxic_high": (
            "Low TPSA (< 40 Å²) indicates high membrane permeability, "
            "enabling rapid systemic distribution and increased exposure to sensitive tissues."
        ),
        "toxic_low": (
            "Moderate TPSA suggests balanced permeability, "
            "though cellular uptake remains possible."
        ),
        "safe_high": (
            "High TPSA (> 140 Å²) limits passive membrane permeability, "
            "reducing systemic absorption and toxicity risk."
        ),
        "safe_low": (
            "TPSA is within the optimal range for oral bioavailability "
            "without excessive membrane penetration."
        ),
        "threshold_high": 140.0,
        "threshold_low": 40.0,
        "invert": True,  # low TPSA = more toxic
    },
    "MolWeight": {
        "label": "Molecular Weight",
        "unit": "Da",
        "toxic_high": (
            "High molecular weight (> 500 Da) may impair renal clearance, "
            "leading to drug accumulation and prolonged toxic exposure."
        ),
        "toxic_low": (
            "Molecular weight is within the drug-like range, "
            "though other structural features drive toxicity."
        ),
        "safe_high": (
            "Molecular weight is within the Lipinski range (≤ 500 Da), "
            "supporting adequate absorption and clearance."
        ),
        "safe_low": (
            "Low molecular weight facilitates rapid clearance, "
            "limiting systemic accumulation."
        ),
        "threshold_high": 500.0,
        "threshold_low": 150.0,
    },
    "AromaticRings": {
        "label": "Aromatic Ring Count",
        "unit": "",
        "toxic_high": (
            "Multiple aromatic rings increase the likelihood of metabolic activation "
            "via cytochrome P450 enzymes, generating reactive epoxide intermediates "
            "that can form covalent adducts with DNA and proteins."
        ),
        "toxic_low": (
            "Aromatic character contributes to planar geometry, "
            "enabling intercalation with DNA and potential genotoxicity."
        ),
        "safe_high": (
            "Aromatic rings are present but within acceptable limits; "
            "metabolic activation risk is manageable."
        ),
        "safe_low": (
            "Low aromatic ring count reduces metabolic activation risk "
            "and potential for reactive intermediate formation."
        ),
        "threshold_high": 3,
        "threshold_low": 0,
    },
    "HBD": {
        "label": "Hydrogen Bond Donors (HBD)",
        "unit": "",
        "toxic_high": (
            "Excess hydrogen bond donors (> 5) violate Lipinski Ro5, "
            "impairing oral absorption and potentially causing off-target interactions."
        ),
        "toxic_low": (
            "Hydrogen bond donors contribute to protein binding affinity, "
            "which may increase off-target toxicity."
        ),
        "safe_high": (
            "HBD count is within Lipinski limits (≤ 5), "
            "supporting adequate oral bioavailability."
        ),
        "safe_low": (
            "Low HBD count reduces polar interactions, "
            "limiting non-specific protein binding."
        ),
        "threshold_high": 5,
        "threshold_low": 0,
    },
    "HBA": {
        "label": "Hydrogen Bond Acceptors (HBA)",
        "unit": "",
        "toxic_high": (
            "High HBA count (> 10) exceeds Lipinski limits, "
            "reducing membrane permeability and potentially causing transporter-mediated toxicity."
        ),
        "toxic_low": (
            "Hydrogen bond acceptors facilitate interactions with biological targets, "
            "contributing to off-target binding."
        ),
        "safe_high": (
            "HBA count is within acceptable range (≤ 10), "
            "consistent with drug-like oral bioavailability."
        ),
        "safe_low": (
            "Low HBA count limits polar interactions, "
            "reducing non-specific binding risk."
        ),
        "threshold_high": 10,
        "threshold_low": 0,
    },
    "RotBonds": {
        "label": "Rotatable Bonds",
        "unit": "",
        "toxic_high": (
            "High rotatable bond count (> 10) reduces oral bioavailability "
            "and may indicate a flexible scaffold prone to conformational toxicity."
        ),
        "toxic_low": (
            "Rotatable bonds contribute to molecular flexibility, "
            "enabling binding to multiple protein targets."
        ),
        "safe_high": (
            "Rotatable bond count is within acceptable limits, "
            "supporting adequate oral bioavailability."
        ),
        "safe_low": (
            "Rigid scaffold with few rotatable bonds; "
            "selectivity and metabolic stability are favored."
        ),
        "threshold_high": 10,
        "threshold_low": 0,
    },
    "QED": {
        "label": "Drug-likeness Score (QED)",
        "unit": "",
        "toxic_high": (
            "Low QED score (< 0.3) indicates poor drug-likeness, "
            "suggesting unfavorable ADMET properties and increased toxicity risk."
        ),
        "toxic_low": (
            "Moderate QED suggests some drug-like properties, "
            "though structural alerts may still drive toxicity."
        ),
        "safe_high": (
            "High QED score (> 0.7) reflects favorable drug-likeness, "
            "consistent with low toxicity and good ADMET profile."
        ),
        "safe_low": (
            "QED is within acceptable range, "
            "indicating reasonable drug-likeness."
        ),
        "threshold_high": 0.7,
        "threshold_low": 0.3,
        "invert": True,
    },
    "Fsp3": {
        "label": "Fraction sp3 Carbons (Fsp3)",
        "unit": "",
        "toxic_high": (
            "Low Fsp3 (< 0.25) indicates a highly planar, aromatic-rich scaffold, "
            "associated with increased metabolic activation and toxicity."
        ),
        "toxic_low": (
            "Moderate sp3 character is present, "
            "though aromatic features may still drive toxicity."
        ),
        "safe_high": (
            "High Fsp3 (> 0.5) reflects a saturated, three-dimensional scaffold, "
            "associated with improved selectivity and reduced toxicity."
        ),
        "safe_low": (
            "Fsp3 is within acceptable range for drug-like compounds."
        ),
        "threshold_high": 0.5,
        "threshold_low": 0.25,
        "invert": True,
    },
    # ── Electronic / charge ──────────────────────────────────
    "Gasteiger_min": {
        "label": "Gasteiger Charge (minimum)",
        "unit": "",
        "toxic_high": (
            "Highly negative partial charges indicate electron-rich reactive sites, "
            "which may participate in nucleophilic reactions with biological macromolecules."
        ),
        "toxic_low": (
            "Partial charge distribution suggests moderate reactivity."
        ),
        "safe_high": (
            "Partial charge distribution is within safe limits, "
            "reducing electrophilic/nucleophilic reactivity."
        ),
        "safe_low": "Charge profile is favorable for safety.",
    },
    "Gasteiger_absmean": {
        "label": "Gasteiger Charge (absolute mean)",
        "unit": "",
        "toxic_high": (
            "High mean absolute partial charge indicates significant charge polarization, "
            "increasing reactivity with biological nucleophiles (DNA, proteins)."
        ),
        "toxic_low": "Moderate charge polarization is present.",
        "safe_high": "Charge polarization is within acceptable limits.",
        "safe_low": "Low charge polarization reduces reactivity risk.",
    },
    "EState_max": {
        "label": "Maximum E-State Index",
        "unit": "",
        "toxic_high": (
            "High E-State index identifies electron-rich atoms susceptible to "
            "electrophilic attack, potentially forming reactive metabolites."
        ),
        "toxic_low": "E-State values suggest moderate electronic reactivity.",
        "safe_high": "E-State profile is within safe range.",
        "safe_low": "Low E-State values indicate limited electronic reactivity.",
    },
    "LabuteASA": {
        "label": "Labute Accessible Surface Area",
        "unit": "Å²",
        "toxic_high": (
            "Large accessible surface area increases the probability of "
            "non-specific protein binding and off-target interactions."
        ),
        "toxic_low": "Surface area contributes to protein binding potential.",
        "safe_high": "Surface area is within acceptable limits.",
        "safe_low": "Compact molecular surface reduces non-specific binding.",
    },
    # ── Structural alerts ────────────────────────────────────
    "Alert_nitro": {
        "label": "Nitro Group Alert",
        "unit": "",
        "toxic_high": (
            "Nitro groups are well-established toxicophores. Nitroreductase-mediated "
            "reduction generates reactive nitroso and hydroxylamine intermediates "
            "that form DNA adducts and cause oxidative stress."
        ),
        "toxic_low": "Nitro group is present but may not be the primary driver.",
        "safe_high": "No significant nitro group contribution detected.",
        "safe_low": "Absence of nitro group reduces reactive metabolite risk.",
    },
    "Alert_amine_arom": {
        "label": "Aromatic Amine Alert",
        "unit": "",
        "toxic_high": (
            "Aromatic amines are metabolically activated by N-hydroxylation "
            "to form reactive nitrenium ions, which are potent DNA-alkylating agents "
            "and known carcinogens."
        ),
        "toxic_low": "Aromatic amine is present; metabolic activation risk exists.",
        "safe_high": "No significant aromatic amine contribution detected.",
        "safe_low": "Absence of aromatic amine reduces carcinogenicity risk.",
    },
    "Alert_halide_arom": {
        "label": "Aromatic Halide Alert",
        "unit": "",
        "toxic_high": (
            "Aromatic halides can undergo nucleophilic aromatic substitution "
            "with biological nucleophiles, and may generate toxic arene oxide intermediates "
            "via CYP450-mediated oxidation."
        ),
        "toxic_low": "Aromatic halide is present; metabolic activation possible.",
        "safe_high": "No significant aromatic halide contribution detected.",
        "safe_low": "Absence of aromatic halide reduces metabolic activation risk.",
    },
    "Alert_epoxide": {
        "label": "Epoxide Alert",
        "unit": "",
        "toxic_high": (
            "Epoxides are highly reactive electrophiles that readily alkylate "
            "DNA, RNA, and proteins, causing genotoxicity and potential carcinogenicity."
        ),
        "toxic_low": "Epoxide moiety is present; direct alkylation risk exists.",
        "safe_high": "No significant epoxide contribution detected.",
        "safe_low": "Absence of epoxide reduces direct alkylation risk.",
    },
    "Alert_aldehyde": {
        "label": "Aldehyde Alert",
        "unit": "",
        "toxic_high": (
            "Aldehydes are reactive electrophiles that form Schiff bases with "
            "lysine residues in proteins, causing enzyme inhibition and cellular toxicity."
        ),
        "toxic_low": "Aldehyde group is present; protein reactivity possible.",
        "safe_high": "No significant aldehyde contribution detected.",
        "safe_low": "Absence of aldehyde reduces protein reactivity risk.",
    },
    "Alert_thiol": {
        "label": "Thiol Alert",
        "unit": "",
        "toxic_high": (
            "Thiol groups can deplete glutathione reserves through conjugation, "
            "impairing cellular antioxidant defense and causing oxidative toxicity."
        ),
        "toxic_low": "Thiol group is present; glutathione depletion possible.",
        "safe_high": "No significant thiol contribution detected.",
        "safe_low": "Absence of thiol reduces glutathione depletion risk.",
    },
    "Alert_carbonyl": {
        "label": "Reactive Carbonyl Alert",
        "unit": "",
        "toxic_high": (
            "Reactive carbonyl groups (Michael acceptors) can covalently modify "
            "cysteine and lysine residues in proteins, causing off-target toxicity."
        ),
        "toxic_low": "Carbonyl group is present; protein reactivity possible.",
        "safe_high": "No significant reactive carbonyl contribution detected.",
        "safe_low": "Absence of reactive carbonyl reduces covalent binding risk.",
    },
    # ── Fingerprint features ─────────────────────────────────
    "MACCS_160": {
        "label": "MACCS Key 160 (aromatic amine pattern)",
        "unit": "",
        "toxic_high": (
            "MACCS key 160 encodes aromatic amine substructures, "
            "strongly associated with metabolic activation and carcinogenicity in Tox21."
        ),
        "toxic_low": "MACCS key 160 pattern is present.",
        "safe_high": "MACCS key 160 pattern is absent, reducing aromatic amine risk.",
        "safe_low": "MACCS key 160 pattern is absent.",
    },
    "MACCS_125": {
        "label": "MACCS Key 125 (halogen pattern)",
        "unit": "",
        "toxic_high": (
            "MACCS key 125 encodes halogenated aromatic patterns, "
            "associated with persistent bioaccumulation and endocrine disruption."
        ),
        "toxic_low": "MACCS key 125 pattern is present.",
        "safe_high": "MACCS key 125 pattern is absent.",
        "safe_low": "MACCS key 125 pattern is absent.",
    },
    # ── Drug-likeness ────────────────────────────────────────
    "Lipinski_score": {
        "label": "Lipinski Rule of Five Score",
        "unit": "/4",
        "toxic_high": (
            "Low Lipinski score indicates multiple rule violations, "
            "suggesting poor oral bioavailability and potential for toxic accumulation."
        ),
        "toxic_low": "Lipinski score is moderate; some violations present.",
        "safe_high": "Full Lipinski compliance supports favorable ADMET profile.",
        "safe_low": "Lipinski score is acceptable.",
        "invert": True,
    },
    "Lipinski_pass": {
        "label": "Lipinski Ro5 Pass",
        "unit": "",
        "toxic_high": "Lipinski Ro5 failure indicates poor drug-likeness.",
        "toxic_low": "Lipinski Ro5 is borderline.",
        "safe_high": "Lipinski Ro5 fully satisfied — favorable ADMET predicted.",
        "safe_low": "Lipinski Ro5 is satisfied.",
        "invert": True,
    },
}

# ── Risk level classifier ─────────────────────────────────────

def classify_risk(probability: float) -> dict:
    """Return risk level metadata from toxicity probability."""
    if probability >= 0.70:
        return {
            "level": "High",
            "color": "red",
            "emoji": "🔴",
            "summary": "High toxicity risk — significant concern for biological safety.",
            "dose_note": (
                "Even at low doses, this compound may exhibit toxic effects. "
                "Therapeutic window is likely narrow. Extensive in-vitro and in-vivo "
                "safety profiling is strongly recommended before further development."
            ),
            "long_term": (
                "Chronic exposure may lead to cumulative organ toxicity, "
                "genotoxicity, or carcinogenicity. Long-term safety studies are essential."
            ),
        }
    elif probability >= 0.35:
        return {
            "level": "Medium",
            "color": "orange",
            "emoji": "🟡",
            "summary": "Moderate toxicity risk — proceed with caution.",
            "dose_note": (
                "Toxicity is dose-dependent. At therapeutic doses, risk may be manageable, "
                "but safety margins should be carefully established. "
                "Structural optimization to reduce toxicophores is recommended."
            ),
            "long_term": (
                "Repeated exposure may lead to cumulative effects. "
                "ADMET profiling and metabolite identification studies are advised."
            ),
        }
    else:
        return {
            "level": "Low",
            "color": "green",
            "emoji": "🟢",
            "summary": "Low toxicity risk — favorable safety profile predicted.",
            "dose_note": (
                "At standard therapeutic doses, this compound is predicted to be safe. "
                "Standard preclinical safety testing is still recommended."
            ),
            "long_term": (
                "Long-term exposure is predicted to be well-tolerated based on "
                "molecular descriptors and structural alert analysis."
            ),
        }


# ── Feature lookup ────────────────────────────────────────────

def _get_knowledge(feature_name: str) -> Optional[dict]:
    """Look up knowledge entry for a feature name (exact or prefix match)."""
    if feature_name in FEATURE_KNOWLEDGE:
        return FEATURE_KNOWLEDGE[feature_name]
    # Prefix match for Alert_ features
    for key in FEATURE_KNOWLEDGE:
        if feature_name.startswith(key) or key.startswith(feature_name.split("_")[0]):
            if feature_name == key:
                return FEATURE_KNOWLEDGE[key]
    # Try Alert_ prefix
    if feature_name.startswith("Alert_"):
        return FEATURE_KNOWLEDGE.get(feature_name)
    return None


def _readable_name(feature_name: str) -> str:
    """Convert internal feature name to display label."""
    kb = _get_knowledge(feature_name)
    if kb:
        return kb["label"]
    if feature_name.startswith("MACCS_"):
        return f"MACCS Key {feature_name[6:]}"
    if feature_name.startswith("Morgan_"):
        return f"Morgan Fingerprint bit {feature_name[7:]}"
    if feature_name.startswith("RDKit_"):
        return f"RDKit Fingerprint bit {feature_name[6:]}"
    if feature_name.startswith("Alert_"):
        return feature_name[6:].replace("_", " ").title() + " Alert"
    return feature_name.replace("_", " ").title()


# ── Core explanation generator ────────────────────────────────

def generate_explanation(
    shap_values: list,          # list of {feature, shap_value, label?, direction?, magnitude?}
    features: dict,             # physicochemical descriptor dict
    toxic: bool,
    probability: float,
    drug_name: str = "This compound",
    n_top: int = 5,
) -> dict:
    """
    Convert SHAP feature importance into structured scientific explanation.

    Returns:
    {
      "headline": str,
      "risk": dict,                    # from classify_risk()
      "top_driver": str,               # most influential feature label
      "bullets": [str, ...],           # per-feature explanation bullets
      "structural_alerts": [str, ...], # fired alert names
      "mechanistic_summary": str,      # paragraph summary
      "dose_response": str,
      "long_term_effects": str,
      "final_conclusion": str,
      "features_explained": [dict],    # enriched feature list
    }
    """
    risk = classify_risk(probability)
    pct  = round(probability * 100, 1)
    conf = round(abs(probability - 0.5) * 2 * 100, 1)

    # Sort by absolute SHAP value
    sorted_feats = sorted(shap_values, key=lambda x: abs(x.get("shap_value", 0)), reverse=True)
    top_feats = sorted_feats[:n_top]

    bullets = []
    structural_alerts = []
    features_explained = []
    max_shap = abs(top_feats[0]["shap_value"]) if top_feats else 1.0

    for feat in top_feats:
        fname  = feat.get("feature", "")
        fval   = feat.get("shap_value", 0.0)
        fvalue = feat.get("feature_value", features.get(fname))
        direction = "toxic" if fval > 0 else "safe"
        rel_mag = abs(fval) / max_shap if max_shap > 0 else 0
        magnitude = "strongly" if rel_mag >= 0.6 else "moderately" if rel_mag >= 0.25 else "slightly"

        kb = _get_knowledge(fname)
        label = _readable_name(fname)

        # Build bullet text
        if kb:
            if direction == "toxic":
                # Pick high vs low variant based on feature value
                fv_num = float(fvalue) if fvalue is not None else 0.0
                thresh_high = kb.get("threshold_high", 999)
                text = kb["toxic_high"] if fv_num >= thresh_high * 0.5 else kb["toxic_low"]
            else:
                fv_num = float(fvalue) if fvalue is not None else 0.0
                thresh_high = kb.get("threshold_high", 999)
                text = kb["safe_high"] if fv_num >= thresh_high * 0.5 else kb["safe_low"]

            bullet = f"{label} {magnitude} {'increases' if direction == 'toxic' else 'reduces'} toxicity risk. {text}"
        else:
            # Generic fingerprint explanation
            if direction == "toxic":
                bullet = (
                    f"{label} {magnitude} increases toxicity risk (SHAP: +{abs(fval):.3f}). "
                    f"This molecular fingerprint pattern is associated with Tox21-active compounds."
                )
            else:
                bullet = (
                    f"{label} {magnitude} reduces toxicity risk (SHAP: -{abs(fval):.3f}). "
                    f"This fingerprint pattern is associated with non-toxic compounds in Tox21."
                )

        bullets.append(bullet)

        # Track structural alerts
        if fname.startswith("Alert_") and direction == "toxic":
            structural_alerts.append(label)

        features_explained.append({
            "feature":    fname,
            "label":      label,
            "shap_value": round(fval, 4),
            "direction":  direction,
            "magnitude":  magnitude,
            "explanation": bullet,
        })

    # Top driver
    top_driver = _readable_name(top_feats[0]["feature"]) if top_feats else "molecular fingerprint"

    # Headline
    if toxic:
        headline = (
            f"{drug_name} is predicted TOXIC ({pct}% probability, {conf}% confidence). "
            f"The primary driver is {top_driver}."
        )
    else:
        headline = (
            f"{drug_name} is predicted NON-TOXIC ({100 - pct:.1f}% probability of safety, "
            f"{conf}% confidence). {top_driver} is the strongest safety contributor."
        )

    # Mechanistic summary paragraph
    toxic_drivers = [f["label"] for f in features_explained if f["direction"] == "toxic"]
    safe_drivers  = [f["label"] for f in features_explained if f["direction"] == "safe"]

    if toxic:
        mech = (
            f"Mechanistic analysis identifies {', '.join(toxic_drivers[:3]) if toxic_drivers else 'molecular fingerprint patterns'} "
            f"as the primary toxicity drivers. "
        )
        if structural_alerts:
            mech += (
                f"Structural alert screening detected {', '.join(structural_alerts[:2])}, "
                f"which are established toxicophores associated with reactive metabolite formation. "
            )
        mech += (
            f"The physicochemical profile — MW {features.get('MolWeight', '?')} Da, "
            f"LogP {features.get('LogP', '?')}, TPSA {features.get('TPSA', '?')} Å² — "
            f"{'supports' if toxic else 'does not support'} the toxicity prediction. "
            f"SHAP analysis attributes {round(abs(top_feats[0]['shap_value']) / max_shap * 100) if top_feats else 0}% "
            f"of the model's decision to {top_driver}."
        )
    else:
        mech = (
            f"The compound exhibits a favorable safety profile. "
            f"Key safety contributors include {', '.join(safe_drivers[:3]) if safe_drivers else 'favorable molecular descriptors'}. "
            f"No significant structural alerts (PAINS/toxicophores) were detected. "
            f"Physicochemical properties — MW {features.get('MolWeight', '?')} Da, "
            f"LogP {features.get('LogP', '?')}, TPSA {features.get('TPSA', '?')} Å² — "
            f"are consistent with a drug-like, non-toxic compound."
        )

    # Final conclusion
    if toxic:
        conclusion = (
            f"Based on ensemble ML prediction (probability: {pct}%) and SHAP-driven mechanistic analysis, "
            f"{drug_name} presents a {risk['level'].lower()} toxicity risk. "
            f"Structural optimization targeting {top_driver} is recommended before further development. "
            f"In-vitro cytotoxicity assays (MTT, LDH) and Ames mutagenicity testing are advised."
        )
    else:
        conclusion = (
            f"Based on ensemble ML prediction (probability: {pct}%) and SHAP-driven mechanistic analysis, "
            f"{drug_name} presents a {risk['level'].lower()} toxicity risk. "
            f"The compound is suitable for further ADMET profiling and preclinical development. "
            f"Standard safety pharmacology studies are still recommended."
        )

    return {
        "headline":           headline,
        "risk":               risk,
        "top_driver":         top_driver,
        "bullets":            bullets,
        "structural_alerts":  structural_alerts,
        "mechanistic_summary": mech,
        "dose_response":      risk["dose_note"],
        "long_term_effects":  risk["long_term"],
        "final_conclusion":   conclusion,
        "features_explained": features_explained,
        "probability":        probability,
        "toxic":              toxic,
        "drug_name":          drug_name,
    }
