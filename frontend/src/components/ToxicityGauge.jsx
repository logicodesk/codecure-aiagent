import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

/**
 * ToxicityGauge — semicircle arc gauge
 *
 * Math:
 *   Full semicircle arc length = π × r
 *   strokeDasharray = π × r          (only the top half is visible)
 *   strokeDashoffset = π × r × (1 - pct/100)
 *
 * The circle is rotated 180° so the arc starts at the left and sweeps right.
 * strokeDasharray covers the full circumference (2πr) but only the top half
 * (πr) is the visible semicircle — the bottom half is hidden behind the clip.
 */
export default function ToxicityGauge({ probability, toxic }) {
  const clamped = Math.min(1, Math.max(0, isFinite(probability) ? probability : 0))
  const pct     = Math.round(clamped * 100)

  // ── Geometry ──────────────────────────────────────────────
  const SIZE  = 120          // viewBox / rendered size
  const SW    = 10           // stroke width
  const cx    = SIZE / 2     // 60
  const cy    = SIZE / 2     // 60  (circle center — bottom half clipped)
  const r     = (SIZE - SW * 2) / 2   // 50

  // Full circumference — dasharray must equal this
  const C         = 2 * Math.PI * r          // ≈ 314.16
  // Semicircle arc length (the visible half)
  const SEMI      = Math.PI * r              // ≈ 157.08
  // How much of the semicircle to fill
  const fillLen   = SEMI * (pct / 100)
  // dashoffset: start full (empty), animate to filled
  const dashOffset = SEMI - fillLen          // 0 = full, SEMI = empty

  // ── Color ─────────────────────────────────────────────────
  const color =
    pct >= 70 ? '#ef4444' :   // red   — high risk
    pct >= 40 ? '#f97316' :   // orange — moderate
                '#22c55e'     // green  — safe

  const glowColor =
    pct >= 70 ? 'rgba(239,68,68,0.35)' :
    pct >= 40 ? 'rgba(249,115,22,0.35)' :
                'rgba(34,197,94,0.35)'

  const label =
    pct >= 70 ? 'High Risk' :
    pct >= 40 ? 'Moderate'  :
    pct >= 25 ? 'Low Risk'  :
                'Safe'

  // ── Tick positions (0, 25, 50, 75, 100) ──────────────────
  // Ticks sit on the semicircle arc (angles 180°→0° = π→0 rad)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const angle = Math.PI * (1 - t)   // 180° at t=0, 0° at t=1
    return {
      x: cx + r * Math.cos(angle),
      y: cy - r * Math.sin(angle),    // SVG y is inverted
      label: Math.round(t * 100),
    }
  })

  const filterId = `gauge-glow-${pct}`

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <div className="relative" style={{ width: SIZE, height: SIZE / 2 + 18 }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE / 2 + 4}`}
          width={SIZE}
          height={SIZE / 2 + 4}
          aria-label={`Toxicity gauge: ${pct}%`}
          overflow="visible"
        >
          <defs>
            {/* Glow filter */}
            <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Gradient along arc */}
            <linearGradient id="arc-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#22c55e" />
              <stop offset="50%"  stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          {/* ── Background track (full semicircle) ── */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={SW}
            strokeLinecap="round"
            strokeDasharray={`${SEMI} ${C}`}
            transform={`rotate(180 ${cx} ${cy})`}
          />

          {/* ── Foreground arc (animated) ── */}
          {pct > 0 && (
            <motion.circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={color}
              strokeWidth={SW}
              strokeLinecap="round"
              strokeDasharray={`${SEMI} ${C}`}
              transform={`rotate(180 ${cx} ${cy})`}
              filter={`url(#${filterId})`}
              initial={{ strokeDashoffset: SEMI }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
            />
          )}

          {/* ── Tick dots ── */}
          {ticks.map(({ x, y, label: tl }) => (
            <circle
              key={tl}
              cx={x.toFixed(2)}
              cy={y.toFixed(2)}
              r={1.5}
              fill="rgba(100,116,139,0.4)"
            />
          ))}
        </svg>

        {/* ── Centre label ── */}
        <div
          className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none"
          style={{ bottom: 18 }}
        >
          <motion.p
            key={pct}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
            className="text-xl font-black leading-none tabular-nums"
            style={{ color, textShadow: `0 0 12px ${glowColor}` }}
          >
            {pct}%
          </motion.p>
          <p className="text-[9px] font-semibold leading-tight mt-0.5" style={{ color }}>
            {label}
          </p>
        </div>
      </div>

      {/* ── Tick labels ── */}
      <div
        className="flex justify-between text-[8px]"
        style={{ width: SIZE, padding: '0 4px', color: 'rgba(100,116,139,0.45)' }}
      >
        {ticks.map(({ label: tl }) => <span key={tl}>{tl}</span>)}
      </div>
    </div>
  )
}
