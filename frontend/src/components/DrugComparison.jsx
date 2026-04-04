// DrugComparison.jsx — Multi-drug comparison panel
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitCompare, Plus, X, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { lookupAndPredict, autocompleteDrug } from '../lib/mockApi'

const MAX_DRUGS = 4

const COMPARE_FIELDS = [
  { key: 'probability', label: 'Toxicity %', format: v => `${Math.round(v * 100)}%`, isRisk: true },
  { key: 'confidence',  label: 'Confidence', format: v => `${Math.round(v * 100)}%` },
  { key: 'LogP',        label: 'LogP',       format: v => v?.toFixed(2) ?? '—', feat: true },
  { key: 'MolWeight',   label: 'MW (Da)',    format: v => v?.toFixed(1) ?? '—', feat: true },
  { key: 'TPSA',        label: 'TPSA (Å²)', format: v => v?.toFixed(1) ?? '—', feat: true },
  { key: 'HBD',         label: 'HBD',       format: v => v ?? '—', feat: true },
  { key: 'HBA',         label: 'HBA',       format: v => v ?? '—', feat: true },
  { key: 'AromaticRings', label: 'Arom. Rings', format: v => v ?? '—', feat: true },
  { key: 'QED',         label: 'QED',       format: v => v?.toFixed(3) ?? '—', feat: true },
]

function ToxBar({ probability }) {
  const pct = Math.round((probability ?? 0) * 100)
  const color = pct >= 70 ? '#ef4444' : pct >= 35 ? '#f97316' : '#22c55e'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-[10px] font-bold font-mono w-8 text-right" style={{ color }}>{pct}%</span>
    </div>
  )
}

function DrugCard({ entry, onRemove, index }) {
  const { name, result, loading, error } = entry
  const toxic = result?.toxic
  const statusColor = toxic ? '#f87171' : '#4ade80'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, x: -20 }}
      transition={{ delay: index * 0.05 }}
      className="relative rounded-2xl p-4 space-y-3 flex-1 min-w-0"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: result
          ? `1px solid ${toxic ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`
          : '1px solid rgba(255,255,255,0.07)',
        minWidth: 140,
      }}
    >
      {/* Remove button */}
      <button
        onClick={() => onRemove(index)}
        className="absolute top-2 right-2 p-1 rounded-lg transition-colors"
        style={{ color: 'rgba(100,116,139,0.4)' }}
        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(100,116,139,0.4)'}
      >
        <X size={11} />
      </button>

      {/* Drug name */}
      <p className="text-xs font-bold pr-5 truncate" style={{ color: '#e2e8f0' }}>{name}</p>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#38bdf8' }}>
          <Loader2 size={11} className="animate-spin" />
          Analyzing…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: '#f87171' }}>
          <AlertCircle size={10} /> {error}
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-2">
          {/* Verdict badge */}
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: toxic ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                  color: statusColor,
                  border: `1px solid ${toxic ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
                }}>
            {toxic ? '⚠ TOXIC' : '✓ SAFE'}
          </span>

          {/* Tox bar */}
          <ToxBar probability={result.probability} />

          {/* Description snippet */}
          {result.compound_info?.description && (
            <p className="text-[9px] leading-relaxed text-slate-400 italic line-clamp-2"
               title={result.compound_info.description}>
              "{result.compound_info.description}"
            </p>
          )}

          {/* Key descriptors */}
          <div className="space-y-1">
            {[
              ['LogP', result.features?.LogP?.toFixed(2)],
              ['MW', result.features?.MolWeight ? `${result.features.MolWeight.toFixed(0)} Da` : '—'],
              ['QED', result.features?.QED?.toFixed(3)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-[10px]">
                <span style={{ color: 'rgba(100,116,139,0.6)' }}>{k}</span>
                <span className="font-mono" style={{ color: '#cbd5e1' }}>{v ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function AddDrugInput({ onAdd, disabled }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await autocompleteDrug(q)
      setSuggestions(res.slice(0, 5))
      setOpen(true)
    } catch (_) {}
    setLoading(false)
  }

  function select(drug) {
    setQuery('')
    setSuggestions([])
    setOpen(false)
    onAdd(drug)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
           style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)' }}>
        <Plus size={12} style={{ color: '#38bdf8', flexShrink: 0 }} />
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Add drug to compare…"
          disabled={disabled}
          className="flex-1 text-xs bg-transparent outline-none"
          style={{ color: '#e2e8f0', caretColor: '#38bdf8' }}
        />
        {loading && <Loader2 size={11} className="animate-spin" style={{ color: '#38bdf8' }} />}
      </div>

      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="relative mt-1 z-10 rounded-xl p-1.5 space-y-0.5"
            style={{
              background: 'rgba(8,12,20,0.98)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}
          >
            {suggestions.map(s => (
              <button
                key={s.cid ?? s.name}
                onMouseDown={() => select(s)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors"
                style={{ color: '#cbd5e1' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,165,233,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span className="font-medium">{s.name}</span>
                {s.formula && <span className="ml-2 text-[10px] font-mono" style={{ color: '#a78bfa' }}>{s.formula}</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function DrugComparison({ dark = true }) {
  const [entries, setEntries] = useState([])
  const [open, setOpen] = useState(false)

  const addDrug = useCallback(async (drug) => {
    if (entries.length >= MAX_DRUGS) return
    const id = Date.now()
    setEntries(prev => [...prev, { id, name: drug.name, result: null, loading: true, error: null }])

    try {
      const res = await lookupAndPredict({ ...drug, smiles: drug.smiles || '' })
      setEntries(prev => prev.map(e =>
        e.id === id ? { ...e, result: res.prediction, loading: false } : e
      ))
    } catch (err) {
      setEntries(prev => prev.map(e =>
        e.id === id ? { ...e, loading: false, error: err.message || 'Failed' } : e
      ))
    }
  }, [entries.length])

  const removeDrug = useCallback((index) => {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass overflow-hidden"
    >
      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors"
        style={{ borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(139,92,246,0.12)' }}>
            <GitCompare size={13} style={{ color: '#a78bfa' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>
            Multi-Drug Comparison
          </span>
          {entries.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
                           border: '1px solid rgba(139,92,246,0.25)' }}>
              {entries.length}/{MAX_DRUGS}
            </span>
          )}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} style={{ color: '#64748b' }} />
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
            <div className="p-5 space-y-4">
              {/* Add input */}
              {entries.length < MAX_DRUGS && (
                <AddDrugInput onAdd={addDrug} disabled={entries.length >= MAX_DRUGS} />
              )}

              {/* Drug cards */}
              {entries.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  <AnimatePresence>
                    {entries.map((entry, i) => (
                      <DrugCard key={entry.id} entry={entry} onRemove={removeDrug} index={i} />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Comparison table */}
              {entries.filter(e => e.result).length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <th className="text-left px-3 py-2 font-semibold"
                            style={{ color: 'rgba(100,116,139,0.7)' }}>Property</th>
                        {entries.filter(e => e.result).map(e => (
                          <th key={e.id} className="px-3 py-2 font-semibold text-center truncate max-w-[80px]"
                              style={{ color: '#cbd5e1' }}>{e.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARE_FIELDS.map((field, fi) => {
                        const vals = entries.filter(e => e.result).map(e =>
                          field.feat ? e.result.features?.[field.key] : e.result[field.key]
                        )
                        const numVals = vals.map(v => parseFloat(v)).filter(v => !isNaN(v))
                        const maxVal = Math.max(...numVals)
                        const minVal = Math.min(...numVals)

                        return (
                          <tr key={field.key}
                              style={{ background: fi % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                            <td className="px-3 py-2 font-medium" style={{ color: 'rgba(100,116,139,0.7)' }}>
                              {field.label}
                            </td>
                            {entries.filter(e => e.result).map(e => {
                              const raw = field.feat ? e.result.features?.[field.key] : e.result[field.key]
                              const num = parseFloat(raw)
                              const isMax = !isNaN(num) && num === maxVal && maxVal !== minVal
                              const isMin = !isNaN(num) && num === minVal && maxVal !== minVal
                              const highlight = field.isRisk
                                ? (isMax ? '#f87171' : isMin ? '#4ade80' : '#cbd5e1')
                                : '#cbd5e1'
                              return (
                                <td key={e.id} className="px-3 py-2 text-center font-mono font-semibold"
                                    style={{ color: highlight }}>
                                  {field.format(raw)}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </motion.div>
              )}

              {entries.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: 'rgba(71,85,105,0.7)' }}>
                  Add up to {MAX_DRUGS} drugs to compare toxicity profiles side-by-side
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
