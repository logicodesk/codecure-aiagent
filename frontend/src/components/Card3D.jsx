import { useRef, useCallback } from 'react'

/**
 * Wraps children in a 3D tilt card that responds to mouse position.
 * Subtle — max 8° tilt so it doesn't feel gimmicky.
 */
export default function Card3D({ children, className = '', style = {}, maxTilt = 6 }) {
  const ref = useRef(null)

  const onMove = useCallback((e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width  - 0.5   // -0.5 to 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5
    const rotX = -y * maxTilt
    const rotY =  x * maxTilt
    el.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(4px)`
    el.style.boxShadow = `
      ${-rotY * 2}px ${rotX * 2}px 30px rgba(0,0,0,0.3),
      0 0 0 1px rgba(14,165,233,${0.05 + Math.abs(x + y) * 0.1})
    `
  }, [maxTilt])

  const onLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)'
    el.style.boxShadow = ''
    el.style.transition = 'transform 0.4s ease, box-shadow 0.4s ease'
    setTimeout(() => { if (el) el.style.transition = '' }, 400)
  }, [])

  return (
    <div
      ref={ref}
      className={`card-3d ${className}`}
      style={{ transformStyle: 'preserve-3d', willChange: 'transform', ...style }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </div>
  )
}
