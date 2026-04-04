import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef, useCallback } from 'react'
import { MousePointer2, ChevronDown, ChevronUp, Info, Zap } from 'lucide-react'

// Level config
const LEVEL_CFG = {
  critical: { color: '#dc2626', bg: 'rgba(220,38,38,0.12)', label: 'Critical' },
  high:     { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  label: 'High' },
  medium:   { color: '#f97316', bg: 'rgba(249,115,22,0.08)', label: 'Medium' },
  low:      { color: '#eab308', bg: 'rgba(234,179,8,0.07)', label: 'Low' },
  safe:     { color: '#22c55e', bg: 'rgba(34,197,94,0.07)', label: 'Safe' },
}

// Atom tooltip card
function AtomTooltip({ atom, visible }) {
  if (!atom || !visible) return null
  const cfg = LEVEL_CFG[atom.level] ?? LEVEL_CFG.safe
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.15 }}
      className="rounded-2xl p-4 space-y-2.5 pointer-events-none"
      style={{
        background: 'rgba(10,14,26,0.97)',
        border: `1px solid ${cfg.color}44`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)`,
        backdropFilter: 'blur(20px)',
        minWidth: 220,
      }}
    >
      {/* Atom identity */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
             style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44` }}>
          {atom.symbol}
        </div>
        <div>
          <p className="text-[11px] font-semibold" style={{ color: '#e2e8f0' }}>
            Atom #{atom.atom_idx} — {atom.symbol}
          </p>
          <p className="text-[9px]" style={{ color: 'rgba(100,116,139,0.6)' }}>
            Gasteiger charge: {atom.gasteiger_charge > 0 ? '+' : ''}{atom.gasteiger_charge?.toFixed(3)}
          </p>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full overflow-hidden"
             style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(atom.score * 100)}%` }}
            transition={{ duration: 0.4 }}
            className="h-full rounded-full"
            style={{ background: cfg.color }}
          />
        </div>
        <span className="text-[10px] font-mono font-bold"
              style={{ color: cfg.color }}>
          {Math.round(atom.score * 100)}%
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full capitalize"
              style={{ background: cfg.bg, color: cfg.color }}>
          {atom.level}
        </span>
      </div>

      {/* Explanation */}
      <p className="text-[10px] leading-relaxed"
         style={{ color: 'rgba(148,163,184,0.8)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
        {atom.explanation}
      </p>
    </motion.div>
  )
}

// 2D molecule with clickable atom overlays using RDKit.js
function SaliencyCanvas({ smiles, atomScores, selectedAtom, onAtomClick }) {
  const containerRef = useRef(null)
  const [rdkitReady, setRdkitReady] = useState(false)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (window.RDKit) { setRdkitReady(true); return }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/@rdkit/rdkit/Code/MinimalLib/dist/RDKit_minimal.js'
    script.onload = () => {
      window.initRDKitModule().then(rdkit => {
        window.RDKit = rdkit
        setRdkitReady(true)
      }).catch(() => setStatus('error'))
    }
    script.onerror = () => setStatus('error')
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!rdkitReady || !smiles || !containerRef.current || !atomScores?.length) return
    try {
      const mol = window.RDKit.get_mol(smiles)
      if (!mol?.is_valid()) { setStatus('error'); return }

      // Build color map: atom_idx → hex color based on saliency score
      const atomColorMap = {}
      const bondColorMap = {}
      const highlightAtoms = []
      const highlightBonds = []

      atomScores.forEach(a => {
        if (a.level !== 'safe') {
          atomColorMap[a.atom_idx] = a.color
          highlightAtoms.push(a.atom_idx)
        }
      })

      // Highlight bonds between highlighted atoms
      try {
        const rdmol = window.RDKit.get_mol(smiles)
        const molObj = JSON.parse(rdmol.get_json())
        molObj?.molecules?.[0]?.bonds?.forEach((bond, idx) => {
          const a1 = bond.atoms[0], a2 = bond.atoms[1]
          if (highlightAtoms.includes(a1) && highlightAtoms.includes(a2)) {
            const c1 = atomColorMap[a1], c2 = atomColorMap[a2]
            bondColorMap[idx] = c1 || c2 || '#f97316'
            highlightBonds.push(idx)
          }
        })
        rdmol.delete()
      } catch (_) {}

      const details = {
        width: 380, height: 260,
        bondLineWidth: 1.5,
        addStereoAnnotation: true,
        highlightAtomColors: atomColorMap,
        highlightBondColors: bondColorMap,
        highlightAtoms,
        highlightBonds,
        highlightRadius: 0.4,
      }

      const svg = mol.get_svg_with_highlights(JSON.stringify(details))
      mol.delete()

      if (containerRef.current) {
        containerRef.current.innerHTML = svg
        const svgEl = containerRef.current.querySelector('svg')
        if (svgEl) {
          svgEl.style.width = '100%'
          svgEl.style.height = 'auto'
          svgEl.style.maxHeight = '260px'
          svgEl.style.cursor = 'crosshair'
        }
        setStatus('ready')
      }
    } catch (_) {
      setStatus('error')
    }
  }, [rdkitReady, smiles, atomScores, selectedAtom])

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center h-32 rounded-xl text-xs"
           style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    color: 'rgba(100,116,139,0.6)' }}>
        2D structure unavailable
      </div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden"
         style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                  minHeight: 120 }}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div className="w-5 h-5 rounded-full border-2 border-t-brand-400"
            style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: '#38bdf8' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
        </div>
      )}
      <div ref={containerRef} className="p-2"
           style={{ filter: 'invert(1) hue-rotate(180deg)',
                    opacity: status === 'ready' ? 1 : 0,
                    transition: 'opacity 0.3s ease' }} />
    </div>
  )
}

// Atom list table
function AtomTable({ atoms, selectedAtom, onSelect }) {
  const sorted = [...atoms].sort((a, b) => b.score - a.score).slice(0, 10)
  return (
    <div className="space-y-1">
      {sorted.map((atom, i) => {
        const cfg = LEVEL_CFG[atom.level] ?? LEVEL_CFG.safe
        const isSelected = selectedAtom?.atom_idx === atom.atom_idx
        return (
          <motion.button
            key={atom.atom_idx}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onSelect(isSelected ? null : atom)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all"
            style={{
              background: isSelected ? cfg.bg : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isSelected ? cfg.color + '44' : 'rgba(255,255,255,0.05)'}`,
            }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                 style={{ background: cfg.bg, color: cfg.color }}>
              {atom.symbol}
            </div>
            <span className="text-[10px] flex-1 truncate"
                  style={{ color: 'rgba(148,163,184,0.8)' }}>
              #{atom.atom_idx} — {atom.explanation.slice(0, 50)}{atom.explanation.length > 50 ? '…' : ''}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-12 h-1.5 rounded-full overflow-hidden"
                   style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full"
                     style={{ width: `${Math.round(atom.score * 100)}%`, background: cfg.color }} />
              </div>
              <span className="text-[9px] font-mono w-7 text-right"
                    style={{ color: cfg.color }}>
                {Math.round(atom.score * 100)}%
              </span>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

export default function AtomSaliencyMap({ result }) {
  const [expanded, setExpanded]       = useState(true)
  const [selectedAtom, setSelectedAtom] = useState(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  const saliency = result?.atom_saliency
  const smiles   = result?.smiles

  useEffect(() => {
    setTooltipVisible(!!selectedAtom)
  }, [selectedAtom])

  if (!saliency?.saliency_available) return null

  const atoms       = saliency.atom_scores ?? []
  const criticalCnt = saliency.critical_atoms?.length ?? 0
  const highCnt     = saliency.high_risk_atoms?.length ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="glass p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
            <MousePointer2 size={13} style={{ color: '#38bdf8' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#7dd3fc' }}>
            Atom Saliency Map
          </span>
          {(criticalCnt + highCnt) > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171',
                           border: '1px solid rgba(239,68,68,0.2)' }}>
              {criticalCnt + highCnt} hot atom{criticalCnt + highCnt !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button onClick={() => setExpanded(v => !v)}
                style={{ color: 'rgba(100,116,139,0.5)' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            {/* 2D molecule */}
            <div className="space-y-2">
              <p className="section-label">
                {selectedAtom
                  ? `Selected: Atom #${selectedAtom.atom_idx} (${selectedAtom.symbol})`
                  : 'Colored by toxicity contribution'}
              </p>
              <SaliencyCanvas
                smiles={smiles}
                atomScores={atoms}
                selectedAtom={selectedAtom}
                onAtomClick={setSelectedAtom}
              />
            </div>

            {/* Selected atom tooltip */}
            <AnimatePresence>
              {selectedAtom && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  <AtomTooltip atom={selectedAtom} visible={true} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Atom table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="section-label">Top contributing atoms</p>
                <p className="text-[9px]" style={{ color: 'rgba(100,116,139,0.5)' }}>
                  Click to inspect
                </p>
              </div>
              <AtomTable
                atoms={atoms}
                selectedAtom={selectedAtom}
                onSelect={setSelectedAtom}
              />
            </div>

            {/* Color legend */}
            <div className="flex flex-wrap gap-2 text-[9px]">
              {Object.entries(LEVEL_CFG).map(([level, cfg]) => (
                <span key={level} className="flex items-center gap-1"
                      style={{ color: 'rgba(100,116,139,0.6)' }}>
                  <span className="w-2 h-2 rounded-full inline-block"
                        style={{ background: cfg.color }} />
                  {cfg.label}
                </span>
              ))}
            </div>

            {/* Human-in-the-loop note */}
            <div className="rounded-xl p-3 text-[10px] leading-relaxed"
                 style={{ background: 'rgba(14,165,233,0.05)',
                          border: '1px solid rgba(14,165,233,0.1)',
                          color: 'rgba(148,163,184,0.65)' }}>
              <span className="font-semibold" style={{ color: '#7dd3fc' }}>
                <Zap size={9} className="inline mr-1" />
                Human-in-the-Loop:{' '}
              </span>
              Click any atom in the list to see its toxicity contribution.
              A chemist can use this to identify which specific atoms to modify
              to reduce toxicity while preserving drug activity.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
