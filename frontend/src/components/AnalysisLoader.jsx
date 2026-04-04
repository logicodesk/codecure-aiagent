// AnalysisLoader.jsx — Full-screen cinematic analysis loading experience
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

const STEPS = [
  'Parsing molecular structure…',
  'Computing 1777 RDKit descriptors…',
  'Extracting Morgan fingerprints…',
  'Running ensemble ML models…',
  'Computing SHAP explanations…',
  'Generating AI insight…',
]

// DNA helix
function DNAHelix() {
  const group = useRef()
  const strand1 = useRef()
  const strand2 = useRef()

  const helixPoints = (offset) => {
    const pts = []
    for (let i = 0; i < 80; i++) {
      const t = (i / 80) * Math.PI * 4
      pts.push(new THREE.Vector3(
        Math.cos(t + offset) * 0.8,
        (i / 80) * 6 - 3,
        Math.sin(t + offset) * 0.8,
      ))
    }
    return pts
  }

  const rungs = []
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 4
    const y = (i / 12) * 6 - 3
    rungs.push({
      start: new THREE.Vector3(Math.cos(t) * 0.8, y, Math.sin(t) * 0.8),
      end:   new THREE.Vector3(Math.cos(t + Math.PI) * 0.8, y, Math.sin(t + Math.PI) * 0.8),
    })
  }

  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.rotation.y = clock.elapsedTime * 0.5
  })

  return (
    <group ref={group}>
      {/* Strand 1 */}
      {helixPoints(0).map((pt, i, arr) => i < arr.length - 1 && (
        <mesh key={`s1-${i}`} position={[
          (pt.x + arr[i+1].x) / 2,
          (pt.y + arr[i+1].y) / 2,
          (pt.z + arr[i+1].z) / 2,
        ]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshBasicMaterial color="#0ea5e9" />
        </mesh>
      ))}
      {/* Strand 2 */}
      {helixPoints(Math.PI).map((pt, i, arr) => i < arr.length - 1 && (
        <mesh key={`s2-${i}`} position={[
          (pt.x + arr[i+1].x) / 2,
          (pt.y + arr[i+1].y) / 2,
          (pt.z + arr[i+1].z) / 2,
        ]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshBasicMaterial color="#8b5cf6" />
        </mesh>
      ))}
      {/* Rungs */}
      {rungs.map((r, i) => (
        <mesh key={`r-${i}`} position={[
          (r.start.x + r.end.x) / 2,
          (r.start.y + r.end.y) / 2,
          (r.start.z + r.end.z) / 2,
        ]}>
          <boxGeometry args={[r.start.distanceTo(r.end), 0.04, 0.04]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  )
}

export default function AnalysisLoader({ visible, smiles }) {
  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!visible) { setStep(0); setProgress(0); return }
    const interval = setInterval(() => {
      setStep(s => Math.min(s + 1, STEPS.length - 1))
      setProgress(p => Math.min(p + 100 / STEPS.length, 100))
    }, 420)
    return () => clearInterval(interval)
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(5,7,15,0.97)', backdropFilter: 'blur(20px)' }}
        >
          {/* DNA helix canvas */}
          <div style={{ width: 200, height: 280 }}>
            <Canvas camera={{ position: [0, 0, 4], fov: 50 }} gl={{ alpha: true }}
                    style={{ background: 'transparent' }}>
              <ambientLight intensity={0.5} />
              <pointLight position={[2, 2, 2]} color="#0ea5e9" intensity={3} />
              <pointLight position={[-2, -2, 2]} color="#8b5cf6" intensity={2} />
              <DNAHelix />
            </Canvas>
          </div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-black mt-4 mb-2"
            style={{ color: '#f1f5f9' }}
          >
            Analyzing Molecular Structure
          </motion.h2>

          {/* SMILES display */}
          {smiles && (
            <p className="text-xs font-mono mb-6 px-4 py-1.5 rounded-full"
               style={{
                 background: 'rgba(14,165,233,0.08)',
                 border: '1px solid rgba(14,165,233,0.2)',
                 color: '#38bdf8',
                 maxWidth: 360,
                 overflow: 'hidden',
                 textOverflow: 'ellipsis',
                 whiteSpace: 'nowrap',
               }}>
              {smiles}
            </p>
          )}

          {/* Progress bar */}
          <div className="w-72 h-1.5 rounded-full mb-4"
               style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{ background: 'linear-gradient(90deg, #0ea5e9, #06b6d4, #8b5cf6)' }}
            />
          </div>

          {/* Step text */}
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-sm"
              style={{ color: 'rgba(148,163,184,0.7)' }}
            >
              {STEPS[step]}
            </motion.p>
          </AnimatePresence>

          {/* Particle swirl */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full"
                style={{
                  background: ['#0ea5e9','#8b5cf6','#22c55e'][i % 3],
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  x: [0, (Math.random() - 0.5) * 120],
                  y: [0, (Math.random() - 0.5) * 120],
                  opacity: [0, 0.8, 0],
                  scale: [0, 1.5, 0],
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
