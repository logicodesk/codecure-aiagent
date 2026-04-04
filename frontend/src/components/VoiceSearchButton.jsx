import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff } from 'lucide-react'
import { fuzzyCorrect, correctDrugName } from '../lib/smilesResolver'

// ── Sound wave bars (animated when listening) ─────────────────
function SoundWave({ active }) {
  const bars = [0.4, 0.8, 1, 0.7, 0.5]
  return (
    <div className="flex items-center gap-[2px]">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="w-[2px] rounded-full"
          style={{ background: '#38bdf8', originY: 0.5 }}
          animate={active
            ? { scaleY: [h, 1, h * 0.6, 1, h], opacity: [0.7, 1, 0.6, 1, 0.7] }
            : { scaleY: 0.3, opacity: 0.3 }
          }
          transition={active
            ? { duration: 0.8, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }
            : { duration: 0.2 }
          }
          initial={{ scaleY: h, height: 12 }}
        />
      ))}
    </div>
  )
}

// ── VoiceSearchButton ─────────────────────────────────────────
const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
  : null

export default function VoiceSearchButton({ onResult, onListeningChange, disabled = false }) {
  const [listening,  setListening]  = useState(false)
  const [supported,  setSupported]  = useState(true)
  const [tooltip,    setTooltip]    = useState(false)
  const recogRef = useRef(null)

  useEffect(() => {
    if (!SR) { setSupported(false); return }

    const r = new SR()
    r.lang = 'en-US'
    r.continuous = false
    r.interimResults = false
    r.maxAlternatives = 3

    r.onresult = (e) => {
      // Try alternatives for best drug name match
      const alternatives = Array.from(e.results[0]).map(a => a.transcript.trim())
      // Pick the one that resolves best
      let best = alternatives[0]
      for (const alt of alternatives) {
        const corrected = fuzzyCorrect(alt.toLowerCase().trim())
        if (corrected !== alt.toLowerCase().trim()) { best = alt; break }
      }
      const corrected = correctDrugName(best)
      onResult?.(corrected)

      // Optional voice feedback
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const utt = new SpeechSynthesisUtterance(`Searching ${corrected}`)
        utt.volume = 0.4
        utt.rate = 1.1
        window.speechSynthesis.speak(utt)
      }
    }

    r.onend = () => {
      setListening(false)
      onListeningChange?.(false)
    }

    r.onerror = (e) => {
      setListening(false)
      onListeningChange?.(false)
      // 'no-speech' is benign — user just didn't speak
      if (e.error !== 'no-speech') {
        onResult?.(null, e.error)
      }
    }

    recogRef.current = r
    return () => { try { r.abort() } catch (_) {} }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(() => {
    if (!supported || disabled) return
    if (listening) {
      try { recogRef.current?.stop() } catch (_) {}
      setListening(false)
      onListeningChange?.(false)
    } else {
      try {
        recogRef.current?.start()
        setListening(true)
        onListeningChange?.(true)
      } catch (e) {
        // Already started — abort and restart
        try { recogRef.current?.abort() } catch (_) {}
        setTimeout(() => {
          try { recogRef.current?.start(); setListening(true); onListeningChange?.(true) }
          catch (_) {}
        }, 150)
      }
    }
  }, [listening, supported, disabled, onListeningChange])

  if (!supported) {
    return (
      <div title="Voice search not supported in this browser"
           className="flex items-center justify-center w-7 h-7 rounded-lg opacity-30 cursor-not-allowed"
           style={{ color: 'rgba(100,116,139,0.5)' }}>
        <MicOff size={13} />
      </div>
    )
  }

  return (
    <div className="relative flex items-center">
      {/* Tooltip */}
      <AnimatePresence>
        {tooltip && !listening && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full mb-2 right-0 whitespace-nowrap
                       text-[10px] px-2 py-1 rounded-lg pointer-events-none z-50"
            style={{
              background: 'rgba(8,12,20,0.95)',
              border: '1px solid rgba(56,189,248,0.2)',
              color: '#94a3b8',
            }}
          >
            Click to speak
          </motion.div>
        )}
      </AnimatePresence>

      {/* Outer pulse ring when listening */}
      {listening && (
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none"
          animate={{ boxShadow: ['0 0 0 0px rgba(56,189,248,0.4)', '0 0 0 6px rgba(56,189,248,0)'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      <motion.button
        onClick={toggle}
        onMouseEnter={() => setTooltip(true)}
        onMouseLeave={() => setTooltip(false)}
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.08 }}
        title={listening ? 'Stop listening' : 'Click to speak'}
        aria-label={listening ? 'Stop voice search' : 'Start voice search'}
        className="relative flex items-center justify-center w-7 h-7 rounded-lg
                   transition-all duration-200 overflow-hidden"
        style={{
          background: listening
            ? 'rgba(56,189,248,0.15)'
            : 'rgba(255,255,255,0.04)',
          border: `1px solid ${listening ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: listening ? '0 0 12px rgba(56,189,248,0.25)' : 'none',
        }}
      >
        {listening ? (
          <SoundWave active />
        ) : (
          <Mic size={12} style={{ color: 'rgba(100,116,139,0.7)' }} />
        )}
      </motion.button>
    </div>
  )
}
