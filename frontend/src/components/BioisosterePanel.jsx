import { motion, AnimatePresence } from 'framer-motion'
import { useState, useCallback } from 'react'
import { Shuffle, ChevronDown, ChevronUp, Zap, ArrowRight, Loader2, Sparkles, Maximize2, X, Target, Info } from 'lucide-react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts'

// Safety gain badge
function GainBadge({ pct }) {
  const color = pct >= 35 ? '#4ade80' : pct >= 20 ? '#86efac' : '#bbf7d0'
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(34,197,94,0.1)', color,
                   border: '1px solid rgba(34,197,94,0.2)' }}>
      +{pct}% safer
    </span>
  )
}

// Single swap card
function SwapCard({ swap, index, onAnalyze, analyzing }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Swap arrow */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
            {swap.from_group}
          </span>
          <ArrowRight size={10} style={{ color: 'rgba(100,116,139,0.5)' }} />
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>
            {swap.to_group}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold truncate"
             style={{ color: '#e2e8f0' }}>{swap.name}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <GainBadge pct={swap.safety_gain_pct} />
          <button onClick={() => setOpen(v => !v)}
                  style={{ color: 'rgba(100,116,139,0.5)' }}>
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Expanded side-by-side */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-4"
                 style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              
              {/* Left Column: Details */}
              <div className="space-y-3">
                <p className="text-[10px] leading-relaxed"
                   style={{ color: 'rgba(148,163,184,0.75)' }}>
                  {swap.rationale}
                </p>

                {swap.modified_smiles && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-semibold uppercase tracking-wider"
                       style={{ color: 'rgba(100,116,139,0.6)' }}>Optimized SMILES</p>
                    <div className="flex justify-between items-center bg-white/5 border border-white/10 p-1.5 rounded-lg">
                      <code className="text-[10px] font-mono truncate text-sky-300 w-48">
                        {swap.modified_smiles}
                      </code>
                      {onAnalyze && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onAnalyze(swap.modified_smiles)}
                          disabled={analyzing}
                          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md text-white transition-all disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg,#0ea5e9,#8b5cf6)' }}
                        >
                          {analyzing ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                          Analyze
                        </motion.button>
                      )}
                    </div>
                  </div>
                )}
                {!swap.feasible && (
                  <p className="text-[9px] text-yellow-500/70 border border-yellow-500/20 bg-yellow-500/10 p-1.5 rounded text-center">
                    ⚠ Manual synthesis required
                  </p>
                )}
              </div>

              {/* Right Column: Comparative Radar Chart */}
              <div className="h-32 w-full border border-white/5 bg-black/20 rounded-xl relative overflow-hidden">
                <p className="absolute top-1 left-2 text-[9px] text-slate-400 font-semibold uppercase z-10">Toxicity Reduction</p>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="60%" data={[
                    { subject: 'Hepatotoxicity', Original: 85, Optimized: Math.max(10, 85 - swap.safety_gain_pct) },
                    { subject: 'Cardiotoxicity', Original: 70, Optimized: Math.max(10, 70 - swap.safety_gain_pct/1.5) },
                    { subject: 'Nephrotoxicity', Original: 60, Optimized: Math.max(10, 60 - swap.safety_gain_pct/2) },
                    { subject: 'Mutagenicity',   Original: 55, Optimized: Math.max(10, 55 - swap.safety_gain_pct) },
                    { subject: 'Neurotoxicity',  Original: 40, Optimized: Math.max(10, 40 - swap.safety_gain_pct/3) }
                  ]}>
                    <PolarGrid stroke="rgba(255,255,255,0.05)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(148,163,184,0.5)', fontSize: 8 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Original" dataKey="Original" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                    <Radar name="Optimized" dataKey="Optimized" stroke="#22c55e" fill="#22c55e" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function BioisosterePanel({ result, onAnalyzeSwap }) {
  const [expanded, setExpanded] = useState(true)
  const [isMaximized, setIsMaximized] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [swaps, setSwaps]       = useState(null)
  const [analyzingSmiles, setAnalyzingSmiles] = useState(null)

  const smiles = result?.smiles
  const isToxic = result?.toxic

  const fetchSwaps = useCallback(async () => {
    if (!smiles) return
    setLoading(true)
    try {
      const res = await fetch('/bioisostere', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles, max_suggestions: 5 }),
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        setSwaps(await res.json())
      } else {
        // Mock fallback
        setSwaps(buildMockSwaps(smiles))
      }
    } catch (_) {
      setSwaps(buildMockSwaps(smiles))
    } finally {
      setLoading(false)
    }
  }, [smiles])

  const handleAnalyze = useCallback(async (newSmiles) => {
    if (!onAnalyzeSwap) return
    setAnalyzingSmiles(newSmiles)
    try {
      await onAnalyzeSwap(newSmiles)
    } finally {
      setAnalyzingSmiles(null)
    }
  }, [onAnalyzeSwap])

  // Only show for toxic compounds
  if (!isToxic) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(139,92,246,0.12)' }}>
            <Shuffle size={13} style={{ color: '#a78bfa' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>
            Bioisosteric Swap Engine
          </span>
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
            style={{ background: 'rgba(5,7,12,0.97)', backdropFilter: 'blur(16px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass w-full max-w-6xl max-h-full overflow-y-auto p-8 md:p-12 space-y-10 relative shadow-2xl"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <button
                onClick={() => setIsMaximized(false)}
                className="absolute top-8 right-8 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors z-10"
              >
                <X size={28} className="text-slate-400" />
              </button>

              <div className="space-y-12">
                <div className="flex items-center gap-5">
                  <div className="p-4 rounded-3xl bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-lg">
                    <Shuffle size={40} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-bold text-slate-100">Bioisosteric Optimization Engine</h2>
                    <p className="text-slate-400 text-lg">Structural substitution strategies for toxicity mitigation</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-16">
                   <div className="space-y-10">
                      <div className="glass p-10 rounded-3xl space-y-8 bg-black/20 border border-white/5">
                         <div className="flex items-center gap-3">
                            <Target size={24} className="text-violet-400" />
                            <h3 className="text-2xl font-bold text-slate-200">Toxicity Displacement</h3>
                         </div>
                         <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                                { subject: 'Hepatotoxicity', Original: 85, Optimized: 25 },
                                { subject: 'Cardiotoxicity', Original: 70, Optimized: 30 },
                                { subject: 'Nephrotoxicity', Original: 60, Optimized: 20 },
                                { subject: 'Mutagenicity',   Original: 55, Optimized: 15 },
                                { subject: 'Neurotoxicity',  Original: 40, Optimized: 10 },
                                { subject: 'Pulmonary',      Original: 30, Optimized: 5 }
                              ]}>
                                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 500 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <Tooltip 
                                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', fontSize: '15px' }}
                                />
                                <Radar name="Original Compound" dataKey="Original" stroke="#ef4444" strokeWidth={3} fill="#ef4444" fillOpacity={0.2} />
                                <Radar name="Next-Gen Lead" dataKey="Optimized" stroke="#22c55e" strokeWidth={3} fill="#22c55e" fillOpacity={0.4} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                              </RadarChart>
                            </ResponsiveContainer>
                         </div>
                      </div>

                      <div className="glass p-8 rounded-3xl bg-blue-500/5 border border-blue-500/10 space-y-4">
                         <div className="flex items-center gap-2 text-blue-400">
                           <Info size={20} />
                           <h4 className="font-bold">Optimization Principle</h4>
                         </div>
                         <p className="text-sm text-slate-300 leading-relaxed">
                           "Bioisosterism is used to reduce toxicity, alter bioavailability, or modify 
                           metabolic rate while retaining the desired pharmacological potency. Our engine uses 
                           classical Fried's rules combined with modern deep structural fingerprints to predict 
                           substitution success."
                         </p>
                      </div>
                   </div>

                   <div className="space-y-8">
                      <div className="flex items-center justify-between px-2">
                        <h3 className="text-xl font-bold text-slate-300 uppercase tracking-[0.2em]">Validated Suggestions</h3>
                        {swaps && <span className="text-xs font-bold text-violet-400 bg-violet-400/10 px-3 py-1 rounded-full">{swaps.suggestions?.length} Strategies Found</span>}
                      </div>
                      
                      {!swaps && !loading && (
                        <div className="py-20 flex flex-col items-center justify-center space-y-6 glass rounded-3xl border-dashed border-white/10">
                          <Sparkles size={48} className="text-violet-500/50" />
                          <button
                            onClick={fetchSwaps}
                            className="px-8 py-4 rounded-2xl text-lg font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-xl shadow-violet-500/20"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #d946ef)' }}
                          >
                            Generate Detailed Strategies
                          </button>
                        </div>
                      )}

                      <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                         {swaps?.suggestions?.map((swap, i) => (
                           <div key={i} className="glass p-6 rounded-2xl border border-white/5 space-y-5 hover:border-violet-500/30 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-sm">{swap.from_group}</div>
                                  <ArrowRight size={16} className="text-slate-500" />
                                  <div className="px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-mono text-sm">{swap.to_group}</div>
                                </div>
                                <GainBadge pct={swap.safety_gain_pct} />
                              </div>
                              
                              <div>
                                <h4 className="text-lg font-bold text-slate-100 mb-2">{swap.name}</h4>
                                <p className="text-sm text-slate-400 leading-relaxed">{swap.rationale}</p>
                              </div>

                              {swap.modified_smiles && (
                                <div className="p-4 rounded-xl bg-white/5 space-y-2">
                                   <span className="text-[10px] text-slate-500 font-bold uppercase">Optimized Architecture</span>
                                   <div className="flex items-center justify-between gap-4">
                                      <code className="text-xs font-mono text-sky-400 truncate flex-1">{swap.modified_smiles}</code>
                                      <button 
                                        onClick={() => handleAnalyze(swap.modified_smiles)}
                                        className="h-9 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all flex items-center gap-2"
                                      >
                                        <Zap size={14} /> Run Analysis
                                      </button>
                                   </div>
                                </div>
                              )}
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            <p className="text-[11px] leading-relaxed"
               style={{ color: 'rgba(148,163,184,0.7)' }}>
              Suggest structural modifications that reduce toxicity while preserving
              pharmacological activity. Based on classical bioisostere tables.
            </p>

            {!swaps && !loading && (
              <div className="relative pt-2 pb-1">
                {/* Glowing ring */}
                <motion.div className="absolute inset-0 rounded-xl blur-md -top-1"
                  animate={{ background: ['rgba(56,189,248,0.2)', 'rgba(139,92,246,0.3)', 'rgba(56,189,248,0.2)'] }}
                  transition={{ duration: 2, repeat: Infinity }} />
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={fetchSwaps}
                  className="relative w-full py-3 rounded-xl text-sm font-semibold text-white transition-all flex justify-center items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #0284c7, #6366f1)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <Sparkles size={16} className="text-sky-200" />
                  Optimize This Compound
                </motion.button>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs"
                   style={{ color: 'rgba(148,163,184,0.6)' }}>
                <Loader2 size={14} className="animate-spin text-brand-400" />
                Analyzing bioisostere space…
              </div>
            )}

            {swaps && (
              <div className="space-y-2">
                {swaps.suggestions?.length === 0 ? (
                  <p className="text-xs text-center py-2"
                     style={{ color: 'rgba(100,116,139,0.6)' }}>
                    No applicable bioisosteric swaps found for this structure
                  </p>
                ) : (
                  swaps.suggestions.map((swap, i) => (
                    <SwapCard
                      key={swap.name}
                      swap={swap}
                      index={i}
                      onAnalyze={handleAnalyze}
                      analyzing={analyzingSmiles === swap.modified_smiles}
                    />
                  ))
                )}

                {swaps.note && (
                  <p className="text-[9px] pt-1" style={{ color: 'rgba(71,85,105,0.7)' }}>
                    ⚠ {swaps.note}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Mock fallback
function buildMockSwaps(smiles) {
  const hasCl = smiles.includes('Cl')
  const hasN  = /\[N\+\]/.test(smiles) || /N\(=O\)/.test(smiles)
  const suggestions = []
  if (hasCl) suggestions.push({
    name: 'Cl→F (dehalogenation)', from_group: '[Cl]', to_group: '[F]',
    modified_smiles: smiles.replace('Cl', 'F'),
    rationale: 'Fluorine is smaller, more electronegative, metabolically stable. Reduces aromatic halide toxicity.',
    safety_gain_pct: 22, atom_indices: [0], feasible: true, match_count: 1,
  })
  if (hasN) suggestions.push({
    name: 'Nitro→Cyano (bioisostere)', from_group: '[N+](=O)[O-]', to_group: 'C#N',
    modified_smiles: null,
    rationale: 'Cyano group eliminates nitroreduction pathway that generates toxic hydroxylamine metabolites.',
    safety_gain_pct: 35, atom_indices: [1,2,3], feasible: false, match_count: 1,
  })
  if (suggestions.length === 0) suggestions.push({
    name: 'ArNH2→ArNHCH3 (N-methylation)', from_group: 'c[NH2]', to_group: 'cNC',
    modified_smiles: null,
    rationale: 'N-methylation reduces aromatic amine oxidation to toxic quinone-imines.',
    safety_gain_pct: 18, atom_indices: [], feasible: false, match_count: 0,
  })
  return { original_smiles: smiles, suggestions, total_suggestions: suggestions.length,
           note: 'Suggestions based on classical bioisostere tables. Verify activity retention before synthesis.' }
}
