import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Atom, RotateCcw, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react'

// ── Load 3Dmol.js from CDN once ───────────────────────────────
let _3dmolPromise = null
function load3Dmol() {
  if (_3dmolPromise) return _3dmolPromise
  _3dmolPromise = new Promise((resolve, reject) => {
    if (window.$3Dmol) { resolve(window.$3Dmol); return }
    const s = document.createElement('script')
    s.src = 'https://3dmol.org/build/3Dmol-min.js'
    s.crossOrigin = 'anonymous'
    s.onload  = () => {
      // Poll briefly — 3Dmol sets window.$3Dmol asynchronously after script load
      let tries = 0
      const poll = setInterval(() => {
        if (window.$3Dmol) { clearInterval(poll); resolve(window.$3Dmol) }
        else if (++tries > 20) { clearInterval(poll); reject(new Error('3Dmol not found')) }
      }, 100)
    }
    s.onerror = () => reject(new Error('Failed to load 3Dmol'))
    document.head.appendChild(s)
  })
  return _3dmolPromise
}

// ── Fetch 3D SDF: PubChem first, then NIH Cactus ─────────────
async function fetchSdf(smiles) {
  const enc = encodeURIComponent(smiles)

  // 1. PubChem
  try {
    const cidRes = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${enc}/cids/JSON`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (cidRes.ok) {
      const j = await cidRes.json()
      const cid = j?.IdentifierList?.CID?.[0]
      if (cid) {
        const sdfRes = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`,
          { signal: AbortSignal.timeout(10000) }
        )
        if (sdfRes.ok) {
          const txt = await sdfRes.text()
          if (txt && txt.includes('$$')) return { sdf: txt, source: 'PubChem', cid }
        }
      }
    }
  } catch (_) {}

  // 2. NIH Cactus fallback
  try {
    const res = await fetch(
      `https://cactus.nci.nih.gov/chemical/structure/${enc}/file?format=sdf&get3d=true`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (res.ok) {
      const txt = await res.text()
      if (txt && txt.includes('$$') && !txt.includes('Page not found'))
        return { sdf: txt, source: 'NIH Cactus', cid: null }
    }
  } catch (_) {}

  return null
}

const STYLES = ['stick', 'sphere', 'cartoon']

// Fixed pixel dimensions for the viewer — avoids 0×0 at mount time
const VIEWER_W = 600
const VIEWER_H = 320

export default function MolViewer3D({ smiles, toxic, result }) {
  const containerRef = useRef(null)  // outer div with fixed height
  const viewerRef    = useRef(null)  // $3Dmol viewer instance
  const [status, setStatus]         = useState('idle')
  const [styleIdx, setStyleIdx]     = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [source, setSource]         = useState('')
  const [dims, setDims]             = useState({ w: VIEWER_W, h: VIEWER_H })

  const currentStyle = STYLES[styleIdx]

  // ── Measure container after layout so we get real pixels ────
  useLayoutEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const measure = () => {
      const w = el.offsetWidth  || VIEWER_W
      const h = el.offsetHeight || VIEWER_H
      setDims({ w, h })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fullscreen])

  // ── Build / rebuild viewer ───────────────────────────────────
  const buildViewer = useCallback(async () => {
    if (!smiles || !containerRef.current) return
    setStatus('loading')
    setSource('')

    try {
      const [$3Dmol, resultObj] = await Promise.all([load3Dmol(), fetchSdf(smiles)])

      if (!resultObj) { setStatus('error'); return }

      // Destroy old viewer
      if (viewerRef.current) {
        try { viewerRef.current.clear(); viewerRef.current.removeAllModels() } catch (_) {}
        viewerRef.current = null
      }
      containerRef.current.innerHTML = ''

      // Use measured dims (or fallback)
      const w = containerRef.current.offsetWidth  || dims.w || VIEWER_W
      const h = containerRef.current.offsetHeight || dims.h || VIEWER_H

      const viewer = $3Dmol.createViewer(containerRef.current, {
        width:           w,
        height:          h,
        backgroundColor: '#0d1117',
        antialias:       true,
        id:              `viewer-${Date.now()}`,
      })
      viewerRef.current = viewer

      viewer.addModel(resultObj.sdf, 'sdf')
      applyStyle(viewer, currentStyle, toxic, result)
      viewer.zoomTo()
      viewer.spin('y', 1)
      viewer.render()

      setSource(resultObj.source + (resultObj.cid ? ` CID:${resultObj.cid}` : ''))
      setStatus('ready')
    } catch (e) {
      console.error('[3D]', e)
      setStatus('error')
    }
  }, [smiles, dims]) // eslint-disable-line

  // Trigger build once dims are measured (non-zero)
  useEffect(() => {
    if (dims.w > 0 && dims.h > 0) buildViewer()
  }, [dims.w, dims.h]) // eslint-disable-line

  // ── Apply render style ───────────────────────────────────────
  function applyStyle(viewer, style, isToxic, res) {
    viewer.setStyle({}, {})
    if (style === 'stick') {
      viewer.setStyle({}, { stick: { radius: 0.15, colorscheme: 'Jmol' } })
    } else if (style === 'sphere') {
      viewer.setStyle({}, { sphere: { scale: 0.35, colorscheme: 'Jmol' } })
    } else {
      viewer.setStyle({}, {
        stick:  { radius: 0.12, colorscheme: 'Jmol' },
        sphere: { scale: 0.25, colorscheme: 'Jmol' },
      })
    }

    // Atom saliency overlay (heat-mapped)
    if (res?.atom_saliency?.atom_scores) {
      res.atom_saliency.atom_scores.forEach((score, idx) => {
        if (score > 0.1) {
          // Map score to a gradient: #22c55e (green) -> #dc2626 (red)
          const r = Math.round(34 + score * (220 - 34))
          const g = Math.round(197 - score * (197 - 38))
          const b = Math.round(94 - score * (94 - 38))
          const color = `rgb(${r},${g},${b})`
          viewer.setStyle(
            { index: idx }, 
            { 
              sphere: { scale: 0.30 + (score * 0.15), color },
              stick: { radius: 0.15 + (score * 0.05), color }
            }
          )
        }
      })
    }
  }

  function changeStyle(idx) {
    setStyleIdx(idx)
    if (!viewerRef.current || status !== 'ready') return
    applyStyle(viewerRef.current, STYLES[idx], toxic, result)
    viewerRef.current.render()
  }

  function resetView() {
    if (!viewerRef.current) return
    viewerRef.current.zoomTo()
    viewerRef.current.spin('y', 1)
    viewerRef.current.render()
  }

  function zoom(f) {
    if (!viewerRef.current) return
    viewerRef.current.zoom(f, 500)
    viewerRef.current.render()
  }

  const accentBg  = toxic ? 'bg-red-100 dark:bg-red-500/20'   : 'bg-green-100 dark:bg-green-500/20'
  const accentTxt = toxic ? 'text-red-500'                     : 'text-green-500'
  const viewerH   = fullscreen ? 'calc(100vh - 180px)' : '320px'

  return (
    <>
      {fullscreen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
             onClick={() => setFullscreen(false)} />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={`glass p-4 space-y-3 ${fullscreen ? 'fixed inset-6 z-50 overflow-auto' : ''}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${accentBg}`}>
              <Atom size={14} className={accentTxt} />
            </div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              3D Structure
            </span>
            {status === 'ready' && (
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-white/5
                               px-2 py-0.5 rounded-full">
                {source}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <div className="flex gap-0.5 mr-1">
              {STYLES.map((s, i) => (
                <button key={s} onClick={() => changeStyle(i)}
                  className={`text-[10px] px-2 py-1 rounded-md transition-all capitalize ${
                    styleIdx === i
                      ? 'bg-brand-500 text-white'
                      : 'text-slate-400 bg-slate-100 dark:bg-white/5 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}>
                  {s === 'cartoon' ? 'ball+stick' : s}
                </button>
              ))}
            </div>

            {status === 'ready' && (<>
              <button onClick={() => zoom(1.3)} title="Zoom in"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700
                           dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <ZoomIn size={13} />
              </button>
              <button onClick={() => zoom(0.7)} title="Zoom out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700
                           dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <ZoomOut size={13} />
              </button>
              <button onClick={resetView} title="Reset"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700
                           dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <RotateCcw size={13} />
              </button>
            </>)}

            <button onClick={() => setFullscreen(f => !f)} title="Fullscreen"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700
                         dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
              {fullscreen ? <X size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </div>

        {/* Canvas wrapper — explicit pixel height so 3Dmol gets real dimensions */}
        <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-white/10"
             style={{ height: viewerH, background: '#0d1117' }}>

          {/* 3Dmol mounts here — width:100% + height:100% fills the parent */}
          <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
          />

          {/* Loading overlay */}
          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d1117]/90 z-10">
              <div className="relative w-12 h-12">
                <motion.div className="absolute inset-0 rounded-full border-2 border-brand-500"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }} />
                <motion.div className="absolute inset-2 rounded-full border-2 border-purple-400"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />
                <div className="absolute inset-0 flex items-center justify-center text-base">⚛️</div>
              </div>
              <p className="text-xs text-slate-400">Fetching 3D coordinates…</p>
              <p className="text-[10px] text-slate-600">Querying PubChem database</p>
            </div>
          )}

          {/* Error overlay */}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0d1117]/90 z-10">
              <p className="text-3xl">🔬</p>
              <p className="text-xs text-slate-300 font-medium">3D structure unavailable</p>
              <p className="text-[10px] text-slate-500 text-center px-6">
                This molecule isn't in PubChem or NIH Cactus.<br />
                Try one of the example compounds.
              </p>
              <button onClick={buildViewer}
                className="mt-1 text-[10px] text-brand-400 hover:text-brand-300 underline">
                Retry
              </button>
            </div>
          )}
        </div>

        {status === 'ready' && (
          <p className="text-[10px] text-slate-400 text-center">
            Drag to rotate · Scroll to zoom · Right-click to pan
          </p>
        )}
      </motion.div>
    </>
  )
}
