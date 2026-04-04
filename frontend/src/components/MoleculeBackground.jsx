import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

// ── Inline SVG images for each floating object ────────────────

const BenzeneRingSVG = ({ color = '#0ea5e9', size = 80 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <defs>
      <radialGradient id="br-g" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stopColor={color} stopOpacity="0.9"/>
        <stop offset="100%" stopColor={color} stopOpacity="0.2"/>
      </radialGradient>
    </defs>
    {/* Hexagon */}
    <polygon points="50,10 84,30 84,70 50,90 16,70 16,30"
      fill="none" stroke={color} strokeWidth="2.5" strokeOpacity="0.6"/>
    {/* Inner circle */}
    <circle cx="50" cy="50" r="18" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="4 3"/>
    {/* Atoms at vertices */}
    {[[50,10],[84,30],[84,70],[50,90],[16,70],[16,30]].map(([x,y],i) => (
      <circle key={i} cx={x} cy={y} r="5" fill="url(#br-g)" opacity="0.9"/>
    ))}
    {/* Centre */}
    <circle cx="50" cy="50" r="4" fill={color} opacity="0.7"/>
    {/* Bonds */}
    {[[50,10,84,30],[84,30,84,70],[84,70,50,90],[50,90,16,70],[16,70,16,30],[16,30,50,10]].map(([x1,y1,x2,y2],i) => (
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" strokeOpacity="0.35"/>
    ))}
  </svg>
)

const DNAHelixSVG = ({ color1 = '#0ea5e9', color2 = '#8b5cf6', size = 60 }) => (
  <svg width={size} height={size * 2.5} viewBox="0 0 60 150" fill="none">
    {Array.from({length: 10}, (_,i) => {
      const y = 8 + i * 14
      const phase = (i / 9) * Math.PI * 2
      const x1 = 30 + Math.cos(phase) * 22
      const x2 = 30 + Math.cos(phase + Math.PI) * 22
      return (
        <g key={i}>
          <circle cx={x1} cy={y} r="4.5" fill={color1} opacity="0.8"/>
          <circle cx={x2} cy={y} r="4.5" fill={color2} opacity="0.8"/>
          {i % 2 === 0 && <line x1={x1} y1={y} x2={x2} y2={y} stroke="#06b6d4" strokeWidth="1.2" strokeOpacity="0.5"/>}
        </g>
      )
    })}
    {/* Backbone curves */}
    <path d="M8,8 Q52,22 8,36 Q52,50 8,64 Q52,78 8,92 Q52,106 8,120 Q52,134 8,148"
      fill="none" stroke={color1} strokeWidth="1.5" strokeOpacity="0.4"/>
    <path d="M52,8 Q8,22 52,36 Q8,50 52,64 Q8,78 52,92 Q8,106 52,120 Q8,134 52,148"
      fill="none" stroke={color2} strokeWidth="1.5" strokeOpacity="0.4"/>
  </svg>
)

const MoleculeSVG = ({ color = '#06b6d4', size = 90 }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
    <defs>
      <radialGradient id="mol-g" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor={color} stopOpacity="1"/>
        <stop offset="100%" stopColor={color} stopOpacity="0.2"/>
      </radialGradient>
    </defs>
    {/* Bonds */}
    {[[60,60,30,30],[60,60,90,30],[60,60,90,90],[60,60,30,90],[60,60,60,20],[60,60,60,100],
      [30,30,10,15],[90,30,110,15],[90,90,110,105],[30,90,10,105]].map(([x1,y1,x2,y2],i) => (
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2" strokeOpacity="0.4" strokeLinecap="round"/>
    ))}
    {/* Atoms */}
    {[[60,60,8,color],[30,30,6,'#0ea5e9'],[90,30,6,'#8b5cf6'],[90,90,6,'#0ea5e9'],[30,90,6,'#8b5cf6'],
      [60,20,5,'#f97316'],[60,100,5,'#22c55e'],[10,15,4,'#f97316'],[110,15,4,'#22c55e'],
      [110,105,4,'#ef4444'],[10,105,4,'#a78bfa']].map(([cx,cy,r,c],i) => (
      <g key={i}>
        <circle cx={cx} cy={cy} r={r*1.8} fill={c} opacity="0.1"/>
        <circle cx={cx} cy={cy} r={r} fill="url(#mol-g)" style={{color:c}}/>
        <circle cx={cx-r*0.3} cy={cy-r*0.3} r={r*0.35} fill="white" opacity="0.5"/>
      </g>
    ))}
  </svg>
)

const PillSVG = ({ color = '#8b5cf6', size = 70 }) => (
  <svg width={size} height={size * 0.5} viewBox="0 0 140 70" fill="none">
    <defs>
      <linearGradient id="pill-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="white" stopOpacity="0.25"/>
        <stop offset="100%" stopColor="black" stopOpacity="0.15"/>
      </linearGradient>
    </defs>
    <rect x="35" y="5" width="70" height="60" rx="30" fill={color} opacity="0.25"/>
    <rect x="35" y="5" width="70" height="60" rx="30" fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.7"/>
    <line x1="70" y1="5" x2="70" y2="65" stroke={color} strokeWidth="1.5" strokeOpacity="0.5"/>
    <rect x="35" y="5" width="70" height="60" rx="30" fill="url(#pill-g)"/>
    {/* Shine */}
    <ellipse cx="55" cy="22" rx="12" ry="6" fill="white" opacity="0.2" transform="rotate(-20 55 22)"/>
  </svg>
)

const AtomSVG = ({ color = '#f97316', size = 65 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    {/* Electron orbits */}
    <ellipse cx="50" cy="50" rx="45" ry="18" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.4"/>
    <ellipse cx="50" cy="50" rx="45" ry="18" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" transform="rotate(60 50 50)"/>
    <ellipse cx="50" cy="50" rx="45" ry="18" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" transform="rotate(120 50 50)"/>
    {/* Nucleus */}
    <circle cx="50" cy="50" r="10" fill={color} opacity="0.8"/>
    <circle cx="50" cy="50" r="6" fill="white" opacity="0.4"/>
    {/* Electrons */}
    <circle cx="95" cy="50" r="4" fill={color} opacity="0.9"/>
    <circle cx="27" cy="19" r="4" fill={color} opacity="0.9"/>
    <circle cx="27" cy="81" r="4" fill={color} opacity="0.9"/>
  </svg>
)

const ProteinSVG = ({ color = '#22c55e', size = 80 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    {/* Alpha helix ribbon */}
    <path d="M20,80 C30,60 40,40 50,20 C60,40 70,60 80,80" fill="none" stroke={color} strokeWidth="3" strokeOpacity="0.5" strokeLinecap="round"/>
    <path d="M15,75 C25,55 35,35 50,15 C65,35 75,55 85,75" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="3 3"/>
    {/* Beta sheet arrows */}
    {[30,50,70].map((x,i) => (
      <g key={i}>
        <rect x={x-8} y={40+i*5} width="16" height="6" rx="2" fill={color} opacity="0.3"/>
        <polygon points={`${x+8},${43+i*5} ${x+14},${43+i*5} ${x+8},${40+i*5} ${x+8},${46+i*5}`} fill={color} opacity="0.5"/>
      </g>
    ))}
    {/* Residue dots */}
    {[[20,80],[35,55],[50,30],[65,55],[80,80]].map(([cx,cy],i) => (
      <circle key={i} cx={cx} cy={cy} r="4" fill={color} opacity="0.7"/>
    ))}
  </svg>
)

const FlaskSVG = ({ color = '#38bdf8', size = 55 }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 80 104" fill="none">
    <defs>
      <linearGradient id="flask-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
        <stop offset="100%" stopColor={color} stopOpacity="0.05"/>
      </linearGradient>
    </defs>
    {/* Flask body */}
    <path d="M28,8 L28,40 L8,80 C4,90 12,100 22,100 L58,100 C68,100 76,90 72,80 L52,40 L52,8 Z"
      fill="url(#flask-g)" stroke={color} strokeWidth="2" strokeOpacity="0.6"/>
    {/* Neck */}
    <rect x="24" y="4" width="32" height="8" rx="3" fill={color} opacity="0.2" stroke={color} strokeWidth="1.5" strokeOpacity="0.5"/>
    {/* Liquid */}
    <path d="M14,82 C10,92 18,98 22,98 L58,98 C62,98 70,92 66,82 Z" fill={color} opacity="0.25"/>
    {/* Bubbles */}
    {[[30,75,3],[45,68,2.5],[55,78,2]].map(([cx,cy,r],i) => (
      <circle key={i} cx={cx} cy={cy} r={r} fill={color} opacity="0.5"/>
    ))}
    {/* Shine */}
    <path d="M32,20 Q28,35 30,50" stroke="white" strokeWidth="2" strokeOpacity="0.3" strokeLinecap="round"/>
  </svg>
)

const FormulaTag = ({ formula, color = '#a78bfa' }) => (
  <div style={{
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 700,
    color,
    background: `${color}12`,
    border: `1px solid ${color}30`,
    borderRadius: 8,
    padding: '4px 10px',
    whiteSpace: 'nowrap',
    textShadow: `0 0 8px ${color}60`,
    backdropFilter: 'blur(4px)',
  }}>
    {formula}
  </div>
)

// ── Floating object definitions ───────────────────────────────
// Each has: x/y (% of viewport), z (depth 0-1), rotation, scale, speed
const FLOATING_OBJECTS = [
  // DNA helices
  { id: 'dna1',  type: 'dna',      x: 8,   y: 12,  z: 0.9, rot: -15, scale: 0.9, speedX: 0.008, speedY: 0.006, c1: '#0ea5e9', c2: '#8b5cf6' },
  { id: 'dna2',  type: 'dna',      x: 88,  y: 55,  z: 0.5, rot: 20,  scale: 0.6, speedX: -0.005, speedY: 0.009, c1: '#06b6d4', c2: '#a78bfa' },
  // Benzene rings
  { id: 'benz1', type: 'benzene',  x: 75,  y: 8,   z: 0.8, rot: 30,  scale: 0.85, speedX: -0.007, speedY: 0.005, color: '#0ea5e9' },
  { id: 'benz2', type: 'benzene',  x: 15,  y: 70,  z: 0.4, rot: -20, scale: 0.55, speedX: 0.006, speedY: -0.007, color: '#8b5cf6' },
  { id: 'benz3', type: 'benzene',  x: 92,  y: 85,  z: 0.7, rot: 45,  scale: 0.7,  speedX: -0.004, speedY: -0.006, color: '#06b6d4' },
  // Molecules
  { id: 'mol1',  type: 'molecule', x: 50,  y: 5,   z: 0.6, rot: 10,  scale: 0.75, speedX: 0.004, speedY: 0.008, color: '#06b6d4' },
  { id: 'mol2',  type: 'molecule', x: 3,   y: 45,  z: 0.3, rot: -30, scale: 0.45, speedX: 0.009, speedY: 0.004, color: '#a78bfa' },
  { id: 'mol3',  type: 'molecule', x: 82,  y: 30,  z: 0.85, rot: 15, scale: 0.9,  speedX: -0.006, speedY: 0.007, color: '#38bdf8' },
  // Atoms
  { id: 'atom1', type: 'atom',     x: 35,  y: 88,  z: 0.7, rot: 0,   scale: 0.8,  speedX: 0.005, speedY: -0.005, color: '#f97316' },
  { id: 'atom2', type: 'atom',     x: 65,  y: 75,  z: 0.4, rot: 45,  scale: 0.5,  speedX: -0.008, speedY: 0.006, color: '#22c55e' },
  { id: 'atom3', type: 'atom',     x: 20,  y: 25,  z: 0.55, rot: -10, scale: 0.65, speedX: 0.007, speedY: 0.005, color: '#ef4444' },
  // Proteins
  { id: 'prot1', type: 'protein',  x: 60,  y: 92,  z: 0.6, rot: 20,  scale: 0.7,  speedX: -0.005, speedY: -0.004, color: '#22c55e' },
  { id: 'prot2', type: 'protein',  x: 5,   y: 88,  z: 0.35, rot: -25, scale: 0.45, speedX: 0.006, speedY: -0.006, color: '#4ade80' },
  // Flasks
  { id: 'flask1',type: 'flask',    x: 45,  y: 60,  z: 0.25, rot: 10,  scale: 0.4,  speedX: -0.004, speedY: 0.005, color: '#38bdf8' },
  { id: 'flask2',type: 'flask',    x: 78,  y: 65,  z: 0.75, rot: -8,  scale: 0.8,  speedX: 0.006, speedY: -0.007, color: '#f97316' },
  // Pills
  { id: 'pill1', type: 'pill',     x: 25,  y: 50,  z: 0.5, rot: 30,  scale: 0.65, speedX: 0.007, speedY: 0.004, color: '#8b5cf6' },
  { id: 'pill2', type: 'pill',     x: 70,  y: 18,  z: 0.3, rot: -15, scale: 0.45, speedX: -0.005, speedY: 0.008, color: '#a78bfa' },
  // Formula tags
  { id: 'form1', type: 'formula',  x: 12,  y: 35,  z: 0.45, rot: -5,  scale: 1,    speedX: 0.004, speedY: 0.006, formula: 'C₆H₆',    color: '#0ea5e9' },
  { id: 'form2', type: 'formula',  x: 55,  y: 82,  z: 0.6,  rot: 8,   scale: 1,    speedX: -0.006, speedY: -0.004, formula: 'C₉H₈O₄', color: '#8b5cf6' },
  { id: 'form3', type: 'formula',  x: 85,  y: 42,  z: 0.35, rot: -12, scale: 1,    speedX: 0.005, speedY: 0.007, formula: 'NH₃',     color: '#22c55e' },
  { id: 'form4', type: 'formula',  x: 38,  y: 15,  z: 0.7,  rot: 5,   scale: 1,    speedX: -0.007, speedY: 0.005, formula: 'C₂H₅OH', color: '#f97316' },
]

// ── Single floating object ────────────────────────────────────
function FloatingObject({ obj, mouseX, mouseY }) {
  // Parallax: deeper objects move less with mouse
  const parallaxStrength = obj.z * 18
  const px = (mouseX - 0.5) * parallaxStrength
  const py = (mouseY - 0.5) * parallaxStrength

  // Opacity based on depth
  const opacity = 0.08 + obj.z * 0.18

  // Size based on depth
  const baseSize = 60 + obj.z * 50

  const renderContent = () => {
    const s = baseSize * obj.scale
    switch (obj.type) {
      case 'dna':      return <DNAHelixSVG  color1={obj.c1} color2={obj.c2} size={s * 0.6} />
      case 'benzene':  return <BenzeneRingSVG color={obj.color} size={s} />
      case 'molecule': return <MoleculeSVG   color={obj.color} size={s} />
      case 'atom':     return <AtomSVG       color={obj.color} size={s} />
      case 'protein':  return <ProteinSVG    color={obj.color} size={s} />
      case 'flask':    return <FlaskSVG      color={obj.color} size={s * 0.8} />
      case 'pill':     return <PillSVG       color={obj.color} size={s} />
      case 'formula':  return <FormulaTag    formula={obj.formula} color={obj.color} />
      default:         return null
    }
  }

  return (
    <motion.div
      style={{
        position: 'fixed',
        left: `${obj.x}%`,
        top:  `${obj.y}%`,
        zIndex: 0,
        pointerEvents: 'none',
        opacity,
        x: px,
        y: py,
      }}
      animate={{
        y: [py - 12, py + 12, py - 12],
        rotate: [obj.rot - 6, obj.rot + 6, obj.rot - 6],
        scale: [obj.scale * 0.97, obj.scale * 1.03, obj.scale * 0.97],
      }}
      transition={{
        duration: 5 + obj.z * 4,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: Math.random() * 3,
      }}
    >
      <div style={{
        transform: `perspective(600px) rotateX(${(mouseY - 0.5) * obj.z * 12}deg) rotateY(${(mouseX - 0.5) * obj.z * -12}deg)`,
        transition: 'transform 0.3s ease',
        filter: `drop-shadow(0 ${4 + obj.z * 8}px ${8 + obj.z * 16}px rgba(14,165,233,${0.1 + obj.z * 0.15}))`,
      }}>
        {renderContent()}
      </div>
    </motion.div>
  )
}

// ── Canvas particle field (kept from before) ──────────────────
function ParticleCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, t = 0
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const PARTICLES = Array.from({ length: 80 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0002,
      vy: (Math.random() - 0.5) * 0.0002,
      r: 0.8 + Math.random() * 1.8,
      alpha: 0.06 + Math.random() * 0.14,
      color: ['#0ea5e9','#06b6d4','#8b5cf6','#a78bfa','#38bdf8'][Math.floor(Math.random()*5)],
    }))

    // Connection lines between nearby particles
    const draw = () => {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      PARTICLES.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.round(p.alpha * 255).toString(16).padStart(2,'0')
        ctx.fill()
      })
      // Draw connections
      for (let i = 0; i < PARTICLES.length; i++) {
        for (let j = i + 1; j < PARTICLES.length; j++) {
          const dx = (PARTICLES[i].x - PARTICLES[j].x) * W
          const dy = (PARTICLES[i].y - PARTICLES[j].y) * H
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(PARTICLES[i].x * W, PARTICLES[i].y * H)
            ctx.lineTo(PARTICLES[j].x * W, PARTICLES[j].y * H)
            ctx.strokeStyle = `rgba(14,165,233,${0.04 * (1 - dist/120)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
      t++
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden="true" />
}

// ── Main export ───────────────────────────────────────────────
export default function MoleculeBackground() {
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 })

  const onMove = useCallback((e) => {
    setMouse({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [onMove])

  return (
    <>
      {/* Particle + connection canvas */}
      <ParticleCanvas />

      {/* 3D floating SVG objects */}
      {FLOATING_OBJECTS.map(obj => (
        <FloatingObject key={obj.id} obj={obj} mouseX={mouse.x} mouseY={mouse.y} />
      ))}
    </>
  )
}
