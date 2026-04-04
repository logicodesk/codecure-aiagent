// ReportDownload.jsx — PDF report generator (backend ReportLab → jsPDF fallback)
import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileDown, Loader2 } from 'lucide-react'

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function formatDate() {
  return new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function toxLabel(prob) {
  if (prob > 0.7) return 'HIGH TOXICITY'
  if (prob > 0.3) return 'MEDIUM TOXICITY'
  return 'LOW TOXICITY'
}

function toxColor(prob) {
  if (prob > 0.7) return [239, 68, 68]
  if (prob > 0.3) return [251, 146, 60]
  return [34, 197, 94]
}

async function generatePDF(result, drugName) {
  const compName = drugName || result.compound_info?.synonyms?.[0] || 'compound'
  const filename = `toxscout_${compName.replace(/\s+/g, '_').toLowerCase()}_report.pdf`

  // ── Try backend ReportLab PDF first ──────────────────────
  try {
    const payload = {
      smiles:           result.smiles,
      drug_name:        drugName || null,
      toxic:            result.toxic,
      probability:      result.probability,
      confidence:       result.confidence,
      threshold:        result.threshold,
      features:         result.features,
      drug_likeness:    result.drug_likeness,
      compound_info:    result.compound_info,
      shap_explanation: result.shap_explanation,
      model_meta:       result.model_meta,
    }
    const res = await fetch(`${BACKEND}/generate-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      return
    }
  } catch (_) {
    // fall through to jsPDF
  }

  // ── Fallback: jsPDF client-side ───────────────────────────
  await generateJsPDF(result, drugName, compName)
}

async function generateJsPDF(result, drugName, compName) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const margin = 18
  let y = 0

  // ── Header bar ──────────────────────────────────────────────
  doc.setFillColor(8, 12, 30)
  doc.rect(0, 0, W, 38, 'F')

  doc.setFontSize(20)
  doc.setTextColor(56, 189, 248)
  doc.setFont('helvetica', 'bold')
  doc.text('ToxScout AI', margin, 16)

  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184)
  doc.setFont('helvetica', 'normal')
  doc.text('Drug Toxicity Prediction Report', margin, 23)
  doc.text(`Generated: ${formatDate()}`, margin, 29)

  // Model badge
  const modelText = result.model_meta?.display || 'ToxScout AI v1.0'
  doc.setFontSize(7)
  doc.setTextColor(139, 92, 246)
  doc.text(modelText, W - margin, 23, { align: 'right' })

  y = 46

  // ── Compound section ─────────────────────────────────────────
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold')
  doc.text('Compound', margin, y)
  y += 6

  doc.setDrawColor(14, 165, 233)
  doc.setLineWidth(0.4)
  doc.line(margin, y, W - margin, y)
  y += 5

  const compName2 = drugName || result.compound_info?.synonyms?.[0] || 'Unknown Compound'
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(51, 65, 85)

  const rows1 = [
    ['Name', compName2],
    ['SMILES', result.smiles],
    ['Formula', result.compound_info?.formula || '—'],
    ['Molecular Weight', result.features?.MolWeight ? `${result.features.MolWeight} Da` : '—'],
    ['PubChem CID', result.compound_info?.cid ? String(result.compound_info.cid) : '—'],
  ]
  rows1.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(k, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    const lines = doc.splitTextToSize(String(v), W - margin - 55)
    doc.text(lines, margin + 50, y)
    y += 5.5 * lines.length
  })

  y += 4

  // ── Toxicity prediction ──────────────────────────────────────
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Toxicity Prediction', margin, y)
  y += 6

  doc.setDrawColor(14, 165, 233)
  doc.line(margin, y, W - margin, y)
  y += 6

  const prob = result.probability ?? 0
  const pct = Math.round(prob * 100)
  const [r, g, b] = toxColor(prob)

  // Big probability display
  doc.setFontSize(32)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(r, g, b)
  doc.text(`${pct}%`, margin, y + 10)

  doc.setFontSize(11)
  doc.setTextColor(r, g, b)
  doc.text(toxLabel(prob), margin + 28, y + 5)

  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'normal')
  doc.text(`Confidence: ${Math.round((result.confidence ?? 0) * 100)}%`, margin + 28, y + 11)
  doc.text(`Threshold: ${(result.threshold ?? 0.35) * 100}%`, margin + 28, y + 16)

  // Progress bar
  const barX = margin, barY = y + 22, barW = W - margin * 2, barH = 4
  doc.setFillColor(230, 232, 240)
  doc.roundedRect(barX, barY, barW, barH, 2, 2, 'F')
  doc.setFillColor(r, g, b)
  doc.roundedRect(barX, barY, barW * (pct / 100), barH, 2, 2, 'F')

  y += 34

  // ── Physicochemical properties ───────────────────────────────
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Physicochemical Properties', margin, y)
  y += 6

  doc.setDrawColor(14, 165, 233)
  doc.line(margin, y, W - margin, y)
  y += 5

  const f = result.features || {}
  const props = [
    ['LogP', f.LogP != null ? f.LogP.toFixed(3) : '—', f.LogP > 5 ? '⚠ High' : '✓'],
    ['H-Bond Donors', f.HBD ?? '—', f.HBD > 5 ? '⚠ High' : '✓'],
    ['H-Bond Acceptors', f.HBA ?? '—', f.HBA > 10 ? '⚠ High' : '✓'],
    ['TPSA', f.TPSA != null ? `${f.TPSA.toFixed(1)} Å²` : '—', ''],
    ['Rotatable Bonds', f.RotBonds ?? '—', ''],
    ['Aromatic Rings', f.AromaticRings ?? '—', ''],
    ['QED Score', f.QED != null ? f.QED.toFixed(3) : '—', ''],
  ]

  const colW = (W - margin * 2) / 3
  doc.setFontSize(8)
  props.forEach(([k, v, flag], i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const cx = margin + col * colW
    const cy = y + row * 10

    doc.setFillColor(248, 250, 252)
    doc.roundedRect(cx, cy, colW - 2, 8, 1, 1, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(k, cx + 2, cy + 3.5)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    doc.text(String(v), cx + 2, cy + 7)

    if (flag && flag.startsWith('⚠')) {
      doc.setTextColor(251, 146, 60)
      doc.text('!', cx + colW - 6, cy + 5.5)
    }
  })

  y += Math.ceil(props.length / 3) * 10 + 6

  // ── Lipinski Ro5 ─────────────────────────────────────────────
  const dl = result.drug_likeness || {}
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Lipinski Rule of Five', margin, y)
  y += 6

  doc.setDrawColor(14, 165, 233)
  doc.line(margin, y, W - margin, y)
  y += 5

  doc.setFontSize(8)
  const lipinskiRules = [
    [`MW ≤ 500 Da`, (dl.mw ?? f.MolWeight ?? 0) <= 500],
    [`LogP ≤ 5`, (dl.logp ?? f.LogP ?? 0) <= 5],
    [`HBD ≤ 5`, (dl.hbd ?? f.HBD ?? 0) <= 5],
    [`HBA ≤ 10`, (dl.hba ?? f.HBA ?? 0) <= 10],
  ]
  lipinskiRules.forEach(([rule, pass], i) => {
    const cx = margin + (i % 2) * ((W - margin * 2) / 2)
    const cy = y + Math.floor(i / 2) * 8
    doc.setFillColor(pass ? 220 : 254, pass ? 252 : 226, pass ? 231 : 226)
    doc.roundedRect(cx, cy, (W - margin * 2) / 2 - 3, 6.5, 1, 1, 'F')
    doc.setTextColor(pass ? 22 : 185, pass ? 163 : 28, pass ? 74 : 26)
    doc.setFont('helvetica', 'bold')
    doc.text(pass ? '✓' : '✗', cx + 2, cy + 4.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    doc.text(rule, cx + 8, cy + 4.5)
  })

  y += Math.ceil(lipinskiRules.length / 2) * 8 + 6

  // ── AI Insight ───────────────────────────────────────────────
  if (result.ai_text) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text('AI Analysis', margin, y)
    y += 6

    doc.setDrawColor(14, 165, 233)
    doc.line(margin, y, W - margin, y)
    y += 5

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    const aiLines = doc.splitTextToSize(result.ai_text.replace(/[⚠️✅]/g, ''), W - margin * 2)
    doc.text(aiLines, margin, y)
    y += aiLines.length * 4.5 + 4
  }

  // ── Footer ───────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.height
  doc.setFillColor(8, 12, 30)
  doc.rect(0, pageH - 14, W, 14, 'F')
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text('ToxScout AI — For research purposes only. Not for clinical use.', margin, pageH - 5)
  doc.text('toxscout.ai', W - margin, pageH - 5, { align: 'right' })

  doc.save(`toxscout_${(compName || 'compound').replace(/\s+/g, '_').toLowerCase()}.pdf`)
}

export default function ReportDownload({ result, drugName, dark = true }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    if (!result || loading) return
    setLoading(true)
    try {
      await generatePDF(result, drugName)
    } catch (e) {
      console.error('PDF generation failed:', e)
    } finally {
      setLoading(false)
    }
  }

  if (!result) return null

  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
      style={{
        background: loading ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(139,92,246,0.15))',
        border: '1px solid rgba(14,165,233,0.25)',
        color: loading ? 'rgba(148,163,184,0.5)' : '#38bdf8',
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading
        ? <><Loader2 size={14} className="animate-spin" /> Generating PDF…</>
        : <><FileDown size={14} /> Download Report</>
      }
    </motion.button>
  )
}



