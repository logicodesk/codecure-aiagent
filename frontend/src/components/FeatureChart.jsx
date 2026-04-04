import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { BarChart2, Hexagon } from 'lucide-react'
import { useState } from 'react'

const BAR_COLORS = [
  '#0ea5e9','#06b6d4','#8b5cf6','#f97316','#ec4899',
  '#a78bfa','#34d399','#facc15','#60a5fa','#f87171',
]

function BarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-xl"
         style={{ background: '#0E1420', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p style={{ color: '#e2e8f0' }} className="font-medium mb-0.5">{payload[0].payload.fullName}</p>
      <p style={{ color: '#38bdf8' }}>{(payload[0].value * 100).toFixed(2)}% importance</p>
    </div>
  )
}

function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-xl"
         style={{ background: '#0E1420', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p style={{ color: '#e2e8f0' }} className="font-medium">{payload[0].payload.feature}</p>
      <p style={{ color: '#a78bfa' }}>{payload[0].value.toFixed(1)}</p>
    </div>
  )
}

export default function FeatureChart({ data }) {
  const [tab, setTab] = useState('bar')
  if (!data?.length) return null

  const chartData = data.slice(0, 10).map(d => ({
    feature:    d.feature.replace('MACCS_', 'M_').replace('Morgan_', 'Mg_').replace('Alert_', 'A_'),
    fullName:   d.feature,
    importance: d.importance,
  }))

  // Radar uses top 8 features, normalized 0–100
  const maxImp = Math.max(...chartData.map(d => d.importance))
  const radarData = chartData.slice(0, 8).map(d => ({
    feature:   d.feature,
    value:     +((d.importance / maxImp) * 100).toFixed(1),
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass p-5 space-y-4"
    >
      {/* Header + tab toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
            <BarChart2 size={13} className="text-brand-400" />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#7dd3fc' }}>
            Feature Importance
          </span>
        </div>
        <div className="flex gap-1 p-0.5 rounded-lg"
             style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[['bar', <BarChart2 size={11} />], ['radar', <Hexagon size={11} />]].map(([key, icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all capitalize"
              style={tab === key
                ? { background: 'linear-gradient(135deg,#0ea5e9,#8b5cf6)', color: 'white' }
                : { color: 'rgba(100,116,139,0.8)' }
              }
            >
              {icon} {key}
            </button>
          ))}
        </div>
      </div>

      {tab === 'bar' && (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
            <XAxis type="number"
              tick={{ fontSize: 9, fill: 'rgba(100,116,139,0.7)' }}
              tickFormatter={v => `${(v * 100).toFixed(1)}%`}
              axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="feature"
              tick={{ fontSize: 9, fill: 'rgba(100,116,139,0.7)' }}
              width={56} axisLine={false} tickLine={false} />
            <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {tab === 'radar' && (
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
            <PolarGrid stroke="rgba(255,255,255,0.06)" />
            <PolarAngleAxis
              dataKey="feature"
              tick={{ fontSize: 8, fill: 'rgba(100,116,139,0.7)' }}
            />
            <PolarRadiusAxis
              angle={30} domain={[0, 100]}
              tick={{ fontSize: 8, fill: 'rgba(100,116,139,0.5)' }}
              axisLine={false}
            />
            <Radar
              name="Importance"
              dataKey="value"
              stroke="#0ea5e9"
              fill="#0ea5e9"
              fillOpacity={0.15}
              strokeWidth={1.5}
            />
            <Tooltip content={<RadarTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      )}

      <p className="text-[10px] text-center" style={{ color: 'rgba(71,85,105,0.7)' }}>
        Top {chartData.length} features from XGBoost ensemble · SHAP-aligned importance
      </p>
    </motion.div>
  )
}
