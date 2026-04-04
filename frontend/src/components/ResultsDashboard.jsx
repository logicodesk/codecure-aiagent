// ResultsDashboard.jsx — Cinematic animated results cards
import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import {
  ShieldAlert, ShieldCheck, Brain, BarChart2, Atom,
  TrendingUp, TrendingDown, Zap, Info,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ── 3D tilt card ──────────────────────────────────────────────
function TiltCard({ children, className = '', style = {} }) {
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 200, damping: 20 })
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 20 })

  function onMove(e) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    x.set((e.clientX - rect.left) / rect.width - 0.5)
    y.set((e.clientY - rect.top)  / rect.height - 0.5)
  }
  function onLeave() { x.set(0); y.set(0) }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d', ...style }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── Animated number ───────────────────────────────────────────
function AnimNum({ value, decimals = 0, duration = 1200 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const target = parseFloat(value) || 0
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(+(ease * target).toFixed(decimals))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value, decimals, duration])
  return <>{display}</>
}

// ── Toxicity verdict card ─────────────────────────────────────
function ToxicityCard({ result }) {
  const toxic = result.toxic
  const pct   = Math.round((result.probability ?? 0) * 100)
  const conf  = Math.round((result.confidence  ?? 0) * 100)
  const color = toxic ? '#ef4444' : '#22c55e'
  const riskLabel = pct >= 70 ? 'HIGH RISK' : pct >= 35 ? 'MODERATE RISK' : 'LOW RISK'

  return (
    <TiltCard
      className="rounded-3xl p-6 space-y-5 relative overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${toxic ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
        boxShadow: toxic
          ? '0 0 40px rgba(239,68,68,0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 0 40px rgba(34,197,94,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none"
           style={{
             background: `radial-gradient(ellipse at 50% 0%, ${toxic ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)'} 0%, transparent 70%)`,
           }} />

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="p-3 rounded-2xl"
            style={{ background: toxic ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)' }}
          >
            {toxic
              ? <ShieldAlert size={28} style={{ color }} />
              : <ShieldCheck  size={28} style={{ color }} />
            }
          </motion.div>
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1"
               style={{ color: 'rgba(100,116,139,0.6)' }}>Prediction</p>
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-3xl font-black tracking-tight"
              style={{ color }}
            >
              {toxic ? 'TOXIC' : 'NON-TOXIC'}
            </motion.p>
          </div>
        </div>
        <span className="text-[10px] font-black px-3 py-1.5 rounded-full"
              style={{
                background: pct >= 70 ? 'rgba(239,68,68,0.12)' : pct >= 35 ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)',
                color: pct >= 70 ? '#f87171' : pct >= 35 ? '#fb923c' : '#4ade80',
                border: `1px solid ${pct >= 70 ? 'rgba(239,68,68,0.25)' : pct >= 35 ? 'rgba(249,115,22,0.25)' : 'rgba(34,197,94,0.25)'}`,
              }}>
          {riskLabel}
        </span>
      </div>

      {/* Big percentage */}
      <div className="relative text-center py-4">
        <motion.p
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          className="text-7xl font-black"
          style={{ color, textShadow: `0 0 40px ${color}60` }}
        >
          <AnimNum value={pct} />%
        </motion.p>
        <p className="text-xs mt-1" style={{ color: 'rgba(100,116,139,0.6)' }}>
          Toxicity probability
        </p>
      </div>

      {/* Bars */}
      <div className="space-y-3">
        {[
          { label: 'Toxicity', value: pct, color },
          { label: 'Confidence', value: conf, color: '#38bdf8' },
        ].map(({ label, value: v, color: c }) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-xs" style={{ color: 'rgba(100,116,139,0.7)' }}>
              <span>{label}</span>
              <span className="font-bold" style={{ color: c }}>{v}%</span>
            </div>
            <div className="h-2 rounded-full" st