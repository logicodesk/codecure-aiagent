# ============================================================
# report_generator.py  —  ReportLab PDF Report Generator
# ============================================================
# Generates professional research-grade PDF reports for
# ToxScout AI toxicity predictions.
# ============================================================

from __future__ import annotations
import io
from datetime import datetime
from typing import Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import (
    HexColor, white, black, Color
)
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import Flowable


# ── Brand colors ──────────────────────────────────────────────
C_BG        = HexColor("#08080f")
C_HEADER    = HexColor("#0c1220")
C_SKY       = HexColor("#0ea5e9")
C_SKY_LIGHT = HexColor("#38bdf8")
C_PURPLE    = HexColor("#8b5cf6")
C_SLATE     = HexColor("#1e293b")
C_SLATE_MID = HexColor("#334155")
C_MUTED     = HexColor("#64748b")
C_TEXT      = HexColor("#1e293b")
C_TEXT_LIGHT= HexColor("#475569")
C_RED       = HexColor("#ef4444")
C_ORANGE    = HexColor("#f97316")
C_GREEN     = HexColor("#22c55e")
C_AMBER     = HexColor("#f59e0b")
C_SECTION_BG= HexColor("#f8fafc")
C_ROW_ALT   = HexColor("#f1f5f9")
C_BORDER    = HexColor("#e2e8f0")


def _risk_color(probability: float) -> HexColor:
    if probability >= 0.70:
        return C_RED
    if probability >= 0.35:
        return C_ORANGE
    return C_GREEN


def _risk_label(probability: float) -> str:
    if probability >= 0.70:
        return "HIGH TOXICITY"
    if probability >= 0.35:
        return "MODERATE TOXICITY"
    return "LOW TOXICITY"


# ── Custom flowable: colored bar ──────────────────────────────
class ColorBar(Flowable):
    """Horizontal progress bar."""
    def __init__(self, width, height, fill_ratio, fill_color, bg_color=C_BORDER):
        super().__init__()
        self.width = width
        self.height = height
        self.fill_ratio = min(max(fill_ratio, 0), 1)
        self.fill_color = fill_color
        self.bg_color = bg_color

    def draw(self):
        # Background
        self.canv.setFillColor(self.bg_color)
        self.canv.roundRect(0, 0, self.width, self.height, self.height / 2, fill=1, stroke=0)
        # Fill
        if self.fill_ratio > 0:
            self.canv.setFillColor(self.fill_color)
            self.canv.roundRect(0, 0, self.width * self.fill_ratio, self.height,
                                self.height / 2, fill=1, stroke=0)


class SectionHeader(Flowable):
    """Colored section header bar."""
    def __init__(self, text, width, accent=C_SKY):
        super().__init__()
        self.text = text
        self.width = width
        self.accent = accent
        self.height = 8 * mm

    def draw(self):
        # Background
        self.canv.setFillColor(HexColor("#f0f9ff"))
        self.canv.roundRect(0, 0, self.width, self.height, 2 * mm, fill=1, stroke=0)
        # Left accent bar
        self.canv.setFillColor(self.accent)
        self.canv.rect(0, 0, 3, self.height, fill=1, stroke=0)
        # Text
        self.canv.setFillColor(C_TEXT)
        self.canv.setFont("Helvetica-Bold", 10)
        self.canv.drawString(8, self.height / 2 - 3.5, self.text)


# ── Style factory ─────────────────────────────────────────────
def _styles():
    base = getSampleStyleSheet()
    W = A4[0] - 36 * mm  # usable width

    def s(name, parent="Normal", **kw):
        return ParagraphStyle(name, parent=base[parent], **kw)

    return {
        "title": s("title", "Title",
                   fontSize=22, textColor=C_SKY_LIGHT,
                   fontName="Helvetica-Bold", spaceAfter=2 * mm,
                   alignment=TA_LEFT),
        "subtitle": s("subtitle",
                      fontSize=9, textColor=C_MUTED,
                      fontName="Helvetica", spaceAfter=1 * mm),
        "body": s("body",
                  fontSize=8.5, textColor=C_TEXT,
                  fontName="Helvetica", leading=13,
                  spaceAfter=2 * mm, alignment=TA_JUSTIFY),
        "bullet": s("bullet",
                    fontSize=8.5, textColor=C_TEXT,
                    fontName="Helvetica", leading=13,
                    leftIndent=10, spaceAfter=1.5 * mm,
                    bulletIndent=0),
        "label": s("label",
                   fontSize=7.5, textColor=C_MUTED,
                   fontName="Helvetica-Bold"),
        "value": s("value",
                   fontSize=8.5, textColor=C_TEXT,
                   fontName="Helvetica"),
        "risk_high": s("risk_high",
                       fontSize=18, textColor=C_RED,
                       fontName="Helvetica-Bold", alignment=TA_CENTER),
        "risk_med": s("risk_med",
                      fontSize=18, textColor=C_ORANGE,
                      fontName="Helvetica-Bold", alignment=TA_CENTER),
        "risk_low": s("risk_low",
                      fontSize=18, textColor=C_GREEN,
                      fontName="Helvetica-Bold", alignment=TA_CENTER),
        "section_title": s("section_title",
                           fontSize=10, textColor=C_TEXT,
                           fontName="Helvetica-Bold",
                           spaceBefore=4 * mm, spaceAfter=2 * mm),
        "mono": s("mono",
                  fontSize=7.5, textColor=C_SLATE_MID,
                  fontName="Courier", leading=11,
                  wordWrap="CJK"),
        "conclusion": s("conclusion",
                        fontSize=8.5, textColor=C_TEXT,
                        fontName="Helvetica", leading=13,
                        alignment=TA_JUSTIFY,
                        backColor=HexColor("#f0fdf4"),
                        borderPad=4, spaceAfter=2 * mm),
        "footer": s("footer",
                    fontSize=7, textColor=C_MUTED,
                    fontName="Helvetica", alignment=TA_CENTER),
    }


# ── Main PDF generator ────────────────────────────────────────

def generate_pdf(data: dict) -> bytes:
    """
    Generate a professional research-grade PDF report.

    data keys:
      drug_name       str
      smiles          str
      toxic           bool
      probability     float  (0–1)
      confidence      float  (0–1)
      threshold       float
      features        dict   {LogP, TPSA, MolWeight, ...}
      drug_likeness   dict   {lipinski_pass, violations, mw, logp, hbd, hba}
      compound_info   dict   {cid, formula, iupac_name, synonyms, ...}
      shap_explanation dict  {top_features: [...], base_value, model_used}
      ai_explanation  dict   (from shap_explainer.generate_explanation)
      model_meta      dict   {display, algorithm}
    """
    buf = io.BytesIO()
    W, H = A4
    margin = 18 * mm

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=22 * mm,
        bottomMargin=20 * mm,
        title="ToxScout AI — Drug Toxicity Analysis Report",
        author="ToxScout AI",
        subject="Drug Toxicity Prediction",
    )

    usable_w = W - 2 * margin
    ST = _styles()
    story = []

    prob        = float(data.get("probability", 0))
    toxic       = bool(data.get("toxic", False))
    conf        = float(data.get("confidence", abs(prob - 0.5) * 2))
    drug_name   = data.get("drug_name") or "Unknown Compound"
    smiles      = data.get("smiles", "")
    features    = data.get("features") or {}
    dl          = data.get("drug_likeness") or {}
    cinfo       = data.get("compound_info") or {}
    shap_exp    = data.get("shap_explanation") or {}
    ai_exp      = data.get("ai_explanation") or {}
    model_meta  = data.get("model_meta") or {}
    threshold   = float(data.get("threshold", 0.35))
    risk_color  = _risk_color(prob)
    risk_label  = _risk_label(prob)
    timestamp   = datetime.now().strftime("%B %d, %Y  %H:%M UTC")

    # ── 1. Title block ────────────────────────────────────────
    story.append(Paragraph("ToxScout AI", ST["title"]))
    story.append(Paragraph("Drug Toxicity Analysis Report", ST["subtitle"]))
    story.append(Paragraph(f"Generated: {timestamp}  ·  Model: {model_meta.get('display', 'ToxScout AI v1.0')}", ST["subtitle"]))
    story.append(HRFlowable(width=usable_w, thickness=0.5, color=C_SKY, spaceAfter=4 * mm))

    # ── 2. Drug overview ──────────────────────────────────────
    story.append(SectionHeader("Drug Overview", usable_w))
    story.append(Spacer(1, 2 * mm))

    formula = cinfo.get("formula") or features.get("formula", "—")
    mw_val  = features.get("MolWeight") or dl.get("mw") or cinfo.get("molecular_weight")
    mw_str  = f"{float(mw_val):.2f} Da" if mw_val else "—"
    cid_str = str(cinfo.get("cid")) if cinfo.get("cid") else "—"
    iupac   = cinfo.get("iupac_name") or cinfo.get("iupac") or "—"
    synonyms = cinfo.get("synonyms") or []
    syn_str  = ", ".join(synonyms[:3]) if synonyms else "—"

    overview_data = [
        ["Name",          drug_name],
        ["SMILES",        smiles or "—"],
        ["Formula",       formula or "—"],
        ["Molecular Weight", mw_str],
        ["PubChem CID",   cid_str],
        ["IUPAC Name",    iupac],
        ["Synonyms",      syn_str],
    ]

    overview_table = Table(
        [[Paragraph(f"<b>{k}</b>", ST["label"]),
          Paragraph(str(v), ST["mono"] if k == "SMILES" else ST["value"])]
         for k, v in overview_data],
        colWidths=[38 * mm, usable_w - 38 * mm],
        hAlign="LEFT",
    )
    overview_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), white),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [white, C_ROW_ALT]),
        ("GRID", (0, 0), (-1, -1), 0.3, C_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(overview_table)
    story.append(Spacer(1, 4 * mm))

    # ── 3. Prediction summary ─────────────────────────────────
    story.append(SectionHeader("Prediction Summary", usable_w, accent=risk_color))
    story.append(Spacer(1, 3 * mm))

    pct = round(prob * 100, 1)
    conf_pct = round(conf * 100, 1)
    risk_style = "risk_high" if prob >= 0.70 else "risk_med" if prob >= 0.35 else "risk_low"

    pred_data = [
        [Paragraph(f"<b>{pct}%</b>", ST[risk_style]),
         Paragraph(f"<b>{risk_label}</b>", ST[risk_style])],
        [Paragraph("Toxicity Probability", ST["label"]),
         Paragraph("Risk Classification", ST["label"])],
    ]
    pred_table = Table(pred_data, colWidths=[usable_w / 2, usable_w / 2])
    pred_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (-1, -1), C_SECTION_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(pred_table)
    story.append(Spacer(1, 2 * mm))

    # Progress bar
    story.append(ColorBar(usable_w, 5, prob, risk_color))
    story.append(Spacer(1, 1 * mm))

    meta_row = Table(
        [[Paragraph(f"Confidence: <b>{conf_pct}%</b>", ST["label"]),
          Paragraph(f"Threshold: <b>{round(threshold * 100)}%</b>", ST["label"]),
          Paragraph(f"Verdict: <b>{'TOXIC' if toxic else 'NON-TOXIC'}</b>",
                    ParagraphStyle("v", parent=ST["label"],
                                   textColor=risk_color))]],
        colWidths=[usable_w / 3] * 3,
    )
    meta_row.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(meta_row)
    story.append(Spacer(1, 4 * mm))

    # ── 4. Molecular properties ───────────────────────────────
    story.append(SectionHeader("Molecular Properties", usable_w))
    story.append(Spacer(1, 2 * mm))

    def _flag(val, thresh, invert=False):
        if val is None:
            return "—"
        over = float(val) > thresh
        if invert:
            over = not over
        return "⚠ High" if over else "✓ OK"

    prop_rows = [
        ["Property", "Value", "Status"],
        ["LogP (Lipophilicity)",
         f"{features.get('LogP', '—'):.3f}" if features.get('LogP') is not None else "—",
         _flag(features.get('LogP'), 5)],
        ["TPSA (Polar Surface Area)",
         f"{features.get('TPSA', '—'):.1f} Å²" if features.get('TPSA') is not None else "—",
         "⚠ Low" if (features.get('TPSA') or 100) < 40 else "✓ OK"],
        ["Molecular Weight",
         f"{features.get('MolWeight', '—'):.2f} Da" if features.get('MolWeight') is not None else "—",
         _flag(features.get('MolWeight'), 500)],
        ["H-Bond Donors",
         str(features.get('HBD', '—')),
         _flag(features.get('HBD'), 5)],
        ["H-Bond Acceptors",
         str(features.get('HBA', '—')),
         _flag(features.get('HBA'), 10)],
        ["Rotatable Bonds",
         str(features.get('RotBonds', '—')),
         _flag(features.get('RotBonds'), 10)],
        ["Aromatic Rings",
         str(features.get('AromaticRings', '—')),
         _flag(features.get('AromaticRings'), 3)],
        ["QED Drug-likeness",
         f"{features.get('QED', '—'):.3f}" if features.get('QED') is not None else "—",
         "⚠ Low" if (features.get('QED') or 1) < 0.3 else "✓ OK"],
        ["Fsp3 (sp3 fraction)",
         f"{features.get('Fsp3', '—'):.3f}" if features.get('Fsp3') is not None else "—",
         "⚠ Low" if (features.get('Fsp3') or 1) < 0.25 else "✓ OK"],
    ]

    col_w = [usable_w * 0.5, usable_w * 0.3, usable_w * 0.2]
    prop_table = Table(
        [[Paragraph(str(c), ST["label"] if i == 0 else ST["value"])
          for c in row]
         for i, row in enumerate(prop_rows)],
        colWidths=col_w,
        hAlign="LEFT",
    )
    prop_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_SLATE),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, C_ROW_ALT]),
        ("GRID", (0, 0), (-1, -1), 0.3, C_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        # Color status column
        ("TEXTCOLOR", (2, 1), (2, -1), C_ORANGE),
    ]))
    story.append(prop_table)
    story.append(Spacer(1, 4 * mm))

    # ── 5. SHAP Feature Importance ────────────────────────────
    top_features = shap_exp.get("top_features") or []
    if top_features:
        story.append(SectionHeader("SHAP Feature Importance", usable_w, accent=C_PURPLE))
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(
            f"SHAP analysis using <b>{shap_exp.get('model_used', 'ensemble')}</b> model. "
            f"Base value: {round(shap_exp.get('base_value', 0) * 100, 1) if shap_exp.get('base_value') else '—'}%. "
            "Positive SHAP = increases toxicity risk. Negative SHAP = reduces risk.",
            ST["body"]
        ))

        shap_rows = [["Rank", "Feature", "SHAP Value", "Direction", "Magnitude"]]
        for f in top_features[:10]:
            dir_color = "red" if f.get("direction") == "toxic" else "green"
            dir_text  = f"<font color='{dir_color}'><b>{'↑ Toxic' if f.get('direction') == 'toxic' else '↓ Safe'}</b></font>"
            shap_rows.append([
                str(f.get("rank", "")),
                f.get("label", f.get("feature", "")),
                f"{f.get('shap_value', 0):+.4f}",
                dir_text,
                f.get("magnitude", "").title(),
            ])

        shap_col_w = [10 * mm, usable_w * 0.42, 22 * mm, 20 * mm, 20 * mm]
        shap_table = Table(
            [[Paragraph(str(c), ST["label"] if i == 0 else ST["value"])
              for c in row]
             for i, row in enumerate(shap_rows)],
            colWidths=shap_col_w,
            hAlign="LEFT",
        )
        shap_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), C_PURPLE),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, C_ROW_ALT]),
            ("GRID", (0, 0), (-1, -1), 0.3, C_BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ]))
        story.append(shap_table)
        story.append(Spacer(1, 4 * mm))

    # ── 6. AI Explanation ─────────────────────────────────────
    if ai_exp:
        story.append(SectionHeader("AI Toxicity Explanation", usable_w, accent=C_SKY))
        story.append(Spacer(1, 2 * mm))

        headline = ai_exp.get("headline", "")
        if headline:
            story.append(Paragraph(f"<b>{headline}</b>", ST["body"]))
            story.append(Spacer(1, 2 * mm))

        bullets = ai_exp.get("bullets") or []
        if bullets:
            story.append(Paragraph("<b>Feature-Level Analysis:</b>", ST["label"]))
            story.append(Spacer(1, 1 * mm))
            for b in bullets:
                story.append(Paragraph(f"• {b}", ST["bullet"]))
            story.append(Spacer(1, 2 * mm))

        mech = ai_exp.get("mechanistic_summary", "")
        if mech:
            story.append(Paragraph("<b>Mechanistic Summary:</b>", ST["label"]))
            story.append(Paragraph(mech, ST["body"]))

        story.append(Spacer(1, 4 * mm))

    # ── 7. Risk Interpretation ────────────────────────────────
    story.append(SectionHeader("Risk Interpretation", usable_w, accent=risk_color))
    story.append(Spacer(1, 2 * mm))

    risk_info = ai_exp.get("risk") or {}
    dose_note = ai_exp.get("dose_response") or risk_info.get("dose_note", "")
    long_term = ai_exp.get("long_term_effects") or risk_info.get("long_term", "")

    if dose_note:
        story.append(Paragraph("<b>Dose-Response Considerations:</b>", ST["label"]))
        story.append(Paragraph(dose_note, ST["body"]))

    if long_term:
        story.append(Paragraph("<b>Long-Term Exposure Effects:</b>", ST["label"]))
        story.append(Paragraph(long_term, ST["body"]))

    story.append(Spacer(1, 4 * mm))

    # ── 8. Final Conclusion ───────────────────────────────────
    story.append(SectionHeader("Final Conclusion", usable_w, accent=C_GREEN if not toxic else C_RED))
    story.append(Spacer(1, 2 * mm))

    conclusion = ai_exp.get("final_conclusion", "")
    if not conclusion:
        conclusion = (
            f"{drug_name} is predicted {'TOXIC' if toxic else 'NON-TOXIC'} "
            f"with {pct}% probability by ToxScout AI ensemble models. "
            f"Risk level: {risk_label}. "
            f"Confidence: {conf_pct}%."
        )

    story.append(Paragraph(conclusion, ST["conclusion"]))

    # Disclaimer
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width=usable_w, thickness=0.3, color=C_BORDER))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        "<b>Disclaimer:</b> This report is generated by an AI system for research purposes only. "
        "It does not constitute medical or clinical advice. All predictions should be validated "
        "with experimental assays before use in drug development decisions.",
        ST["footer"]
    ))
    story.append(Paragraph(
        f"ToxScout AI  ·  {timestamp}  ·  For research use only",
        ST["footer"]
    ))

    doc.build(story)
    return buf.getvalue()

