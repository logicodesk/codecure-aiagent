// MolImage2D.jsx — 2D molecular structure viewer using RDKit backend
// Falls back to a SMILES-based SVG placeholder if backend unavailable
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export default function MolImage2D({ smiles, width = 380, height = 260 }) {
  const [src, setSrc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!smiles) return
    setLoading(true)
    setError(false)
    setSrc(null)

    // Try backend SVG endpoint first
    const url = `/mol-image?smiles=${encodeURIComponent(smiles)}&width=${width}&height=${height}`
    fetch(url, { signal: AbortSignal.timeout(6000) })
      .then(r => {
        if (!r.ok) throw new Error('Backend unavailable')
        return r.blob()
      })
      .then(blob => {
        setSrc(URL.createObjectURL(blob))
        setLoading(false)
      })
      .catch(() => {
        // Fallback: use PubChem 2D depiction
        const pubchemUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/PNG?image_size=300x200`
        setSrc(pubchemUrl)
        setLoading(false)
        setError(false)
      })
  }, [smiles, width, height])

  return (
    <div
      className="relative rounded-xl overflow-hidden flex items-center justify-center"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        minHeight: height,
        width: '100%',
      }}
    >
      {loading && (
        <div className="flex flex-col items-center gap-2 py-8">
          <div className="w-6 h-6 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
          <span className="text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>Rendering structure…</span>
        </div>
      )}

      {!loading && src && (
        <motion.img
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          src={src}
          alt="2D molecular structure"
          className="max-w-full object-contain"
          style={{
            maxHeight: height,
            filter: 'invert(1) hue-rotate(180deg) brightness(0.9)',
          }}
          onError={() => setError(true)}
        />
      )}

      {!loading && error && (
        <div className="text-center py-8 space-y-1">
          <div className="text-2xl">⚗️</div>
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Structure preview unavailable
          </p>
        </div>
      )}

      {/* SMILES label */}
      {!loading && src && (
        <div
          className="absolute bottom-0 left-0 right-0 px-3 py-1.5 text-[10px] font-mono truncate"
          style={{
            background: 'rgba(0,0,0,0.5)',
            color: 'rgba(148,163,184,0.7)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {smiles}
        </div>
      )}
    </div>
  )
}
