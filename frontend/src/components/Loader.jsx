import { motion } from 'framer-motion'
import { APP_NAME, TAGLINE } from '../brand'

const STEPS = [
  { label: 'Parsing molecular structure',    icon: '🧬' },
  { label: 'Computing RDKit descriptors',    icon: '⚗️' },
  { label: 'Extracting Morgan fingerprints', icon: '🔬' },
  { label: 'Running ensemble models',        icon: '🤖' },
  { label: 'Generating AI insight',          icon: '✨' },
]

function SkeletonBlock({ h = 'h-4', w = 'w-full', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className={`${h} ${w} rounded-lg shimmer`}
    />
  )
}

export default function Loader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="glass p-6 space-y-6"
    >
      {/* Brand + spinner */}
      <div className="flex items-center gap-4">
        {/* Concentric spinner rings */}
        <div className="relative w-12 h-12 flex-shrink-0">
          {/* Outer ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              border: '2px solid transparent',
              borderTopColor: '#0ea5e9',
              borderRightColor: 'rgba(14,165,233,0.3)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          />
          {/* Middle ring */}
          <motion.div
            className="absolute inset-2 rounded-full"
            style={{
              border: '2px solid transparent',
              borderTopColor: '#06b6d4',
              borderLeftColor: 'rgba(6,182,212,0.3)',
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          />
          {/* Inner dot */}
          <motion.div
            className="absolute inset-4 rounded-full"
            style={{ background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)' }}
            animate={{ scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>

        <div>
          <p className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>
            {APP_NAME} <span style={{ color: '#38bdf8' }}>is analyzing</span>
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(100,116,139,0.7)' }}>
            {TAGLINE}
          </p>
          <div className="flex gap-1 mt-2">
            {[0, 1, 2, 3].map(i => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)' }}
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Step list with shimmer */}
      <div className="space-y-2">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.label}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.38 }}
            className="flex items-center gap-3 rounded-xl px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <motion.span
              className="text-sm"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.5, delay: i * 0.38 }}
            >
              {step.icon}
            </motion.span>
            <span className="text-xs flex-1" style={{ color: 'rgba(148,163,184,0.7)' }}>
              {step.label}
            </span>
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#0ea5e9' }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.8, delay: i * 0.38, repeat: Infinity }}
            />
          </motion.div>
        ))}
      </div>

      {/* Shimmer progress bar */}
      <div className="h-1 rounded-full overflow-hidden"
           style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #0ea5e9, #06b6d4, #8b5cf6)' }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Skeleton preview of result card */}
      <div className="space-y-2 pt-1">
        <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(71,85,105,0.5)' }}>
          Preview loading…
        </p>
        <div className="rounded-xl p-3 space-y-2"
             style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-3">
            <SkeletonBlock h="h-10" w="w-10" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBlock h="h-4" w="w-24" delay={0.05} />
              <SkeletonBlock h="h-3" w="w-40" delay={0.1} />
            </div>
          </div>
          <SkeletonBlock h="h-2" delay={0.15} />
          <SkeletonBlock h="h-2" w="w-3/4" delay={0.2} />
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[0.25, 0.3, 0.35].map(d => <SkeletonBlock key={d} h="h-8" delay={d} />)}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
