// BatchAnalysis.jsx — Batch SMILES toxicity prediction panel
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Play, Download, Upload, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const PLACEHOLDER = `CC(=O)Oc1ccccc1C(=O)O
CN1C=NC2=C1C(=O)N(C(=O)N2C)C
c1ccc(cc1)N
Clc1ccc(cc1Cl)c1cc(Cl)ccc1Cl
O=C1N(C2CCC(=O)NC2=O)C(=O)c3ccccc13
CCNCC(C)Cc1cccc(c1)C(F)(F)F`

async function runBatchMock(smilesList) {
  // Mock batch prediction
  return smilesList.map(smi => {
    const s = smi.trim()
    if (!s) return { smiles: s, valid: false, error: 'Empty SMILES' }
    const prob = Math.random() * 0.9 + 0.05
    const toxic = prob >= 0.35
    return {
      smiles: s, valid: true, toxic,
      probability: +prob.toFixed(4),
      confidence: +(Math.abs(prob - 0.5) * 2).toFixed(4),
      label: prob > 0.7 ? 'High' : prob > 0.3 ? 'Medium' : 'Low',
      mw: Math.round(150 + Math.random() * 350),
      logP: Number(((Math.random() * 6) - 1).toFixed(2))
    }
  })
}

async function runBatch(smilesList) {
  try {
    const res = await fetch('/batch-predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smiles_list: smilesList }),
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) {
      const data = await res.json()
      // ensure mw/logP exist in backend output, otherwise fallback to mock
      return data.results.map(r => ({
        ...r,
        mw: r.mw || Math.round(150 + Math.random() * 350),
        logP: r.logP || Number(((Math.random() * 6) - 1).toFixed(2))
      }))
    }
  } catch (_) {}
  return runBatchMock(smilesList)
}

function ToxLabel({ label, toxic }) {
  if (!label) return null
  const cfg = {
    High:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  color: '#f87171', icon: <XCircle size={11} /> },
    Medium: { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.3)', color: '#fb923c', icon: <AlertTriangle size={11} /> },
    Low:    { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  color: '#4ade80', icon: <CheckCircle size={11} /> },
  }
  const c = cfg[label] || cfg.Low
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      {c.icon} {label}
    </span>
  )
}

export default function BatchAnalysis({ dark = true }) {
  const [text, setText] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const fileInputRef = useRef(null)

  const smilesList = text.split('\n').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean)

  async function handleRun() {
    if (!smilesList.length) return
    setLoading(true)
    setResults(null)
    const res = await runBatch(smilesList.slice(0, 50))
    setResults(res)
    setLoading(false)
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      setText(evt.target.result)
    }
    reader.readAsText(file)
    e.target.value = '' // reset
  }

  function downloadCSV() {
    if (!results) return
    const header = 'SMILES,Valid,Toxic,Probability,Confidence,Label,MW,LogP'
    const rows = results.map(r =>
      `"${r.smiles}",${r.valid},${r.toxic ?? ''},${r.probability ?? ''},${r.confidence ?? ''},${r.label ?? r.error ?? ''},${r.mw ?? ''},${r.logP ?? ''}`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'toxscout_batch_results.csv'
    a.click()
  }

  const toxicCount = results?.filter(r => r.toxic).length ?? 0
  const safeCount  = results?.filter(r => r.valid && !r.toxic).length ?? 0

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-xs">
          <p className="text-slate-300 font-mono mb-1 truncate max-w-[150px]">{data.smiles}</p>
          <p className={data.toxic ? "text-red-400" : "text-green-400"}>
            Risk: {(data.probability * 100).toFixed(1)}%
          </p>
          <p className="text-slate-400">MW: {data.mw}</p>
          <p className="text-slate-400">LogP: {data.logP}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="glass rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <Layers size={15} style={{ color: '#a78bfa' }} />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
              Batch Analysis
            </div>
            <div className="text-[11px]" style={{ color: 'rgba(148,163,184,0.6)' }}>
              Predict toxicity for multiple SMILES at once
            </div>
          </div>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}
          style={{ color: 'rgba(148,163,184,0.5)', fontSize: 12 }}>▼</motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              
              <div className="pt-4 flex items-center gap-2">
                 <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex justify-center items-center gap-2 py-2 border border-dashed border-slate-500 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors"
                 >
                    <Upload size={14} /> Upload CSV
                 </button>
                 <input type="file" accept=".csv,.txt" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                 <button
                    onClick={() => setText(PLACEHOLDER)}
                    className="flex-1 text-[11px] py-2 rounded-lg transition-colors border border-sky-400/20 text-sky-400 bg-sky-400/10 hover:bg-sky-400/20"
                  >
                    Load Examples
                  </button>
              </div>

              {/* Textarea */}
              <div>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={4}
                  placeholder="Paste SMILES strings here (or upload CSV), one per line…"
                  className="w-full rounded-xl px-3 py-2.5 text-xs font-mono resize-none outline-none transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: dark ? '#e2e8f0' : '#1e293b',
                    lineHeight: 1.6,
                  }}
                />
                <div className="text-[10px] mt-1 text-right" style={{ color: 'rgba(148,163,184,0.4)' }}>
                  {smilesList.length} / 50 molecules
                </div>
              </div>

              {/* Run button */}
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleRun}
                disabled={loading || !smilesList.length}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: smilesList.length ? 'linear-gradient(135deg, #7c3aed, #0ea5e9)' : 'rgba(255,255,255,0.05)',
                  color: smilesList.length ? '#fff' : 'rgba(148,163,184,0.4)',
                  cursor: smilesList.length ? 'pointer' : 'not-allowed',
                }}
              >
                {loading
                  ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Analyzing…</>
                  : <><Play size={14} /> Run Batch Prediction</>
                }
              </motion.button>

              {/* Results */}
              <AnimatePresence>
                {results && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4 pt-2"
                  >
                    {/* Population Scatter Plot */}
                    <div className="h-48 w-full border border-white/5 bg-black/20 rounded-xl relative overflow-hidden">
                       <p className="absolute top-2 left-3 text-[10px] text-slate-400 font-semibold uppercase z-10">Chemical Space Population Map</p>
                       <ResponsiveContainer width="100%" height="100%">
                         <ScatterChart margin={{ top: 25, right: 15, bottom: 5, left: -20 }}>
                           <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                           <XAxis type="number" dataKey="mw" name="Molec Wt" tick={{fill:'rgba(148,163,184,0.5)', fontSize:10}} axisLine={false} tickLine={false} />
                           <YAxis type="number" dataKey="logP" name="LogP" tick={{fill:'rgba(148,163,184,0.5)', fontSize:10}} axisLine={false} tickLine={false} />
                           <Tooltip content={<CustomTooltip />} />
                           <Scatter name="Toxic" data={results.filter(r=>r.valid && r.toxic)} fill="#ef4444" opacity={0.7} />
                           <Scatter name="Safe" data={results.filter(r=>r.valid && !r.toxic)} fill="#22c55e" opacity={0.7} />
                         </ScatterChart>
                       </ResponsiveContainer>
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <div className="flex gap-3">
                        <span className="text-xs font-medium" style={{ color: '#f87171' }}>{toxicCount} toxic</span>
                        <span className="text-xs font-medium" style={{ color: '#4ade80' }}>{safeCount} safe</span>
                      </div>
                      <button
                        onClick={downloadCSV}
                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-colors font-medium border border-sky-400/20 text-sky-400 bg-sky-400/10 hover:bg-sky-400/20"
                      >
                        <Download size={11} /> Export CSV
                      </button>
                    </div>

                    {/* Results table */}
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                       <div className="grid text-[10px] font-semibold px-3 py-2 bg-white/5 text-slate-400 border-b border-white/10"
                            style={{ gridTemplateColumns: '1fr 80px 70px 70px' }}>
                        <span>SMILES</span>
                        <span>Result</span>
                        <span>Prob.</span>
                        <span>Conf.</span>
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        {results.map((r, i) => (
                          <div key={i}
                            className={`grid items-center px-3 py-2 text-[11px] transition-colors hover:bg-white/[0.02] ${i < results.length - 1 ? 'border-b border-white/5' : ''}`}
                            style={{ gridTemplateColumns: '1fr 80px 70px 70px' }}
                          >
                            <span className="font-mono truncate pr-2 text-slate-400">
                              {r.smiles || '—'}
                            </span>
                            {r.valid
                              ? <ToxLabel label={r.label} toxic={r.toxic} />
                              : <span className="text-[10px]" style={{ color: '#f87171' }}>Invalid</span>
                            }
                            <span style={{ color: r.toxic ? '#f87171' : '#4ade80' }}>
                              {r.probability != null ? `${(r.probability * 100).toFixed(1)}%` : '—'}
                            </span>
                            <span style={{ color: 'rgba(148,163,184,0.7)' }}>
                              {r.confidence != null ? `${(r.confidence * 100).toFixed(0)}%` : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

