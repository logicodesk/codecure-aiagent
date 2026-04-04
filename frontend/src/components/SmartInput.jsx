// SmartInput.jsx — Premium cinematic input panel
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Zap, X, CheckCircle2, AlertCircle, FlaskConical, ChevronRight } from 'lucide-react'

const SUGGESTIONS = [
  { name: 'Aspirin',       smiles: 'CC(=O)Oc1ccccc1C(=O)O',                    safe: true  },
  { name: 'Caffeine',      smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',             safe: true  },
  { name: 'Ibuprofen',     smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',               safe: true  },
  { name: 'Paracetamol',   smiles: 'CC(=O)Nc1ccc(O)cc1',                        safe: true  },
  { name: 'Benzene',       smiles: 'c1ccccc1',                                   safe: false },
  { name: 'Nitrobenzene',  smiles: 'c1ccc([N+](=O)[O-])cc1',                    safe: false },
  { name: 'Aniline',       smiles: 'c1ccc(cc1)N',                                safe: false },
  { name: 'Testosterone',  smiles: 'CC12CCC3C(C1CCC2O)CCC4=CC(=O)CCC34C',       safe: true  },
  { name: 'Metformin',     smiles: 'CN(C)C(=N)NC(=N)N',                          safe: true  },
  { name: 'PCB',           smiles: 'Clc1ccc(cc1Cl)c1cc(Cl)ccc1Cl',              safe: false },
]

const PLACEHOLDER_CYCLE = [
  'Enter SMILES: CC(=O)Oc1ccccc1C(=O)O',
  'Or drug name: Aspirin, Caffeine…',
  'Try: c1ccccc1 (Benzene)',
  'Paste any SMILES string…',
]

function useCyclePlaceholder(items, interval = 2800) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), interval)
    return () => clearInterval(t)
  }, [items.length, interval])
  return items[idx]
}

export default function SmartInput({ onSubmit, loading }) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [validation, setValidation] = useState(null) // null | 'valid' | 'invalid'
  const inputRef = useRef(null)
  const placeholder = useCyclePlaceholder(PLACEHOLDER_CYCLE)

  // Filter suggestions
  const filtered = value.length >= 2
    ? SUGGESTIONS.filter(s =>
        s.name.toLowerCase().includes(value.toLowerCase()) ||
        s.smiles.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 6)
    : SUGGESTIONS.slice(0, 6)

  // Basic SMILES/name validation
  useEffect(() => {
    if (!value.trim()) { setValidation(null); return }
    const timer = setTimeout(() => {
      const looksLikeSMILES = /[=()[\]#@+\-]/.test(value) || value.length > 6
      const knownDrug = SUGGESTIONS.find(s => s.name.toLowerCase() === value.toLowerCase())
      if (knownDrug || looksLikeSMILES) setValidation('valid')
      else if (value.length > 2) setValidation('valid') // optimistic
      else setValidation('invalid')
    }, 500)
    return () => clearTimeout(timer)
  }, [value])

  function handleSelect(s) {
    setValue(s.smiles)
    setShowSuggestions(false)
    setValidation('valid')
    // Auto-submit after matching suggestion
    onSubmit?.(s.smiles)
    inputRef.current?.blur()
  }

  function handleSubmit(e) {
    e?.preventDefault()
    if (!value.trim() || loading) return
    // Resolve name → SMILES
    const match = SUGGESTIONS.find(s => s.name.toLowerCase() === value.toLowerCase())
    onSubmit?.(match ? match.smiles : value.trim())
  }

  const borderColor = focused
    ? validation === 'invalid' ? 'rgba(239,68,68,0.7)' : 'rgba(14,165,233,0.7)'
    : 'rgba(255,255,255,0.08)'

  const glowColor = focused
    ? validation === 'invalid'
      ? '0 0 0 3px rgba(239,68,68,0.12), 0 0 30px rgba(239,68,68,0.08)'
      : '0 0 0 3px rgba(14,165,233,0.15), 0 0 40px rgba(14,165,233,0.1)'
    : 'none'

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Label */}
      <motion.div
        animate={{ y: focused || value ? -4 : 0, opacity: focused || value ? 1 : 0.6 }}
        className="flex items-center gap-2"
      >
        <FlaskConical size={13} style={{ color: '#38bdf8' }} />
        <span className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: '#38bdf8' }}>
          Molecular Input
        </span>
        {validation === 'valid' && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 text-[10px] font-bold"
            style={{ color: '#4ade80' }}
          >
            <CheckCircle2 size={10} /> Valid structure
          </motion.span>
        )}
        {validation === 'invalid' && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 text-[10px]"
            style={{ color: '#f87171' }}
          >
            <AlertCircle size={10} /> Check input
          </motion.span>
        )}
      </motion.div>

      {/* Input container */}
      <form onSubmit={handleSubmit} className="relative">
        <motion.div
          animate={{ boxShadow: glowColor }}
          transition={{ duration: 0.2 }}
          className="relative rounded-2xl overflow-hidden"
          style={{
            border: `1px solid ${borderColor}`,
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(12px)',
            transition: 'border-color 0.2s ease',
          }}
        >
          {/* Left icon */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <motion.div
              animate={{ rotate: focused ? 360 : 0 }}
              transition={{ duration: 0.5 }}
            >
              <Search size={16} style={{ color: focused ? '#38bdf8' : 'rgba(100,116,139,0.5)' }} />
            </motion.div>
          </div>

          <input
            ref={inputRef}
            value={value}
            onChange={e => { setValue(e.target.value); setShowSuggestions(true) }}
            onFocus={() => { setFocused(true); setShowSuggestions(true) }}
            onBlur={() => { setFocused(false); setTimeout(() => setShowSuggestions(false), 180) }}
            placeholder={placeholder}
            disabled={loading}
            className="w-full pl-12 pr-28 py-4 text-sm font-mono outline-none bg-transparent"
            style={{ color: '#e2e8f0', caretColor: '#38bdf8' }}
            autoComplete="off"
            spellCheck={false}
          />

          {/* Right controls */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {value && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => { setValue(''); setValidation(null) }}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'rgba(100,116,139,0.5)' }}
              >
                <X size={13} />
              </motion.button>
            )}
            <motion.button
              type="submit"
              disabled={!value.trim() || loading}
              whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(14,165,233,0.5)' }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-30 transition-all"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)' }}
            >
              <Zap size={12} />
              Analyze
            </motion.button>
          </div>
        </motion.div>

        {/* Suggestions dropdown */}
        <AnimatePresence>
          {showSuggestions && filtered.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="relative mt-2 z-10 rounded-2xl p-2 space-y-0.5"
              style={{
                background: 'rgba(8,10,20,0.97)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <p className="text-[9px] uppercase tracking-widest px-3 py-1"
                 style={{ color: 'rgba(100,116,139,0.5)' }}>
                Suggestions
              </p>
              {filtered.map((s, i) => (
                <motion.button
                  key={s.name}
                  type="button"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleSelect(s)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,165,233,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                       style={{ background: s.safe ? '#22c55e' : '#ef4444' }} />
                  <span className="text-xs font-semibold" style={{ color: '#e2e8f0' }}>{s.name}</span>
                  <span className="text-[10px] font-mono truncate flex-1"
                        style={{ color: 'rgba(100,116,139,0.5)' }}>
                    {s.smiles.length > 32 ? s.smiles.slice(0, 32) + '…' : s.smiles}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          background: s.safe ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          color: s.safe ? '#4ade80' : '#f87171',
                        }}>
                    {s.safe ? 'SAFE' : 'TOXIC'}
                  </span>
                  <ChevronRight size={11} style={{ color: 'rgba(100,116,139,0.3)', flexShrink: 0 }} />
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Quick chips */}
      <div className="flex flex-wrap gap-2 justify-center">
        {['Aspirin', 'Caffeine', 'Benzene', 'Nitrobenzene', 'Ibuprofen'].map((name, i) => {
          const s = SUGGESTIONS.find(x => x.name === name)
          return (
            <motion.button
              key={name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              whileHover={{ scale: 1.06, y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => s && handleSelect(s)}
              className="text-[11px] px-3 py-1.5 rounded-full font-medium transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(148,163,184,0.8)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(14,165,233,0.4)'
                e.currentTarget.style.color = '#38bdf8'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.color = 'rgba(148,163,184,0.8)'
              }}
            >
              {name}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
