import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, X, FlaskConical, Loader2, ExternalLink,
  ChevronRight, AlertCircle, Clock, Beaker, Atom,
  ArrowUp, ArrowDown, CornerDownLeft, Sparkles, Mic,
} from 'lucide-react'
import { autocompleteDrug, getSMILES, getDrugInfo, lookupAndPredict } from '../lib/mockApi'
import VoiceSearchButton from './VoiceSearchButton'

// ── Debounce hook ─────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Highlight matching substring ──────────────────────────────
function HighlightMatch({ text, query }) {
  if (!query || !text) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <span style={{ color: '#38bdf8', fontWeight: 700 }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </span>
  )
}

// ── Drug info mini-card ───────────────────────────────────────
function DrugInfoCard({ info, visible }) {
  if (!info || !visible) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-xl p-3 space-y-3"
      style={{
        background: 'rgba(14,165,233,0.05)',
        border: '1px solid rgba(14,165,233,0.15)',
      }}
    >
      <div className="flex items-center gap-2">
        <Atom size={11} style={{ color: '#38bdf8' }} />
        <span className="text-[11px] font-semibold" style={{ color: '#7dd3fc' }}>
          {info.name}
        </span>
        {(info.cid || info.sourceUrl) && (
          <a
            href={info.sourceUrl || `https://pubchem.ncbi.nlm.nih.gov/compound/${info.cid}`}
            target="_blank" rel="noopener noreferrer"
            className="ml-auto p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(56,189,248,0.7)' }}
          >
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          ['Formula', info.formula],
          ['MW', info.mw ? `${parseFloat(info.mw).toFixed(1)} Da` : '—'],
          ['CID', info.cid ?? '—'],
        ].map(([label, val]) => (
          <div key={label} className="rounded-lg px-2 py-1.5 text-center"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[8px] mb-0.5" style={{ color: 'rgba(100,116,139,0.6)' }}>{label}</p>
            <p className="text-[10px] font-mono font-semibold" style={{ color: '#cbd5e1' }}>{val || '—'}</p>
          </div>
        ))}
      </div>

      {(info.description || info.iupac) && (
        <div className="space-y-1.5 p-2 rounded-lg bg-black/20 border border-white/5">
          {info.description && (
            <p className="text-[10px] leading-relaxed text-slate-300 italic">
              "{info.description.length > 180 ? info.description.slice(0, 180) + '…' : info.description}"
            </p>
          )}
          {info.iupac && (
            <p className="text-[9px] leading-relaxed font-mono opacity-60" style={{ color: 'rgba(148,163,184,0.8)' }}>
              IUPAC: {info.iupac.length > 100 ? info.iupac.slice(0, 100) + '…' : info.iupac}
            </p>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ── Single autocomplete row ───────────────────────────────────
function SuggestionRow({ drug, query, isActive, onSelect, onHover, index }) {
  const hasSmiles = Boolean(drug.smiles)
  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, ease: [0.23, 1, 0.32, 1] }}
      onClick={() => onSelect(drug)}
      onMouseEnter={() => onHover(index)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                 transition-all duration-150 group relative"
      style={{
        background: isActive ? 'rgba(14,165,233,0.1)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isActive ? 'rgba(14,165,233,0.25)' : 'rgba(255,255,255,0.04)'}`,
      }}
    >
      {/* Active left accent */}
      {isActive && (
        <motion.div
          layoutId="activeAccent"
          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
          style={{ background: 'linear-gradient(180deg, #38bdf8, #818cf8)' }}
        />
      )}

      {/* Icon */}
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
           style={{
             background: isActive ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.04)',
             border: `1px solid ${isActive ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.06)'}`,
           }}>
        <FlaskConical size={12} style={{ color: isActive ? '#38bdf8' : 'rgba(100,116,139,0.6)' }} />
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold truncate"
                style={{ color: isActive ? '#e2e8f0' : 'rgba(203,213,225,0.8)' }}>
            <HighlightMatch text={drug.name} query={query} />
          </span>
          {drug.formula && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa',
                           border: '1px solid rgba(139,92,246,0.15)' }}>
              {drug.formula}
            </span>
          )}
          {!hasSmiles && (
            <span className="text-[8px] px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: 'rgba(234,179,8,0.08)', color: '#fbbf24',
                           border: '1px solid rgba(234,179,8,0.15)' }}>
              fetch on select
            </span>
          )}
        </div>
        {(drug.smiles || drug.mw) && (
          <div className="flex items-center gap-2 mt-0.5">
            {drug.smiles && (
              <span className="text-[9px] font-mono truncate"
                    style={{ color: 'rgba(100,116,139,0.55)' }}>
                {drug.smiles.length > 38 ? drug.smiles.slice(0, 38) + '…' : drug.smiles}
              </span>
            )}
            {drug.mw && (
              <span className="text-[9px] flex-shrink-0 font-mono"
                    style={{ color: 'rgba(100,116,139,0.5)' }}>
                {parseFloat(drug.mw).toFixed(1)} Da
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {drug.cid && (
          <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${drug.cid}`}
             target="_blank" rel="noopener noreferrer"
             onClick={e => e.stopPropagation()}
             className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
             style={{ color: 'rgba(100,116,139,0.5)' }}
             onMouseEnter={e => e.currentTarget.style.color = '#38bdf8'}
             onMouseLeave={e => e.currentTarget.style.color = 'rgba(100,116,139,0.5)'}
             title="View on PubChem">
            <ExternalLink size={10} />
          </a>
        )}
        <ChevronRight size={12}
          style={{ color: isActive ? '#38bdf8' : 'rgba(100,116,139,0.3)',
                   transition: 'color 0.15s ease' }} />
      </div>
    </motion.button>
  )
}

// ── History row ───────────────────────────────────────────────
function HistoryRow({ item, onSelect, onRemove }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg group"
         style={{ background: 'rgba(255,255,255,0.02)' }}>
      <Clock size={10} style={{ color: 'rgba(100,116,139,0.5)', flexShrink: 0 }} />
      <button
        onClick={() => onSelect(item)}
        className="flex-1 text-left text-[11px] truncate transition-colors"
        style={{ color: 'rgba(148,163,184,0.7)' }}
        onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.7)'}
      >
        {item.name}
      </button>
      <button
        onClick={() => onRemove(item.name)}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'rgba(100,116,139,0.5)' }}
      >
        <X size={9} />
      </button>
    </div>
  )
}

// ── Main DrugSearch component ─────────────────────────────────
const MAX_HISTORY = 5

export default function DrugSearch({ onResult, onLoading, dark = true }) {
  const [query,       setQuery]       = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [activeIdx,   setActiveIdx]   = useState(-1)
  const [open,        setOpen]        = useState(false)
  const [searching,   setSearching]   = useState(false)
  const [predicting,  setPredicting]  = useState(false)
  const [fetchingSmiles, setFetchingSmiles] = useState(false)
  const [error,       setError]       = useState('')
  const [history,     setHistory]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('drugSearchHistory') || '[]') }
    catch { return [] }
  })
  const [selectedInfo, setSelectedInfo] = useState(null)
  const [showInfo,     setShowInfo]     = useState(false)
  const [listening,    setListening]    = useState(false)

  const inputRef    = useRef(null)
  const dropdownRef = useRef(null)
  const debouncedQ  = useDebounce(query, 300)

  // ── Autocomplete on debounced query ──────────────────────────
  useEffect(() => {
    const q = debouncedQ.trim()
    if (q.length < 2) {
      setSuggestions([])
      setOpen(false)
      setError('')
      setActiveIdx(-1)
      return
    }
    let cancelled = false
    setSearching(true)
    setError('')
    autocompleteDrug(q).then(res => {
      if (cancelled) return
      setSuggestions(res)
      setOpen(true)
      setActiveIdx(-1)
      if (res.length === 0) setError(`No results for "${q}" — try a different spelling`)
      setSearching(false)
    }).catch(() => {
      if (!cancelled) { setError('Search failed — check connection'); setSearching(false) }
    })
    return () => { cancelled = true }
  }, [debouncedQ])

  // ── Close dropdown on outside click ──────────────────────────
  useEffect(() => {
    const handler = e => {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Keyboard navigation ───────────────────────────────────────
  const handleKeyDown = useCallback(e => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = activeIdx >= 0 ? activeIdx : 0
      if (suggestions[idx]) handleSelect(suggestions[idx])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    }
  }, [open, suggestions, activeIdx])

  // ── Select a suggestion ───────────────────────────────────────
  const handleSelect = useCallback(async (drug) => {
    setOpen(false)
    setActiveIdx(-1)
    setError('')
    setShowInfo(false)

    let resolvedDrug = { ...drug }

    // If no SMILES yet (name-only autocomplete result), fetch it first
    if (!resolvedDrug.smiles) {
      setFetchingSmiles(true)
      setQuery(drug.name)
      try {
        const smiles = await getSMILES(drug.name)
        if (!smiles) { setError(`Could not find SMILES for "${drug.name}"`); setFetchingSmiles(false); return }
        resolvedDrug.smiles = smiles
        // Also fetch full info in background
        getDrugInfo(drug.name).then(info => {
          if (info) resolvedDrug = { ...resolvedDrug, ...info }
        })
      } catch {
        setError(`Could not fetch structure for "${drug.name}"`)
        setFetchingSmiles(false)
        return
      }
      setFetchingSmiles(false)
    }

    setQuery(resolvedDrug.name)

    // Fetch drug info card (non-blocking)
    getDrugInfo(resolvedDrug.name).then(info => {
      if (info) { setSelectedInfo(info); setShowInfo(true) }
    })

    // Run prediction
    setPredicting(true)
    onLoading?.(true)
    try {
      const res = await lookupAndPredict(resolvedDrug)
      onResult?.(res.prediction, resolvedDrug)

      // Save to history
      setHistory(prev => {
        const next = [
          { name: resolvedDrug.name, smiles: resolvedDrug.smiles,
            formula: resolvedDrug.formula, mw: resolvedDrug.mw },
          ...prev.filter(h => h.name !== resolvedDrug.name),
        ].slice(0, MAX_HISTORY)
        localStorage.setItem('drugSearchHistory', JSON.stringify(next))
        return next
      })
    } catch (e) {
      setError(e.message || 'Prediction failed')
    } finally {
      setPredicting(false)
      onLoading?.(false)
    }
  }, [onResult, onLoading])

  const handleHistorySelect = useCallback((item) => {
    setQuery(item.name)
    handleSelect(item)
  }, [handleSelect])

  const removeHistory = useCallback((name) => {
    setHistory(prev => {
      const next = prev.filter(h => h.name !== name)
      localStorage.setItem('drugSearchHistory', JSON.stringify(next))
      return next
    })
  }, [])

  // ── Voice search handler ──────────────────────────────────────
  const handleVoiceResult = useCallback((transcript, errorType) => {
    if (!transcript) {
      if (errorType) setError('Voice recognition failed — try again')
      return
    }
    setError('')
    setShowInfo(false)
    setQuery(transcript)
    // Focus input so user sees the filled text
    inputRef.current?.focus()
    // Trigger autocomplete immediately (bypass debounce by calling directly)
    if (transcript.trim().length >= 2) {
      setSearching(true)
      autocompleteDrug(transcript.trim()).then(res => {
        setSuggestions(res)
        setOpen(res.length > 0)
        setActiveIdx(-1)
        if (res.length === 0) setError(`No results for "${transcript}" — try again`)
        setSearching(false)
      }).catch(() => {
        setError('Search failed — check connection')
        setSearching(false)
      })
    }
  }, [])

  const clear = () => {
    setQuery(''); setSuggestions([]); setOpen(false)
    setError(''); setSelectedInfo(null); setShowInfo(false)
    inputRef.current?.focus()
  }

  const isLoading = searching || predicting || fetchingSmiles
  const borderGlow = open
    ? '0 0 0 3px rgba(14,165,233,0.12)'
    : 'none'

  return (
    <div className="glass p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
            <Beaker size={13} style={{ color: '#38bdf8' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#7dd3fc' }}>
            Drug Name Search
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="neon-dot" />
          <span className="section-label">PubChem · Live</span>
        </div>
      </div>

      {/* Search input */}
      <div className="relative" ref={dropdownRef}>
        <motion.div
          animate={{ boxShadow: borderGlow }}
          transition={{ duration: 0.2 }}
          className="relative rounded-xl overflow-visible"
          style={{
            border: `1px solid ${open ? 'rgba(14,165,233,0.4)' : 'rgba(255,255,255,0.08)'}`,
            background: 'rgba(255,255,255,0.04)',
            transition: 'border-color 0.2s ease',
          }}
        >
          {/* Left icon */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {isLoading
              ? <Loader2 size={14} style={{ color: '#38bdf8' }} className="animate-spin" />
              : <Search size={14} style={{ color: open ? '#38bdf8' : 'rgba(100,116,139,0.5)',
                                           transition: 'color 0.2s ease' }} />
            }
          </div>

          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setError(''); setShowInfo(false) }}
            onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
            onKeyDown={handleKeyDown}
            placeholder='Search drug name (e.g. Aspirin, Metformin…)'
            className="w-full pl-9 pr-20 py-3 text-sm outline-none bg-transparent"
            style={{ color: '#e2e8f0', caretColor: '#38bdf8' }}
            autoComplete="off"
            spellCheck={false}
          />

          {/* Right controls: mic + clear */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <VoiceSearchButton
              onResult={handleVoiceResult}
              onListeningChange={setListening}
              disabled={isLoading}
            />
            {query && (
              <button onClick={clear}
                className="transition-colors"
                style={{ color: 'rgba(100,116,139,0.5)' }}
                onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(100,116,139,0.5)'}>
                <X size={13} />
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Dropdown ── */}
        <AnimatePresence>
          {open && (suggestions.length > 0 || (history.length > 0 && !query)) && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
              className="relative mt-2 z-10 rounded-2xl p-2 space-y-1"
              style={{
                background: 'rgba(8,12,20,0.98)',
                border: '1px solid rgba(255,255,255,0.09)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(14,165,233,0.06)',
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Result count */}
              {suggestions.length > 0 && (
                <div className="flex items-center justify-between px-2 pb-1">
                  <span className="section-label">
                    {suggestions.length} result{suggestions.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-2 text-[9px]"
                       style={{ color: 'rgba(71,85,105,0.7)' }}>
                    <span className="flex items-center gap-0.5">
                      <ArrowUp size={8} /><ArrowDown size={8} /> navigate
                    </span>
                    <span className="flex items-center gap-0.5">
                      <CornerDownLeft size={8} /> select
                    </span>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {suggestions.map((drug, i) => (
                <SuggestionRow
                  key={drug.cid ?? drug.name}
                  drug={drug}
                  query={query}
                  isActive={i === activeIdx}
                  onSelect={handleSelect}
                  onHover={setActiveIdx}
                  index={i}
                />
              ))}

              {/* Divider + history */}
              {history.length > 0 && suggestions.length > 0 && (
                <div className="pt-1 mt-1"
                     style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="section-label px-2 pb-1">Recent</p>
                  {history.slice(0, 3).map(h => (
                    <HistoryRow key={h.name} item={h}
                      onSelect={handleHistorySelect} onRemove={removeHistory} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Status messages ── */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div key="err"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 text-xs"
            style={{ color: '#f87171' }}>
            <AlertCircle size={11} /> {error}
          </motion.div>
        )}
        {listening && !error && (
          <motion.div key="listening"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-xs"
            style={{ color: '#38bdf8' }}>
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Mic size={11} />
            </motion.div>
            Listening… speak a drug name
          </motion.div>
        )}
        {fetchingSmiles && (
          <motion.div key="fetch"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-xs"
            style={{ color: 'rgba(148,163,184,0.7)' }}>
            <Loader2 size={11} className="animate-spin" style={{ color: '#38bdf8' }} />
            Fetching molecular structure from PubChem…
          </motion.div>
        )}
        {predicting && (
          <motion.div key="pred"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-xs"
            style={{ color: 'rgba(148,163,184,0.7)' }}>
            <Sparkles size={11} className="animate-pulse" style={{ color: '#a78bfa' }} />
            Running toxicity prediction…
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Drug info card ── */}
      <AnimatePresence>
        {showInfo && selectedInfo && (
          <DrugInfoCard info={selectedInfo} visible={showInfo} />
        )}
      </AnimatePresence>

      {/* ── History (idle state) ── */}
      {!query && history.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="section-label">Recent searches</p>
            <button
              onClick={() => { setHistory([]); localStorage.removeItem('drugSearchHistory') }}
              className="text-[9px] transition-colors"
              style={{ color: 'rgba(100,116,139,0.5)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(100,116,139,0.5)'}
            >
              Clear all
            </button>
          </div>
          {history.map(h => (
            <HistoryRow key={h.name} item={h}
              onSelect={handleHistorySelect} onRemove={removeHistory} />
          ))}
        </div>
      )}

      {/* ── Hint ── */}
      {!query && history.length === 0 && !predicting && (
        <p className="text-[11px]" style={{ color: 'rgba(71,85,105,0.8)' }}>
          Type or <span style={{ color: 'rgba(56,189,248,0.7)' }}>speak 🎤</span> a drug name for real-time PubChem autocomplete. Select a result to auto-predict toxicity.
        </p>
      )}
    </div>
  )
}
