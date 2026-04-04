import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, Info, Zap, Maximize2, X } from 'lucide-react'

// ── Severity config ───────────────────────────────────────────
const SEVERITY_CFG = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)',  label: 'High',   dot: '#ef4444' },
  medium: { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.2)',  label: 'Medium', dot: '#f97316' },
  low:    { color: '#eab308', bg: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.18)',  label: 'Low',    dot: '#eab308' },
}

// ── Risk Classification Banner ────────────────────────────────
function RiskBanner({ risk }) {
  if (!risk) return null
  const isFailure = risk.tier === 'HIGH_RISK_STRUCTURAL_FAILURE'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: risk.bg,
        border: `1px solid ${risk.border}`,
        boxShadow: isFailure ? `0 0 24px ${risk.bg}` : 'none',
      }}
    >
      {/* Badge */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {isFailure && (
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ShieldAlert size={18} style={{ color: risk.color }} />
            </motion.div>
          )}
          <span className="text-sm font-black tracking-tight" style={{ color: risk.color }}>
            {risk.badge_text}
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(148,163,184,0.7)' }}>
          {risk.tier}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed" style={{ color: 'rgba(203,213,225,0.8)' }}>
        {risk.description}
      </p>

      {/* Reasons */}
      {risk.reasons?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {risk.reasons.map((r, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(148,163,184,0.8)',
                           border: '1px solid rgba(255,255,255,0.08)' }}>
              {r}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ── Alert badge row ───────────────────────────────────────────
function AlertBadge({ alert, active, onClick }) {
  const cfg = SEVERITY_CFG[alert.severity] ?? SEVERITY_CFG.low
  return (
    <motion.button
      whileHover={{ scale: 1.02, x: 2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2.5 text-left transition-all"
      style={{
        background: active ? cfg.bg : 'rgba(255,255,255,0.02)',
        border: `1px solid ${active ? cfg.border : 'rgba(255,255,255,0.05)'}`,
      }}
    >
      {/* Severity dot */}
      <div className="w-2 h-2 rounded-full flex-shrink-0"
           style={{ background: cfg.dot, boxShadow: active ? `0 0 6px ${cfg.dot}` : 'none' }} />

      {/* Label + count */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold truncate"
                style={{ color: active ? cfg.color : 'rgba(203,213,225,0.8)' }}>
            {alert.label}
          </span>
          {alert.count > 1 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
              ×{alert.count}
            </span>
          )}
        </div>
        <p className="text-[9px] font-mono mt-0.5" style={{ color: 'rgba(100,116,139,0.6)' }}>
          {alert.smarts || alert.name}
        </p>
      </div>

      {/* Severity badge */}
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
        {cfg.label}
      </span>

      {/* Atom count */}
      <span className="text-[9px] flex-shrink-0" style={{ color: 'rgba(100,116,139,0.5)' }}>
        {alert.atom_indices?.length ?? 0} atoms
      </span>
    </motion.button>
  )
}

// Helper to convert hex to RDKit RGB array [r, g, b] (0-1)
function hexToRgbArray(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) / 255
  const g = parseInt(h.substring(2, 4), 16) / 255
  const b = parseInt(h.substring(4, 6), 16) / 255
  return [r, g, b]
}

// ── 2D Molecule SVG with atom highlights ─────────────────────
function MoleculeCanvas({ smiles, toxicophoreData, activeAlert }) {
  const canvasRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [rdkitReady, setRdkitReady] = useState(false)

  // Load RDKit.js from CDN once
  useEffect(() => {
    if (window.RDKit) { setRdkitReady(true); return }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/@rdkit/rdkit/Code/MinimalLib/dist/RDKit_minimal.js'
    script.onload = () => {
      window.initRDKitModule().then(rdkit => {
        window.RDKit = rdkit
        setRdkitReady(true)
      }).catch(() => setStatus('error'))
    }
    script.onerror = () => setStatus('error')
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!rdkitReady || !smiles || !canvasRef.current) return
    try {
      const mol = window.RDKit.get_mol(smiles)
      if (!mol || !mol.is_valid()) { setStatus('error'); return }

      // Determine which atoms to highlight
      const highlightAtoms = activeAlert
        ? (activeAlert.atom_indices ?? [])
        : (toxicophoreData?.highlighted_atoms ?? [])

      const highlightBonds = activeAlert
        ? (activeAlert.bond_indices ?? [])
        : (toxicophoreData?.highlighted_bonds ?? [])

      // Build highlight color map: atom_idx → RGB array [r, g, b]
      const atomColorMap = {}
      const bondColorMap = {}

      if (activeAlert) {
        const rgb = hexToRgbArray(activeAlert.color ?? '#ef4444')
        highlightAtoms.forEach(i => { atomColorMap[i] = rgb })
        highlightBonds.forEach(i => { bondColorMap[i] = rgb })
      } else if (toxicophoreData?.alerts?.length) {
        // Multi-alert: each alert gets its own color
        toxicophoreData.alerts.forEach(alert => {
          const rgb = hexToRgbArray(alert.color ?? '#f97316')
          ;(alert.atom_indices ?? []).forEach(i => { atomColorMap[i] = rgb })
          ;(alert.bond_indices ?? []).forEach(i => { bondColorMap[i] = rgb })
        })
      }

      // Build RDKit drawing details JSON
      const details = {
        width: 380, height: 260,
        bondLineWidth: 1.5,
        addStereoAnnotation: true,
        highlightAtomColors: atomColorMap,
        highlightBondColors: bondColorMap,
        highlightAtoms: highlightAtoms,
        highlightBonds: highlightBonds,
        highlightRadius: 0.35,
      }

      const svg = mol.get_svg_with_highlights(JSON.stringify(details))
      mol.delete()

      if (canvasRef.current) {
        canvasRef.current.innerHTML = svg
        // Style the SVG to fit container
        const svgEl = canvasRef.current.querySelector('svg')
        if (svgEl) {
          svgEl.style.width = '100%'
          svgEl.style.height = 'auto'
          svgEl.style.maxHeight = '260px'
        }
        setStatus('ready')
      }
    } catch (e) {
      setStatus('error')
    }
  }, [rdkitReady, smiles, activeAlert, toxicophoreData])

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center h-40 rounded-xl text-xs"
           style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    color: 'rgba(100,116,139,0.6)' }}>
        2D structure unavailable
      </div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden"
         style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                  minHeight: 160 }}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-6 h-6 rounded-full border-2 border-t-brand-400"
            style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: '#38bdf8' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}
      <div
        ref={canvasRef}
        className="p-2"
        style={{
          filter: 'invert(1) hue-rotate(180deg)',  // dark-mode invert
          opacity: status === 'ready' ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />
      {/* Overlay legend */}
      {status === 'ready' && toxicophoreData?.alerts?.length > 0 && !activeAlert && (
        <div className="absolute bottom-2 right-2 flex flex-wrap gap-1 justify-end max-w-[180px]">
          {toxicophoreData.alerts.slice(0, 3).map(a => (
            <span key={a.name} className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: `${a.color}22`, color: a.color,
                           border: `1px solid ${a.color}44` }}>
              {a.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function ToxicophoreHighlight({ result }) {
  const [activeAlert, setActiveAlert] = useState(null)
  const [expanded, setExpanded] = useState(true)
  const [isMaximized, setIsMaximized] = useState(false)

  const toxicophoreData = result?.toxicophore_atoms
  const riskData        = result?.risk_classification
  const smiles          = result?.smiles

  if (!toxicophoreData && !riskData) return null

  const alerts      = toxicophoreData?.alerts ?? []
  const totalAlerts = toxicophoreData?.total_alerts ?? 0
  const highCount   = toxicophoreData?.high_severity_count ?? 0

  // Sort: high → medium → low
  const sortedAlerts = [...alerts].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
  })

  const handleAlertClick = (alert) => {
    setActiveAlert(prev => prev?.name === alert.name ? null : alert)
  }

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
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <AlertTriangle size={13} style={{ color: '#f87171' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#fca5a5' }}>
            Toxicophore Analysis
          </span>
          {totalAlerts > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: highCount > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.1)',
                           color: highCount > 0 ? '#f87171' : '#facc15',
                           border: `1px solid ${highCount > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)'}` }}>
              {totalAlerts} alert{totalAlerts !== 1 ? 's' : ''}
              {highCount > 0 && ` · ${highCount} high`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMaximized(true)}
            className="p-1.5 rounded-lg transition-all hover:bg-white/5"
            style={{ color: 'rgba(14,165,233,0.7)' }}
            title="Expand View"
          >
            <Maximize2 size={13} />
          </button>
          <button onClick={() => setExpanded(v => !v)}
                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                  style={{ color: 'rgba(100,116,139,0.6)' }}>
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
              className="glass w-full max-w-5xl max-h-full overflow-y-auto p-6 md:p-10 space-y-6 relative"
            >
              <button
                onClick={() => setIsMaximized(false)}
                className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors z-10"
              >
                <X size={20} className="text-slate-400" />
              </button>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <AlertTriangle size={20} style={{ color: '#f87171' }} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-100">Structural Toxicophore Analysis</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                       <MoleculeCanvas
                        smiles={smiles}
                        toxicophoreData={toxicophoreData}
                        activeAlert={activeAlert}
                      />
                    </div>
                    {riskData && <RiskBanner risk={riskData} />}
                  </div>

                  <div className="space-y-4 overflow-y-auto pr-2 max-h-[600px]">
                    <p className="section-label">Structural Alerts ({alerts.length})</p>
                    <div className="space-y-2">
                      {sortedAlerts.map((alert) => (
                        <AlertBadge
                          key={alert.name}
                          alert={alert}
                          active={activeAlert?.name === alert.name}
                          onClick={() => handleAlertClick(alert)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl p-6 space-y-3" style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.1)' }}>
                  <h3 className="text-sm font-bold text-brand-400 flex items-center gap-2">
                    <Info size={14} /> Detailed Interpretation
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Toxicophores are structural motifs (clusters of atoms) known to correlate with specific toxic results.
                    Our AI cross-references these motifs with <strong>{result?.model_used || 'ToxScout AI'}</strong>'s SHAP values to explain exactly why this molecule was flagged.
                    {activeAlert ? ` Currently inspecting "${activeAlert.label}" which consists of ${activeAlert.atom_indices.length} atoms.` : ' Select an alert on the right to focus the 2D highlight.'}
                  </p>
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
            className="space-y-4 overflow-hidden"
          >
            {/* Risk classification banner */}
            {riskData && <RiskBanner risk={riskData} />}

            {/* 2D molecule with highlights */}
            {smiles && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="section-label">
                    {activeAlert
                      ? `Highlighting: ${activeAlert.label}`
                      : totalAlerts > 0
                      ? 'All toxicophores highlighted'
                      : '2D Structure'}
                  </p>
                  {activeAlert && (
                    <button
                      onClick={() => setActiveAlert(null)}
                      className="text-[10px] underline"
                      style={{ color: 'rgba(100,116,139,0.6)' }}
                    >
                      Show all
                    </button>
                  )}
                </div>
                <MoleculeCanvas
                  smiles={smiles}
                  toxicophoreData={toxicophoreData}
                  activeAlert={activeAlert}
                />
              </div>
            )}

            {/* Alert list */}
            {sortedAlerts.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="section-label">Structural Alerts</p>
                  <p className="text-[9px]" style={{ color: 'rgba(100,116,139,0.5)' }}>
                    Click to highlight atoms
                  </p>
                </div>
                <div className="space-y-1.5">
                  {sortedAlerts.map((alert, i) => (
                    <motion.div
                      key={alert.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <AlertBadge
                        alert={alert}
                        active={activeAlert?.name === alert.name}
                        onClick={() => handleAlertClick(alert)}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs py-2"
                   style={{ color: 'rgba(100,116,139,0.6)' }}>
                <Info size={12} />
                No structural alerts detected — molecule appears clean
              </div>
            )}

            {/* SHAP ↔ Toxicophore connection note */}
            {totalAlerts > 0 && (
              <div className="rounded-xl p-3 text-[10px] leading-relaxed"
                   style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.1)',
                            color: 'rgba(148,163,184,0.7)' }}>
                <span className="flex items-center gap-1.5 mb-1">
                  <Zap size={9} style={{ color: '#38bdf8' }} />
                  <span className="font-semibold" style={{ color: '#7dd3fc' }}>SHAP ↔ Toxicophore Link</span>
                </span>
                Alert features (e.g. Alert_nitro, Alert_amine_arom) appear in the SHAP explanation above
                when they drive the toxicity prediction. Highlighted atoms show exactly which part of the
                molecule triggered each alert.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
