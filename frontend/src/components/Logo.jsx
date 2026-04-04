import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { useRef } from 'react'
import { APP_VERSION } from '../brand'

const ICON_SIZE = { sm: 36, md: 48, lg: 72 }

// 3D shield icon — layered SVG with depth, specular highlight, and shadow
function Shield3D({ size, c1, c2, c3 }) {
  const s = size
  const id = `sh3d-${s}`

  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
         width={s} height={s}
         style={{ filter: `drop-shadow(0 ${s * 0.08}px ${s * 0.18}px ${c3}55) drop-shadow(0 2px 6px rgba(0,0,0,0.5))` }}>
      <defs>
        {/* Main gradient */}
        <linearGradient id={`${id}-g1`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor={c1}/>
          <stop offset="50%"  stopColor={c2}/>
          <stop offset="100%" stopColor={c3}/>
        </linearGradient>
        {/* 3D face gradient — lighter top-left */}
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%"   stopColor={c1} stopOpacity="0.95"/>
          <stop offset="40%"  stopColor={c2} stopOpacity="0.75"/>
          <stop offset="100%" stopColor={c3} stopOpacity="0.55"/>
        </linearGradient>
        {/* Specular highlight */}
        <linearGradient id={`${id}-spec`} x1="0.2" y1="0" x2="0.5" y2="0.5">
          <stop offset="0%"   stopColor="white" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </linearGradient>
        {/* Bottom shadow */}
        <linearGradient id={`${id}-shadow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
        </linearGradient>
        {/* Glow filter */}
        <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {/* Atom glow */}
        <filter id={`${id}-ag`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ── 3D depth layer (offset shadow) ── */}
      <path d="M32 6 L55 15 L55 36 C55 48 44 57 32 61 C20 57 9 48 9 36 L9 15 Z"
            fill={c3} opacity="0.25" transform="translate(2, 3)"/>

      {/* ── Shield body fill ── */}
      <path d="M32 4 L54 13 L54 34 C54 46 44 56 32 60 C20 56 10 46 10 34 L10 13 Z"
            fill={`url(#${id}-face)`}/>

      {/* ── Shadow overlay ── */}
      <path d="M32 4 L54 13 L54 34 C54 46 44 56 32 60 C20 56 10 46 10 34 L10 13 Z"
            fill={`url(#${id}-shadow)`} opacity="0.3"/>

      {/* ── Outline ── */}
      <path d="M32 4 L54 13 L54 34 C54 46 44 56 32 60 C20 56 10 46 10 34 L10 13 Z"
            fill="none" stroke={`url(#${id}-g1)`} strokeWidth="1.5"/>

      {/* ── Specular highlight (top-left bevel) ── */}
      <path d="M32 4 L54 13 L54 34 C54 46 44 56 32 60 C20 56 10 46 10 34 L10 13 Z"
            fill={`url(#${id}-spec)`}/>

      {/* ── Inner bevel line ── */}
      <path d="M32 9 L50 17 L50 34 C50 44 42 52 32 56 C22 52 14 44 14 34 L14 17 Z"
            fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8"/>

      {/* ── Molecule: centre atom ── */}
      <circle cx="32" cy="32" r="5" fill={`url(#${id}-g1)`} filter={`url(#${id}-ag)`}/>
      <circle cx="32" cy="32" r="2.5" fill="white" opacity="0.6"/>

      {/* ── Outer atoms ── */}
      {[
        [20, 24, c2], [44, 24, c1], [20, 40, c3],
        [44, 40, c2], [32, 20, c1], [32, 44, c3],
      ].map(([cx, cy, col], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="3.5" fill={col} opacity="0.15"/>
          <circle cx={cx} cy={cy} r="2.5" fill={col} opacity="0.9"/>
          <circle cx={cx - 0.7} cy={cy - 0.7} r="0.8" fill="white" opacity="0.5"/>
        </g>
      ))}

      {/* ── Bonds ── */}
      {[
        [32,32,20,24,c2],[32,32,44,24,c1],[32,32,20,40,c3],
        [32,32,44,40,c2],[32,32,32,20,c1],[32,32,32,44,c3],
      ].map(([x1,y1,x2,y2,col], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={col} strokeWidth="1.4" opacity="0.65" strokeLinecap="round"/>
      ))}

      {/* ── Neural arc hints ── */}
      <path d="M20 24 Q32 14 44 24" fill="none" stroke={c1}
            strokeWidth="0.9" opacity="0.3" strokeDasharray="2 2"/>
      <path d="M20 40 Q32 50 44 40" fill="none" stroke={c3}
            strokeWidth="0.9" opacity="0.3" strokeDasharray="2 2"/>
    </svg>
  )
}

export default function Logo({ dark = false, size = 'md', showTagline = false, className = '' }) {
  const s       = ICON_SIZE[size] ?? ICON_SIZE.md
  const ref     = useRef(null)

  // Mouse-tracking 3D tilt for the icon
  const rotX = useMotionValue(0)
  const rotY = useMotionValue(0)
  const springX = useSpring(rotX, { stiffness: 300, damping: 25 })
  const springY = useSpring(rotY, { stiffness: 300, damping: 25 })

  const onMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width  - 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5
    rotX.set(-y * 22)
    rotY.set( x * 22)
  }
  const onLeave = () => { rotX.set(0); rotY.set(0) }

  // Text sizes — bigger than before
  const textSize = size === 'sm'
    ? 'text-xl'       // was text-base
    : size === 'lg'
    ? 'text-4xl'      // was text-3xl
    : 'text-2xl'      // was text-xl

  const tagSize  = size === 'lg' ? 'text-sm' : 'text-[11px]'

  const c1 = dark ? '#38bdf8' : '#0ea5e9'
  const c2 = dark ? '#22d3ee' : '#06b6d4'
  const c3 = dark ? '#a78bfa' : '#8b5cf6'
  const wordBase = dark ? '#f1f5f9' : '#0f172a'
  const tagColor = dark ? '#94a3b8' : '#64748b'

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* 3D icon with mouse tilt */}
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{
          width: s, height: s, flexShrink: 0,
          transformStyle: 'preserve-3d',
          rotateX: springX,
          rotateY: springY,
          perspective: 400,
        }}
        whileHover={{ scale: 1.12 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <Shield3D size={s} c1={c1} c2={c2} c3={c3} />
      </motion.div>

      {/* Wordmark */}
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline gap-2">
          <motion.span
            className={`font-extrabold tracking-tight ${textSize}`}
            style={{ color: wordBase }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            Tox
            <span 
              className="gradient-text ml-1"
              style={{ 
                backgroundImage: `linear-gradient(135deg, ${c1} 0%, ${c2} 45%, ${c3} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                color: 'transparent'
              }}
            >
              Scout AI
            </span>
          </motion.span>

          {/* Version badge */}
          <motion.span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full border leading-none"
            style={{
              color: tagColor,
              borderColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            }}
            whileHover={{ scale: 1.1 }}
          >
            {APP_VERSION}
          </motion.span>
        </div>

        {showTagline && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`${tagSize} mt-1`}
            style={{ color: tagColor }}
          >
            AI-powered molecular toxicity intelligence
          </motion.span>
        )}
      </div>
    </div>
  )
}
