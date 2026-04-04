// ParticleBackground.jsx — Three.js galaxy particle field with mouse interaction
import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

function Particles({ count = 2200, mouse }) {
  const mesh = useRef()
  const { size } = useThree()

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const palette = [
      new THREE.Color('#0ea5e9'),
      new THREE.Color('#8b5cf6'),
      new THREE.Color('#06b6d4'),
      new THREE.Color('#22c55e'),
      new THREE.Color('#a78bfa'),
    ]
    for (let i = 0; i < count; i++) {
      // Spiral galaxy distribution
      const angle = Math.random() * Math.PI * 2
      const radius = Math.pow(Math.random(), 0.5) * 18
      const arm = Math.floor(Math.random() * 3) * (Math.PI * 2 / 3)
      const spiral = angle + arm + radius * 0.3
      pos[i * 3]     = Math.cos(spiral) * radius + (Math.random() - 0.5) * 3
      pos[i * 3 + 1] = (Math.random() - 0.5) * 6
      pos[i * 3 + 2] = Math.sin(spiral) * radius + (Math.random() - 0.5) * 3
      const c = palette[Math.floor(Math.random() * palette.length)]
      col[i * 3]     = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    return [pos, col]
  }, [count])

  useFrame((state) => {
    if (!mesh.current) return
    const t = state.clock.elapsedTime
    mesh.current.rotation.y = t * 0.04
    mesh.current.rotation.x = Math.sin(t * 0.02) * 0.08

    // Mouse parallax
    if (mouse.current) {
      mesh.current.rotation.y += mouse.current.x * 0.0003
      mesh.current.rotation.x += mouse.current.y * 0.0002
    }
  })

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        vertexColors
        transparent
        opacity={0.75}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

function NebulaRing() {
  const ref = useRef()
  const geo = useMemo(() => {
    const g = new THREE.TorusGeometry(8, 0.04, 8, 120)
    return g
  }, [])

  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.x = clock.elapsedTime * 0.06
    ref.current.rotation.z = clock.elapsedTime * 0.03
  })

  return (
    <mesh ref={ref} geometry={geo}>
      <meshBasicMaterial color="#0ea5e9" transparent opacity={0.12} />
    </mesh>
  )
}

export default function ParticleBackground() {
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handler = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth  - 0.5) * 2
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 14], fov: 65 }}
        gl={{ antialias: false, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.3} />
        <Particles mouse={mouse} />
        <NebulaRing />
      </Canvas>
    </div>
  )
}
