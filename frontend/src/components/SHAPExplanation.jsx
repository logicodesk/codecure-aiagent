// SHAPExplanation.jsx — Visual SHAP-driven AI explanation panel
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Brain, AlertTriangle, CheckCircle, Zap, Activity, Clock } from 'lucide-react'

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function RiskBadge({ level, color }) {
  const cfg = {
    High:   { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   text: '#f87171',  icon: AlertTriangle },
    Medium: { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)',  text: '#fb923c',  icon: AlertTriangle },
    Low:    { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',   text: '#4ade80',  icon: CheckCircle  },
  }
  const c = cfg[level] || cfg.Medium
  const Icon = c.icon
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
          style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      <Icon size={11} />
      {level} Risk
    </span>
  )
}

function DirectionBar({ shap_value, max_abs }) {
  const ratio = Math.min(Math.abs(shap_value) / (max_abs || 1), 1)
  const toxic = shap_value > 0
  const color = toxic ? '#ef4444' : '#22c55e'
  const width = Math.max(ratio * 100, 4)
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-[10px] font-mono w-14 text-right"
            style={{ color }}>
        {shap_value > 0 ? '+' : ''}{shap_value.toFixed(3)}
      </span>
    </div>
  )
}

function FeatureRow({ feat, max_abs, index }) {
  const toxic = feat.direction === 'toxic'
  const color = toxic ? '#f87171' : '#4ade80'
  const arrow = toxic ? '↑' : '↓'
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-3 py-2 px-3 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      {/* Rank */}
      <span className="text-[10px] font-bold w-5 text-center mt-0.5"
            style={{ color: 'rgba(148,163,184,0.5)' }}>
        {feat.rank}
      </span>

      {/* Direction arrow */}
      <span className="text-sm font-bold w-4 mt-0.5" style={{ color }}>{arrow}</span>

      {/* Label + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium truncate" style={{ color: '#e2e8f0' }}>
            {feat.label}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                style={{
                  background: toxic ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                  color,
                }}>
            {feat.magnitude}
          </span>
        </div>
        <DirectionBar shap_value={feat.shap_value} max_abs={max_abs} />
      </div>
    </motion.div>
  )
}

function Section({ title, icon: Icon, children, defaultOpen = true, accent = '#0ea5e9' }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl overflow-hidden"
         style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <div className="flex items-center gap-2">
          <Icon size={13} style={{ color: accent }} />
          <span className="text-xs font-semibold" style={{ color: '#cbd5e1' }}>{title}</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={13} style={{ color: '#64748b' }} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 pt-2 space-y-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function SHAPExplanation({ result, drugName }) {
  const [explanation, setExplanation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fetched, setFetched] = useState(false)

  // Auto-build from existing shap_explanation if available
  const shap_exp = result?.shap_explanation || {}
  const top_features = shap_exp.top_features || []

  async function fetchExplanation() {
    if (fetched || loading) return
    setLoading(true)
    setError(null)
    try {
      const payload = {
        smiles: result.smiles,
        drug_name: drugName || result.compound_info?.synonyms?.[0] || 'This compound',
        toxic: result.toxic,
        probability: result.probability,
        features: result.features,
        shap_values: top_features.map(f => ({
          feature: f.feature,
          shap_value: f.shap_value,
          feature_value: f.feature_value,
        })),
      }
      const res = await fetch(`${BACKEND}/generate-explanation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setExplanation(data)
      setFetched(true)
    } catch (e) {
      // Fallback: build from existing shap_explanation data
      if (top_features.length > 0) {
        setExplanation(buildLocalExplanation(result, drugName, top_features))
        setFetched(true)
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // Local fallback builder
  function buildLocalExplanation(result, drugName, features) {
    const prob = result.probability || 0
    const toxic = result.toxic
    const name = drugName || 'This compound'
    const pct = Math.round(prob * 100)
    const conf = Math.round(Math.abs(prob - 0.5) * 2 * 100)
    const topDriver = features[0]?.label || 'molecular fingerprint'
    const risk = prob >= 0.7 ? { level: 'High', emoji: '🔴' }
               : prob >= 0.35 ? { level: 'Medium', emoji: '🟡' }
               : { level: 'Low', emoji: '🟢' }

    return {
      headline: toxic
        ? `${name} is predicted TOXIC (${pct}% probability, ${conf}% confidence). Primary driver: ${topDriver}.`
        : `${name} is predicted NON-TOXIC (${100 - pct}% safety probability, ${conf}% confidence).`,
      risk,
      top_driver: topDriver,
      bullets: features.slice(0, 5).map(f =>
        `${f.label} ${f.magnitude}ly ${f.direction === 'toxic' ? 'increases' : 'reduces'} toxicity risk. ${f.explanation}`
      ),
      mechanistic_summary: `SHAP analysis identifies ${topDriver} as the primary driver. Probability: ${pct}%.`,
      dose_response: toxic
        ? 'Toxicity may be dose-dependent. Narrow therapeutic window expected.'
        : 'At standard doses, this compound is predicted to be safe.',
      long_term_effects: toxic
        ? 'Chronic exposure may lead to cumulative toxicity. Long-term studies recommended.'
        : 'Long-term exposure predicted to be well-tolerated based on molecular profile.',
      final_conclusion: `${name} presents ${risk.level.toLowerCase()} toxicity risk (${pct}%). ${toxic ? 'Structural optimization recommended.' : 'Suitable for further ADMET profiling.'}`,
    }
  }

  if (!result) return null

  const exp = explanation
  const max_abs = top_features.length > 0
    ? Math.max(...top_features.map(f => Math.abs(f.shap_value)))
    : 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(139,92,246,0.2)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <Brain size={15} style={{ color: '#8b5cf6' }} />
          <span className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>
            AI Toxicity Explanation
          </span>
          {exp?.risk && <RiskBadge level={exp.risk.level} />}
        </div>
        {!fetched && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={fetchExplanation}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: loading ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.3)',
              color: loading ? '#64748b' : '#a78bfa',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Zap size={11} />
              </motion.div> Generating…</>
            ) : (
              <><Brain size={11} /> Generate Explanation</>
            )}
          </motion.button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 text-xs" style={{ color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Content */}
      {exp && (
        <div className="p-4 space-y-3">
          {/* Headline */}
          <div className="p-3 rounded-xl text-xs leading-relaxed"
               style={{
                 background: 'rgba(139,92,246,0.06)',
                 border: '1px solid rgba(139,92,246,0.15)',
                 color: '#cbd5e1',
               }}>
            {exp.headline}
          </div>

          {/* Top driver highlight */}
          {exp.top_driver && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                 style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
              <Zap size={11} style={{ color: '#38bdf8' }} />
              <span className="text-xs" style={{ color: '#94a3b8' }}>
                Top driver: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{exp.top_driver}</span>
              </span>
            </div>
          )}

          {/* Feature bars */}
          {top_features.length > 0 && (
            <Section title="SHAP Feature Analysis" icon={Activity} accent="#8b5cf6">
              <div className="space-y-1.5">
                {top_features.slice(0, 8).map((f, i) => (
                  <FeatureRow key={f.feature} feat={f} max_abs={max_abs} index={i} />
                ))}
              </div>
            </Section>
          )}

          {/* Bullets */}
          {exp.bullets?.length > 0 && (
            <Section title="Feature-Level Analysis" icon={Brain} accent="#0ea5e9">
              <div className="space-y-2">
                {exp.bullets.map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex gap-2 text-xs leading-relaxed"
                    style={{ color: '#94a3b8' }}
                  >
                    <span style={{ color: '#38bdf8', flexShrink: 0 }}>•</span>
                    <span>{b}</span>
                  </motion.div>
                ))}
              </div>
            </Section>
          )}

          {/* Mechanistic summary */}
          {exp.mechanistic_summary && (
            <Section title="Mechanistic Summary" icon={Brain} defaultOpen={false} accent="#8b5cf6">
              <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                {exp.mechanistic_summary}
              </p>
            </Section>
          )}

          {/* Risk interpretation */}
          {(exp.dose_response || exp.long_term_effects) && (
            <Section title="Risk Interpretation" icon={AlertTriangle} defaultOpen={false}
                     accent={result.toxic ? '#ef4444' : '#22c55e'}>
              {exp.dose_response && (
                <div>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: '#64748b' }}>
                    DOSE-RESPONSE
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                    {exp.dose_response}
                  </p>
                </div>
              )}
              {exp.long_term_effects && (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold mb-1" style={{ color: '#64748b' }}>
                    LONG-TERM EFFECTS
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                    {exp.long_term_effects}
                  </p>
                </div>
              )}
            </Section>
          )}

          {/* Final conclusion */}
          {exp.final_conclusion && (
            <div className="p-3 rounded-xl"
                 style={{
                   background: result.toxic ? 'rgba(239,68,68,0.05)' : 'rgba(34,197,94,0.05)',
                   border: `1px solid ${result.toxic ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}`,
                 }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock size={10} style={{ color: result.toxic ? '#f87171' : '#4ade80' }} />
                <span className="text-[10px] font-semibold"
                      style={{ color: result.toxic ? '#f87171' : '#4ade80' }}>
                  FINAL CONCLUSION
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                {exp.final_conclusion}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Prompt to generate */}
      {!exp && !loading && !error && (
        <div className="px-4 py-6 text-center">
          <Brain size={24} className="mx-auto mb-2" style={{ color: 'rgba(139,92,246,0.3)' }} />
          <p className="text-xs" style={{ color: '#475569' }}>
            Click "Generate Explanation" for SHAP-driven mechanistic analysis
          </p>
        </div>
      )}
    </motion.div>
  )
}
