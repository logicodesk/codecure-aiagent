import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Activity, ChevronDown, ChevronUp, Info, Maximize2, X, Target } from 'lucide-react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'

// Risk level bar
function RiskBar({ score }) {
  const pct = Math.round(score * 100)
  const color = score >= 0.75 ? '#ef4444' : score >= 0.55 ? '#f97316' : '#eab308'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden"
           style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
              initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-[10px] font-mono w-8 text-right"
            style={{ color }}>{pct}%</span>
    </div>
  )
}

// Single organ card
function OrganCard({ organ, index }) {
  const [open, setOpen] = useState(false)
  const levelBg = organ.risk_level === 'high'
    ? 'rgba(239,68,68,0.07)'
    : organ.risk_level === 'medium'
    ? 'rgba(249,115,22,0.07)'
    : 'rgba(234,179,8,0.07)'
  const levelBorder = organ.risk_level === 'high'
    ? 'rgba(239,68,68,0.18)'
    : organ.risk_level === 'medium'
    ? 'rgba(249,115,22,0.18)'
    : 'rgba(234,179,8,0.18)'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-xl overflow-hidden"
      style={{ background: levelBg, border: `1px solid ${levelBorder}` }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="text-base flex-shrink-0">{organ.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold truncate"
                  style={{ color: organ.color }}>{organ.organ}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold capitalize flex-shrink-0"
                  style={{ background: `${organ.color}22`, color: organ.color,
                           border: `1px solid ${organ.color}44` }}>
              {organ.risk_level}
            </span>
          </div>
          <RiskBar score={organ.risk_score} />
        </div>
        {open ? <ChevronUp size={12} style={{ color: 'rgba(100,116,139,0.5)', flexShrink: 0 }} />
               : <ChevronDown size={12} style={{ color: 'rgba(100,116,139,0.5)', flexShrink: 0 }} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2"
                 style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] pt-2" style={{ color: 'rgba(148,163,184,0.7)' }}>
                {organ.description}
              </p>
              {organ.mechanisms?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wider"
                     style={{ color: 'rgba(100,116,139,0.6)' }}>Mechanisms</p>
                  {organ.mechanisms.map((m, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px]"
                         style={{ color: 'rgba(148,163,184,0.75)' }}>
                      <span className="mt-0.5 flex-shrink-0" style={{ color: organ.color }}>→</span>
                      {m}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function OrganToxicityPanel({ organToxicity }) {
  const [expanded, setExpanded] = useState(true)
  const [isMaximized, setIsMaximized] = useState(false)
  if (!organToxicity) return null

  const { organs = [], organ_count, no_animal_testing_note } = organToxicity

  const chartData = [
    { subject: 'Hepatotoxicity', A: 0, fullMark: 100 },
    { subject: 'Cardiotoxicity', A: 0, fullMark: 100 },
    { subject: 'Nephrotoxicity', A: 0, fullMark: 100 },
    { subject: 'Neurotoxicity',  A: 0, fullMark: 100 },
    { subject: 'Pulmonary',      A: 0, fullMark: 100 },
  ]

  organs.forEach(o => {
    let axis = chartData.find(c => o.organ.includes(c.subject.replace('toxicity',''))) 
               || chartData.find(c => c.subject === 'Hepatotoxicity') 
    axis.A = Math.round(o.risk_score * 100)
    axis.subject = o.organ
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(249,115,22,0.1)' }}>
            <Activity size={13} style={{ color: '#fb923c' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#fed7aa' }}>
            Organ Toxicity (ToxKG)
          </span>
          {organ_count > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171',
                           border: '1px solid rgba(239,68,68,0.2)' }}>
              {organ_count} organ{organ_count !== 1 ? 's' : ''} at risk
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
           <button
            onClick={(e) => { e.stopPropagation(); setIsMaximized(true); }}
            className="p-1.5 rounded-lg transition-all hover:bg-white/5"
            style={{ color: 'rgba(14,165,233,0.7)' }}
            title="Expand View"
          >
            <Maximize2 size={13} />
          </button>
          <button onClick={() => setExpanded(v => !v)}
                  style={{ color: 'rgba(100,116,139,0.5)' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMaximized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 sm:p-6"
            style={{ background: 'rgba(5,7,12,0.95)', backdropFilter: 'blur(12px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass w-full max-w-6xl max-h-full overflow-y-auto p-8 md:p-12 space-y-8 relative shadow-2xl"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <button
                onClick={() => setIsMaximized(false)}
                className="absolute top-8 right-8 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors z-10"
              >
                <X size={24} className="text-slate-400" />
              </button>

              <div className="space-y-10">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-lg">
                    <Activity size={32} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-100">Organ Toxicity Analysis</h2>
                    <p className="text-slate-400">Deep-learning based risk assessment for systemic toxicity</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                   <div className="space-y-8">
                      <div className="glass p-8 rounded-3xl space-y-6">
                         <div className="flex items-center gap-3">
                            <Target size={20} className="text-orange-400" />
                            <h3 className="text-xl font-bold text-slate-200">Systemic Risk Map</h3>
                         </div>
                         <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <Tooltip 
                                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '14px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}
                                  itemStyle={{ color: '#fb923c' }}
                                />
                                <Radar name="Risk Index" dataKey="A" stroke="#fb923c" strokeWidth={3} fill="#fb923c" fillOpacity={0.4} />
                              </RadarChart>
                            </ResponsiveContainer>
                         </div>
                      </div>

                      <div className="p-6 rounded-2xl bg-brand-500/5 border border-brand-500/10">
                         <p className="text-sm text-slate-300 leading-relaxed italic">
                           "This AI model analyzes structural fingerprints against the ToxKG (Toxicity Knowledge Graph) 
                           to identify potential organ-specific adverse outcomes without animal experimentation."
                         </p>
                      </div>
                   </div>

                   <div className="space-y-6">
                      <h3 className="text-lg font-bold text-slate-300 px-2 uppercase tracking-widest">Detailed Organ Breakdown</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {organs.map((o, i) => (
                           <div key={i} className="glass p-5 rounded-2xl border border-white/5 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-2xl">{o.icon}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                                      style={{ background: `${o.color}11`, color: o.color, border: `1px solid ${o.color}33` }}>
                                  {o.risk_level}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-200">{o.organ}</h4>
                              <RiskBar score={o.risk_score} />
                              <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">{o.description}</p>
                           </div>
                         ))}
                         {organs.length === 0 && (
                           <div className="col-span-full py-12 text-center text-slate-500 italic">
                             No high-risk signals detected for systemic organs.
                           </div>
                         )}
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            {/* Visual Radar Chart */}
            <div className="h-56 w-full -mt-4 mb-2">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={chartData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(148,163,184,0.8)', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#fed7aa' }}
                  />
                  <Radar name="Risk Level" dataKey="A" stroke="#fb923c" fill="#fb923c" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {organs.length === 0 ? (
              <div className="flex items-center gap-2 text-xs py-2"
                   style={{ color: 'rgba(100,116,139,0.6)' }}>
                <Info size={12} />
                No organ-level toxicity signals detected
              </div>
            ) : (
              <div className="space-y-2">
                {organs.map((organ, i) => (
                  <OrganCard key={organ.organ} organ={organ} index={i} />
                ))}
              </div>
            )}

            <div className="rounded-xl p-3 text-[10px] leading-relaxed"
                 style={{ background: 'rgba(34,197,94,0.05)',
                          border: '1px solid rgba(34,197,94,0.12)',
                          color: 'rgba(148,163,184,0.65)' }}>
              <span className="font-semibold" style={{ color: '#4ade80' }}>
                🐾 Animal Testing Displacement:{' '}
              </span>
              {no_animal_testing_note}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
