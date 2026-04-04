import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, FlaskConical, X, Clipboard, AlertCircle, CheckCircle2, Zap } from 'lucide-react'

const DEMO_DRUGS = [
  { name: 'Aspirin (safe)', smiles: 'CC(=O)Oc1ccccc1C(=O)O' },
  { name: 'Benzene (toxic)', smiles: 'c1ccccc1' },
  { name: 'Nitrobenzene (toxic)', smiles: 'c1ccc([N+](=O)[O-])cc1' },
  { name: 'Caffeine (safe)', smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C' },
]
let demoIdx = 0

// Debounced SMILES validation against backend (or client fallback)
async function validateSMILES(smiles) {
  if (!smiles || smiles.length < 2) return null
  try {
    const res = await fetch(`/validate-smiles?smiles=${encodeURIComponent(smiles)}`, {
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) return await res.json()
  } catch (_) {}
  // Client-side fallback: basic character check
  const invalid = /[^A-Za-z0-9@+\-\[\]()=#$:.\/\\%]/.test(smiles)
  return { valid: !invalid, message: invalid ? 'Contains unusual characters' : 'Valid SMILES' }
}

export default function InputCard({ onSubmit, loading, examples, dark = true }) {
  const [smiles, setSmiles] = useState('')
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState('')
  const [validation, setValidation] = useState(null) // { valid, message, formula, mw }
  const debounceRef = useRef(null)

  // Live validation with debounce
  useEffect(() => {
    if (!smiles.trim()) { setValidation(null); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const result = await validateSMILES(smiles.trim())
      setValidation(result)
    }, 600)
    return () => clearTimeout(debounceRef.current)
  }, [smiles])

  function validate(val) {
    if (!val.trim()) return 'Please enter a SMILES string'
    if (val.trim().length < 2) return 'SMILES too short'
    if (/[^A-Za-z0-9@+\-\[\]()=#$:.\/\\%]/.test(val))
      return 'Contains unusual characters — double-check your SMILES'
    return ''
  }

  function handleDemo() {
    const drug = DEMO_DRUGS[demoIdx % DEMO_DRUGS.length]
    demoIdx++
    setSmiles(drug.smiles)
    setError('')
    // Auto-submit after a short delay for the "animate results" feel
    setTimeout(() => {
      onSubmit(drug.smiles)
    }, 400)
  }

  function handleSubmit(e) {
    e?.preventDefault()
    const err = validate(smiles)
    if (err) { setError(err); return }
    setError('')
    onSubmit(smiles.trim())
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      setSmiles(text.trim())
      setError('')
    } catch (_) {}
  }

  const borderColor = error
    ? 'rgba(239,68,68,0.5)'
    : focused
    ? 'rgba(14,165,233,0.5)'
    : dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'

  const glowStyle = focused && !error
    ? { boxShadow: '0 0 0 3px rgba(14,165,233,0.12), 0 0 20px rgba(14,165,233,0.08)' }
    : error
    ? { boxShadow: '0 0 0 3px rgba(239,68,68,0.1)' }
    : {}

  return (
    <div className="glass p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(14,165,233,0.12)' }}>
            <FlaskConical size={13} className="text-brand-400" />
          </div>
          <span className="text-sm font-semibold" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
            SMILES Input
          </span>
        </div>
        <span className="section-label">Molecular notation</span>
        <motion.button
          type="button"
          whileHover={{ scale: 1.04, boxShadow: '0 0 16px rgba(139,92,246,0.4)' }}
          whileTap={{ scale: 0.96 }}
          onClick={handleDemo}
          disabled={loading}
          className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full transition-all disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(14,165,233,0.2))',
            border: '1px solid rgba(139,92,246,0.35)',
            color: '#a78bfa',
          }}
        >
          <Zap size={10} />
          Demo Mode
        </motion.button>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <motion.div
          animate={glowStyle}
          transition={{ duration: 0.2 }}
          className="relative rounded-xl overflow-hidden"
          style={{
            border: `1px solid ${borderColor}`,
            background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
            transition: 'border-color 0.2s ease',
          }}
        >
          <input
            value={smiles}
            onChange={e => { setSmiles(e.target.value); setError('') }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            disabled={loading}
            placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O"
            className="w-full px-4 py-3 pr-20 text-sm font-mono outline-none
                       disabled:opacity-50 bg-transparent"
            style={{ color: dark ? '#e2e8f0' : '#1e293b' }}
          />

          {/* Action buttons inside input */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {smiles && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => { setSmiles(''); setError('') }}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: dark ? '#64748b' : '#94a3b8' }}
              >
                <X size={13} />
              </motion.button>
            )}
            {!smiles && (
              <motion.button
                type="button"
                onClick={handlePaste}
                className="p-1.5 rounded-md transition-colors text-[10px] font-medium flex items-center gap-1"
                style={{ color: dark ? '#64748b' : '#94a3b8' }}
                title="Paste from clipboard"
              >
                <Clipboard size={12} />
              </motion.button>
            )}
            <motion.button
              type="submit"
              disabled={loading || !smiles.trim()}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-md disabled:opacity-30 disabled:cursor-not-allowed
                         transition-all"
              style={{ color: '#0ea5e9' }}
            >
              <Send size={15} />
            </motion.button>
          </div>
        </motion.div>

        {/* Validation indicator */}
        <AnimatePresence>
          {validation && smiles.trim() && !error && (
            <motion.div
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              className="flex items-center gap-1.5 text-xs"
              style={{ color: validation.valid ? '#4ade80' : '#f87171' }}
            >
              {validation.valid
                ? <><CheckCircle2 size={12} /> Valid SMILES{validation.formula ? ` — ${validation.formula}` : ''}{validation.mw ? `, MW ${validation.mw} Da` : ''}</>
                : <><AlertCircle size={12} /> {validation.message}</>
              }
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              className="flex items-center gap-1.5 text-xs"
              style={{ color: '#f87171' }}
            >
              <AlertCircle size={12} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analyze button */}
        <motion.button
          type="submit"
          disabled={loading || !smiles.trim()}
          whileHover={{ scale: 1.01, boxShadow: '0 4px 24px rgba(14,165,233,0.4)' }}
          whileTap={{ scale: 0.99 }}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                     disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 50%, #8b5cf6 100%)' }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
              Analyzing…
            </span>
          ) : (
            '⚗ Analyze Molecule'
          )}
        </motion.button>
      </form>

      {/* Example chips */}
      <div className="space-y-2">
        <p className="section-label">Quick examples</p>
        <div className="flex flex-wrap gap-1.5">
          {examples.map(ex => (
            <motion.button
              key={ex.name}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => { setSmiles(ex.smiles); setError('') }}
              disabled={loading}
              className="text-[11px] px-2.5 py-1 rounded-full font-medium
                         transition-all disabled:opacity-40"
              style={{
                background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                color: dark ? 'rgba(148,163,184,0.9)' : '#64748b',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(14,165,233,0.4)'
                e.currentTarget.style.color = '#38bdf8'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                e.currentTarget.style.color = dark ? 'rgba(148,163,184,0.9)' : '#64748b'
              }}
            >
              {ex.name}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
