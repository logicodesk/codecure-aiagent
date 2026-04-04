// AmesMutagenicityPanel.jsx — Ames Mutagenicity + Multi-Strain Analysis
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FlaskConical, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Info, Maximize2, X, Target, Activity } from 'lucide-react'

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STRAIN_COLORS = {
  TA98:    { color: '#f87171', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'   },
  TA100:   { color: '#fb923c', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.2)'  },
  TA1535:  { color: '#facc15', bg: 'rgba(250,204,21,0.08)',  border: 'rgba(250,204,21,0.2)'  },
  TA1537:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' },
  TA1538:  { color: '#38bdf8', bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.2)'  },
  consensus: { color: '#4ade80', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)'  },
}

function StrainBar({ strain, data, index }) {
  const cfg = STRAIN_COLORS[strain] || STRAIN_COLORS.consensus
  const pct = Math.round((data.probability || 0) * 100)
  const active = data.mutagenic

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl px-3 py-2.5"
      style={{
        background: active ? cfg.bg : 'rgba(255,255,255,0.02)',
        border: `1px solid ${active ? cfg.border : 'rgba(255,255,255,0.05)'}`,
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {active
          ? <AlertTriangle size={11} style={{ color: cfg.color, flexShrink: 0 }} />
          : <CheckCircle2  size={11} style={{ color: '#4ade80', flexShrink: 0 }} />
        }
        <span className="text-xs font-bold" style={{ color: active ? cfg.color : '#4ade80' }}>
          {strain}
        </span>
        <span className="text-[10px] ml-auto font-mono font-bold"
              style={{ color: active ? cfg.color : '#4ade80' }}>
          {pct}%
        </span>
      </div>

      {/* Bar */}
      <div className="h-1.5 rounded-full overflow-hidden"
           style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay: index * 0.06, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: active ? cfg.color : '#4ade80' }}
        />
      </div>

      {/* Mechanism */}
      {data.mechanism && (
        <p className="text-[9px] mt-1" style={{ color: 'rgba(100,116,139,0.7)' }}>
          {data.mechanism}
        </p>
      )}
    </motion.div>
  )
}

export default function AmesMutagenicityPanel({ smiles, result: externalResult }) {
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [open,    setOpen]    = useState(false)
  const [fetched, setFetched] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  // Use external result if passed (from /analyze), else fetch on demand
  const data = externalResult || result

  async function fetchAmes() {
    if (fetched || loading || !smiles) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND}/ames-predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Ames prediction failed')
      setResult(json)
      setFetched(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleToggle() {
    setOpen(o => !o)
    if (!open && !fetched && !externalResult) fetchAmes()
  }

  const strains = data?.strains || {}
  const activeStrains = data?.active_strains || []
  const consensusProb = data?.consensus_prob
  const mutagenic = data?.mutagenic

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <div
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors group cursor-pointer"
        style={{ background: 'rgba(255,255,255,0.03)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(251,146,60,0.12)' }}>
            <FlaskConical size={13} style={{ color: '#fb923c' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#fed7aa' }}>
            Ames Mutagenicity
          </span>
          {data && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{
                    background: mutagenic ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                    color: mutagenic ? '#f87171' : '#4ade80',
                    border: `1px solid ${mutagenic ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
                  }}>
              {mutagenic ? `⚠ ${activeStrains.length} strain(s)` : '✓ Non-mutagenic'}
            </span>
          )}
          {loading && <Loader2 size={12} className="animate-spin" style={{ color: '#fb923c' }} />}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setIsMaximized(true); if(!fetched && !externalResult) fetchAmes(); }}
            className="p-1.5 rounded-lg transition-all hover:bg-white/5"
            style={{ color: 'rgba(14,165,233,0.7)' }}
            title="Expand View"
          >
            <Maximize2 size={13} />
          </button>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={13} style={{ color: '#64748b' }} />
          </motion.div>
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
              className="glass w-full max-w-5xl max-h-full overflow-y-auto p-8 md:p-12 space-y-8 relative shadow-2xl"
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
                  <div className={`p-3 rounded-2xl shadow-lg ${mutagenic ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                    <FlaskConical size={32} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-100">Ames Mutagenicity Profile</h2>
                    <p className="text-slate-400">Predicted genotoxic potential across Salmonella strains</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                     <div className="glass p-6 rounded-2xl space-y-4">
                        <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Overall Prediction</p>
                        <div className="flex items-end gap-3">
                          <span className={`text-5xl font-black ${mutagenic ? 'text-red-400' : 'text-green-400'}`}>
                            {mutagenic ? 'POSITIVE' : 'NEGATIVE'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">
                          {mutagenic
                            ? 'Compound is predicted to induce genetic mutations in Salmonella strains. This is a primary indicator of potential carcinogenicity.'
                            : 'No significant mutagenic potential detected under standardized conditions across the core tester strains.'}
                        </p>
                     </div>

                     {Object.keys(strains).length > 0 && (
                       <div className="glass p-6 rounded-2xl space-y-4">
                         <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Strain Analysis Details</p>
                         <div className="grid grid-cols-2 gap-3">
                           {Object.entries(strains).map(([strain, strainData]) => (
                             <div key={strain} className="flex flex-col p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="text-xs font-bold text-slate-300 mb-2">{strain}</span>
                                <div className="flex items-center justify-between">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${strainData.mutagenic ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                                    {strainData.mutagenic ? 'POSITIVE' : 'NEGATIVE'}
                                  </span>
                                  <span className="text-[10px] text-slate-500">{Math.round((strainData.probability || 0)*100)}%</span>
                                </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                  </div>

                  <div className="glass p-6 rounded-2xl space-y-6">
                    <div className="flex items-center gap-2 text-brand-400">
                      <Target size={18} />
                      <p className="text-sm font-bold uppercase tracking-wider">Metabolic Activation (S9)</p>
                    </div>

                    <div className="p-5 rounded-2xl border border-dashed border-white/10 bg-white/5 space-y-4">
                       <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">S9- Mix (Base Strains)</span>
                          <span className={`text-xs font-bold ${mutagenic ? 'text-red-400' : 'text-green-400'}`}>
                             {mutagenic ? '+ Found' : '- Clear'}
                          </span>
                       </div>
                       <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">S9+ Mix (Rat Liver Prep)</span>
                          <span className={`text-xs font-bold ${mutagenic ? 'text-yellow-400' : 'text-green-400'}`}>
                             {mutagenic ? '+ Activation likely' : '- Clear'}
                          </span>
                       </div>
                    </div>

                    <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/10">
                       <div className="flex items-center gap-2 text-brand-300 mb-2">
                          <Activity size={14} />
                          <span className="text-xs font-bold uppercase tracking-widest">Model Synthesis</span>
                       </div>
                       <p className="text-xs text-slate-400 leading-relaxed italic">
                         Predictive Ames analysis utilizes an ensemble of Gradient Boosting models trained on 10,000+ consensus records.
                         Results incorporate structural alert checks for various genotoxic functional groups.
                       </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="p-4 space-y-3">
              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl text-xs"
                     style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                              color: '#f87171' }}>
                  <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p className="font-semibold mb-0.5">Ames models not available</p>
                    <p style={{ color: 'rgba(248,113,113,0.7)' }}>
                      Train first: <code className="font-mono">python drug_toxicity/ames_pipeline.py</code>
                    </p>
                  </div>
                </div>
              )}

              {/* No data yet */}
              {!data && !loading && !error && (
                <p className="text-xs text-center py-2" style={{ color: '#64748b' }}>
                  Loading Ames strain predictions…
                </p>
              )}

              {/* Results */}
              {data && (
                <>
                  {/* Consensus summary */}
                  {consensusProb != null && (
                    <div className="flex items-center gap-3 p-3 rounded-xl"
                         style={{
                           background: mutagenic ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
                           border: `1px solid ${mutagenic ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}`,
                         }}>
                      <div className="flex-1">
                        <p className="text-xs font-bold" style={{ color: mutagenic ? '#f87171' : '#4ade80' }}>
                          {mutagenic ? '⚠ Mutagenic' : '✓ Non-Mutagenic'}
                        </p>
                        <p className="text-[10px]" style={{ color: '#64748b' }}>
                          Consensus probability: {Math.round(consensusProb * 100)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black font-mono"
                           style={{ color: mutagenic ? '#f87171' : '#4ade80' }}>
                          {Math.round(consensusProb * 100)}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Per-strain bars */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-semibold uppercase tracking-widest"
                       style={{ color: 'rgba(100,116,139,0.6)' }}>
                      Per-Strain Predictions
                    </p>
                    {Object.entries(strains)
                      .filter(([s]) => s !== 'consensus')
                      .map(([strain, sdata], i) => (
                        <StrainBar key={strain} strain={strain} data={sdata} index={i} />
                      ))}
                  </div>

                  {/* Interpretation */}
                  {data.interpretation && (
                    <div className="p-3 rounded-xl text-xs leading-relaxed"
                         style={{ background: 'rgba(255,255,255,0.02)',
                                  border: '1px solid rgba(255,255,255,0.06)',
                                  color: '#94a3b8' }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Info size={10} style={{ color: '#38bdf8' }} />
                        <span className="text-[9px] font-bold uppercase tracking-widest"
                              style={{ color: '#38bdf8' }}>Interpretation</span>
                      </div>
                      {data.interpretation}
                    </div>
                  )}

                  {/* Info footer */}
                  <p className="text-[9px]" style={{ color: 'rgba(71,85,105,0.6)' }}>
                    Ames test uses <em>S. typhimurium</em> strains to detect mutagenicity.
                    TA98/TA1537/TA1538 detect frameshifts; TA100/TA1535 detect base-pair substitutions.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
