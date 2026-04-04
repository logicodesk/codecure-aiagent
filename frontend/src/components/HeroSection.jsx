// HeroSection.jsx — Full-screen cinematic landing
import { useRef, useState, useEffect } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Zap, ChevronDown } from 'lucide-react'
import MoleculeHero3D from './MoleculeHero3D'

// Magnetic button hook
function useMagnetic(strength = 0.35) {
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 200, damping: 18 })
  const sy = useSpring(y, { stiffness: 200, damping: 18 })

  function onMove(e) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top  + rect.height / 2
    x.set((e.clientX - cx) * strength)
    y.set((e.clientY - cy) * strength)
  }
  function onLeave() { x.set(0); y.set(0) }

  return { ref, sx, sy, onMove, onLeave }
}

// Animated counter
function Counter({ target, duration = 1800, suffix = '' }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setVal(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    const id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [target, duration])
  return <>{val.toLocaleString()}{suffix}</>
}

const STATS = [
  { value: 12,   suffix: '',  label: 'Tox21 Targets' },
  { value: 1777, suffix: '+', label: 'ML Features' },
  { value: 99,   suffix: '%', label: 'Accuracy' },
  { value: 7831, suffix: '+', label: 'Compounds' },
]

export default function HeroSection({ onAnalyze }) {
  const mag = useMagnetic(0.4)
  const [burst, setBurst] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handler = (e) => setMousePos({
      x: (e.clientX / window.innerWidth  - 0.5) * 30,
      y: (e.clientY / window.innerHeight - 0.5) * 20,
    })
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  function handleCTA() {
    setBurst(true)
    setTimeout(() => { setBurst(false); onAnalyze?.() }, 600)
  }

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6">

      {/* Radial pulse rings */}
      {[1, 2, 3].map(i => (
        <motion.div
          key={i}
          className="absolute rounded-full border pointer-events-none"
          style={{
            width: 300 + i * 180,
            height: 300 + i * 180,
            borderColor: `rgba(14,165,233,${0.06 - i * 0.015})`,
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          animate={{ scale: [1, 1.04, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 }}
        />
      ))}

      {/* Main content grid */}
      <div className="relative z-10 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

        {/* Left — text */}
        <div className="space-y-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest"
            style={{
              background: 'rgba(14,165,233,0.08)',
              border: '1px solid rgba(14,165,233,0.25)',
              color: '#38bdf8',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Next-Gen Toxicology AI · Live
          </motion.div>

          {/* Title */}
          <div className="space-y-2">
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
              className="text-6xl lg:text-7xl font-black leading-none tracking-tight"
            >
              <span style={{ color: '#f1f5f9' }}>Tox</span>
              <span style={{
                background: 'linear-gradient(135deg, #0ea5e9, #06b6d4, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Scout AI</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="text-2xl lg:text-3xl font-light tracking-wide"
              style={{ color: 'rgba(148,163,184,0.85)' }}
            >
              Predict.{' '}
              <span style={{ color: '#38bdf8' }}>Analyze.</span>{' '}
              <span style={{ color: '#a78bfa' }}>Prevent.</span>
            </motion.p>
          </div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="text-base leading-relaxed max-w-lg"
            style={{ color: 'rgba(100,116,139,0.9)' }}
          >
            Research-grade molecular toxicity intelligence powered by ensemble ML,
            SHAP explainability, and 1777 RDKit features trained on the Tox21 dataset.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-4"
          >
            <motion.button
              ref={mag.ref}
              style={{ x: mag.sx, y: mag.sy }}
              onMouseMove={mag.onMove}
              onMouseLeave={mag.onLeave}
              onClick={handleCTA}
              whileTap={{ scale: 0.95 }}
              className="relative overflow-hidden px-8 py-4 rounded-2xl text-base font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #0ea5e9, #06b6d4, #8b5cf6)',
                boxShadow: '0 0 32px rgba(14,165,233,0.4), 0 4px 24px rgba(139,92,246,0.3)',
              }}
            >
              {/* Burst effect */}
              {burst && (
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  initial={{ scale: 0, opacity: 0.8 }}
                  animate={{ scale: 3, opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4), transparent)' }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <Zap size={16} />
                Analyze Compound
              </span>
            </motion.button>

            <motion.button
              whileHover={{ x: 4 }}
              onClick={onAnalyze}
              className="text-sm font-medium flex items-center gap-1.5 transition-colors"
              style={{ color: 'rgba(100,116,139,0.7)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#38bdf8'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(100,116,139,0.7)'}
            >
              View examples →
            </motion.button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
            className="grid grid-cols-4 gap-4 pt-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 + i * 0.1 }}
                className="text-center"
              >
                <p className="text-xl font-black" style={{ color: '#38bdf8' }}>
                  <Counter target={s.value} suffix={s.suffix} duration={1600 + i * 200} />
                </p>
                <p className="text-[10px] uppercase tracking-wider mt-0.5"
                   style={{ color: 'rgba(100,116,139,0.6)' }}>
                  {s.label}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Right — 3D molecule */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotateY: -20 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ delay: 0.4, duration: 1.2, ease: [0.23, 1, 0.32, 1] }}
          className="flex justify-center items-center"
          style={{
            transform: `perspective(1000px) rotateX(${mousePos.y * 0.02}deg) rotateY(${mousePos.x * 0.02}deg)`,
            transition: 'transform 0.1s ease-out',
          }}
        >
          <MoleculeHero3D size={420} />
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        style={{ color: 'rgba(100,116,139,0.5)' }}
      >
        <span className="text-[10px] uppercase tracking-widest">Scroll to explore</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ChevronDown size={16} />
        </motion.div>
      </motion.div>
    </section>
  )
}
