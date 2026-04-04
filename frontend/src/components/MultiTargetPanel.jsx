import { motion } from 'framer-motion'
import { Target, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function MultiTargetPanel({ data }) {
  if (!data?.length) return null
  const toxicCount = data.filter(d => d.toxic).length
  const safeCount  = data.length - toxicCount

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass p-5 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(251,146,60,0.12)' }}>
            <Target size={13} style={{ color: '#fb923c' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#fed7aa' }}>
            Multi-Target Analysis
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171',
                         border: '1px solid rgba(239,68,68,0.2)' }}>
            {toxicCount} flagged
          </span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80',
                         border: '1px solid rgba(34,197,94,0.2)' }}>
            {safeCount} safe
          </span>
        </div>
      </div>

      {/* Summary bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px]"
             style={{ color: 'rgba(100,116,139,0.7)' }}>
          <span>Toxicity coverage</span>
          <span>{Math.round((toxicCount / data.length) * 100)}% of targets</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden flex"
             style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(toxicCount / data.length) * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full"
            style={{ background: 'linear-gradient(90deg, #f97316, #ef4444)' }}
          />
        </div>
      </div>

      {/* Target list */}
      <div className="space-y-1.5">
        {data.map((item, i) => {
          const pct = Math.round(item.probability * 100)
          return (
            <motion.div
              key={item.target}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.04 }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 group transition-all"
              style={{
                background: item.toxic
                  ? 'rgba(239,68,68,0.06)'
                  : 'rgba(255,255,255,0.03)',
                border: item.toxic
                  ? '1px solid rgba(239,68,68,0.12)'
                  : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {item.toxic
                ? <AlertTriangle size={12} style={{ color: '#f87171', flexShrink: 0 }} />
                : <CheckCircle2  size={12} style={{ color: '#4ade80', flexShrink: 0 }} />
              }
              <span className="text-[11px] flex-1 truncate"
                    style={{ color: item.toxic ? '#fca5a5' : 'rgba(148,163,184,0.8)' }}>
                {item.label}
              </span>
              <div className="w-20 h-1.5 rounded-full overflow-hidden"
                   style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: 0.15 + i * 0.04 }}
                  className="h-full rounded-full"
                  style={{
                    background: item.toxic
                      ? 'linear-gradient(90deg, #f97316, #ef4444)'
                      : 'linear-gradient(90deg, #22c55e, #4ade80)',
                  }}
                />
              </div>
              <span className="text-[10px] font-mono w-8 text-right"
                    style={{ color: item.toxic ? '#f87171' : '#4ade80' }}>
                {pct}%
              </span>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
