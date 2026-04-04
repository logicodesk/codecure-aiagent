import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion'
import { Sparkles, TrendingUp, TrendingDown, Brain, ChevronDown, ChevronUp, Info, Zap, Maximize2, Target, X } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'

// ── Typewriter ────────────────────────────────────────────────
function Typewriter({ text, speed = 13 }) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    setDisplayed(''); setDone(false)
    let i = 0
    const id = setInterval(() => {
      i++; setDisplayed(text.slice(0, i))
      if (i >= text.length) { clearInterval(id); setDone(true) }
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])
  return (
    <span>
      {displayed}
      {!done && <span className="animate-pulse" style={{ color: '#38bdf8' }}>▍</span>}
    </span>
  )
}

// ── Magnitude ring ────────────────────────────────────────────
function MagnitudeRing({ magnitude, direction }) {
  const colors = {
    toxic:  { high: '#ef4444', medium: '#f97316', low: '#eab308' },
    safe:   { high: '#22c55e', medium: '#84cc16', low: '#a3e635' },
  }
  const c = colors[direction]?.[magnitude] ?? '#64748b'
  const r = magnitude === 'high' ? 5 : magnitude === 'medium' ? 4 : 3
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="flex-shrink-0">
      <circle cx="7" cy="7" r="5" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
      <circle cx="7" cy="7" r={r} fill={c}
        style={{ filter: `drop-shadow(0 0 3px ${c})` }} />
    </svg>
  )
}

// ── Floating tooltip card ─────────────────────────────────────
function ShapTooltip({ item, visible, anchorRef }) {
  const tooltipRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, placement: 'bottom' })

  useEffect(() => {
    if (!visible || !anchorRef.current || !tooltipRef.current) return
    const anchor  = anchorRef.current.getBoundingClientRect()
    const tooltip = tooltipRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Prefer below, fall back to above
    const spaceBelow = vh - anchor.bottom
    const placement  = spaceBelow >= tooltip.height + 12 ? 'bottom' : 'top'

    // Horizontal: center on anchor, clamp to viewport
    let left = anchor.left + anchor.width / 2 - tooltip.width / 2
    left = Math.max(8, Math.min(left, vw - tooltip.width - 8))

    const top = placement === 'bottom'
      ? anchor.bottom + 8
      : anchor.top - tooltip.height - 8

    setPos({ top, left, placement })
  }, [visible, anchorRef])

  const positive = item.shap_value >= 0
  const dirColor  = positive ? '#f87171' : '#4ade80'
  const dirBg     = positive ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)'
  const dirBorder = positive ? 'rgba(239,68,68,0.2)'  : 'rgba(34,197,94,0.2)'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.92, y: pos.placement === 'bottom' ? -6 : 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: pos.placement === 'bottom' ? -4 : 4 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          className="fixed z-[9999] w-64 rounded-2xl p-4 space-y-3 pointer-events-none"
          style={{
            top: pos.top, left: pos.left,
            background: 'rgba(10,14,26,0.97)',
            border: `1px solid ${dirBorder}`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.04)`,
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45"
               style={{
                 background: 'rgba(10,14,26,0.97)',
                 border: `1px solid ${dirBorder}`,
                 ...(pos.placement === 'bottom'
                   ? { top: -6, borderBottom: 'none', borderRight: 'none' }
                   : { bottom: -6, borderTop: 'none', borderLeft: 'none' }),
               }} />

          {/* Feature name + rank */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold leading-tight" style={{ color: '#e2e8f0' }}>
                {item.label || item.feature}
              </p>
              <p className="text-[9px] font-mono mt-0.5" style={{ color: 'rgba(100,116,139,0.6)' }}>
                {item.feature}
              </p>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(100,116,139,0.7)' }}>
              #{item.rank}
            </span>
          </div>

          {/* SHAP value + direction badge */}
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-xl px-3 py-2 text-center"
                 style={{ background: dirBg, border: `1px solid ${dirBorder}` }}>
              <p className="text-[9px] font-medium mb-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>
                SHAP value
              </p>
              <p className="text-base font-bold font-mono" style={{ color: dirColor }}>
                {positive ? '+' : ''}{item.shap_value.toFixed(4)}
              </p>
            </div>
            <div className="flex-1 rounded-xl px-3 py-2 text-center"
                 style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[9px] font-medium mb-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>
                Feature value
              </p>
              <p className="text-sm font-bold font-mono" style={{ color: '#cbd5e1' }}>
                {typeof item.feature_value === 'number' ? item.feature_value.toFixed(3) : '—'}
              </p>
            </div>
          </div>

          {/* Direction + magnitude */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: dirBg, border: `1px solid ${dirBorder}`, color: dirColor }}>
              {positive
                ? <TrendingUp size={10} />
                : <TrendingDown size={10} />
              }
              {positive ? 'Increases risk' : 'Reduces risk'}
            </span>
            <span className="text-[10px] px-2.5 py-1 rounded-full capitalize"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    color: 'rgba(148,163,184,0.7)',
                  }}>
              {item.magnitude} impact
            </span>
          </div>

          {/* Explanation sentence */}
          {item.explanation && (
            <p className="text-[10px] leading-relaxed pt-1"
               style={{
                 color: 'rgba(148,163,184,0.75)',
                 borderTop: '1px solid rgba(255,255,255,0.05)',
                 paddingTop: '0.5rem',
               }}>
              {item.explanation}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Animated bar with glow ────────────────────────────────────
function AnimatedBar({ pct, color, hovered, delay }) {
  return (
    <div className="flex-1 h-2 rounded-full overflow-hidden relative"
         style={{ background: 'rgba(255,255,255,0.05)' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, delay, ease: [0.23, 1, 0.32, 1] }}
        className="h-full rounded-full relative"
        style={{
          background: color,
          boxShadow: hovered ? `0 0 8px ${color.includes('ef4444') ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'}` : 'none',
          transition: 'box-shadow 0.2s ease',
        }}
      />
    </div>
  )
}

// ── Single SHAP row ───────────────────────────────────────────
function ShapRow({ item, maxAbs, index }) {
  const [hovered, setHovered] = useState(false)
  const rowRef = useRef(null)

  const positive  = item.shap_value >= 0
  const barPct    = Math.min((Math.abs(item.shap_value) / (maxAbs || 1)) * 100, 100)
  const barColor  = positive
    ? 'linear-gradient(90deg, #f97316, #ef4444)'
    : 'linear-gradient(90deg, #22c55e, #4ade80)'
  const textColor = positive ? '#f87171' : '#4ade80'
  const accentClr = positive ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)'
  const bgHover   = positive ? 'rgba(239,68,68,0.04)' : 'rgba(34,197,94,0.04)'

  return (
    <>
      <motion.div
        ref={rowRef}
        initial={{ opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.08 + index * 0.055, ease: [0.23, 1, 0.32, 1] }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="rounded-xl px-3 py-2.5 cursor-default select-none relative overflow-hidden"
        style={{
          background: hovered ? bgHover : 'rgba(255,255,255,0.02)',
          border: `1px solid ${hovered ? accentClr : 'rgba(255,255,255,0.04)'}`,
          transition: 'background 0.2s ease, border-color 0.2s ease',
        }}
        whileHover={{ x: 2 }}
      >
        {/* Left accent bar */}
        <motion.div
          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl"
          animate={{ opacity: hovered ? 1 : 0, scaleY: hovered ? 1 : 0.4 }}
          transition={{ duration: 0.2 }}
          style={{ background: positive ? '#ef4444' : '#22c55e',
                   boxShadow: `0 0 6px ${positive ? '#ef4444' : '#22c55e'}` }}
        />

        {/* Row header */}
        <div className="flex items-center gap-2 mb-1.5 pl-1">
          {/* Rank badge */}
          <motion.span
            animate={{ color: hovered ? (positive ? '#f87171' : '#4ade80') : 'rgba(100,116,139,0.45)' }}
            transition={{ duration: 0.2 }}
            className="text-[9px] font-bold w-4 text-center flex-shrink-0 font-mono"
          >
            {item.rank}
          </motion.span>

          {/* Direction icon */}
          <motion.div
            animate={{ scale: hovered ? 1.2 : 1 }}
            transition={{ duration: 0.2 }}
          >
            {positive
              ? <TrendingUp  size={11} style={{ color: '#f87171', flexShrink: 0 }} />
              : <TrendingDown size={11} style={{ color: '#4ade80', flexShrink: 0 }} />
            }
          </motion.div>

          {/* Feature label */}
          <span className="text-[11px] font-medium flex-1 truncate"
                style={{ color: hovered ? '#e2e8f0' : 'rgba(203,213,225,0.75)',
                         transition: 'color 0.2s ease' }}>
            {item.label || item.feature}
          </span>

          {/* Magnitude ring */}
          <MagnitudeRing magnitude={item.magnitude} direction={item.direction} />

          {/* SHAP value */}
          <motion.span
            animate={{ scale: hovered ? 1.05 : 1 }}
            transition={{ duration: 0.15 }}
            className="text-[11px] font-mono font-bold flex-shrink-0"
            style={{ color: textColor }}
          >
            {positive ? '+' : ''}{item.shap_value.toFixed(3)}
          </motion.span>
        </div>

        {/* Bar row */}
        <div className="flex items-center gap-2 pl-1">
          <div className="w-4 flex-shrink-0" />
          <AnimatedBar
            pct={barPct}
            color={barColor}
            hovered={hovered}
            delay={0.12 + index * 0.055}
          />
          <span className="text-[9px] w-8 text-right flex-shrink-0 font-mono"
                style={{ color: hovered ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.4)',
                         transition: 'color 0.2s ease' }}>
            {Math.round(barPct)}%
          </span>
        </div>

        {/* Hover shimmer overlay */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, x: '-100%' }}
              animate={{ opacity: 1, x: '100%' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(90deg, transparent, ${positive ? 'rgba(239,68,68,0.04)' : 'rgba(34,197,94,0.04)'}, transparent)`,
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Floating tooltip — rendered via portal-like fixed positioning */}
      <ShapTooltip item={item} visible={hovered} anchorRef={rowRef} />
    </>
  )
}

// ── Waterfall summary bar ─────────────────────────────────────
function WaterfallSummary({ topFeatures, baseValue }) {
  if (!topFeatures?.length) return null

  const toxicSum = topFeatures.filter(f => f.direction === 'toxic').reduce((s, f) => s + Math.abs(f.shap_value), 0)
  const safeSum  = topFeatures.filter(f => f.direction === 'safe').reduce((s, f) => s + Math.abs(f.shap_value), 0)
  const total    = toxicSum + safeSum || 1
  const toxPct   = Math.round((toxicSum / total) * 100)
  const safePct  = 100 - toxPct

  return (
    <div className="rounded-xl p-3 space-y-2"
         style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center justify-between text-[10px]"
           style={{ color: 'rgba(100,116,139,0.7)' }}>
        <span className="flex items-center gap-1.5">
          <Zap size={9} style={{ color: '#38bdf8' }} />
          SHAP force balance
        </span>
        {baseValue != null && (
          <span className="font-mono">base rate: {Math.round(baseValue * 100)}%</span>
        )}
      </div>

      {/* Segmented bar */}
      <div className="h-3 rounded-full overflow-hidden flex gap-px"
           style={{ background: 'rgba(255,255,255,0.04)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${toxPct}%` }}
          transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
          className="h-full rounded-l-full"
          style={{ background: 'linear-gradient(90deg, #f97316, #ef4444)',
                   boxShadow: '2px 0 8px rgba(239,68,68,0.3)' }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${safePct}%` }}
          transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1], delay: 0.05 }}
          className="h-full rounded-r-full"
          style={{ background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                   boxShadow: '-2px 0 8px rgba(34,197,94,0.3)' }}
        />
      </div>

      <div className="flex justify-between text-[9px] font-mono">
        <span style={{ color: '#f87171' }}>↑ toxic push {toxPct}%</span>
        <span style={{ color: '#4ade80' }}>safe push {safePct}% ↓</span>
      </div>
    </div>
  )
}

// ── Sort control ──────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: 'importance', label: 'Importance' },
  { key: 'toxic',      label: 'Toxic first' },
  { key: 'safe',       label: 'Safe first' },
]

function SortControl({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {SORT_OPTIONS.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className="text-[9px] px-2 py-0.5 rounded-full font-medium transition-all"
          style={{
            background: value === o.key ? 'rgba(14,165,233,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${value === o.key ? 'rgba(14,165,233,0.25)' : 'rgba(255,255,255,0.06)'}`,
            color: value === o.key ? '#38bdf8' : 'rgba(100,116,139,0.7)',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Executive Summary builder ─────────────────────────────────
function buildExecutiveSummary(features, shap_top5, shap_explanation, ai_text) {
  const topFeats = shap_explanation?.top_features || shap_top5 || []
  const topDriver = topFeats[0]?.label || topFeats[0]?.feature || null
  const toxicDrivers = topFeats.filter(f => (f.direction || (f.shap_value >= 0 ? 'toxic' : 'safe')) === 'toxic')
  const logp = features?.LogP
  const mw = features?.MolWeight
  const aromatic = features?.AromaticRings

  const parts = []
  if (topDriver) parts.push(`primarily driven by ${topDriver}`)
  if (logp > 5) parts.push('high lipophilicity')
  if (aromatic >= 3) parts.push('multiple aromatic rings')
  if (mw > 500) parts.push('high molecular weight')

  if (parts.length === 0) return null
  return `This compound shows notable toxicity characteristics ${parts.slice(0, 3).join(', ')}.`
}

// ── Main component ────────────────────────────────────────────
export default function InsightBox({ insight, features, shap_top5, ai_text, shap_explanation }) {
  const [showAll,         setShowAll]         = useState(false)
  const [showDescriptors, setShowDescriptors] = useState(false)
  const [sortBy,          setSortBy]          = useState('importance')
  const [isMaximized,     setIsMaximized]     = useState(false)

  const featureItems = features ? Object.entries(features).slice(0, 8) : []
  const displayText  = ai_text || insight

  const executiveSummary = buildExecutiveSummary(features, shap_top5, shap_explanation, ai_text)

  // Prefer full shap_explanation, fall back to shap_top5
  const shapData = shap_explanation?.top_features?.length
    ? shap_explanation
    : {
        top_features: (shap_top5 ?? []).map((s, i) => ({
          rank: i + 1,
          feature: s.feature,
          label: s.feature.replace(/_/g, ' '),
          shap_value: s.shap_value,
          feature_value: 0,
          direction: s.shap_value >= 0 ? 'toxic' : 'safe',
          magnitude: Math.abs(s.shap_value) > 0.1 ? 'high' : 'medium',
          explanation: null,
        })),
        base_value: null,
        model_used: null,
        shap_available: (shap_top5?.length ?? 0) > 0,
      }

  // Sort features
  const allFeatures = [...(shapData.top_features ?? [])].sort((a, b) => {
    if (sortBy === 'toxic') {
      if (a.direction !== b.direction) return a.direction === 'toxic' ? -1 : 1
    } else if (sortBy === 'safe') {
      if (a.direction !== b.direction) return a.direction === 'safe' ? -1 : 1
    }
    return Math.abs(b.shap_value) - Math.abs(a.shap_value)
  })

  const visibleFeatures = showAll ? allFeatures : allFeatures.slice(0, 5)
  const maxAbs = allFeatures.length
    ? Math.max(...allFeatures.map(f => Math.abs(f.shap_value)))
    : 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass p-5 space-y-5 relative"
    >
      <button
        onClick={() => setIsMaximized(true)}
        className="absolute top-4 right-4 p-1.5 rounded-lg transition-all hover:bg-white/5 opacity-40 hover:opacity-100 z-10"
        style={{ color: 'rgba(14,165,233,0.7)' }}
        title="Maximize Analysis"
      >
        <Maximize2 size={14} />
      </button>

      <AnimatePresence>
        {isMaximized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 sm:p-6"
            style={{ background: 'rgba(5,7,12,0.98)', backdropFilter: 'blur(16px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass w-full max-w-6xl max-h-full overflow-y-auto p-10 md:p-14 space-y-10 relative shadow-2xl"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <button
                onClick={() => setIsMaximized(false)}
                className="absolute top-10 right-10 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors z-10"
              >
                <X size={28} className="text-slate-400" />
              </button>

              <div className="space-y-10">
                <div className="flex items-center gap-5">
                   <div className="p-4 rounded-3xl bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-xl shadow-brand-500/5">
                      <Brain size={40} />
                   </div>
                   <div>
                      <h2 className="text-4xl font-black text-slate-100 tracking-tight">Intelligence Dashboard</h2>
                      <p className="text-slate-400 text-lg">Comprehensive SHAP-grounded toxicity analysis</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                   <div className="space-y-8">
                      <section className="glass p-8 rounded-3xl space-y-6">
                         <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                               <Sparkles size={20} className="text-purple-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-200">AI Predictive Narrative</h3>
                         </div>
                         <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 text-lg leading-relaxed text-slate-300 italic font-medium font-serif">
                            "{displayText}"
                         </div>
                         {executiveSummary && (
                            <div className="p-5 rounded-2xl bg-brand-500/5 border border-brand-500/10 flex items-start gap-4">
                               <Zap size={18} className="text-brand-400 mt-1 shrink-0" />
                               <div>
                                  <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1">Key Insight</p>
                                  <p className="text-sm text-slate-300 leading-relaxed font-medium">{executiveSummary}</p>
                               </div>
                            </div>
                         )}
                      </section>

                      <section className="glass p-8 rounded-3xl space-y-6">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                               <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                                  <TrendingUp size={20} className="text-brand-400" />
                               </div>
                               <h3 className="text-xl font-bold text-slate-200">Waterfall Balance</h3>
                            </div>
                            <span className="text-xs font-mono text-slate-500">Global Score Mapping</span>
                         </div>
                         <WaterfallSummary topFeatures={allFeatures} baseValue={shapData.base_value} />
                         <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                            <p className="text-xs text-slate-400 leading-loose">
                               This visualization shows the net interaction of chemical space features. 
                               The <strong>orange/red</strong> segments represent structural attributes that drive the molecule towards a positive toxicity prediction, 
                               while the <strong>green</strong> segments represent mitigating factors that contribute to a safer profile.
                            </p>
                         </div>
                      </section>
                   </div>

                   <div className="space-y-8">
                       <section className="glass p-8 rounded-3xl space-y-6">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                   <Target size={20} className="text-blue-400" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-200">Feature Attribution</h3>
                             </div>
                             <SortControl value={sortBy} onChange={setSortBy} />
                          </div>
                          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                             {allFeatures.map((item, i) => (
                               <ShapRow key={item.feature} item={item} maxAbs={maxAbs} index={i} />
                             ))}
                          </div>
                       </section>
                   </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── Executive Summary ── */}
      {executiveSummary && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl p-3.5 space-y-1"
          style={{
            background: 'linear-gradient(135deg, rgba(14,165,233,0.06), rgba(139,92,246,0.06))',
            border: '1px solid rgba(14,165,233,0.15)',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Zap size={10} style={{ color: '#38bdf8' }} />
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#38bdf8' }}>
              Executive Summary
            </span>
          </div>
          <p className="text-xs leading-relaxed font-medium" style={{ color: '#cbd5e1' }}>
            {executiveSummary}
          </p>
        </motion.div>
      )}

      {/* ── AI Analysis ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(139,92,246,0.12)' }}>
            <Brain size={13} style={{ color: '#a78bfa' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>AI Analysis</span>
          <span className="ml-auto section-label">SHAP-grounded</span>
        </div>
        <div className="rounded-xl p-3.5 text-sm leading-relaxed"
             style={{
               background: 'rgba(139,92,246,0.06)',
               border: '1px solid rgba(139,92,246,0.12)',
               color: 'rgba(203,213,225,0.9)',
             }}>
          <Typewriter text={displayText} />
        </div>
      </div>

      {/* ── SHAP Explainability Panel ── */}
      {shapData.shap_available && allFeatures.length > 0 && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
              <Sparkles size={13} style={{ color: '#38bdf8' }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: '#7dd3fc' }}>
              SHAP Explainability
            </span>
            {shapData.model_used && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                    style={{ background: 'rgba(14,165,233,0.08)', color: 'rgba(56,189,248,0.7)',
                             border: '1px solid rgba(14,165,233,0.12)' }}>
                {shapData.model_used}
              </span>
            )}
            <span className="ml-auto section-label">{allFeatures.length} features</span>
          </div>

          {/* Sort control */}
          <div className="flex items-center justify-between">
            <span className="text-[9px]" style={{ color: 'rgba(100,116,139,0.5)' }}>Sort by</span>
            <SortControl value={sortBy} onChange={setSortBy} />
          </div>

          {/* Force balance */}
          <WaterfallSummary topFeatures={allFeatures} baseValue={shapData.base_value} />

          {/* Feature rows */}
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {visibleFeatures.map((item, i) => (
                <ShapRow key={item.feature} item={item} maxAbs={maxAbs} index={i} />
              ))}
            </AnimatePresence>
          </div>

          {/* Show more / less */}
          {allFeatures.length > 5 && (
            <motion.button
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowAll(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(100,116,139,0.8)',
              }}
            >
              {showAll
                ? <><ChevronUp size={12} /> Show top 5 only</>
                : <><ChevronDown size={12} /> Show all {allFeatures.length} features</>
              }
            </motion.button>
          )}

          {/* Legend */}
          <div className="flex items-center gap-5 text-[10px]"
               style={{ color: 'rgba(100,116,139,0.6)' }}>
            <span className="flex items-center gap-1.5">
              <TrendingUp size={10} style={{ color: '#f87171' }} />
              <span className="w-6 h-1 rounded-full inline-block"
                    style={{ background: 'linear-gradient(90deg,#f97316,#ef4444)' }} />
              Increases toxicity risk
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingDown size={10} style={{ color: '#4ade80' }} />
              <span className="w-6 h-1 rounded-full inline-block"
                    style={{ background: 'linear-gradient(90deg,#22c55e,#4ade80)' }} />
              Reduces toxicity risk
            </span>
          </div>

          {/* Hover hint */}
          <p className="text-[9px] flex items-center gap-1"
             style={{ color: 'rgba(71,85,105,0.6)' }}>
            <Info size={9} /> Hover any feature row for detailed breakdown
          </p>
        </div>
      )}

      {/* ── Molecular Descriptors (collapsible) ── */}
      {featureItems.length > 0 && (
        <div className="space-y-2">
          <button onClick={() => setShowDescriptors(v => !v)}
                  className="flex items-center gap-2 w-full text-left">
            <p className="section-label flex-1">Molecular Descriptors</p>
            {showDescriptors
              ? <ChevronUp size={11} style={{ color: 'rgba(100,116,139,0.5)' }} />
              : <ChevronDown size={11} style={{ color: 'rgba(100,116,139,0.5)' }} />
            }
          </button>
          <AnimatePresence>
            {showDescriptors && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-1.5 overflow-hidden"
              >
                {featureItems.map(([key, val], i) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex justify-between items-center rounded-lg px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <span className="text-[10px]" style={{ color: 'rgba(100,116,139,0.7)' }}>{key}</span>
                    <span className="text-[11px] font-mono font-semibold" style={{ color: '#cbd5e1' }}>
                      {typeof val === 'number' ? val.toFixed(2) : val}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
