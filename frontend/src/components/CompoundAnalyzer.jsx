// CompoundAnalyzer.jsx — Universal Compound Analysis Panel
// Accepts any name / SMILES / formula → full AI analysis
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Brain, Zap, FlaskConical, Activity, MessageSquare, Send, X,
} from 'lucide-react'

const BACKEND = '/api' // Using relative paths for Vite proxy

const EXAMPLES = [
  'aspirin', 'carbon monoxide', 'glucose', 'benzene',
  'paracetamol', 'CO2', 'caffeine', 'nitrobenzene',
]

function RiskBadge({ level, emoji }) {
  const cfg = {
    High:     { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  text: '#f87171' },
    Moderate: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', text: '#fb923c' },
    Low:      { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  text: '#4ade80' },
  }
  const c = cfg[level] || cfg.Moderate
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
          style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {emoji} {level} Risk
    </span>
  )
}

function Section({ title, icon: Icon, children, accent = '#0ea5e9', defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl overflow-hidden"
         style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={() => setOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
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
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                      style={{ overflow: 'hidden' }}>
            <div className="px-4 pb-4 pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DescriptorGrid({ descriptors }) {
  const SHOW = [
    ['MolWeight', 'MW (Da)'], ['LogP', 'LogP'], ['TPSA', 'TPSA (Å²)'],
    ['HBD', 'HBD'], ['HBA', 'HBA'], ['AromaticRings', 'Arom. Rings'],
    ['QED', 'QED'], ['Fsp3', 'Fsp3'], ['RotBonds', 'Rot. Bonds'],
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {SHOW.map(([k, label]) => {
        const v = descriptors?.[k]
        if (v == null) return null
        return (
          <div key={k} className="rounded-xl px-3 py-2 text-center"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[9px] mb-0.5" style={{ color: 'rgba(100,116,139,0.6)' }}>{label}</p>
            <p className="text-xs font-bold font-mono" style={{ color: '#e2e8f0' }}>
              {typeof v === 'number' ? v.toFixed(v % 1 === 0 ? 0 : 3) : v}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function BulletList({ items, color = '#94a3b8' }) {
  if (!items?.length) return null
  return (
    <div className="space-y-1.5">
      {items.map((b, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex gap-2 text-xs leading-relaxed" style={{ color }}>
          <span style={{ flexShrink: 0 }}>•</span>
          <span>{b}</span>
        </motion.div>
      ))}
    </div>
  )
}

function QAPanel({ context }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer]     = useState('')
  const [loading, setLoading]   = useState(false)
  const inputRef = useRef(null)

  const QUICK = [
    'Why is this toxic?', 'Explain LogP', 'How to improve?',
    'What organ risks?', 'Explain SHAP', 'Is it drug-like?',
  ]

  async function ask(q) {
    if (!q.trim() || !context) return
    setLoading(true)
    setAnswer('')
    try {
      const res = await fetch(`${BACKEND}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context }),
      })
      const data = await res.json()
      setAnswer(data.answer || 'No answer available.')
    } catch {
      setAnswer('Could not reach the AI engine. Please check the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Quick prompts */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map(q => (
          <button key={q} onClick={() => { setQuestion(q); ask(q) }}
                  className="text-[10px] px-2.5 py-1 rounded-full font-medium transition-all"
                  style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                           color: '#a78bfa' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'}>
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input ref={inputRef} value={question}
               onChange={e => setQuestion(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && ask(question)}
               placeholder="Ask anything about this compound…"
               className="flex-1 px-3 py-2 rounded-xl text-xs outline-none bg-transparent"
               style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0',
                        caretColor: '#a78bfa' }} />
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                       onClick={() => ask(question)} disabled={loading || !question.trim()}
                       className="px-3 py-2 rounded-xl disabled:opacity-40"
                       style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)',
                                color: '#a78bfa' }}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </motion.button>
      </div>

      {/* Answer */}
      <AnimatePresence>
        {answer && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-xl p-3 text-xs leading-relaxed"
                      style={{ background: 'rgba(139,92,246,0.06)',
                               border: '1px solid rgba(139,92,246,0.15)',
                               color: '#cbd5e1' }}>
            {answer}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function CompoundAnalyzer({ dark = true }) {
  const [query,   setQuery]   = useState('')
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function analyze(q) {
    const input = (q || query).trim()
    if (!input) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`${BACKEND}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.detail?.error || data?.detail || 'Analysis failed.')
      } else {
        setResult(data)
      }
    } catch (e) {
      setError('Could not reach the server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const ai  = result?.ai_explanation
  const risk = ai?.risk

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="glass overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
            <FlaskConical size={13} style={{ color: '#38bdf8' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#7dd3fc' }}>
            Universal Compound Analyzer
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold ml-auto"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80',
                         border: '1px solid rgba(34,197,94,0.2)' }}>
            Any name · SMILES · Formula
          </span>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl"
               style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Search size={13} style={{ color: '#64748b', flexShrink: 0 }} />
            <input value={query} onChange={e => setQuery(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && analyze()}
                   placeholder="aspirin · CO2 · CC(=O)Oc1ccccc1C(=O)O · glucose…"
                   className="flex-1 text-sm bg-transparent outline-none"
                   style={{ color: '#e2e8f0', caretColor: '#38bdf8' }} />
            {query && (
              <button onClick={() => { setQuery(''); setResult(null); setError(null) }}>
                <X size={12} style={{ color: '#64748b' }} />
              </button>
            )}
          </div>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                         onClick={() => analyze()} disabled={loading || !query.trim()}
                         className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                         style={{ background: 'linear-gradient(135deg,#0ea5e9,#8b5cf6)' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : '⚗ Analyze'}
          </motion.button>
        </div>

        {/* Example chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => { setQuery(ex); analyze(ex) }}
                    className="text-[10px] px-2.5 py-1 rounded-full font-medium transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                             color: 'rgba(148,163,184,0.8)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.4)'; e.currentTarget.style.color = '#38bdf8' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(148,163,184,0.8)' }}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="mx-5 mt-4 flex items-start gap-2 p-3 rounded-xl text-xs"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                               color: '#f87171' }}>
            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 px-5 py-6">
          <Loader2 size={18} className="animate-spin" style={{ color: '#38bdf8' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: '#e2e8f0' }}>Resolving compound…</p>
            <p className="text-[10px]" style={{ color: '#64748b' }}>
              Checking local DB → PubChem → CIR → OPSIN
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="p-5 space-y-3">
          {/* Identity bar */}
          <div className="flex items-center gap-3 p-3 rounded-xl"
               style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
            <CheckCircle2 size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: '#e2e8f0' }}>{result.name}</p>
              <p className="text-[10px] font-mono truncate" style={{ color: '#64748b' }}>{result.smiles}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[9px]" style={{ color: '#64748b' }}>via {result.source}</p>
              <p className="text-[9px] font-mono" style={{ color: '#a78bfa' }}>{result.formula}</p>
            </div>
          </div>

          {/* Risk + prediction */}
          {result.probability != null && risk && (
            <div className="flex items-center gap-3 flex-wrap">
              <RiskBadge level={risk.level} emoji={risk.emoji} />
              <span className="text-sm font-bold" style={{ color: risk.color === 'red' ? '#f87171' : risk.color === 'orange' ? '#fb923c' : '#4ade80' }}>
                {Math.round(result.probability * 100)}% toxicity probability
              </span>
              <span className="text-xs" style={{ color: '#64748b' }}>
                {Math.round(result.confidence * 100)}% confidence
              </span>
            </div>
          )}
          {result.probability == null && (
            <p className="text-xs" style={{ color: '#64748b' }}>
              ⚠ ML models not loaded — descriptors computed, prediction unavailable.
              Run: <code className="font-mono">python drug_toxicity/main.py</code>
            </p>
          )}

          {/* Executive summary */}
          {ai?.executive_summary && (
            <div className="p-3 rounded-xl"
                 style={{ background: 'linear-gradient(135deg,rgba(14,165,233,0.06),rgba(139,92,246,0.06))',
                          border: '1px solid rgba(14,165,233,0.15)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={10} style={{ color: '#38bdf8' }} />
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#38bdf8' }}>
                  Executive Summary
                </span>
              </div>
              <p className="text-xs leading-relaxed font-medium" style={{ color: '#cbd5e1' }}>
                {ai.executive_summary}
              </p>
            </div>
          )}

          {/* Descriptors */}
          <Section title="Molecular Descriptors" icon={Activity} accent="#38bdf8">
            <DescriptorGrid descriptors={result.descriptors} />
          </Section>

          {/* AI descriptor analysis */}
          {ai?.descriptor_bullets?.length > 0 && (
            <Section title="Descriptor Analysis" icon={Brain} accent="#a78bfa">
              <BulletList items={ai.descriptor_bullets} color="#94a3b8" />
            </Section>
          )}

          {/* Structural alerts */}
          {ai?.structural_alerts?.length > 0 && (
            <Section title="Structural Alerts" icon={AlertCircle} accent="#f87171" defaultOpen={true}>
              <BulletList items={ai.structural_alerts} color="#fca5a5" />
            </Section>
          )}

          {/* Organ risks */}
          {ai?.organ_risks?.length > 0 && (
            <Section title="Organ Toxicity Pathways" icon={Activity} accent="#fb923c" defaultOpen={false}>
              <BulletList items={ai.organ_risks} color="#fed7aa" />
            </Section>
          )}

          {/* Mechanistic summary */}
          {ai?.mechanistic_summary && (
            <Section title="Mechanistic Summary" icon={Brain} accent="#8b5cf6" defaultOpen={false}>
              <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                {ai.mechanistic_summary}
              </p>
            </Section>
          )}

          {/* Risk interpretation */}
          {(ai?.dose_response || ai?.long_term_effects) && (
            <Section title="Risk Interpretation" icon={Zap}
                     accent={risk?.color === 'red' ? '#ef4444' : risk?.color === 'orange' ? '#f97316' : '#22c55e'}
                     defaultOpen={false}>
              {ai.dose_response && (
                <div className="mb-2">
                  <p className="text-[9px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Dose-Response</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{ai.dose_response}</p>
                </div>
              )}
              {ai.long_term_effects && (
                <div>
                  <p className="text-[9px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Long-Term Effects</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{ai.long_term_effects}</p>
                </div>
              )}
            </Section>
          )}

          {/* Final conclusion */}
          {ai?.final_conclusion && (
            <div className="p-3 rounded-xl"
                 style={{ background: risk?.color === 'green' ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                          border: `1px solid ${risk?.color === 'green' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
              <p className="text-[9px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Final Conclusion</p>
              <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{ai.final_conclusion}</p>
            </div>
          )}

          {/* AI Q&A */}
          <Section title="Ask AI About This Compound" icon={MessageSquare} accent="#a78bfa" defaultOpen={false}>
            <QAPanel context={ai?._context} />
          </Section>
        </div>
      )}
    </motion.div>
  )
}
