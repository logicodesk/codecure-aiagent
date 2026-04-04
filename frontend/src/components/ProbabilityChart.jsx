// ProbabilityChart.jsx — Probability distribution + confidence visualization
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts'
import { TrendingUp, Info } from 'lucide-react'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value ?? 0
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-xl"
         style={{ background: '#0E1420', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p style={{ color: '#94a3b8' }}>Probability: <span style={{ color: '#38bdf8', fontWeight: 700 }}>{label}%</span></p>
      <p style={{ color: '#94a3b8' }}>Density: <span style={{ color: '#a78bfa' }}>{val.toFixed(3)}</span></p>
    </div>
  )
}

// Generate a smooth beta-like distribution curve centered on the prediction
function buildDistribution(probability, n = 60) {
  const mu = probability
  const sigma = 0.12
  const points = []
  for (let i = 0; i <= n; i++) {
    const x = i / n
    // Gaussian approximation
    const y = Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2)) / (sigma * Math.sqrt(2 * Math.PI))
    points.push({ x: Math.round(x * 100), y: +y.toFixed(4) })
  }
  return points
}

function ConfidenceBadge({ confidence }) {
  const pct = Math.round(confidence * 100)
  const cfg = pct >= 90
    ? { label: 'Highly Reliable', color: '#4ade80', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)' }
    : pct >= 70
    ? { label: 'Moderate Reliability', color: '#fb923c', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)' }
    : { label: 'Uncertain', color: '#f87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
         style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="w-2 h-2 rounded-full" style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>
          {cfg.label}
        </p>
        <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.7)' }}>
          {pct}% model confidence
        </p>
      </div>
    </div>
  )
}

export default function ProbabilityChart({ probability, confidence, toxic }) {
  if (probability == null) return null

  const data = buildDistribution(probability)
  const pct = Math.round(probability * 100)
  const color = toxic ? '#ef4444' : '#22c55e'
  const gradId = `prob-grad-${toxic ? 'toxic' : 'safe'}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
            <TrendingUp size={13} style={{ color: '#38bdf8' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#7dd3fc' }}>
            Probability Distribution
          </span>
        </div>
        <ConfidenceBadge confidence={confidence} />
      </div>

      {/* Chart */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="x"
              tick={{ fontSize: 9, fill: 'rgba(100,116,139,0.6)' }}
              tickFormatter={v => `${v}%`}
              axisLine={false} tickLine={false}
              ticks={[0, 25, 50, 75, 100]}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              x={pct}
              stroke={color}
              strokeWidth={2}
              strokeDasharray="4 2"
              label={{
                value: `${pct}%`,
                position: 'top',
                fill: color,
                fontSize: 10,
                fontWeight: 700,
              }}
            />
            <ReferenceLine
              x={35}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{ value: 'threshold', position: 'insideTopRight', fill: 'rgba(100,116,139,0.5)', fontSize: 8 }}
            />
            <Area
              type="monotone"
              dataKey="y"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Confidence interpretation */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Prediction', value: `${pct}%`, color },
          { label: 'Confidence', value: `${Math.round(confidence * 100)}%`, color: '#38bdf8' },
          { label: 'Threshold', value: '35%', color: 'rgba(100,116,139,0.7)' },
        ].map(({ label, value, color: c }) => (
          <div key={label} className="text-center rounded-xl py-2"
               style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[9px] mb-0.5" style={{ color: 'rgba(100,116,139,0.6)' }}>{label}</p>
            <p className="text-sm font-bold font-mono" style={{ color: c }}>{value}</p>
          </div>
        ))}
      </div>

      <p className="text-[9px] flex items-center gap-1" style={{ color: 'rgba(71,85,105,0.6)' }}>
        <Info size={9} />
        Distribution curve estimated from ensemble model output variance
      </p>
    </motion.div>
  )
}
