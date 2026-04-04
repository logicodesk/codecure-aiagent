import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Logo from './Logo'

// Animated SVG molecule that rotates on mouse move
function InteractiveMolecule({ mouseX, mouseY }) {
  const rx = (mouseY - 0.5) * 30   // tilt up/down
  const ry = (mouseX - 0.5) * -30  // tilt left/right

  const atoms = [
    { cx: 100, cy: 60,  r: 10, color: '#0ea5e9', label: 'C' },
    { cx: 160, cy: 90,  r: 9,  color: '#06b6d4', label: 'N' },
    { cx: 160, cy: 150, r: 9,  color: '#8b5cf6', label: 'O' },
    { cx: 100, cy: 180, r: 10, color: '#0ea5e9', label: 'C' },
    { cx: 40,  cy: 150, r: 9,  color: '#06b6d4', label: 'C' },
    { cx: 40,  cy: 90,  r: 9,  color: '#8b5cf6', label: 'C' },
    { cx: 100, cy: 10,  r: 7,  color: '#f97316', label: 'OH' },
    { cx: 210, cy: 70,  r: 7,  color: '#22c55e', label: 'F' },
    { cx: 210, cy: 170, r: 7,  color: '#ef4444', label: 'Cl' },
    { cx: 100, cy: 230, r: 7,  color: '#f97316', label: 'N' },
    { cx: -10, cy: 170, r: 7,  color: '#22c55e', label: 'S' },
    { cx: -10, cy: 70,  r: 7,  color: '#a78bfa', label: 'O' },
  ]

  const bonds = [
    [0,1],[1,2],[2,3],[3,4],[4,5],[5,0],
    [0,6],[1,7],[2,8],[3,9],[4,10],[5,11],
  ]

  return (
    <motion.div
      style={{
        transformStyle: 'preserve-3d',
        transform: `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`,
        transition: 'transform 0.1s ease',
      }}
      className="relative"
    >
      <svg viewBox="-30 -10 270 260" width="220" height="220"
           style={{ filter: 'drop-shadow(0 0 20px rgba(14,165,233,0.2))' }}>
        <defs>
          {atoms.map((a, i) => (
            <radialGradient key={i} id={`ag${i}`} cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor={a.color} stopOpacity="1" />
              <stop offset="100%" stopColor={a.color} stopOpacity="0.3" />
            </radialGradient>
          ))}
        </defs>

        {/* Bonds */}
        {bonds.map(([i, j], k) => (
          <line key={k}
            x1={atoms[i].cx} y1={atoms[i].cy}
            x2={atoms[j].cx} y2={atoms[j].cy}
            stroke={`url(#ag${i})`}
            strokeWidth="2.5"
            strokeOpacity="0.5"
            strokeLinecap="round"
          />
        ))}

        {/* Atoms */}
        {atoms.map((a, i) => (
          <g key={i}>
            {/* Glow ring */}
            <circle cx={a.cx} cy={a.cy} r={a.r * 2.2}
              fill={a.color} fillOpacity="0.08" />
            {/* Atom body */}
            <circle cx={a.cx} cy={a.cy} r={a.r}
              fill={`url(#ag${i})`}
              className="mol-atom"
              style={{ color: a.color }}
            />
            {/* Label */}
            <text x={a.cx} y={a.cy + 1}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={a.r > 8 ? 7 : 5.5}
              fill="white" fontWeight="700" fontFamily="monospace"
              style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {a.label}
            </text>
          </g>
        ))}

        {/* Orbiting electron */}
        <g style={{ transformOrigin: '100px 120px' }}>
          <circle cx="100" cy="120" r="55"
            fill="none" stroke="#0ea5e9" strokeWidth="0.5" strokeOpacity="0.15"
            strokeDasharray="4 4" />
        </g>
      </svg>

      {/* Floating orbital dots */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: ['#0ea5e9','#8b5cf6','#06b6d4'][i],
            boxShadow: `0 0 8px ${['#0ea5e9','#8b5cf6','#06b6d4'][i]}`,
            top: '50%', left: '50%',
          }}
          animate={{
            x: [0, Math.cos(i * 2.09) * 70, Math.cos(i * 2.09 + Math.PI) * 70, 0],
            y: [0, Math.sin(i * 2.09) * 70, Math.sin(i * 2.09 + Math.PI) * 70, 0],
          }}
          transition={{ duration: 3 + i, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </motion.div>
  )
}

// Floating stat badge
function StatBadge({ value, label, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 200 }}
      whileHover={{ scale: 1.06, y: -2 }}
      className="flex flex-col items-center px-4 py-2.5 rounded-2xl cursor-default"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${color}33`,
        boxShadow: `0 4px 20px ${color}18`,
      }}
    >
      <span className="text-xl font-black tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[9px] font-medium mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>{label}</span>
    </motion.div>
  )
}

// Tox21 target chip
function TargetChip({ label, i }) {
  const colors = ['#0ea5e9','#06b6d4','#8b5cf6','#a78bfa','#38bdf8','#7dd3fc']
  const c = colors[i % colors.length]
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4 + i * 0.06, type: 'spring' }}
      whileHover={{ scale: 1.1, y: -2 }}
      className="text-[9px] font-mono px-2.5 py-1.5 rounded-lg cursor-default select-none"
      style={{
        background: `${c}12`,
        border: `1px solid ${c}30`,
        color: c,
        boxShadow: `0 2px 8px ${c}18`,
      }}
    >
      {label}
    </motion.div>
  )
}

export default function IdleHero({ dark, onDemoClick }) {
  const containerRef = useRef(null)
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      setMouse({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top)  / rect.height,
      })
    }
    el.addEventListener('mousemove', onMove)
    return () => el.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <motion.div
      ref={containerRef}
      key="idle"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="glass idle-glow rotating-border flex flex-col items-center
                 justify-center text-center space-y-6 min-h-[420px] p-8 overflow-hidden relative"
      style={{ cursor: 'crosshair' }}
    >
      {/* Scan line */}
      <div className="scan-line" />

      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none"
           style={{
             backgroundImage: `
               linear-gradient(rgba(14,165,233,0.04) 1px, transparent 1px),
               linear-gradient(90deg, rgba(14,165,233,0.04) 1px, transparent 1px)
             `,
             backgroundSize: '32px 32px',
             borderRadius: 16,
           }} />

      {/* Corner decorations */}
      {[
        'top-3 left-3 border-t border-l',
        'top-3 right-3 border-t border-r',
        'bottom-3 left-3 border-b border-l',
        'bottom-3 right-3 border-b border-r',
      ].map((cls, i) => (
        <div key={i} className={`absolute w-4 h-4 ${cls}`}
             style={{ borderColor: 'rgba(14,165,233,0.3)' }} />
      ))}

      {/* Interactive molecule */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative z-10"
      >
        <InteractiveMolecule mouseX={mouse.x} mouseY={mouse.y} />
      </motion.div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative z-10"
      >
        <Logo dark={dark} size="md" showTagline />
      </motion.div>

      {/* Stats row */}
      <div className="flex gap-3 relative z-10">
        <StatBadge value="12"   label="Tox21 Targets"    color="#0ea5e9" delay={0.3} />
        <StatBadge value="1777" label="ML Features"      color="#8b5cf6" delay={0.4} />
        <StatBadge value="41k"  label="Compounds"        color="#06b6d4" delay={0.5} />
      </div>

      {/* Target chips */}
      <div className="flex flex-wrap justify-center gap-1.5 max-w-xs relative z-10">
        {['NR-AR','NR-AhR','NR-ER','SR-ARE','SR-MMP','SR-p53','hERG','AMES','DILI'].map((t, i) => (
          <TargetChip key={t} label={t} i={i} />
        ))}
      </div>

      {/* ROI / Cost Saved Calculator */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="relative z-10 mt-2 px-6 py-3 rounded-2xl glass flex flex-col sm:flex-row gap-4 sm:gap-8 items-center justify-between w-full max-w-[420px]"
        style={{ border: '1px solid rgba(255,255,255,0.05)', background: dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)' }}
      >
        <div className="text-center sm:text-left">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Traditional Method</p>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            <span className="text-red-500 line-through mr-2">$2,000,000</span>
            <span className="text-slate-500 line-through">18 months</span>
          </p>
        </div>
        <div className="hidden sm:block text-slate-400">→</div>
        <div className="text-center sm:text-right">
          <p className="text-[9px] font-bold text-sky-500 uppercase tracking-wider mb-1 flex justify-center sm:justify-end items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
            ToxScout AI
          </p>
          <p className="text-xs font-bold text-sky-600 dark:text-sky-400">
            $0 <span className="text-slate-400 font-medium mx-1">in</span> 0.4 sec
          </p>
        </div>
      </motion.div>

      {/* Historical Demo Drugs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="relative z-10 flex flex-wrap justify-center gap-2 mt-2 w-full max-w-sm"
      >
        {[
          { name: 'Thalidomide', smiles: 'O=C1N(C2CCC(=O)NC2=O)C(=O)c3ccccc13', desc: 'Teratogen' },
          { name: 'Vioxx', smiles: 'CS(=O)(=O)c1ccc(cc1)C2=C(C(=O)OC2)c3ccccc3', desc: 'Cardiotoxic' },
          { name: 'Fenfluramine', smiles: 'CCNCC(C)Cc1cccc(c1)C(F)(F)F', desc: 'Pulmonary' }
        ].map((drug, i) => (
          <button
            key={drug.name}
            onClick={() => onDemoClick?.(drug.name, drug.smiles)}
            className="flex flex-col items-center bg-white/5 hover:bg-white/10 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 transition-all hover:-translate-y-0.5"
          >
            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{drug.name}</span>
            <span className="text-[9px] font-mono text-red-500/80">{drug.desc}</span>
          </button>
        ))}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="text-[10px] relative z-10 mt-4"
        style={{ color: 'rgba(100,116,139,0.5)' }}
      >
        Interact with molecule · Click a demo drug · Enter SMILES to begin
      </motion.p>
    </motion.div>
  )
}
