// MoleculeHero3D.jsx — 3D rotating molecule for hero section
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, Line, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

// Atom positions for a stylized benzene-like molecule
const ATOMS = [
  { pos: [0, 0, 0],      r: 0.38, color: '#38bdf8' },   // center
  { pos: [1.4, 0, 0],    r: 0.28, color: '#0ea5e9' },
  { pos: [0.7, 1.2, 0],  r: 0.28, color: '#8b5cf6' },
  { pos: [-0.7, 1.2, 0], r: 0.28, color: '#06b6d4' },
  { pos: [-1.4, 0, 0],   r: 0.28, color: '#a78bfa' },
  { pos: [-0.7,-1.2, 0], r: 0.28, color: '#22c55e' },
  { pos: [0.7, -1.2, 0], r: 0.28, color: '#0ea5e9' },
  // Extra atoms for depth
  { pos: [0, 0, 1.6],    r: 0.22, color: '#38bdf8' },
  { pos: [0, 0, -1.6],   r: 0.22, color: '#8b5cf6' },
  { pos: [1.2, 0.8, 0.8],r: 0.18, color: '#22c55e' },
  { pos: [-1.2, 0.8,-0.8],r:0.18, color: '#a78bfa' },
]

const BONDS = [
  [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],
  [1,2],[2,3],[3,4],[4,5],[5,6],[6,1],
  [0,7],[0,8],[1,9],[3,10],
]

function Atom({ position, radius, color }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.2 + position[0]) * 0.06
  })
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[radius, 20, 20]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        roughness={0.2}
        metalness={0.5}
      />
    </mesh>
  )
}

function Bond({ start, end }) {
  const points = useMemo(() => [
    new THREE.Vector3(...start),
    new THREE.Vector3(...end),
  ], [start, end])
  return (
    <Line
      points={points}
      color="#38bdf8"
      lineWidth={1.2}
      transparent
      opacity={0.35}
    />
  )
}

function CoreGlow() {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const s = 1 + Math.sin(clock.elapsedTime * 1.5) * 0.08
    ref.current.scale.set(s, s, s)
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.55, 32, 32]} />
      <MeshDistortMaterial
        color="#0ea5e9"
        emissive="#0ea5e9"
        emissiveIntensity={0.8}
        distort={0.35}
        speed={2}
        transparent
        opacity={0.55}
      />
    </mesh>
  )
}

function Scene() {
  const group = useRef()
  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.rotation.y = clock.elapsedTime * 0.28
    group.current.rotation.x = Math.sin(clock.elapsedTime * 0.18) * 0.22
  })

  return (
    <group ref={group}>
      <CoreGlow />
      {ATOMS.map((a, i) => (
        <Atom key={i} position={a.pos} radius={a.r} color={a.color} />
      ))}
      {BONDS.map(([a, b], i) => (
        <Bond key={i} start={ATOMS[a].pos} end={ATOMS[b].pos} />
      ))}
    </group>
  )
}

export default function MoleculeHero3D({ size = 420 }) {
  return (
    <div style={{ width: size, height: size }} className="relative">
      {/* Glow backdrop */}
      <div className="absolute inset-0 rounded-full"
           style={{
             background: 'radial-gradient(circle, rgba(14,165,233,0.18) 0%, rgba(139,92,246,0.12) 50%, transparent 70%)',
             filter: 'blur(24px)',
           }} />
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[4, 4, 4]}  intensity={2.5} color="#0ea5e9" />
        <pointLight position={[-4, -4, 2]} intensity={1.8} color="#8b5cf6" />
        <pointLight position={[0, 0, -4]} intensity={1.2} color="#22c55e" />
        <Scene />
      </Canvas>
    </div>
  )
}
