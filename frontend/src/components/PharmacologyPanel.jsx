import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical, ShieldAlert, ShieldCheck, Brain, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, Lightbulb, Scale,
  Microscope, Activity, Dna, BarChart3, Atom, Zap,
} from 'lucide-react'
import { buildStructuredReport } from '../lib/AIExplanation'

// ── Helpers ───────────────────────────────────────────────────
const RISK_STYLES = {
  red:    { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  text: '#f87171' },
  orange: { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)', text: '#fb923c' },
  yellow: { bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.25)',  text: '#fbbf24' },
  green:  { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.25)',  text: '#4ade80' },
}

function RiskBadge({ level, color, emoji }) {
  const s = RISK_STYLES[color] || RISK_STYLES.green
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
          style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
      {emoji} {level} Risk
    </span>
  )
}

function Section({ icon: Icon, iconColor, iconBg, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl overflow-hidden"
         style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
        style={{ background: open ? 'rgba(255,255,255,0.03)' : 'transparent' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
        onMouseLeave={e => e.currentTarget.style.background = open ? 'rgba(255,255,255,0.03)' : 'transparent'}
      >
        <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: iconBg }}>
          <Icon size={12} style={{ color: iconColor }} />
        </div>
        <span className="text-[12px] font-semibold flex-1" style={{ color: '#e2e8f0' }}>{title}</span>
        {open
          ? <ChevronUp   size={12} style={{ color: 'rgba(100,116,139,0.5)', flexShrink: 0 }} />
          : <ChevronDown size={12} style={{ color: 'rgba(100,116,139,0.5)', flexShrink: 0 }} />
        }
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 space-y-2"
                 style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Descriptor pill ───────────────────────────────────────────
const FLAG_STYLES = {
  high:     { bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.2)',  text: '#f87171', dot: '#ef4444' },
  moderate: { bg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.2)', text: '#fb923c', dot: '#f97316' },
  low:      { bg: 'rgba(234,179,8,0.07)',  border: 'rgba(234,179,8,0.2)',  text: '#fbbf24', dot: '#eab308' },
  optimal:  { bg: 'rgba(34,197,94,0.07)',  border: 'rgba(34,197,94,0.2)',  text: '#4ade80', dot: '#22c55e' },
}

function DescriptorPill({ insight, index }) {
  const s = FLAG_STYLES[insight.flag] || FLAG_STYLES.optimal
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg p-3 space-y-1.5"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
        <span className="text-[11px] font-bold" style={{ color: s.text }}>
          {insight.prop}
          {insight.value != null && (
            <span className="font-mono ml-1.5 font-normal opacity-70"> = {insight.value}</span>
          )}
        </span>
        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded capitalize"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(100,116,139,0.7)' }}>
          {insight.flag}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed pl-3.5" style={{ color: 'rgba(148,163,184,0.85)' }}>
        {insight.reason}
      </p>
    </motion.div>
  )
}

// ── Structural alert badge ────────────────────────────────────
const ALERT_SEV = {
  high:     { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  text: '#f87171' },
  moderate: { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', text: '#fb923c' },
  low:      { bg: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.2)',  text: '#fbbf24' },
}

function AlertBadge({ alert, index }) {
  const [open, setOpen] = useState(false)
  const s = ALERT_SEV[alert.severity] || ALERT_SEV.low
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-lg overflow-hidden"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <Zap size={10} style={{ color: s.text, flexShrink: 0 }} />
        <span className="text-[11px] font-semibold flex-1" style={{ color: s.text }}>
          {alert.label}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded capitalize"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(148,163,184,0.6)' }}>
          {alert.severity}
        </span>
        {open ? <ChevronUp size={9} style={{ color: s.text }} />
               : <ChevronDown size={9} style={{ color: s.text }} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="text-[10px] leading-relaxed px-3 pb-2.5 overflow-hidden"
            style={{ color: 'rgba(148,163,184,0.8)', borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            {alert.reason}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Organ toxicity chip ───────────────────────────────────────
function OrganChip({ organ, index }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-sm flex-shrink-0">{organ.icon}</span>
        <span className="text-[11px] font-medium flex-1" style={{ color: organ.color }}>
          {organ.label}
        </span>
        {open ? <ChevronUp size={9} style={{ color: 'rgba(100,116,139,0.5)' }} />
               : <ChevronDown size={9} style={{ color: 'rgba(100,116,139,0.5)' }} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="text-[10px] leading-relaxed px-3 pb-2.5 overflow-hidden"
            style={{ color: 'rgba(148,163,184,0.75)', borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            {organ.note}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Dose card ─────────────────────────────────────────────────
function DoseCard({ label, text, safe }) {
  return (
    <div className="rounded-xl p-3 space-y-1.5"
         style={{
           background: safe ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
           border: `1px solid ${safe ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
         }}>
      <div className="flex items-center gap-2">
        {safe
          ? <CheckCircle2 size={12} style={{ color: '#4ade80' }} />
          : <AlertTriangle size={12} style={{ color: '#f87171' }} />
        }
        <span className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: safe ? '#4ade80' : '#f87171' }}>
          {label}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed pl-5" style={{ color: 'rgba(148,163,184,0.85)' }}>
        {text}
      </p>
    </div>
  )
}

// ── Model interpretation line ─────────────────────────────────
function ModelLine({ text, index }) {
  const isWarning = text.startsWith('⚠️')
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex gap-2.5 rounded-lg px-3 py-2"
      style={{
        background: isWarning ? 'rgba(234,179,8,0.06)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isWarning ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)'}`,
      }}
    >
      <div className="w-1 rounded-full flex-shrink-0 mt-1"
           style={{ background: isWarning ? '#fbbf24' : 'rgba(56,189,248,0.4)', minHeight: 12 }} />
      <p className="text-[11px] leading-relaxed" style={{ color: isWarning ? '#fbbf24' : 'rgba(148,163,184,0.85)' }}>
        {text}
      </p>
    </motion.div>
  )
}

// ── Insight card ──────────────────────────────────────────────
function InsightCard({ text, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="flex gap-3 rounded-xl p-3"
      style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}
    >
      <div className="p-1 rounded-lg flex-shrink-0 h-fit"
           style={{ background: 'rgba(139,92,246,0.12)' }}>
        <Lightbulb size={11} style={{ color: '#a78bfa' }} />
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(196,181,253,0.9)' }}>
        {text}
      </p>
    </motion.div>
  )
}

// ── Confidence meter ──────────────────────────────────────────
function ConfidenceMeter({ value, uncertain }) {
  const color = uncertain ? '#fbbf24' : value >= 80 ? '#4ade80' : value >= 60 ? '#38bdf8' : '#fb923c'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px]">
        <span style={{ color: 'rgba(100,116,139,0.7)' }}>Model confidence</span>
        <span className="font-mono font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      {uncertain && (
        <p className="text-[10px] flex items-center gap-1.5" style={{ color: '#fbbf24' }}>
          <AlertTriangle size={9} />
          Prediction uncertainty is moderate — further experimental validation is recommended.
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function PharmacologyPanel({ drugName, result }) {
  const [expandAll, setExpandAll] = useState(false)

  if (!result || !drugName) return null
  const report = buildStructuredReport(drugName, result, 'explain')
  if (!report) return null

  const {
    name, drugClass, primaryUse, mechanism, metabolism,
    prediction, probability, confidence, uncertain, riskLevel,
    descInsights, hbondNotes, structAlerts, organTox,
    sciExplanation, doseResponse, modelInterp, keyInsights, verdict,
  } = report

  const isToxic = result.toxic

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass p-5 space-y-3"
      style={{ border: `1px solid ${isToxic ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)'}` }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg"
               style={{ background: isToxic ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)' }}>
            <Microscope size={13} style={{ color: isToxic ? '#f87171' : '#4ade80' }} />
          </div>
          <div>
            <span className="text-sm font-bold" style={{ color: '#e2e8f0' }}>ToxScout AI Research</span>
            <p className="text-[10px]" style={{ color: 'rgba(100,116,139,0.7)' }}>
              Computational Chemistry · Toxicology Report
            </p>
          </div>
        </div>
        <RiskBadge {...riskLevel} />
      </div>

      {/* ── 1. Drug Overview ── */}
      <Section icon={FlaskConical} iconColor="#38bdf8" iconBg="rgba(14,165,233,0.1)"
               title="🧪 Drug Overview" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Drug Name', name],
            ['Class', drugClass],
            ['Primary Use', primaryUse],
            ['Formula', result.compound_info?.formula || '—'],
            ['MW', result.features?.MolWeight ? `${result.features.MolWeight} Da` : '—'],
            ['CID', result.compound_info?.cid || '—'],
          ].map(([label, val]) => (
            <div key={label} className="rounded-lg px-3 py-2"
                 style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[9px] uppercase tracking-wider mb-0.5"
                 style={{ color: 'rgba(100,116,139,0.6)' }}>{label}</p>
              <p className="text-[11px] font-medium leading-snug" style={{ color: '#cbd5e1' }}>
                {val || '—'}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 2. Toxicity Prediction ── */}
      <Section icon={isToxic ? ShieldAlert : ShieldCheck}
               iconColor={isToxic ? '#f87171' : '#4ade80'}
               iconBg={isToxic ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'}
               title="⚠️ Toxicity Prediction" defaultOpen>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Result',      value: prediction,
                color: isToxic ? '#f87171' : '#4ade80' },
              { label: 'Probability', value: `${probability}%`,
                color: isToxic ? '#fb923c' : '#38bdf8' },
              { label: 'Risk',        value: riskLevel.level,
                color: RISK_STYLES[riskLevel.color]?.text || '#4ade80' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-3 text-center"
                   style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[9px] uppercase tracking-wider mb-1"
                   style={{ color: 'rgba(100,116,139,0.6)' }}>{label}</p>
                <p className="text-[13px] font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
          <ConfidenceMeter value={confidence} uncertain={uncertain} />
        </div>
      </Section>

      {/* ── 3. Mechanistic Analysis ── */}
      <Section icon={Dna} iconColor="#e879f9" iconBg="rgba(232,121,249,0.1)"
               title="🔬 Mechanistic Analysis" defaultOpen={expandAll}>
        <div className="space-y-3">
          {/* Mechanism + metabolism */}
          {(mechanism || metabolism) && (
            <div className="space-y-2">
              {mechanism && (
                <div className="rounded-xl p-3"
                     style={{ background: 'rgba(232,121,249,0.05)', border: '1px solid rgba(232,121,249,0.12)' }}>
                  <p className="text-[9px] uppercase tracking-wider mb-1.5"
                     style={{ color: 'rgba(232,121,249,0.6)' }}>Mechanism of Action</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(196,181,253,0.9)' }}>
                    {mechanism}
                  </p>
                </div>
              )}
              {metabolism && (
                <div className="rounded-xl p-3"
                     style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.1)' }}>
                  <p className="text-[9px] uppercase tracking-wider mb-1.5"
                     style={{ color: 'rgba(56,189,248,0.6)' }}>Metabolic Pathway</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(148,163,184,0.85)' }}>
                    {metabolism}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Scientific narrative */}
          {sciExplanation && (
            <p className="text-[11px] leading-relaxed rounded-xl p-3"
               style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)',
                        color: 'rgba(196,181,253,0.9)' }}>
              {sciExplanation}
            </p>
          )}

          {/* Structural alerts */}
          {structAlerts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider"
                 style={{ color: 'rgba(100,116,139,0.6)' }}>
                Structural Alerts / Toxicophores ({structAlerts.length})
              </p>
              {structAlerts.map((a, i) => <AlertBadge key={a.id} alert={a} index={i} />)}
            </div>
          )}

          {/* Descriptor analysis */}
          {descInsights.filter(d => d.flag !== 'optimal').length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider"
                 style={{ color: 'rgba(100,116,139,0.6)' }}>Molecular Descriptor Analysis</p>
              {descInsights.filter(d => d.flag !== 'optimal').map((ins, i) =>
                <DescriptorPill key={ins.prop} insight={ins} index={i} />
              )}
            </div>
          )}

          {/* H-bond notes */}
          {hbondNotes.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider"
                 style={{ color: 'rgba(100,116,139,0.6)' }}>H-Bond & Permeability</p>
              {hbondNotes.map((note, i) => (
                <p key={i} className="text-[11px] leading-relaxed px-3 py-2 rounded-lg"
                   style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                            color: 'rgba(148,163,184,0.8)' }}>
                  {note}
                </p>
              ))}
            </div>
          )}

          {/* Organ toxicity */}
          {organTox.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider"
                 style={{ color: 'rgba(100,116,139,0.6)' }}>
                Predicted Organ Toxicity ({organTox.length})
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {organTox.map((o, i) => <OrganChip key={o.label} organ={o} index={i} />)}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── 4. Dose & Safety ── */}
      <Section icon={Scale} iconColor="#fbbf24" iconBg="rgba(234,179,8,0.1)"
               title="⚖️ Dose & Safety Interpretation" defaultOpen={expandAll}>
        <div className="space-y-2">
          {doseResponse?.normal && <DoseCard label="Therapeutic Dose" text={doseResponse.normal} safe />}
          {doseResponse?.high   && <DoseCard label="High Dose / Overdose" text={doseResponse.high} safe={false} />}
        </div>
      </Section>

      {/* ── 5. Model Interpretation ── */}
      <Section icon={BarChart3} iconColor="#38bdf8" iconBg="rgba(14,165,233,0.1)"
               title="📊 Model Interpretation" defaultOpen={expandAll}>
        <div className="space-y-1.5">
          {modelInterp.map((line, i) => <ModelLine key={i} text={line} index={i} />)}
        </div>
      </Section>

      {/* ── 6. Key Scientific Insights ── */}
      <Section icon={Lightbulb} iconColor="#fbbf24" iconBg="rgba(234,179,8,0.08)"
               title="💡 Key Scientific Insights" defaultOpen>
        <div className="space-y-2">
          {keyInsights.map((ins, i) => <InsightCard key={i} text={ins} index={i} />)}
        </div>
      </Section>

      {/* ── 7. Final Assessment ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl p-4 space-y-2"
        style={{
          background: isToxic ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
          border: `1px solid ${isToxic ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
        }}
      >
        <div className="flex items-center gap-2">
          <Activity size={13} style={{ color: isToxic ? '#f87171' : '#4ade80' }} />
          <span className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: isToxic ? '#f87171' : '#4ade80' }}>
            ✅ Final Assessment
          </span>
        </div>
        <p className="text-[12px] leading-relaxed font-medium"
           style={{ color: 'rgba(226,232,240,0.9)' }}>
          {verdict}
        </p>
      </motion.div>

      {/* Expand / collapse all */}
      <button
        onClick={() => setExpandAll(e => !e)}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] transition-colors"
        style={{ color: 'rgba(71,85,105,0.6)' }}
        onMouseEnter={e => e.currentTarget.style.color = '#38bdf8'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(71,85,105,0.6)'}
      >
        {expandAll ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {expandAll ? 'Collapse detailed sections' : 'Expand all sections'}
      </button>
    </motion.div>
  )
}

