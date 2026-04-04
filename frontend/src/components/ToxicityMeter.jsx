import { useEffect, useId, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Math helpers ──────────────────────────────────────────────
function clamp(v, lo = 0, hi = 100) {
  const n = Number(v)
  return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0
}

/**
 * For a full-circle ring:
 *   C = 2πr
 *   dashArray  = C
 *   dashOffset = C × (1 - pct/100)   → 0 = full ring, C = empty
 *   rotate(-90 cx cy)                 → start from top (12 o'clock)
 */
function ringGeometry(r, pct) {
  const C      = 2 * Math.PI * r
  const offset = C * (1 - clamp(pct) / 100)
  return { C, offset }
}

// ── Color helpers ─────────────────────────────────────────────
function toxicityColor(pct) {
  if (pct >= 70) return { stroke: '#ef4444', glow: 'rgba(239,68,68,0.5)',  label: 'High Risk',  gradId: 'tox-hi'  }
  if (pct >= 40) return { stroke: '#f97316', glow: 'rgba(249,115,22,0.45)', label: 'Moderate',   gradId: 'tox-mid' }
  return               { stroke: '#22c55e', glow: 'rgba(34,197,94,0.45)',  label: 'Safe',       gradId: 'tox-lo'  }
}

// ── Ring config ───────────────────────────────────────────────
// Outer=toxicity, Middle=confidence, Inner=risk
// All rings share the same cx/cy = SIZE/2
const RINGS = [
  {
    key:   'toxicity',
    r:     88,
    sw:    9,
    label: 'Toxicity',
    gradStart: '#22c55e',
    gradMid:   '#f97316',
    gradEnd:   '#ef4444',
    gradId:    'grad-tox',
    glowId:    'glow-tox',
    glowColor: 'rgba(239,68,68,0.6)',
  },
  {
    key:   'confidence',
    r:     68,
    sw:    8,
    label: 'Confidence',
    gradStart: '#0ea5e9',
    gradMid:   '#06b6d4',
    gradEnd:   '#8b5cf6',
    gradId:    'grad-conf',
    glowId:    'glow-conf',
    glowColor: 'rgba(14,165,233,0.55)',
  },
  {
    key:   'risk',
    r:     48,
    sw:    7,
    label: 'Risk Score',
    gradStart: '#a855f7',
    gradMid:   '#ec4899',
    gradEnd:   '#f43f5e',
    gradId:    'grad-risk',
    glowId:    'glow-risk',
    glowColor: 'rgba(168,85,247,0.55)',
  },
]

const SIZE = 200   // viewBox & rendered px
const CX   = SIZE / 2
const CY   = SIZE / 2

// ── Tooltip ───────────────────────────────────────────────────
function Tooltip({ label, value, color, x, y }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 4 }}
      transition={{ duration: 0.15 }}
      className="absolute z-20 pointer-events-none px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap"
      style={{
        left: x, top: y,
        transform: 'translate(-50%, -110%)',
        background: 'rgba(8,12,20,0.92)',
        border: `1px solid ${color}44`,
        color,
        boxShadow: `0 0 12px ${color}33`,
        backdropFilter: 'blur(8px)',
      }}
    >
      {label}: {Math.round(value)}%
    </motion.div>
  )
}

// ── Single animated ring ──────────────────────────────────────
function Ring({ ring, pct, uid, isHighRisk, delay }) {
  const { r, sw, gradId, glowId, glowColor } = ring
  const { C, offset } = ringGeometry(r, pct)

  return (
    <g>
      {/* Track */}
      <circle
        cx={CX} cy={CY} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={sw}
        strokeLinecap="round"
      />

      {/* Filled arc */}
      <motion.circle
        cx={CX} cy={CY} r={r}
        fill="none"
        stroke={`url(#${uid}-${gradId})`}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={C}
        transform={`rotate(-90 ${CX} ${CY})`}
        filter={`url(#${uid}-${glowId})`}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1], delay }}
      />

      {/* Pulse ring for high-risk toxicity */}
      {isHighRisk && ring.key === 'toxicity' && (
        <motion.circle
          cx={CX} cy={CY} r={r}
          fill="none"
          stroke={glowColor}
          strokeWidth={sw + 4}
          strokeLinecap="round"
          strokeDasharray={C}
          transform={`rotate(-90 ${CX} ${CY})`}
          strokeDashoffset={offset}
          animate={{ opacity: [0.15, 0.45, 0.15] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </g>
  )
}

// ── Main component ────────────────────────────────────────────
/**
 * ToxicityMeter
 * @param {number} toxicity   0–100
 * @param {number} confidence 0–100
 * @param {number} risk       0–100
 * @param {number} [size=200] rendered px (square)
 */
export default function ToxicityMeter({
  toxicity   = 0,
  confidence = 0,
  risk       = 0,
  size       = 200,
}) {
  const uid = useId().replace(/:/g, '')   // unique per instance — safe SVG IDs

  const tox  = clamp(toxicity)
  const conf = clamp(confidence)
  const rsk  = clamp(risk)

  const isHighRisk = tox >= 70
  const { label: riskLabel, glow: centerGlow, stroke: centerColor } = toxicityColor(tox)

  const scale = size / SIZE   // allow custom size via CSS transform

  // Tooltip state
  const [tooltip, setTooltip] = useState(null)   // { label, value, color, x, y }
  const svgRef = useRef(null)

  function showTooltip(ring, pct, e) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({
      label: ring.label,
      value: pct,
      color: ring.gradEnd,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  // ── Legend data ───────────────────────────────────────────
  const legendItems = [
    { label: 'Toxicity',   value: tox,  color: toxicityColor(tox).stroke },
    { label: 'Confidence', value: conf, color: '#38bdf8' },
    { label: 'Risk Score', value: rsk,  color: '#a855f7' },
  ]

  return (
    <div className="flex flex-col items-center gap-3 select-none">

      {/* ── SVG meter ── */}
      <div
        className="relative"
        style={{ width: size, height: size }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Tooltip */}
        <AnimatePresence>
          {tooltip && (
            <Tooltip key="tip" {...tooltip} />
          )}
        </AnimatePresence>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={size}
          height={size}
          aria-label={`Toxicity ${tox}%, Confidence ${conf}%, Risk ${rsk}%`}
          overflow="visible"
        >
          <defs>
            {RINGS.map(ring => (
              <g key={ring.key}>
                {/* Conic-style linear gradient (rotated per ring) */}
                <linearGradient
                  id={`${uid}-${ring.gradId}`}
                  x1="0%" y1="0%" x2="100%" y2="100%"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%"   stopColor={ring.gradStart} />
                  <stop offset="50%"  stopColor={ring.gradMid}   />
                  <stop offset="100%" stopColor={ring.gradEnd}   />
                </linearGradient>

                {/* Glow filter */}
                <filter
                  id={`${uid}-${ring.glowId}`}
                  x="-20%" y="-20%" width="140%" height="140%"
                >
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </g>
            ))}

            {/* Radial gradient for center bg */}
            <radialGradient id={`${uid}-center-bg`} cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(14,165,233,0.06)" />
              <stop offset="100%" stopColor="rgba(8,12,20,0)" />
            </radialGradient>
          </defs>

          {/* Center background glow disc */}
          <circle
            cx={CX} cy={CY} r={36}
            fill={`url(#${uid}-center-bg)`}
          />

          {/* Rings — outer to inner */}
          {RINGS.map((ring, i) => {
            const pct = [tox, conf, rsk][i]
            return (
              <g
                key={ring.key}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => showTooltip(ring, pct, e)}
                onMouseMove={e  => showTooltip(ring, pct, e)}
              >
                <Ring
                  ring={ring}
                  pct={pct}
                  uid={uid}
                  isHighRisk={isHighRisk}
                  delay={i * 0.12}
                />
              </g>
            )
          })}

          {/* ── Tick marks (0, 25, 50, 75, 100) on outer ring ── */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => {
            const angle = -Math.PI / 2 + 2 * Math.PI * t
            const outerR = RINGS[0].r + RINGS[0].sw / 2 + 3
            const innerR = RINGS[0].r - RINGS[0].sw / 2 - 3
            return (
              <line
                key={t}
                x1={CX + outerR * Math.cos(angle)}
                y1={CY + outerR * Math.sin(angle)}
                x2={CX + innerR * Math.cos(angle)}
                y2={CY + innerR * Math.sin(angle)}
                stroke="rgba(100,116,139,0.35)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            )
          })}
        </svg>

        {/* ── Center label (HTML overlay — crisp text) ── */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        >
          <motion.span
            key={tox}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.2 }}
            className="text-3xl font-black tabular-nums leading-none"
            style={{
              color: centerColor,
              textShadow: `0 0 20px ${centerGlow}, 0 0 40px ${centerGlow}`,
            }}
          >
            {tox}%
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-[10px] font-bold uppercase tracking-widest mt-1"
            style={{ color: centerColor, opacity: 0.85 }}
          >
            {riskLabel}
          </motion.span>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4">
        {legendItems.map(({ label, value, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.08 }}
            className="flex flex-col items-center gap-1"
          >
            {/* Mini arc indicator */}
            <svg width={28} height={28} viewBox="0 0 28 28">
              <circle cx={14} cy={14} r={10}
                fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={4} />
              <motion.circle
                cx={14} cy={14} r={10}
                fill="none"
                stroke={color}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 10}
                transform="rotate(-90 14 14)"
                initial={{ strokeDashoffset: 2 * Math.PI * 10 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 10 * (1 - value / 100) }}
                transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1], delay: 0.5 + i * 0.12 }}
              />
            </svg>
            <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
              {Math.round(value)}%
            </span>
            <span className="text-[9px] uppercase tracking-wider"
                  style={{ color: 'rgba(100,116,139,0.6)' }}>
              {label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
