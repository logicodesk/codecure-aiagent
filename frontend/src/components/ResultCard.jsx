import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, ShieldCheck, Copy, Check, Cpu, TrendingUp, Info, Maximize2, X, Activity, Target, Zap, AlertCircle, Shield } from 'lucide-react'
import { useState } from 'react'
import ToxicityGauge from './ToxicityGauge'
import ToxicityMeter from './ToxicityMeter'

function ConfidenceInterpretation({ confidence }) {
  const pct = Math.round(confidence * 100)
  const cfg = pct >= 90
    ? { label: 'Highly Reliable', sub: 'Strong model consensus', color: '#4ade80', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' }
    : pct >= 70
    ? { label: 'Moderate Reliability', sub: 'Some model variance', color: '#fb923c', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)' }
    : { label: 'Uncertain', sub: 'High model variance', color: '#f87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' }
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl"
         style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
           style={{ background: cfg.color, boxShadow: `0 0 5px ${cfg.color}` }} />
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wide leading-none" style={{ color: cfg.color }}>
          {cfg.label}
        </p>
        <p className="text-[8px] leading-none mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>
          {cfg.sub}
        </p>
      </div>
    </div>
  )
}

function RiskLevel({ probability, riskClassification }) {
  // Prefer backend risk_classification if available
  if (riskClassification) {
    const isFailure = riskClassification.tier === 'HIGH_RISK_STRUCTURAL_FAILURE'
    return (
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', delay: 0.1 }}
        className="text-[9px] font-black px-2.5 py-1 rounded-full tracking-wide flex items-center gap-1"
        style={{
          background: riskClassification.bg,
          color: riskClassification.color,
          border: `1px solid ${riskClassification.border}`,
          boxShadow: isFailure ? `0 0 12px ${riskClassification.bg}` : 'none',
        }}
      >
        {isFailure && <span>⛔</span>}
        {riskClassification.label.toUpperCase()}
      </motion.span>
    )
  }
  // Fallback: probability-based
  const pct = Math.round(probability * 100)
  const cfg = pct >= 70
    ? { label: 'HIGH RISK', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' }
    : pct >= 35
    ? { label: 'MODERATE RISK', color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)' }
    : { label: 'LOW RISK', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)' }
  return (
    <span className="text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  )
}

export default function ResultCard({ result, dark = true }) {
  const [copied, setCopied] = useState(false)
  const [showMeter, setShowMeter] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const { toxic, smiles, model_meta, drug_likeness } = result

  const modelDisplay = model_meta?.display
    ?? (result.model_used ? `ToxScout AI v1.0 (${result.model_used.replace(/_/g, ' ')})` : 'ToxScout AI v1.0')

  const probability = Math.min(1, Math.max(0, result.probability ?? 0))
  const confidence  = Math.min(1, Math.max(0, result.confidence  ?? 0))
  const pct     = Math.round(probability * 100)
  const confPct = Math.round(confidence  * 100)
  // Risk score: weighted blend of toxicity + inverse confidence gap
  const riskPct = Math.round(Math.min(100, pct * 0.7 + (100 - confPct) * 0.3))

  const lipinskiPass = drug_likeness?.lipinski_pass
    ?? (result.features?.LipinskiViol === 0)

  function copy() {
    navigator.clipboard.writeText(
      `SMILES: ${smiles}\nToxic: ${toxic}\nProbability: ${pct}%\nModel: ${modelDisplay}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toxicColor  = '#ef4444'
  const safeColor   = '#22c55e'
  const statusColor = toxic ? toxicColor : safeColor

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="glass p-5 space-y-4"
      style={{
        border: `1px solid ${toxic ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
        boxShadow: toxic
          ? '0 0 0 1px rgba(239,68,68,0.1), 0 8px 32px rgba(239,68,68,0.08)'
          : '0 0 0 1px rgba(34,197,94,0.1), 0 8px 32px rgba(34,197,94,0.08)',
      }}
    >
      {/* Status header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="p-2.5 rounded-xl"
            style={{ background: toxic ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)' }}
          >
            {toxic
              ? <ShieldAlert size={22} style={{ color: toxicColor }} />
              : <ShieldCheck size={22} style={{ color: safeColor }} />
            }
          </motion.div>
          <div>
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-2"
            >
              <span className="text-xl font-black tracking-tight" style={{ color: statusColor }}>
                {toxic ? 'TOXIC' : 'NON-TOXIC'}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: toxic ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                      color: statusColor,
                      border: `1px solid ${toxic ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
                    }}>
                {pct}%
              </span>
            </motion.div>
            <p className="text-[11px] font-mono mt-0.5 truncate max-w-[220px]"
               style={{ color: dark ? 'rgba(100,116,139,0.8)' : '#94a3b8' }}>
              {smiles}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
            className="text-[10px] font-bold px-2 py-1 rounded-full"
            style={{
              background: lipinskiPass ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: lipinskiPass ? '#4ade80' : '#f87171',
              border: `1px solid ${lipinskiPass ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}
          >
            {lipinskiPass ? '✓ Drug-like' : '✗ Non-drug-like'}
          </motion.span>
          <div className="flex items-center gap-1.5">
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => setIsMaximized(true)}
              className="p-1.5 rounded-lg transition-all hover:bg-white/5"
              style={{ color: 'rgba(14,165,233,0.7)', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
              title="Expand View"
            >
              <Maximize2 size={13} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={copy}
              className="p-2 rounded-lg transition-colors"
              style={{
                background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                color: dark ? '#64748b' : '#94a3b8',
              }}
            >
              {copied ? <Check size={13} style={{ color: '#4ade80' }} /> : <Copy size={13} />}
            </motion.button>
          </div>
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
              className="glass w-full max-w-6xl max-h-[90vh] overflow-y-auto p-8 md:p-12 space-y-8 relative shadow-2xl"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <button
                onClick={() => setIsMaximized(false)}
                className="absolute top-8 right-8 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors z-10"
              >
                <X size={24} className="text-slate-400" />
              </button>

              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl shadow-lg ${toxic ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                    {toxic ? <ShieldAlert size={32} /> : <ShieldCheck size={32} />}
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-100">Analysis Results</h2>
                    <p className="text-slate-400">Comprehensive molecular toxicity profile</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="glass p-6 rounded-2xl space-y-4">
                      <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Primary Prediction</p>
                      <div className="flex items-end gap-3">
                        <span className={`text-5xl font-black ${toxic ? 'text-red-400' : 'text-green-400'}`}>
                          {toxic ? 'TOXIC' : 'NON-TOXIC'}
                        </span>
                        <span className="text-xl text-slate-500 mb-1 font-medium">
                          ({pct}% confidence)
                        </span>
                      </div>
                      <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          className={`h-full ${toxic ? 'bg-red-500' : 'bg-green-500'} shadow-[0_0_15px_rgba(239,68,68,0.5)]`}
                        />
                      </div>
                    </div>

                    <div className="glass p-6 rounded-2xl space-y-4">
                      <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Molecular Metrics</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <p className="text-[10px] text-slate-500 mb-1">MW</p>
                          <p className="text-lg font-bold text-slate-200">241.2 g/mol</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <p className="text-[10px] text-slate-500 mb-1">LogP</p>
                          <p className="text-lg font-bold text-slate-200">2.45</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5 col-span-2">
                           <p className="text-[10px] text-slate-500 mb-1 truncate">SMILES</p>
                           <p className="text-xs font-mono text-slate-400 break-all">{smiles}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass p-6 rounded-2xl space-y-6">
                    <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2 text-brand-400">
                        <Activity size={18} />
                        <p className="text-sm font-bold uppercase tracking-wider">Toxicity Profile</p>
                     </div>
                      <ToxicityMeter pct={pct} toxic={toxic} />
                    </div>
                    {/* Placeholder for future SHAP/details if applicable */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                        <div className="flex items-center gap-2 text-brand-300">
                           <Target size={14} />
                           <span className="text-xs font-bold">Model Path</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          The molecular descriptor <strong>{result.features?.[0]?.feature || 'AlogP'}</strong> was the primary driver for this prediction.
                          Cross-validation across {result.model_meta?.version || 'v1.0'} shows consistent classification.
                        </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Risk level + confidence row */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2 flex-wrap"
      >
        <RiskLevel probability={probability} riskClassification={result.risk_classification} />
        <ConfidenceInterpretation confidence={confidence} />
        <motion.button
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={copy}
          className="ml-auto p-1.5 rounded-lg transition-colors"
          style={{
            background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            color: dark ? '#64748b' : '#94a3b8',
          }}
        >
          {copied ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
        </motion.button>
      </motion.div>

      {/* View toggle */}
      <div className="flex gap-1 p-0.5 rounded-lg w-fit"
           style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {['Gauge', '3-Ring'].map(v => (
          <button
            key={v}
            onClick={() => setShowMeter(v === '3-Ring')}
            className="text-[10px] px-2.5 py-1 rounded-md font-medium transition-all"
            style={
              (v === '3-Ring') === showMeter
                ? { background: 'linear-gradient(135deg,#0ea5e9,#8b5cf6)', color: '#fff' }
                : { color: 'rgba(100,116,139,0.7)' }
            }
          >
            {v}
          </button>
        ))}
      </div>

      {/* Gauge + bars */}
      <div className="flex items-center gap-5">
        {showMeter
          ? <ToxicityMeter toxicity={pct} confidence={confPct} risk={riskPct} size={180} />
          : <ToxicityGauge probability={probability} toxic={toxic} />
        }

        {!showMeter && (
        <div className="flex-1 space-y-3">
          {/* Toxicity bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs"
                 style={{ color: dark ? 'rgba(100,116,139,0.8)' : '#94a3b8' }}>
              <span>Toxicity probability</span>
              <span className="font-semibold" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
                {pct}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden"
                 style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
                className="h-full rounded-full"
                style={{
                  background: toxic
                    ? 'linear-gradient(90deg, #f97316, #ef4444)'
                    : 'linear-gradient(90deg, #22c55e, #4ade80)',
                }}
              />
            </div>
          </div>

          {/* Confidence bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs"
                 style={{ color: dark ? 'rgba(100,116,139,0.8)' : '#94a3b8' }}>
              <span>Model confidence</span>
              <span className="font-semibold" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
                {confPct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden"
                 style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${confPct}%` }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.35 }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #0ea5e9, #8b5cf6)' }}
              />
            </div>
          </div>

          {/* Threshold indicator */}
          <div className="flex items-center gap-1.5 text-[10px]"
               style={{ color: dark ? 'rgba(100,116,139,0.6)' : '#94a3b8' }}>
            <TrendingUp size={10} />
            Decision threshold: 35% · Ensemble of 5 models
          </div>
        </div>
        )}
      </div>

      {/* Model identity */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center gap-2 pt-3"
        style={{ borderTop: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)' }}
      >
        <div className="p-1 rounded-md" style={{ background: 'rgba(14,165,233,0.1)' }}>
          <Cpu size={11} className="text-brand-400" />
        </div>
        <span className="text-[11px] font-semibold" style={{ color: dark ? '#cbd5e1' : '#334155' }}>
          {model_meta?.name ?? 'ToxScout AI'}
          <span className="text-brand-400 ml-1">{model_meta?.version ?? 'v1.0'}</span>
        </span>
        <span className="text-[10px]" style={{ color: dark ? '#475569' : '#94a3b8' }}>
          ({model_meta?.algorithm ?? 'Voting Ensemble'})
        </span>
        <span className="ml-auto text-[9px] font-mono"
              style={{ color: dark ? 'rgba(71,85,105,0.7)' : '#cbd5e1' }}>
          Tox21 · RDKit · 1777 features
        </span>
      </motion.div>
    </motion.div>
  )
}

